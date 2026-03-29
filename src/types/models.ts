/**
 * Zentrale TypeScript-Interfaces fuer den Studienorganisator.
 *
 * Diese Interfaces bilden das Datenmodell ab, das aus den vier
 * Datenquellen der THGA extrahiert wird:
 * - Veranstaltungsliste (PDF, Untis 2023)
 * - Wochenplan (HTM, Untis 2023)
 * - Fachpruefungsordnung (PDF)
 * - Modulhandbuch (PDF)
 */

// ============================================================
// Veranstaltungstypen (aus Untis / FPO)
// ============================================================

/** Typ der Lehrveranstaltung */
export type VeranstaltungsTyp = "V" | "Ü" | "P" | "S" | "SU" | "FM";

/** Lesbarer Name pro Veranstaltungstyp */
export const veranstaltungs_typ_label: Record<VeranstaltungsTyp, string> = {
  V: "Vorlesung",
  Ü: "Übung",
  P: "Praktikum",
  S: "Seminar",
  SU: "Sem. Unterricht",
  FM: "Forschungsmodul",
};

// ============================================================
// Wochentage (THGA-Raster: Mo-Sa)
// ============================================================

export type Wochentag = "Mo" | "Di" | "Mi" | "Do" | "Fr" | "Sa";

export const wochentag_lang: Record<string, Wochentag> = {
  Montag: "Mo",
  Dienstag: "Di",
  Mittwoch: "Mi",
  Donnerstag: "Do",
  Freitag: "Fr",
  Samstag: "Sa",
};

// ============================================================
// THGA Zeitslots
// ============================================================

export interface ZeitSlot {
  /** Slot-Nummer (0-15) */
  slot: number;
  /** Startzeit als String "HH:MM" */
  start: string;
  /** Endzeit als String "HH:MM" */
  end: string;
}

/** Offizielles THGA-Zeitraster */
export const thga_zeitraster: ZeitSlot[] = [
  { slot: 0, start: "7:30", end: "8:15" },
  { slot: 1, start: "8:15", end: "9:00" },
  { slot: 2, start: "9:15", end: "10:00" },
  { slot: 3, start: "10:15", end: "11:00" },
  { slot: 4, start: "11:15", end: "12:00" },
  { slot: 5, start: "12:15", end: "13:00" },
  { slot: 6, start: "13:15", end: "14:00" },
  { slot: 7, start: "14:15", end: "15:00" },
  { slot: 8, start: "15:15", end: "16:00" },
  { slot: 9, start: "16:15", end: "17:00" },
  { slot: 10, start: "17:15", end: "18:00" },
  { slot: 11, start: "18:00", end: "18:45" },
  { slot: 12, start: "18:45", end: "19:30" },
  { slot: 13, start: "19:45", end: "20:30" },
  { slot: 14, start: "20:30", end: "21:15" },
  { slot: 15, start: "21:15", end: "22:00" },
];

// ============================================================
// Kernmodell: Veranstaltung (aus Veranstaltungsliste)
// ============================================================

/** Ein einzelner Termin einer Veranstaltung */
export interface Termin {
  tag: Wochentag;
  start_zeit: string;
  end_zeit: string;
  raum: string | null;
  /** Dozenten-Kuerzel (z.B. "WEL") */
  dozent_kuerzel: string | null;
  /** Voller Dozent-Name (aus HTM extrahiert) */
  dozent_name: string | null;
  /** Studiengruppen-Codes die diesen Termin besuchen */
  klassen: string[];
  /** Gruppeninfo (z.B. "Gr.1") */
  gruppe: string | null;
  /** Freitext-Zusatzinfos (n.V., Online, Blockveranstaltung etc.) */
  bemerkung: string | null;
}

/** Eine Veranstaltung = ein Block aus der Veranstaltungsliste */
export interface Veranstaltung {
  /** Modulnummer (z.B. "40050140") */
  modul_nummer: string;
  /** Veranstaltungstyp (V, Ü, P, S, SU, FM) */
  typ: VeranstaltungsTyp;
  /** Veranstaltungsname (z.B. "Programmierung") */
  name: string;
  /** Alle Termine dieser Veranstaltung */
  termine: Termin[];
}

