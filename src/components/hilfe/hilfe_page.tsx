/**
 * Hilfe-Seite: Anleitung zur Benutzung des Studienorganisators.
 */

export function HilfePage() {
  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold mb-1">Hilfe</h2>
      <p className="text-sm text-slate-500 mb-6">Anleitung zur Benutzung des Studienorganisators</p>

      {/* Reihenfolge */}
      <Section title="Empfohlene Reihenfolge beim Hochladen">
        <p className="mb-3">
          Lade die Dokumente in dieser Reihenfolge hoch, damit alle Funktionen korrekt arbeiten:
        </p>
        <ol className="space-y-3">
          <Step nr={1} title="Veranstaltungsliste (PDF)" pflicht>
            Untis-Export mit allen Modulen, Terminen, Räumen und Dozenten.
            Bildet die Grundlage für die Modulübersicht und den Wochenplaner.
            Ohne diese Datei funktionieren die meisten Reiter nicht.
          </Step>
          <Step nr={2} title="Wochenplan (HTM-Datei)">
            Untis-Wochenplan für deinen Studiengang (z.B. <code>Kla1A_2BID.htm</code>).
            Importiert die Termine automatisch in den Wochenplaner und löst Dozenten-Kürzel zu vollen Namen auf.
            <em className="block mt-1 text-amber-600">Wichtig: Erst die Veranstaltungsliste hochladen, sonst können die Termine nicht zugeordnet werden.</em>
          </Step>
          <Step nr={3} title="Modulhandbuch (PDF)">
            Enthält detaillierte Modulbeschreibungen: Lernziele, Inhalte, Prüfungsformen, CP, SWS, Verantwortliche.
            Wird im Reiter „Modulhandbuch" angezeigt.
          </Step>
          <Step nr={4} title="Fachprüfungsordnung / FPO (PDF)">
            Enthält die Prüfungspläne mit empfohlenen Semestern, Prüfungsvorleistungen und Prüfungsformen.
            Wird im Reiter „Prüfungsplan (FPO)" angezeigt.
          </Step>
          <Step nr={5} title="Studienverlauf (PDF)" optional>
            Grafischer Studienverlaufsplan (farbige Kästchen).
            Wird im Reiter „Studienverlauf" angezeigt. Kann auch ohne Upload manuell erstellt werden.
          </Step>
        </ol>
        <p className="mt-3 text-xs text-slate-400">
          Alle Dateien werden über die Upload-Zone auf der Modulübersicht-Seite hochgeladen.
          Der Dokumenttyp wird automatisch erkannt.
        </p>
      </Section>

      {/* Reiter */}
      <Section title="Die einzelnen Reiter">
        <ReiterHilfe
          name="Modulübersicht"
          beschreibung="Zeigt alle extrahierten Module aus der Veranstaltungsliste."
        >
          <li>PDF- oder HTM-Dateien in die Upload-Zone ziehen oder klicken</li>
          <li>Filter nach Studiengang, Semester oder Freitext-Suche</li>
          <li>Klick auf ein Modul klappt die Details auf (Termine, Dozenten, Räume, Gruppen)</li>
          <li>„Daten zurücksetzen" löscht alle hochgeladenen Daten</li>
        </ReiterHilfe>

        <ReiterHilfe
          name="Wochenplaner"
          beschreibung="Erstelle deinen persönlichen Stundenplan."
        >
          <li>Links: Verfügbare Termine — filterbar nach Name, Studiengang, Dozent</li>
          <li><strong>Klick</strong> auf einen Termin platziert ihn automatisch am richtigen Tag und Zeitslot</li>
          <li><strong>Drag & Drop</strong>: Termin gedrückt halten und ins Grid ziehen — gültige Slots leuchten grün, ungültige rot</li>
          <li>Mehrere Module pro Zeitslot möglich (parallele Gruppen)</li>
          <li><strong>Klick</strong> auf ein platziertes Modul öffnet den Bearbeitungsdialog (Raum, Dozent, Gruppe ändern)</li>
          <li>Hover + rotes X zum Entfernen</li>
          <li>Zellengröße anpassbar (S / M / L / XL)</li>
          <li>HTM-Import: Untis-Wochenplan hochladen füllt den Plan automatisch</li>
        </ReiterHilfe>

        <ReiterHilfe
          name="Modulhandbuch"
          beschreibung="Alle Module mit vollständigen Beschreibungen aus dem Modulhandbuch."
        >
          <li>Module als klickbare Kacheln mit CP und Kürzel</li>
          <li>Klick öffnet die vollständige Modulbeschreibung</li>
          <li>Suchfeld zum schnellen Finden von Modulen</li>
          <li>Zeigt: Verantwortlicher, Studiensemester (WS/SS), Zuordnung, Arbeitsaufwand, Voraussetzungen, Lernziele, Inhalt, Prüfungsformen</li>
        </ReiterHilfe>

        <ReiterHilfe
          name="Prüfungsplan (FPO)"
          beschreibung="Prüfungspläne aus der Fachprüfungsordnung."
        >
          <li>Umschaltbar zwischen Vollzeit und Praxisbegleitend</li>
          <li>Pflichtmodule gruppiert nach Fachbereich (Mathematik, Elektrotechnik, etc.)</li>
          <li>Separate Tabelle für empfohlene Wahlpflichtmodule</li>
          <li>Zeigt pro Modul: CP, PVL (Prüfungsvorleistung), Prüfungsereignis, Prüfungsform, empfohlenes Semester</li>
          <li>Module mit PVL sind farblich markiert</li>
        </ReiterHilfe>

        <ReiterHilfe
          name="Studienverlauf"
          beschreibung="Visueller Semester-Plan zum Planen deines Studiums."
        >
          <li>Kann per PDF-Upload oder manuell erstellt werden</li>
          <li>Module aus dem Modulhandbuch per Drag & Drop aus der linken Sidebar in Semester ziehen</li>
          <li>Module rausziehen (außerhalb der Semester) zum Löschen</li>
          <li><strong>Klick</strong> auf ein Modul zum Umbenennen oder Verschieben</li>
          <li><strong>Rechtsklick</strong> auf ein Modul zum Farbändern (z.B. Rot für Module mit PVL)</li>
          <li>Semester hinzufügen / entfernen über die Buttons oben rechts</li>
          <li>Mehrere Pläne gleichzeitig möglich (z.B. Vollzeit + Praxisbegleitend + eigener Plan)</li>
        </ReiterHilfe>

        <ReiterHilfe
          name="Direktlinks"
          beschreibung="Schnellzugriff auf THGA-Webseiten."
        >
          <li>Links zu allen Bachelor-Studiengängen der THGA</li>
          <li>Link zum Vorlesungsplan (vorlesungsplan.thga.de)</li>
          <li>Alle Links öffnen sich in einem neuen Tab</li>
        </ReiterHilfe>
      </Section>

      {/* Tipps */}
      <Section title="Tipps">
        <ul className="space-y-2 text-sm text-slate-600">
          <li>Die App läuft komplett lokal — keine Daten werden an externe Server gesendet.</li>
          <li>Wenn die App über die Desktop-Verknüpfung gestartet wird, beendet sich das Backend automatisch wenn der Browser-Tab geschlossen wird. Bei manuellem Start (Terminal) muss das Backend mit Ctrl+C beendet werden.</li>
          <li>Bei Problemen: „Daten zurücksetzen" auf der Modulübersicht und alle Dateien neu hochladen.</li>
          <li>Die Dokumenttyp-Erkennung basiert auf dem Dateinamen und dem Inhalt — Dateien nicht umbenennen.</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-slate-800 mb-3 pb-1 border-b border-slate-200">{title}</h3>
      {children}
    </div>
  );
}

function Step({ nr, title, children, pflicht, optional }: {
  nr: number; title: string; children: React.ReactNode; pflicht?: boolean; optional?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
        pflicht ? "bg-blue-500 text-white" : optional ? "bg-slate-200 text-slate-500" : "bg-blue-100 text-blue-700"
      }`}>
        {nr}
      </div>
      <div>
        <div className="font-medium text-slate-800 text-sm">
          {title}
          {pflicht && <span className="text-[10px] text-blue-500 ml-1">(Pflicht)</span>}
          {optional && <span className="text-[10px] text-slate-400 ml-1">(Optional)</span>}
        </div>
        <div className="text-sm text-slate-500 mt-0.5">{children}</div>
      </div>
    </li>
  );
}

function ReiterHilfe({ name, beschreibung, children }: {
  name: string; beschreibung: string; children: React.ReactNode;
}) {
  return (
    <div className="mb-4 bg-slate-50 rounded-lg border border-slate-200 p-3">
      <h4 className="font-semibold text-slate-800 text-sm">{name}</h4>
      <p className="text-xs text-slate-500 mb-2">{beschreibung}</p>
      <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
        {children}
      </ul>
    </div>
  );
}
