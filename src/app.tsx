import { useState, useEffect } from "react";
import { use_modules } from "./hooks/use_modules";
import { PdfUpload } from "./components/dashboard/pdf_upload";
import { FilterBar } from "./components/dashboard/filter_bar";
import { ModuleList } from "./components/dashboard/module_list";
import { SchedulerPage } from "./components/scheduler/scheduler_page";
import { ModulhandbuchPage } from "./components/modulhandbuch/modulhandbuch_page";
import { FpoPage } from "./components/fpo/fpo_page";
import { StudienverlaufPage } from "./components/studienverlauf/studienverlauf_page";
import { DirektlinksPage } from "./components/direktlinks/direktlinks_page";
import { HilfePage } from "./components/hilfe/hilfe_page";
import { ResetModal } from "./components/dashboard/reset_modal";

type Page = "dashboard" | "scheduler" | "modulhandbuch" | "fpo" | "studienverlauf" | "direktlinks" | "hilfe";

export default function App() {
  const [active_page, set_active_page] = useState<Page>("dashboard");

  // Heartbeat: Alle 5 Sek dem Backend sagen dass das Tab noch offen ist.
  // Wenn das Tab geschlossen wird, stoppt der Heartbeat und das Backend
  // faehrt sich nach 15 Sek automatisch herunter.
  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
    }, 5000);
    // Sofort einen senden beim Start
    fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-52 lg:w-64 bg-[var(--color-thga-blue)] text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-white/20">
          <h1 className="text-lg font-bold">Studienorganisator</h1>
          <p className="text-xs text-white/60 mt-1">THGA Bochum</p>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <button
            onClick={() => set_active_page("dashboard")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              active_page === "dashboard"
                ? "bg-white/20 font-medium"
                : "hover:bg-white/10"
            }`}
          >
            Modulübersicht aktuell
          </button>
          <button
            onClick={() => set_active_page("scheduler")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              active_page === "scheduler"
                ? "bg-white/20 font-medium"
                : "hover:bg-white/10"
            }`}
          >
            Wochenplaner
          </button>
          <button
            onClick={() => set_active_page("modulhandbuch")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              active_page === "modulhandbuch"
                ? "bg-white/20 font-medium"
                : "hover:bg-white/10"
            }`}
          >
            Modulhandbücher
          </button>
          <button
            onClick={() => set_active_page("fpo")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              active_page === "fpo"
                ? "bg-white/20 font-medium"
                : "hover:bg-white/10"
            }`}
          >
            Prüfungsplan (FPO)
          </button>
          <button
            onClick={() => set_active_page("studienverlauf")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              active_page === "studienverlauf"
                ? "bg-white/20 font-medium"
                : "hover:bg-white/10"
            }`}
          >
            Studienverlauf
          </button>
          <button
            onClick={() => set_active_page("direktlinks")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              active_page === "direktlinks"
                ? "bg-white/20 font-medium"
                : "hover:bg-white/10"
            }`}
          >
            Direktlinks
          </button>
          <button
            onClick={() => set_active_page("hilfe")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              active_page === "hilfe"
                ? "bg-white/20 font-medium"
                : "hover:bg-white/10"
            }`}
          >
            Hilfe
          </button>
        </nav>

        <div className="p-4 border-t border-white/20 text-xs text-white/40">
          v0.1.0
        </div>
      </aside>

      {/* Hauptbereich */}
      <main className="flex-1 overflow-auto p-6">
        {active_page === "dashboard" && <DashboardPage />}
        {active_page === "scheduler" && <SchedulerPage />}
        {active_page === "modulhandbuch" && <ModulhandbuchPage />}
        {active_page === "fpo" && <FpoPage />}
        {active_page === "studienverlauf" && <StudienverlaufPage />}
        {active_page === "direktlinks" && <DirektlinksPage />}
        {active_page === "hilfe" && <HilfePage />}
      </main>
    </div>
  );
}

/** Dashboard: Upload + Filter + Modulliste */
function DashboardPage() {
  const {
    module,
    total,
    db_has_data,
    semester_info,
    stand_info,
    loading,
    error,
    filter,
    set_filter,
    upload_file,
    upload_result,
    reset_db,
  } = use_modules();

  const [show_reset_modal, set_show_reset_modal] = useState(false);

  return (
    <div>
      {/* Header mit Semester-Info */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Modulübersicht aktuell</h2>
          {semester_info && (
            <p className="text-sm text-slate-500 mt-0.5">
              {semester_info} {stand_info && `· Stand: ${stand_info}`}
            </p>
          )}
        </div>

        {/* DB-Reset Button */}
        {db_has_data && (
          <button
            onClick={() => set_show_reset_modal(true)}
            className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600
                       hover:bg-red-50 transition-colors"
          >
            Daten zurücksetzen
          </button>
        )}
      </div>

      {show_reset_modal && (
        <ResetModal
          on_close={() => set_show_reset_modal(false)}
          on_reset_all={() => { reset_db(); set_show_reset_modal(false); }}
        />
      )}

      {/* Upload */}
      <PdfUpload
        on_upload={upload_file}
        loading={loading && !db_has_data}
        result={upload_result}
        error={error}
      />

      {/* Filter + Liste — IMMER sichtbar wenn Daten da, auch bei 0 Treffern */}
      {db_has_data && (
        <div className="mt-6">
          <FilterBar filter={filter} on_change={set_filter} total={total} />
          <ModuleList module={module} loading={loading} />
        </div>
      )}
    </div>
  );
}
