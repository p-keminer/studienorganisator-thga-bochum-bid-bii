/**
 * Modul-Karte: Zeigt alle Infos zu einem Modul als vollstaendigen Block.
 *
 * Enthalt: Name, Nummer, alle Veranstaltungstypen (V/Ue/P/S/SU),
 * Termine mit Tag/Zeit/Raum/Dozent/Klassen/Gruppen.
 */

import { useState } from "react";
import type { ModulAPI, VeranstaltungAPI, TerminAPI } from "../../lib/api_client";

/** Farbe pro Veranstaltungstyp */
const TYP_FARBEN: Record<string, { bg: string; text: string; label: string }> = {
  V:  { bg: "bg-blue-100", text: "text-blue-800", label: "Vorlesung" },
  Ü:  { bg: "bg-purple-100", text: "text-purple-800", label: "Übung" },
  P:  { bg: "bg-red-100", text: "text-red-800", label: "Praktikum" },
  S:  { bg: "bg-amber-100", text: "text-amber-800", label: "Seminar" },
  SU: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Sem. Unterricht" },
  FM: { bg: "bg-slate-100", text: "text-slate-800", label: "Forschungsmodul" },
};

const DEFAULT_TYP = { bg: "bg-slate-100", text: "text-slate-800", label: "Sonstige" };

interface ModuleCardProps {
  modul: ModulAPI;
}

export function ModuleCard({ modul }: ModuleCardProps) {
  const [expanded, set_expanded] = useState(false);

  // Eindeutige Dozenten mit Namen
  const dozent_entries = Object.entries(modul.dozenten);

  // Alle Typen die dieses Modul hat
  const typen = modul.veranstaltungen.map((v) => v.typ);
  const unique_typen = [...new Set(typen)];

  // Gesamtzahl Termine
  const total_termine = modul.veranstaltungen.reduce(
    (sum, v) => sum + v.termine.length, 0
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => set_expanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-slate-400">
                {modul.modul_nummer}
              </span>
              {/* Typ-Badges */}
              {unique_typen.map((typ) => {
                const style = TYP_FARBEN[typ] || DEFAULT_TYP;
                return (
                  <span
                    key={typ}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${style.bg} ${style.text}`}
                  >
                    {style.label}
                  </span>
                );
              })}
            </div>
            <h3 className="font-semibold text-slate-900 truncate">
              {modul.name}
            </h3>
          </div>

          {/* Expand-Pfeil */}
          <span
            className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            &#9660;
          </span>
        </div>

        {/* Kompakt-Info */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {dozent_entries.length > 0 && (
            <span>
              Dozent: {dozent_entries.map(([k, v]) => v !== k ? v : k).join(", ")}
            </span>
          )}
          {modul.raeume.length > 0 && (
            <span>Raum: {modul.raeume.join(", ")}</span>
          )}
          <span>{total_termine} Termine</span>
        </div>
      </div>

      {/* Expandierter Bereich: Alle Veranstaltungen mit Terminen */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4">
          {/* Studiengaenge */}
          <div className="mt-3 flex flex-wrap gap-1">
            {modul.studiengaenge.map((sg) => (
              <span
                key={sg}
                className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono"
              >
                {sg}
              </span>
            ))}
          </div>

          {/* Veranstaltungen */}
          {modul.veranstaltungen.map((v, i) => (
            <VeranstaltungsBlock key={`${v.typ}-${i}`} veranstaltung={v} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Ein Veranstaltungstyp-Block mit Terminliste */
function VeranstaltungsBlock({ veranstaltung }: { veranstaltung: VeranstaltungAPI }) {
  const style = TYP_FARBEN[veranstaltung.typ] || DEFAULT_TYP;

  // Termine nach Tag gruppieren
  const by_day = group_termine_by_day(veranstaltung.termine);

  return (
    <div className="mt-3">
      <div className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${style.bg} ${style.text} mb-2`}>
        {style.label} ({veranstaltung.termine.length} Termine)
      </div>

      <div className="space-y-1">
        {Object.entries(by_day).map(([day, termine]) => (
          <div key={day} className="flex gap-2 text-xs">
            <span className="w-6 font-semibold text-slate-700">{day}</span>
            <div className="flex-1 space-y-0.5">
              {termine.map((t, i) => (
                <TerminZeile key={i} termin={t} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Einzelne Terminzeile */
function TerminZeile({ termin }: { termin: TerminAPI }) {
  const dozent = termin.dozent_name || termin.dozent_kuerzel || "";
  const klassen = termin.klassen.join(", ");

  return (
    <div className="flex items-center gap-2 text-slate-600">
      <span className="font-mono w-[90px]">
        {termin.start_zeit}–{termin.end_zeit}
      </span>
      {termin.raum && (
        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-medium">
          {termin.raum}
        </span>
      )}
      {dozent && <span className="text-slate-500">{dozent}</span>}
      {termin.gruppe && (
        <span className="text-blue-600 font-medium">{termin.gruppe}</span>
      )}
      {klassen && (
        <span className="text-slate-400 truncate max-w-[200px]" title={klassen}>
          {klassen}
        </span>
      )}
      {termin.bemerkung && (
        <span className="text-amber-600 italic">{termin.bemerkung}</span>
      )}
    </div>
  );
}

/** Gruppiert Termine nach Wochentag. */
function group_termine_by_day(termine: TerminAPI[]): Record<string, TerminAPI[]> {
  const order = ["Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const grouped: Record<string, TerminAPI[]> = {};

  for (const t of termine) {
    if (!grouped[t.tag]) grouped[t.tag] = [];
    grouped[t.tag].push(t);
  }

  // Nach Wochentag sortieren
  const sorted: Record<string, TerminAPI[]> = {};
  for (const day of order) {
    if (grouped[day]) {
      // Innerhalb des Tages nach Startzeit sortieren
      sorted[day] = grouped[day].sort((a, b) =>
        a.start_zeit.localeCompare(b.start_zeit)
      );
    }
  }
  return sorted;
}
