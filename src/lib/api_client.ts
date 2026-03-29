/**
 * Typisierter HTTP-Client fuer das FastAPI-Backend.
 *
 * Alle API-Aufrufe laufen ueber diesen Client.
 * Im Dev-Modus proxied Vite /api/* an localhost:8321.
 */

const API_BASE = "/api";

// ============================================================
// Response-Typen (spiegeln Backend-Antworten)
// ============================================================

export interface UploadResultat {
  status: string;
  filename: string;
  doc_type: string;
  semester?: string;
  stand?: string;
  klasse?: string;
  statistik?: {
    veranstaltungen: number;
    termine: number;
    module: number;
    varianten?: number;
  };
  dozenten_mappings?: {
    gesamt: number;
    neu_hinzugefuegt: number;
  };
  plan_eintraege?: number;
  hinweis?: string;
}

export interface TerminAPI {
  tag: string;
  start_zeit: string;
  end_zeit: string;
  raum: string | null;
  dozent_kuerzel: string | null;
  dozent_name: string | null;
  klassen: string[];
  gruppe: string | null;
  bemerkung: string | null;
}

export interface VeranstaltungAPI {
  typ: string;
  name: string;
  termine: TerminAPI[];
}

export interface ModulAPI {
  modul_nummer: string;
  name: string;
  veranstaltungen: VeranstaltungAPI[];
  studiengaenge: string[];
  dozenten: Record<string, string>;
  raeume: string[];
}

export interface ModulListeAPI {
  module: ModulAPI[];
  total: number;
  semester: string | null;
  stand: string | null;
}

// ============================================================
// API-Funktionen
// ============================================================

/** Health-Check des Backends. */
export async function api_health(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

/** Dokument analysieren (ohne Upload in DB) — gibt doc_type, studiengang, already_exists zurück. */
export async function api_detect_document(file: File): Promise<{
  doc_type: string;
  studiengang: string | null;
  already_exists: boolean;
}> {
  const form_data = new FormData();
  form_data.append("file", file);
  const res = await fetch(`${API_BASE}/pdf/detect`, { method: "POST", body: form_data });
  if (!res.ok) throw new Error("Detect fehlgeschlagen");
  return res.json();
}

/** PDF oder HTM hochladen. */
export async function api_upload_document(
  file: File,
): Promise<UploadResultat> {
  const form_data = new FormData();
  form_data.append("file", file);

  const res = await fetch(`${API_BASE}/pdf/upload`, {
    method: "POST",
    body: form_data,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Upload fehlgeschlagen");
  }

  return res.json();
}

/** Prüft ob irgendwelche Daten in der DB existieren (Veranstaltungen, Modulhandbuch, FPO). */
export async function api_has_any_data(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/modules/info`);
    if (!res.ok) return false;
    const data = await res.json();
    const s = data.statistik || {};
    return (s.veranstaltungen || 0) > 0 || (s.modulhandbuch || 0) > 0 || (s.fpo || 0) > 0;
  } catch {
    return false;
  }
}

/** Alle Module laden (mit optionalen Filtern). */
export async function api_get_modules(filter?: {
  studiengang?: string;
  semester?: number;
  suche?: string;
}): Promise<ModulListeAPI> {
  const params = new URLSearchParams();
  if (filter?.studiengang) params.set("studiengang", filter.studiengang);
  if (filter?.semester) params.set("semester", String(filter.semester));
  if (filter?.suche) params.set("suche", filter.suche);

  const query = params.toString();
  const url = `${API_BASE}/modules/${query ? "?" + query : ""}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { module: [], total: 0, semester: null, stand: null };
    return res.json();
  } catch {
    // Backend nicht erreichbar — leere Liste zurueckgeben
    return { module: [], total: 0, semester: null, stand: null };
  }
}

/** Einzelnes Modul mit Details laden. */
export async function api_get_module(
  modul_nummer: string,
): Promise<ModulAPI> {
  const res = await fetch(`${API_BASE}/modules/${modul_nummer}`);
  return res.json();
}

// ============================================================
// Modulhandbuch-API
// ============================================================

export interface ModulhandbuchModul {
  id: number;
  studiengang: string | null;
  name: string;
  kuerzel: string | null;
  niveau: string | null;
  studiensemester: string | null;
  modulverantwortlicher: string | null;
  sprache: string | null;
  zuordnung: string | null;
  sws: {
    vorlesung: number | null;
    uebung: number | null;
    praktikum: number | null;
    seminar: number | null;
    su: number | null;
  };
  arbeitsaufwand: string | null;
  credit_points: number | null; // kann 2.5, 5, 7.5, 15 sein
  pvl: string | null;
  empfohlene_voraussetzungen: string | null;
  lernziele: string | null;
  inhalt: string | null;
  pruefungsformen: string | null;
}

/** Alle Module aus dem Modulhandbuch laden (optional nach Studiengang gefiltert). */
export async function api_get_modulhandbuch(studiengang?: string): Promise<{
  module: ModulhandbuchModul[];
  total: number;
}> {
  try {
    const params = studiengang ? `?studiengang=${encodeURIComponent(studiengang)}` : "";
    const res = await fetch(`${API_BASE}/modulhandbuch/${params}`);
    if (!res.ok) return { module: [], total: 0 };
    return res.json();
  } catch {
    return { module: [], total: 0 };
  }
}

/** Liste aller vorhandenen Studiengaenge im Modulhandbuch. */
export async function api_get_modulhandbuch_studiengaenge(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/modulhandbuch/studiengaenge`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.studiengaenge || [];
  } catch {
    return [];
  }
}

// ============================================================
// FPO-API
// ============================================================

export interface FpoModulAPI {
  pruefungsnummer: string;
  name: string;
  cp: number | null;
  pvl: string | null;
  pruefungsereignis: string | null;
  pruefungsform: string | null;
  semester: number | null;
  kategorie: string | null;
}

export interface FpoPlanAPI {
  variante: string;
  pflichtmodule: FpoModulAPI[];
  wahlpflichtmodule: FpoModulAPI[];
}

/** FPO-Pruefungsplaene laden (optional nach Studiengang gefiltert). */
export async function api_get_fpo(studiengang?: string): Promise<{ plaene: FpoPlanAPI[] }> {
  try {
    const params = studiengang ? `?studiengang=${encodeURIComponent(studiengang)}` : "";
    const res = await fetch(`${API_BASE}/fpo/${params}`);
    if (!res.ok) return { plaene: [] };
    return res.json();
  } catch {
    return { plaene: [] };
  }
}

/** Liste aller vorhandenen Studiengaenge in der FPO. */
export async function api_get_fpo_studiengaenge(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/fpo/studiengaenge`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.studiengaenge || [];
  } catch {
    return [];
  }
}

