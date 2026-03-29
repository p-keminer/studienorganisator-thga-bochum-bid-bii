/**
 * Studienverlauf-Seite: Visueller Semester-Plan.
 *
 * - Auch ohne Upload nutzbar (leeres Grid zum Selbstausfuellen)
 * - Semester hinzufuegen/entfernen
 * - Verfuegbare Module aus DB als Sidebar per Drag & Drop ins Grid
 * - Module bearbeitbar, verschiebbar, loeschbar
 * - Farbe pro Modul aenderbar (Rechtsklick)
 */

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  api_get_studienverlauf,
  api_add_studienverlauf_modul,
  api_update_studienverlauf_modul,
  api_delete_studienverlauf_modul,
  api_delete_studienverlauf_plan,
  api_get_modulhandbuch,
  type StudienverlaufPlanAPI,
  type ModulhandbuchModul,
} from "../../lib/api_client";

const FARBEN = [
  { name: "Türkis", value: "bg-teal-500" },
  { name: "Blau", value: "bg-blue-600" },
  { name: "Rot (PVL)", value: "bg-red-500" },
  { name: "Orange", value: "bg-amber-500" },
  { name: "Grün", value: "bg-emerald-500" },
  { name: "Lila", value: "bg-purple-500" },
  { name: "Grau", value: "bg-slate-400" },
];

/** Farbpalette für Studiengänge (hex) */
const SG_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

function get_sg_color(studiengaenge_sorted: string[], sg: string | null): string {
  if (!sg) return "#94a3b8";
  const idx = studiengaenge_sorted.indexOf(sg);
  return idx >= 0 ? SG_COLORS[idx % SG_COLORS.length] : "#94a3b8";
}

function get_farbe(id: number, hat_pvl: boolean): string {
  try {
    const stored = localStorage.getItem(`sv-farbe-${id}`);
    if (stored) return stored;
  } catch { /* ignore */ }
  return hat_pvl ? "bg-teal-600" : "bg-blue-500";
}

function set_farbe(id: number, farbe: string) {
  try { localStorage.setItem(`sv-farbe-${id}`, farbe); } catch { /* */ }
}

interface DragData {
  type: "sidebar" | "grid";
  name: string;
  id?: number;
}

