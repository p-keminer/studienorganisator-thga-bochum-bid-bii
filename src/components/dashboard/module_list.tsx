/**
 * Modul-Liste: Zeigt alle gefilterten Module als Karten an.
 */

import type { ModulAPI } from "../../lib/api_client";
import { ModuleCard } from "./module_card";

interface ModuleListProps {
  module: ModulAPI[];
  loading: boolean;
}

export function ModuleList({ module, loading }: ModuleListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        <span className="ml-3 text-slate-500">Lade Module...</span>
      </div>
    );
  }

  if (module.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p className="text-lg">Keine Module gefunden</p>
        <p className="text-sm mt-1">
          Lade eine Veranstaltungsliste hoch oder passe die Filter an.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {module.map((m) => (
        <ModuleCard key={m.modul_nummer} modul={m} />
      ))}
    </div>
  );
}
