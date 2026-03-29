/**
 * Direktlinks: Schnellzugriff auf THGA-Webseiten.
 */

const STUDIENGAENGE = [
  { name: "Informationstechnik und Digitalisierung", url: "https://www.thga.de/studienangebot/bachelor/informationstechnik-und-digitalisierung" },
];

const WEITERE_LINKS = [
  { name: "Vorlesungsplan", url: "https://vorlesungsplan.thga.de/", beschreibung: "Aktuelle Stunden- und Vorlesungspläne der THGA" },
];

export function DirektlinksPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Direktlinks</h2>
      <p className="text-sm text-slate-500 mb-6">Schnellzugriff auf THGA-Webseiten</p>

      {/* Vorlesungsplan */}
      <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Vorlesungsplan</h3>
      <div className="mb-8">
        {WEITERE_LINKS.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 hover:border-blue-400 transition-colors"
          >
            <div className="font-semibold text-blue-800">{link.name}</div>
            <div className="text-sm text-blue-600 mt-0.5">{link.beschreibung}</div>
            <div className="text-xs text-blue-400 mt-1">{link.url}</div>
          </a>
        ))}
      </div>

      {/* Studiengaenge */}
      <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">Studiengänge (Bachelor)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {STUDIENGAENGE.map((sg) => (
          <a
            key={sg.url}
            href={sg.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-slate-200 rounded-lg p-3 hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <div className="font-medium text-slate-800 text-sm">{sg.name}</div>
            <div className="text-[10px] text-slate-400 mt-1 truncate">{sg.url}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