export function StudienverlaufPage() {
  const [plaene, set_plaene] = useState<StudienverlaufPlanAPI[]>([]);
  const [active_plan, set_active_plan] = useState("");
  const [semester_count, set_semester_count] = useState(6);
  const [editing_id, set_editing_id] = useState<number | null>(null);
  const [edit_name, set_edit_name] = useState("");
  const [color_picker_id, set_color_picker_id] = useState<number | null>(null);
  const [active_drag, set_active_drag] = useState<DragData | null>(null);
  const [mh_module, set_mh_module] = useState<ModulhandbuchModul[]>([]);
  const [sidebar_filter, set_sidebar_filter] = useState("");
  const [sg_checked, set_sg_checked] = useState<Record<string, boolean>>({});
  const [, force_update] = useState(0);

  // Neuer Plan erstellen
  const [creating_plan, set_creating_plan] = useState(false);
  const [new_plan_name, set_new_plan_name] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    const [sv_data, mh_data] = await Promise.all([
      api_get_studienverlauf(),
      api_get_modulhandbuch(),
    ]);
    set_plaene(sv_data.plaene);
    const sorted_modules = [...mh_data.module].sort((a, b) => a.name.localeCompare(b.name));
    set_mh_module(sorted_modules);
    // Studiengänge-Filter initialisieren (alle an)
    const sgs = Array.from(new Set(sorted_modules.map((m) => m.studiengang || "Unbekannt"))).sort();
    set_sg_checked((prev) => {
      const next: Record<string, boolean> = {};
      for (const sg of sgs) next[sg] = sg in prev ? prev[sg] : true;
      return next;
    });
    if (sv_data.plaene.length > 0 && !active_plan) {
      set_active_plan(sv_data.plaene[0].plan_name);
      set_semester_count(sv_data.plaene[0].anzahl_semester);
    }
  }, [active_plan]);

  useEffect(() => { load(); }, [load]);

  const plan = plaene.find((p) => p.plan_name === active_plan);

  useEffect(() => {
    if (plan) set_semester_count(plan.anzahl_semester);
  }, [plan]);

  const handle_create_plan = async () => {
    const name = new_plan_name.trim() || "Mein Plan";
    await api_add_studienverlauf_modul(name, "(Platzhalter)", 1);
    const data = await api_get_studienverlauf();
    const created = data.plaene.find((p) => p.plan_name === name);
    if (created && created.module.length > 0) {
      await api_delete_studienverlauf_modul(created.module[0].id);
    }
    set_active_plan(name);
    set_creating_plan(false);
    set_new_plan_name("");
    load();
  };

  const handle_add_semester = async () => {
    const new_count = semester_count + 1;
    set_semester_count(new_count);
    await fetch("/api/studienverlauf/semester", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_name: active_plan, anzahl_semester: new_count }),
    });
  };

  const handle_remove_semester = async () => {
    if (semester_count <= 1) return;
    const mods_in_last = plan?.module.filter((m) => m.semester === semester_count) || [];
    if (mods_in_last.length > 0) {
      if (!window.confirm(`Semester ${semester_count} hat ${mods_in_last.length} Module. Trotzdem entfernen?`)) return;
      for (const m of mods_in_last) await api_delete_studienverlauf_modul(m.id);
    }
    const new_count = semester_count - 1;
    set_semester_count(new_count);
    await fetch("/api/studienverlauf/semester", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_name: active_plan, anzahl_semester: new_count }),
    });
    load();
  };

  const handle_rename = async (id: number) => {
    if (edit_name.trim()) {
      await api_update_studienverlauf_modul(id, { name: edit_name.trim() });
      set_editing_id(null);
      load();
    }
  };

  const handle_delete = async (id: number) => {
    await api_delete_studienverlauf_modul(id);
    set_editing_id(null);
    load();
  };

  const handle_move = async (id: number, new_sem: number) => {
    await api_update_studienverlauf_modul(id, { semester: new_sem });
    set_editing_id(null);
    load();
  };

  // === Drag & Drop ===

  const handle_drag_start = (e: DragStartEvent) => {
    set_active_drag(e.active.data.current as DragData);
  };

  const handle_drag_end = async (e: DragEndEvent) => {
    set_active_drag(null);
    const data = e.active.data.current as DragData;

    // Kein Drop-Target getroffen
    if (!e.over) {
      // Grid-Modul ausserhalb abgelegt → loeschen
      if (data.type === "grid" && data.id) {
        await api_delete_studienverlauf_modul(data.id);
        load();
      }
      return;
    }

    const drop_sem = parse_semester_drop(e.over.id as string);
    if (!drop_sem || !active_plan) return;

    if (data.type === "sidebar") {
      await api_add_studienverlauf_modul(active_plan, data.name, drop_sem);
      load();
    } else if (data.type === "grid" && data.id) {
      await api_update_studienverlauf_modul(data.id, { semester: drop_sem });
      load();
    }
  };

  // Studiengänge für Farbpalette (sortiert)
  const unique_sgs = Array.from(new Set(mh_module.map((m) => m.studiengang || "Unbekannt"))).sort();

  // Sidebar: verfuegbare Module filtern (nach Text + Studiengang-Checkboxen)
  const filtered_mh = mh_module.filter((m) => {
    const sg = m.studiengang || "Unbekannt";
    if (!sg_checked[sg]) return false;
    if (sidebar_filter.trim()) {
      return m.name.toLowerCase().includes(sidebar_filter.toLowerCase());
    }
    return true;
  });

  return (
    <DndContext sensors={sensors} onDragStart={handle_drag_start} onDragEnd={handle_drag_end}>
      <div className="flex gap-4 h-full">
        {/* Sidebar: Verfuegbare Module */}
        <div className="w-[220px] shrink-0 flex flex-col overflow-hidden">
          <h3 className="text-sm font-bold mb-1">Verfügbare Module</h3>
          <input
            type="text"
            value={sidebar_filter}
            onChange={(e) => set_sidebar_filter(e.target.value)}
            placeholder="Filter..."
            className="px-2 py-1 text-xs rounded border border-slate-300 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Studiengang-Checkboxen */}
          {unique_sgs.length > 1 && (
            <div className="mb-2 space-y-0.5">
              {unique_sgs.map((sg) => (
                <label key={sg} className="flex items-center gap-1.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={!!sg_checked[sg]}
                    onChange={(e) => set_sg_checked((prev) => ({ ...prev, [sg]: e.target.checked }))}
                    className="w-3 h-3 rounded accent-blue-500"
                  />
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: get_sg_color(unique_sgs, sg) }}
                  />
                  <span className="text-[10px] text-slate-600 truncate">{sg}</span>
                </label>
              ))}
            </div>
          )}

          <p className="text-[9px] text-slate-400 mb-1">Drag & Drop ins Semester-Grid</p>

          <div className="flex-1 overflow-auto space-y-1 pr-1">
            {mh_module.length === 0 && (
              <p className="text-[10px] text-slate-400 text-center py-2">
                Modulhandbuch hochladen um Module hier zu sehen.
              </p>
            )}
            {filtered_mh.slice(0, 120).map((m) => (
              <DraggableSidebarModul
                key={m.id}
                modul={m}
                color={unique_sgs.length > 1 ? get_sg_color(unique_sgs, m.studiengang || "Unbekannt") : undefined}
              />
            ))}
          </div>
        </div>

        {/* Hauptbereich */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold">Studienverlauf</h2>
          </div>

          {/* Plan-Auswahl + Aktionen */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {plaene.map((p) => (
              <button
                key={p.plan_name}
                onClick={() => { set_active_plan(p.plan_name); set_semester_count(p.anzahl_semester); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active_plan === p.plan_name ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p.plan_name}
              </button>
            ))}

            {creating_plan ? (
              <div className="flex gap-1 items-center">
                <input type="text" value={new_plan_name} onChange={(e) => set_new_plan_name(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handle_create_plan(); if (e.key === "Escape") set_creating_plan(false); }}
                  placeholder="Planname..." className="px-2 py-1 text-xs border rounded" autoFocus />
                <button onClick={handle_create_plan} className="text-xs text-green-600">&#10003;</button>
                <button onClick={() => set_creating_plan(false)} className="text-xs text-slate-400">&#10005;</button>
              </div>
            ) : (
              <button onClick={() => set_creating_plan(true)}
                className="px-3 py-1.5 text-xs rounded-lg border border-dashed border-blue-300 text-blue-500 hover:bg-blue-50">
                + Neuer Plan
              </button>
            )}

            <div className="flex-1" />

            {active_plan && (
              <>
                <button onClick={handle_remove_semester} className="px-2 py-1 text-xs rounded border border-slate-200 text-slate-500 hover:bg-slate-100">− Semester</button>
                <button onClick={handle_add_semester} className="px-2 py-1 text-xs rounded border border-blue-200 text-blue-500 hover:bg-blue-50">+ Semester</button>
                <button
                  onClick={() => { if (window.confirm(`"${active_plan}" löschen?`)) { api_delete_studienverlauf_plan(active_plan); set_active_plan(""); load(); } }}
                  className="px-2 py-1 text-xs rounded border border-red-200 text-red-500 hover:bg-red-50"
                >
                  Plan löschen
                </button>
              </>
            )}
          </div>

          {/* Legende */}
          <div className="flex items-center gap-3 mb-3 text-[9px] text-slate-400">
            <span>Klick = Bearbeiten</span>
            <span>Rechtsklick = Farbe</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-teal-600 inline-block" /> PVL</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-blue-500 inline-block" /> Ohne PVL</span>
          </div>

          {/* Semester-Grid */}
          {!active_plan ? (
            <p className="text-slate-400 text-sm text-center py-8">
              Erstelle einen neuen Plan oder lade einen Studienverlaufs-PDF hoch.
            </p>
          ) : (
            <div className="flex-1 overflow-auto">
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${Math.min(semester_count, 10)}, minmax(110px, 1fr))` }}
              >
                {Array.from({ length: semester_count }, (_, i) => i + 1).map((sem) => (
                  <SemesterSpalte
                    key={sem}
                    semester={sem}
                    module={(plan?.module || []).filter((m) => m.semester === sem)}
                    semester_count={semester_count}
                    editing_id={editing_id}
                    edit_name={edit_name}
                    color_picker_id={color_picker_id}
                    on_start_edit={(id, name) => { set_editing_id(id); set_edit_name(name); }}
                    on_cancel_edit={() => set_editing_id(null)}
                    on_rename={(id) => handle_rename(id)}
                    on_edit_name_change={set_edit_name}
                    on_delete={handle_delete}
                    on_move={handle_move}
                    on_toggle_color_picker={(id) => set_color_picker_id(color_picker_id === id ? null : id)}
                    on_set_color={(id, farbe) => { set_farbe(id, farbe); set_color_picker_id(null); force_update((n) => n + 1); }}
                    on_add={async (name) => { await api_add_studienverlauf_modul(active_plan, name, sem); load(); }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {active_drag && (
          <div className="bg-blue-500 text-white rounded-lg px-3 py-2 text-xs font-medium shadow-xl max-w-[150px]">
            {active_drag.name}
          </div>
        )}
      </DragOverlay>

    </DndContext>
  );
}

// === Subkomponenten ===

function parse_semester_drop(id: string): number | null {
  const match = String(id).match(/^sem-drop-(\d+)$/);
  return match ? parseInt(match[1]) : null;
}

/** Droppable Semester-Spalte */
function SemesterSpalte({
  semester, module, semester_count,
  editing_id, edit_name, color_picker_id,
  on_start_edit, on_cancel_edit, on_rename, on_edit_name_change,
  on_delete, on_move, on_toggle_color_picker, on_set_color, on_add,
}: {
  semester: number;
  module: { id: number; name: string; hat_pvl: boolean }[];
  semester_count: number;
  editing_id: number | null;
  edit_name: string;
  color_picker_id: number | null;
  on_start_edit: (id: number, name: string) => void;
  on_cancel_edit: () => void;
  on_rename: (id: number) => void;
  on_edit_name_change: (name: string) => void;
  on_delete: (id: number) => void;
  on_move: (id: number, sem: number) => void;
  on_toggle_color_picker: (id: number) => void;
  on_set_color: (id: number, farbe: string) => void;
  on_add: (name: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `sem-drop-${semester}` });
  const [adding, set_adding] = useState(false);
  const [new_name, set_new_name] = useState("");

  return (
    <div ref={setNodeRef} className="flex flex-col">
      <div className="bg-slate-700 text-white text-center py-2 rounded-t-lg text-xs font-semibold">
        {semester}. Semester
      </div>

      <div className={`rounded-b-lg p-1.5 space-y-1.5 min-h-[180px] flex-1 transition-colors ${
        isOver ? "bg-blue-100 ring-2 ring-blue-400" : "bg-slate-100"
      }`}>
        {module.map((m) => (
          <ModulKaestchen
            key={m.id}
            modul={m}
            semester={semester}
            semester_count={semester_count}
            is_editing={editing_id === m.id}
            edit_name={edit_name}
            show_color_picker={color_picker_id === m.id}
            on_start_edit={() => on_start_edit(m.id, m.name)}
            on_cancel_edit={on_cancel_edit}
            on_rename={() => on_rename(m.id)}
            on_edit_name_change={on_edit_name_change}
            on_delete={() => on_delete(m.id)}
            on_move={(sem) => on_move(m.id, sem)}
            on_toggle_color_picker={() => on_toggle_color_picker(m.id)}
            on_set_color={(farbe) => on_set_color(m.id, farbe)}
          />
        ))}

        {adding ? (
          <div className="bg-white rounded-lg p-1.5 border border-dashed border-blue-300">
            <input
              type="text" value={new_name}
              onChange={(e) => set_new_name(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && new_name.trim()) { on_add(new_name.trim()); set_new_name(""); set_adding(false); }
                if (e.key === "Escape") set_adding(false);
              }}
              placeholder="Modulname..."
              className="w-full px-1 py-0.5 text-[10px] border rounded"
              autoFocus
            />
          </div>
        ) : (
          <button
            onClick={() => set_adding(true)}
            className="w-full py-1.5 text-[10px] text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg border border-dashed border-slate-300"
          >
            + Modul
          </button>
        )}
      </div>
    </div>
  );
}

/** Draggbares + editierbares Modul-Kästchen */
function ModulKaestchen({
  modul, semester, semester_count,
  is_editing, edit_name, show_color_picker,
  on_start_edit, on_cancel_edit, on_rename, on_edit_name_change,
  on_delete, on_move, on_toggle_color_picker, on_set_color,
}: {
  modul: { id: number; name: string; hat_pvl: boolean };
  semester: number;
  semester_count: number;
  is_editing: boolean;
  edit_name: string;
  show_color_picker: boolean;
  on_start_edit: () => void;
  on_cancel_edit: () => void;
  on_rename: () => void;
  on_edit_name_change: (n: string) => void;
  on_delete: () => void;
  on_move: (sem: number) => void;
  on_toggle_color_picker: () => void;
  on_set_color: (farbe: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `grid-${modul.id}`,
    data: { type: "grid", name: modul.name, id: modul.id } as DragData,
  });

  const farbe = get_farbe(modul.id, modul.hat_pvl);

  if (is_editing) {
    return (
      <div className="bg-white rounded-lg p-2 border-2 border-blue-400 text-[10px]">
        <input
          type="text" value={edit_name}
          onChange={(e) => on_edit_name_change(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") on_rename(); if (e.key === "Escape") on_cancel_edit(); }}
          className="w-full px-1 py-0.5 border rounded text-[10px] mb-1"
          autoFocus
        />
        <div className="flex flex-wrap gap-1">
          <button onClick={on_rename} className="text-green-600">Speichern</button>
          <button onClick={on_cancel_edit} className="text-slate-400">Abbrechen</button>
          {semester > 1 && <button onClick={() => on_move(semester - 1)} className="text-blue-500">← {semester - 1}</button>}
          {semester < semester_count && <button onClick={() => on_move(semester + 1)} className="text-blue-500">{semester + 1} →</button>}
          <button onClick={on_delete} className="text-red-500">Löschen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`${farbe} text-white rounded-lg px-2.5 py-3 text-[11px] font-medium leading-snug
                   cursor-grab hover:brightness-110 transition-all min-h-[48px] flex items-center
                   ${isDragging ? "opacity-30" : ""}`}
        onClick={on_start_edit}
        onContextMenu={(e) => { e.preventDefault(); on_toggle_color_picker(); }}
      >
        <span className="break-words">{modul.name}</span>
      </div>

      {show_color_picker && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-white rounded-lg shadow-xl border p-1.5 flex gap-1">
          {FARBEN.map((f) => (
            <button
              key={f.value}
              onClick={() => on_set_color(f.value)}
              className={`w-5 h-5 rounded-full ${f.value} hover:ring-2 ring-slate-400 ${farbe === f.value ? "ring-2 ring-black" : ""}`}
              title={f.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Draggbares Modul aus der Sidebar (Modulhandbuch) */
function DraggableSidebarModul({ modul, color }: { modul: ModulhandbuchModul; color?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `mh-${modul.id}`,
    data: { type: "sidebar", name: modul.name } as DragData,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`bg-white border rounded p-1.5 text-[10px] cursor-grab hover:shadow-sm transition-all ${
        isDragging ? "opacity-30" : ""
      }`}
      style={color ? { borderLeftColor: color, borderLeftWidth: 3 } : undefined}
    >
      <div className="font-medium text-slate-800 leading-tight">{modul.name}</div>
      {modul.credit_points && (
        <span className="text-[8px] text-slate-400">{modul.credit_points} CP</span>
      )}
    </div>
  );
}
