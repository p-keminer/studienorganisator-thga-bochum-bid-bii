/**
 * PDF/HTM Upload-Zone mit Drag & Drop.
 * Erkennt den Dokumenttyp vor dem Upload und zeigt bei Duplikat-Studiengang einen Dialog.
 */

import { useState, useRef, type DragEvent } from "react";
import { api_detect_document, type UploadResultat } from "../../lib/api_client";

interface PdfUploadProps {
  on_upload: (file: File) => Promise<UploadResultat>;
  loading: boolean;
  result: UploadResultat | null;
  error: string | null;
}

interface DetectInfo {
  doc_type: string;
  studiengang: string | null;
  already_exists: boolean;
  file: File;
}

export function PdfUpload({ on_upload, loading, result, error }: PdfUploadProps) {
  const [dragging, set_dragging] = useState(false);
  const [detecting, set_detecting] = useState(false);
  const [confirm_info, set_confirm_info] = useState<DetectInfo | null>(null);
  const input_ref = useRef<HTMLInputElement>(null);

  const handle_file = async (file: File) => {
    // Nur für Modulhandbuch/FPO detect aufrufen
    const name_lower = file.name.toLowerCase();
    const is_relevant = name_lower.endsWith(".pdf") && (
      name_lower.includes("modulhandbuch") || name_lower.includes("fpo") ||
      name_lower.includes("fachpr") || name_lower.includes("pruefungsordnung")
    );

    if (is_relevant) {
      set_detecting(true);
      try {
        const info = await api_detect_document(file);
        if (info.already_exists && info.studiengang) {
          set_confirm_info({ ...info, file });
          return;
        }
      } catch {
        // Bei Fehler: normaler Upload ohne Bestätigung
      } finally {
        set_detecting(false);
      }
    }

    await on_upload(file);
  };

  const handle_drop = async (e: DragEvent) => {
    e.preventDefault();
    set_dragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await handle_file(file);
  };

  const handle_select = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handle_file(file);
    if (input_ref.current) input_ref.current.value = "";
  };

  const handle_confirm = async () => {
    if (!confirm_info) return;
    const file = confirm_info.file;
    set_confirm_info(null);
    await on_upload(file);
  };

  const is_busy = loading || detecting;

  return (
    <div className="space-y-3">
      {/* Bestätigungsdialog */}
      {confirm_info && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm">
          <p className="font-semibold text-amber-900 mb-1">
            Studiengang bereits vorhanden
          </p>
          <p className="text-amber-800 mb-3">
            <span className="font-medium">{confirm_info.studiengang}</span> ist bereits in der Datenbank.
            Hochladen ersetzt die vorhandenen Daten für diesen Studiengang.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handle_confirm}
              className="px-4 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600"
            >
              Ersetzen
            </button>
            <button
              onClick={() => set_confirm_info(null)}
              className="px-4 py-1.5 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Drop-Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          set_dragging(true);
        }}
        onDragLeave={() => set_dragging(false)}
        onDrop={handle_drop}
        onClick={() => input_ref.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-colors duration-200
          ${dragging
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
          }
          ${is_busy ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        <input
          ref={input_ref}
          type="file"
          accept=".pdf,.htm,.html"
          onChange={handle_select}
          className="hidden"
        />

        {is_busy ? (
          <div className="space-y-2">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-500 text-sm">
              {detecting ? "Dokument wird erkannt..." : "Extrahiere Daten..."}
            </p>
          </div>
        ) : (
          <>
            <div className="text-3xl mb-2">&#128196;</div>
            <p className="text-slate-600 font-medium">
              PDF oder HTM hier ablegen
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Veranstaltungsliste, Modulhandbuch, FPO oder Wochenplan
            </p>
          </>
        )}
      </div>

      {/* Ergebnis */}
      {result && (
        <div className={`rounded-lg p-3 text-sm border ${
          result.hinweis
            ? "bg-amber-50 border-amber-200"
            : "bg-green-50 border-green-200"
        }`}>
          <p className={`font-medium ${result.hinweis ? "text-amber-800" : "text-green-800"}`}>
            {result.filename} {result.hinweis ? "verarbeitet (mit Hinweis)" : "erfolgreich verarbeitet"}
          </p>
          {result.statistik && result.doc_type === "modulhandbuch" && (
            <p className="text-green-600 mt-1">
              {result.statistik.module} Module ins Modulhandbuch importiert
            </p>
          )}
          {result.statistik && result.doc_type === "fpo" && (
            <p className="text-green-600 mt-1">
              {result.statistik.module} Module in {result.statistik.varianten} Prüfungspläne (FPO) importiert
            </p>
          )}
          {result.statistik && !["modulhandbuch", "fpo"].includes(result.doc_type) && (
            <p className="text-green-600 mt-1">
              {result.statistik.module} Module, {result.statistik.veranstaltungen} Veranstaltungen, {result.statistik.termine} Termine
            </p>
          )}
          {result.dozenten_mappings && (
            <p className="text-green-600 mt-1">
              {result.dozenten_mappings.neu_hinzugefuegt} neue Dozenten-Zuordnungen
            </p>
          )}
          {result.plan_eintraege != null && result.plan_eintraege > 0 && (
            <p className="text-green-600 mt-1">
              {result.plan_eintraege} Termine in den Wochenplaner importiert
            </p>
          )}
          {result.hinweis && (
            <p className="text-amber-600 mt-1 font-medium">
              {result.hinweis}
            </p>
          )}
        </div>
      )}

      {/* Fehler */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