// ============================================================
// Studienverlauf-API
// ============================================================

export interface StudienverlaufModulAPI {
  id: number;
  name: string;
  semester: number;
  hat_pvl: boolean;
}

export interface StudienverlaufPlanAPI {
  plan_name: string;
  studiengang: string | null;
  anzahl_semester: number;
  module: StudienverlaufModulAPI[];
}

export async function api_get_studienverlauf(): Promise<{ plaene: StudienverlaufPlanAPI[] }> {
  try {
    const res = await fetch(`${API_BASE}/studienverlauf/`);
    if (!res.ok) return { plaene: [] };
    return res.json();
  } catch {
    return { plaene: [] };
  }
}

export async function api_add_studienverlauf_modul(plan_name: string, name: string, semester: number): Promise<StudienverlaufModulAPI> {
  const res = await fetch(`${API_BASE}/studienverlauf/modul`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_name, name, semester }),
  });
  return res.json();
}

export async function api_update_studienverlauf_modul(id: number, update: { name?: string; semester?: number }): Promise<void> {
  await fetch(`${API_BASE}/studienverlauf/modul/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
}

export async function api_delete_studienverlauf_modul(id: number): Promise<void> {
  await fetch(`${API_BASE}/studienverlauf/modul/${id}`, { method: "DELETE" });
}

export async function api_delete_studienverlauf_plan(plan_name: string): Promise<void> {
  await fetch(`${API_BASE}/studienverlauf/${encodeURIComponent(plan_name)}`, { method: "DELETE" });
}

/** Datenbank komplett leeren. */
export async function api_reset_database(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/modules/reset`, { method: "DELETE" });
  return res.json();
}

export interface ResetInfoAPI {
  veranstaltungen: number;
  wochenplan: number;
  modulhandbuch: { studiengang: string; anzahl: number }[];
  fpo: { studiengang: string; anzahl: number }[];
  studienverlauf: { plan_name: string; anzahl: number }[];
}

/** Übersicht über vorhandene Daten für den Reset-Dialog. */
export async function api_get_reset_info(): Promise<ResetInfoAPI> {
  const res = await fetch(`${API_BASE}/modules/reset-info`);
  return res.json();
}

export interface SelectiveResetPayload {
  veranstaltungen?: boolean;
  wochenplan?: boolean;
  modulhandbuch_studiengaenge?: string[];
  fpo_studiengaenge?: string[];
  studienverlauf_plaene?: string[];
}

/** Gezielt Datenkategorien löschen. */
export async function api_reset_selective(payload: SelectiveResetPayload): Promise<void> {
  await fetch(`${API_BASE}/modules/reset-selective`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ============================================================
// Schedule-API (Wochenplan-Persistenz)
// ============================================================

export interface PlanEintragAPI {
  id: number;
  modul_nummer: string;
  veranstaltungs_typ: string;
  display_name: string;
  tag: string;
  start_zeit: string;
  end_zeit: string;
  slot: number;
  raum: string | null;
  dozent: string | null;
  gruppe: string | null;
  farbe: string;
  notizen: string | null;
}

/** Alle Wochenplan-Eintraege laden. */
export async function api_get_schedule(): Promise<PlanEintragAPI[]> {
  try {
    const res = await fetch(`${API_BASE}/schedule/`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.eintraege || [];
  } catch {
    return [];
  }
}

/** Neuen Wochenplan-Eintrag erstellen. */
export async function api_create_schedule_entry(entry: {
  modul_nummer: string;
  veranstaltungs_typ: string;
  display_name: string;
  tag: string;
  start_zeit: string;
  end_zeit: string;
  slot: number;
  raum: string | null;
  dozent: string | null;
  gruppe: string | null;
}): Promise<PlanEintragAPI> {
  const res = await fetch(`${API_BASE}/schedule/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  return res.json();
}

/** Wochenplan-Eintrag loeschen. */
export async function api_delete_schedule_entry(id: number): Promise<void> {
  await fetch(`${API_BASE}/schedule/${id}`, { method: "DELETE" });
}

/** Alle Wochenplan-Eintraege loeschen. */
export async function api_clear_schedule(): Promise<void> {
  await fetch(`${API_BASE}/schedule/`, { method: "DELETE" });
}
