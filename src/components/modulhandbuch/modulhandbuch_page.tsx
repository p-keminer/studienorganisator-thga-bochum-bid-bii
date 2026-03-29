/**
 * Modulhandbücher-Seite: Zeigt Module als klickbare Buttons.
 * Beim Klick klappt die vollstaendige Modulbeschreibung auf.
 * Studiengang-Switcher wenn mehrere Modulhandbuecher hochgeladen.
 */

import { useState, useEffect, useCallback } from "react";
import {
  api_get_modulhandbuch,
  api_get_modulhandbuch_studiengaenge,
  type ModulhandbuchModul,
} from "../../lib/api_client";

export function ModulhandbuchPage() {
  const [module, set_module] = useState<ModulhandbuchModul[]>([]);
  const [studiengaenge, set_studiengaenge] = useState<string[]>([]);
  const [active_studiengang, set_active_studiengang] = useState<string>("");
  const [expanded_id, set_expanded_id] = useState<number | null>(null);
  const [suche, set_suche] = useState("");

  const load = useCallback(async (sg?: string) => {
    const data = await api_get_modulhandbuch(sg || undefined);
    set_module(data.module);
  }, []);

  useEffect(() => {
    api_get_modulhandbuch_studiengaenge().then((sg_list) => {
      set_studiengaenge(sg_list);
      if (sg_list.length > 0) {
        set_active_studiengang(sg_list[0]);
        load(sg_list[0]);
      } else {
        load();
      }
    });
  }, [load]);

  const handle_switch = (sg: string) => {
    set_active_studiengang(sg);
    set_expanded_id(null);
    load(sg);
  };

  const filtered = suche.trim()
    ? module.filter((m) => {
        const s = suche.toLowerCase();
        return (
          m.name.toLowerCase().includes(s) ||
          (m.kuerzel && m.kuerzel.toLowerCase().includes(s)) ||
          (m.modulverantwortlicher && m.modulverantwortlicher.toLowerCase().includes(s)) ||
          (m.zuordnung && m.zuordnung.toLowerCase().includes(s))
        );
      })
    : module;

  if (studiengaenge.length === 0 && module.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-4">Modulhandbücher</h2>
        <p className="text-slate-400">
          Noch kein Modulhandbuch hochgeladen. Lade das Modulhandbuch-PDF in der Modulübersicht hoch.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold">Modulhandbücher</h2>
        <span className="text-sm text-slate-500">{filtered.length} Module</span>
      </div>

      {/* Studiengang-Switcher */}
      {studiengaenge.length > 1 && (
        <div className="flex gap-1 mb-4">
          {studiengaenge.map((sg) => (
            <button
              key={sg}
              onClick={() => handle_switch(sg)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active_studiengang === sg
                  ? "bg-blue-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {sg}
            </button>
          ))}
        </div>
      )}

      {/* Studiengang-Info wenn nur einer */}
      {studiengaenge.length === 1 && (
        <p className="text-sm text-slate-500 mb-4">{studiengaenge[0]}</p>
      )}

      <input
        type="text"
        value={suche}
        onChange={(e) => set_suche(e.target.value)}
        placeholder="Modul suchen..."
        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm mb-4
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-6">
        {filtered.map((m) => (
          <button
            key={m.id}
            onClick={() => set_expanded_id(expanded_id === m.id ? null : m.id)}
            className={`text-left p-3 rounded-lg border text-sm transition-all ${
              expanded_id === m.id
                ? "bg-blue-50 border-blue-400 ring-2 ring-blue-300"
                : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm"
            }`}
          >
            <div className="font-semibold text-slate-800 text-xs leading-tight">
              {m.name}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {m.credit_points && (
                <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded font-medium">
                  {m.credit_points} CP
                </span>
              )}
              {m.kuerzel && (
                <span className="text-[10px] text-slate-400 font-mono">
                  {m.kuerzel}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Ausgeklappte Modulbeschreibung */}
      {expanded_id && (
        <ModulDetail
          modul={module.find((m) => m.id === expanded_id)!}
          on_close={() => set_expanded_id(null)}
        />
      )}
    </div>
  );
}

function ModulDetail({
  modul,
  on_close,
}: {
  modul: ModulhandbuchModul;
  on_close: () => void;
}) {
  // SWS zusammenfassen
  const sws_parts: string[] = [];
  if (modul.sws.vorlesung) sws_parts.push(`${modul.sws.vorlesung} V`);
  if (modul.sws.su) sws_parts.push(`${modul.sws.su} SU`);
  if (modul.sws.uebung) sws_parts.push(`${modul.sws.uebung} Ü`);
  if (modul.sws.seminar) sws_parts.push(`${modul.sws.seminar} S`);
  if (modul.sws.praktikum) sws_parts.push(`${modul.sws.praktikum} P`);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-6 mb-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{modul.name}</h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
            {modul.kuerzel && <span className="font-mono bg-slate-100 px-1.5 rounded">{modul.kuerzel}</span>}
            {modul.credit_points && <span className="font-semibold text-blue-600">{modul.credit_points} CP</span>}
            {sws_parts.length > 0 && <span>{sws_parts.join(" + ")}</span>}
          </div>
        </div>
        <button
          onClick={on_close}
          className="text-slate-400 hover:text-slate-600 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Metadaten */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <InfoField label="Modulverantwortlich" value={modul.modulverantwortlicher} />
        <InfoField label="Studiensemester" value={modul.studiensemester} />
        <InfoField label="Sprache" value={modul.sprache} />
        <InfoField label="Zuordnung" value={modul.zuordnung} />
        <InfoField label="Arbeitsaufwand" value={modul.arbeitsaufwand} />
        <InfoField label="Prüfungsvorleistung" value={modul.pvl} />
        <InfoField label="Prüfungsformen" value={modul.pruefungsformen} />
      </div>

      {/* Empfohlene Voraussetzungen */}
      {modul.empfohlene_voraussetzungen && (
        <TextSection title="Empfohlene Voraussetzungen" text={modul.empfohlene_voraussetzungen} />
      )}

      {/* Lernziele */}
      {modul.lernziele && (
        <TextSection title="Lernziele" text={modul.lernziele} />
      )}

      {/* Inhalt */}
      {modul.inhalt && (
        <TextSection title="Inhalt" text={modul.inhalt} />
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      <p className="text-sm text-slate-700 mt-0.5">{value}</p>
    </div>
  );
}

function TextSection({ title, text }: { title: string; text: string }) {
  // Aufzaehlungspunkte erkennen und formatieren
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-slate-700 mb-1">{title}</h4>
      <div className="text-sm text-slate-600 space-y-0.5">
        {lines.map((line, i) => (
          <p key={i} className={line.startsWith("–") || line.startsWith("•") || line.startsWith("·") ? "pl-3" : ""}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