// ============================================================
// Angereichertes Modul (Veranstaltungen + FPO + Modulhandbuch)
// ============================================================

/** Prüfungsform-Kuerzel */
export type PruefungsForm = "K" | "M" | "A";

/** Ein vollstaendiges Modul mit allen aggregierten Informationen */
export interface Modul {
  /** Modulnummer (z.B. "40050140") */
  modul_nummer: string;
  /** Modulname (z.B. "Programmierung") */
  name: string;
  /** BID-Modulkuerzel (z.B. "BID 9") — nur wenn aus FPO bekannt */
  curriculum_kuerzel: string | null;
  /** Alle zugehoerigen Veranstaltungen (V, Ü, P, ...) */
  veranstaltungen: Veranstaltung[];

  // --- Aus FPO ---
  /** Credit Points */
  ects: number | null;
  /** Semesterwochenstunden (Gesamt) */
  sws: number | null;
  /** SWS aufgeschluesselt */
  sws_detail: {
    vorlesung: number;
    uebung: number;
    praktikum: number;
    seminar: number;
    su: number;
  } | null;
  /** Pruefungsformen */
  pruefungsformen: PruefungsForm[];
  /** Pruefungsvorleistung erforderlich (z.B. TN Praktikum) */
  pvl: string | null;
  /** Empfohlenes Semester (Vollzeit) */
  empfohlenes_semester: number | null;
  /** Pflicht- oder Wahlpflichtmodul */
  pflicht: boolean | null;
  /** In welchen Studiengaengen angeboten */
  studiengaenge: string[];

  // --- Aus Modulhandbuch ---
  /** Modulverantwortliche(r) */
  modul_verantwortlicher: string | null;
  /** Empfohlene Voraussetzungen */
  voraussetzungen: string | null;
  /** Modulbeschreibung / Inhalt (Stichpunkte) */
  inhalt: string | null;
  /** Lernziele */
  lernziele: string | null;

  // --- Metadaten ---
  /** Konfidenz-Score (0.0 - 1.0) fuer die Extraktion */
  extraction_confidence: number;
  /** Quelldokument aus dem extrahiert wurde */
  quelle: string;
}

// ============================================================
// Wochenplan-Eintrag (vom User per Drag & Drop erstellt)
// ============================================================

/** Ein Eintrag im persoenlichen Wochenplan */
export interface PlanEintrag {
  id: string;
  /** Referenz auf die Veranstaltung */
  modul_nummer: string;
  veranstaltungs_typ: VeranstaltungsTyp;
  /** Anzeigename */
  display_name: string;
  /** Platzierung im Plan */
  tag: Wochentag;
  start_zeit: string;
  end_zeit: string;
  /** Raum */
  raum: string | null;
  /** Dozent */
  dozent: string | null;
  /** Farbkodierung (CSS-Farbe) */
  farbe: string;
  /** Notizen des Users */
  notizen: string | null;
}

// ============================================================
// Dozenten-Mapping (Kuerzel -> voller Name)
// ============================================================

export interface DozentenMapping {
  /** 2-3 Buchstaben Kuerzel (z.B. "WEL") */
  kuerzel: string;
  /** Voller Nachname (z.B. "Welp") */
  name: string;
  /** Voller Name inkl. Titel wenn aus Modulhandbuch bekannt */
  voller_name: string | null;
}

// ============================================================
// Quelldokument-Metadaten
// ============================================================

export type DokumentTyp =
  | "veranstaltungsliste"
  | "wochenplan_htm"
  | "fpo"
  | "modulhandbuch"
  | "sonstiges";

export interface Dokument {
  id: string;
  dateiname: string;
  typ: DokumentTyp;
  /** Semester-Info falls erkannt */
  semester: string | null;
  /** Stand-Datum */
  stand: string | null;
  /** Zeitpunkt des Uploads */
  uploaded_at: string;
}

// ============================================================
// API Response-Typen
// ============================================================

export interface ExtraktionsErgebnis {
  dokument: Dokument;
  module: Modul[];
  dozenten_mappings: DozentenMapping[];
  /** Warnungen / unsichere Extraktionen */
  warnungen: string[];
}
