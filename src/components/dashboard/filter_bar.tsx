/**
 * Filter-Leiste: Studiengang, Semester, Freitext-Suche.
 */

import type { ModulFilter } from "../../hooks/use_modules";

/** Bekannte Studiengaenge der THGA (aus Datenquellen-Analyse) */
const STUDIENGAENGE = [
  { kuerzel: "", label: "Alle Studiengänge" },
  { kuerzel: "BID", label: "Informationstechnik & Digitalisierung" },
  { kuerzel: "BET", label: "Elektro- & Informationstechnik" },
  { kuerzel: "BMB", label: "Maschinenbau" },
  { kuerzel: "BAM", label: "Angewandte Materialwissenschaften" },
  { kuerzel: "BVT", label: "Verfahrenstechnik" },
  { kuerzel: "BGT", label: "Geotechnik & Angew. Geologie" },
  { kuerzel: "BRR", label: "Rohstoffingenieurwesen & Recycling" },
  { kuerzel: "BWI", label: "Wirtschaftsingenieurwesen" },
  { kuerzel: "BVW", label: "Vermessungswesen" },
  { kuerzel: "MEI", label: "Master Elektro- & Informationstechnik" },
  { kuerzel: "MMB", label: "Master Maschinenbau" },
  { kuerzel: "MWI", label: "Master Wirtschaftsingenieurwesen" },
  { kuerzel: "MGN", label: "Master Geoingenieurwesen & Nachbergbau" },
];

const SEMESTER = [
  { value: null, label: "Alle Semester" },
  { value: 1, label: "1. Semester" },
  { value: 2, label: "2. Semester" },
  { value: 4, label: "4. Semester" },
  { value: 6, label: "6. Semester" },
  { value: 8, label: "8. Semester" },
];

interface FilterBarProps {
  filter: ModulFilter;
  on_change: (filter: ModulFilter) => void;
  total: number;
}

export function FilterBar({ filter, on_change, total }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Studiengang */}
      <select
        value={filter.studiengang}
        onChange={(e) =>
          on_change({ ...filter, studiengang: e.target.value })
        }
        className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {STUDIENGAENGE.map((sg) => (
          <option key={sg.kuerzel} value={sg.kuerzel}>
            {sg.kuerzel ? `${sg.kuerzel} — ${sg.label}` : sg.label}
          </option>
        ))}
      </select>

      {/* Semester */}
      <select
        value={filter.semester ?? ""}
        onChange={(e) =>
          on_change({
            ...filter,
            semester: e.target.value ? Number(e.target.value) : null,
          })
        }
        className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {SEMESTER.map((s) => (
          <option key={s.label} value={s.value ?? ""}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Suche */}
      <input
        type="text"
        value={filter.suche}
        onChange={(e) =>
          on_change({ ...filter, suche: e.target.value })
        }
        placeholder="Suche (Name, Dozent, Raum)..."
        className="px-3 py-2 rounded-lg border border-slate-300 text-sm flex-1 min-w-[200px]
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {/* Ergebnis-Zaehler */}
      <span className="text-sm text-slate-500">{total} Module</span>
    </div>
  );
}
