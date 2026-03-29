/**
 * Wochenplaner-Seite.
 *
 * - Klick auf Termin in Sidebar: automatisch am richtigen Slot platzieren
 * - Drag & Drop: Termin aus Sidebar ins Grid ziehen (nur am richtigen Tag+Slot ablegen)
 * - Klick auf platziertes Modul: Edit-Popup (Raum, Dozent, Gruppe aendern)
 */

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import {
  api_get_modules,
  api_get_schedule,
  api_create_schedule_entry,
  api_delete_schedule_entry,
  api_clear_schedule,
  type ModulAPI,
} from "../../lib/api_client";
import {
  WeekGrid,
  EditModal,
  type PlanItem,
  type ActiveDragInfo,
  zeit_zu_slot,
  parse_drop_id,
} from "./week_grid";

/** Farbe pro Veranstaltungstyp */
const TYP_FARBEN: Record<string, { bg: string; text: string; label: string }> = {
  V: { bg: "bg-blue-50 border-blue-200", text: "text-blue-800", label: "V" },
  Ü: { bg: "bg-purple-50 border-purple-200", text: "text-purple-800", label: "Ü" },
  P: { bg: "bg-red-50 border-red-200", text: "text-red-800", label: "P" },
  S: { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", label: "S" },
  SU: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", label: "SU" },
};
const DEFAULT_STYLE = { bg: "bg-slate-50 border-slate-200", text: "text-slate-800", label: "?" };

interface SidebarTermin {
  id: string;
  modul_nummer: string;
  name: string;
  typ: string;
  tag: string;
  start_zeit: string;
  end_zeit: string;
  slot: number;
  raum: string | null;
  dozent: string | null;
  klassen: string[];
  gruppe: string | null;
}

export function SchedulerPage() {
  const [module, set_module] = useState<ModulAPI[]>([]);
  const [plan_items, set_plan_items] = useState<PlanItem[]>([]);
  const [filter_text, set_filter_text] = useState("");
  const [meldung, set_meldung] = useState<{ text: string; typ: "success" | "warning" } | null>(null);
  const [editing_item, set_editing_item] = useState<PlanItem | null>(null);
  const [active_drag, set_active_drag] = useState<SidebarTermin | null>(null);
  const [active_drag_info, set_active_drag_info] = useState<ActiveDragInfo | null>(null);

  // Drag braucht etwas Bewegung bevor es startet (damit Klick weiterhin funktioniert)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Module + gespeicherten Wochenplan laden
  const load_all = useCallback(async () => {
    try {
      const [mod_data, schedule_entries] = await Promise.all([
        api_get_modules(),
        api_get_schedule(),
      ]);
      set_module(mod_data.module);
      set_plan_items(schedule_entries.map((e) => ({
        id: String(e.id),
        modul_nummer: e.modul_nummer,
        name: e.display_name,
        typ: e.veranstaltungs_typ,
        tag: e.tag,
        slot: e.slot,
        raum: e.raum,
        dozent: e.dozent,
        gruppe: e.gruppe,
      })));
    } catch { /* Backend offline */ }
  }, []);

  useEffect(() => { load_all(); }, [load_all]);

  const sidebar_termine = build_sidebar_termine(module, filter_text);

  // === Klick: Automatisch am richtigen Slot platzieren ===
  const handle_click_termin = useCallback(async (termin: SidebarTermin) => {
    let item_id = `local-${Date.now()}`;
    try {
      const saved = await api_create_schedule_entry({
        modul_nummer: termin.modul_nummer,
        veranstaltungs_typ: termin.typ,
        display_name: termin.name,
        tag: termin.tag,
        start_zeit: termin.start_zeit,
        end_zeit: termin.end_zeit,
        slot: termin.slot,
        raum: termin.raum,
        dozent: termin.dozent,
        gruppe: termin.gruppe,
      });
      item_id = String(saved.id);
    } catch { /* offline */ }

    set_plan_items((prev) => [...prev, {
      id: item_id,
      modul_nummer: termin.modul_nummer,
      name: termin.name,
      typ: termin.typ,
      tag: termin.tag,
      slot: termin.slot,
      raum: termin.raum,
      dozent: termin.dozent,
      gruppe: termin.gruppe,
    }]);
    set_meldung({ text: `${termin.name} (${termin.typ}) → ${termin.tag} ${termin.start_zeit}`, typ: "success" });
    setTimeout(() => set_meldung(null), 2000);
  }, []);

  // === Drag & Drop ===
  const handle_drag_start = useCallback((event: DragStartEvent) => {
    const termin = event.active.data.current as SidebarTermin;
    set_active_drag(termin);
    set_active_drag_info({ tag: termin.tag, slot: termin.slot });
  }, []);

  const handle_drag_end = useCallback(async (event: DragEndEvent) => {
    set_active_drag(null);
    set_active_drag_info(null);
    const { over, active } = event;
    if (!over) return;

    const drop_target = parse_drop_id(over.id as string);
    if (!drop_target) return;

    const termin = active.data.current as SidebarTermin;

    // NUR am richtigen Tag+Slot ablegen lassen
    if (drop_target.tag !== termin.tag || drop_target.slot !== termin.slot) {
      set_meldung({
        text: `${termin.name} gehört auf ${termin.tag} ${termin.start_zeit} — nicht hier`,
        typ: "warning",
      });
      setTimeout(() => set_meldung(null), 3000);
      return;
    }

    // Platzieren (gleiche Logik wie Klick)
    await handle_click_termin(termin);
  }, [handle_click_termin]);

  // === Entfernen ===
  const handle_remove = useCallback(async (item_id: string) => {
    set_plan_items((prev) => prev.filter((item) => item.id !== item_id));
    try {
      const numeric_id = Number(item_id);
      if (!isNaN(numeric_id)) await api_delete_schedule_entry(numeric_id);
    } catch { /* offline */ }
  }, []);

  // === Bearbeiten ===
  const handle_edit_save = useCallback(async (updated: PlanItem) => {
    set_plan_items((prev) => prev.map((item) => item.id === updated.id ? updated : item));
    set_editing_item(null);

    // In DB aktualisieren: loeschen + neu erstellen (einfachste Methode)
    try {
      const numeric_id = Number(updated.id);
      if (!isNaN(numeric_id)) {
        await api_delete_schedule_entry(numeric_id);
        const saved = await api_create_schedule_entry({
          modul_nummer: updated.modul_nummer,
          veranstaltungs_typ: updated.typ,
          display_name: updated.name,
          tag: updated.tag,
          start_zeit: "", // wird aus slot berechnet
          end_zeit: "",
          slot: updated.slot,
          raum: updated.raum,
          dozent: updated.dozent,
          gruppe: updated.gruppe,
        });
        set_plan_items((prev) => prev.map((item) =>
          item.id === updated.id ? { ...updated, id: String(saved.id) } : item
        ));
      }
    } catch { /* offline */ }
  }, []);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handle_drag_start}
      onDragEnd={handle_drag_end}
    >
      <div className="flex gap-4 h-full">
        {/* Sidebar */}
        <div className="w-[280px] shrink-0 flex flex-col overflow-hidden">
          <h2 className="text-lg font-bold mb-2">Verfügbare Termine</h2>
          <input
            type="text"
            value={filter_text}
            onChange={(e) => set_filter_text(e.target.value)}
            placeholder="Filter (BID, Programmierung...)"
            className="px-2 py-1.5 rounded border border-slate-300 text-xs mb-2
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[10px] text-slate-400 mb-2">
            Klick oder Drag & Drop platziert den Termin im Plan.
          </p>

          <div className="flex-1 overflow-auto space-y-1 pr-1">
            {sidebar_termine.length === 0 && module.length === 0 && (
              <p className="text-slate-400 text-xs text-center py-4">
                Lade erst eine Veranstaltungsliste in der Modulübersicht hoch.
              </p>
            )}
            {sidebar_termine.length === 0 && module.length > 0 && (
              <p className="text-slate-400 text-xs text-center py-4">
                Keine Treffer für „{filter_text}".
              </p>
            )}
            {sidebar_termine.length > 100 && (
              <p className="text-amber-600 text-[10px] text-center mb-1">
                {sidebar_termine.length} Termine — Filter nutzen um einzugrenzen
              </p>
            )}
            {sidebar_termine.slice(0, 100).map((t) => {
              const is_placed = plan_items.some(
                (item) => item.tag === t.tag && item.slot === t.slot
                  && item.modul_nummer === t.modul_nummer && item.typ === t.typ,
              );
              return (
                <DraggableSidebarCard
                  key={t.id}
                  termin={t}
                  is_placed={is_placed}
                  on_click={() => handle_click_termin(t)}
                />
              );
            })}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">Wochenplan</h2>
            {plan_items.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{plan_items.length} Einträge</span>
                <button
                  onClick={async () => { await api_clear_schedule(); set_plan_items([]); }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Alle entfernen
                </button>
              </div>
            )}
          </div>

          {meldung && (
            <div className={`rounded px-3 py-1.5 text-xs mb-2 ${
              meldung.typ === "success"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-amber-50 border border-amber-200 text-amber-700"
            }`}>
              {meldung.text}
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <WeekGrid
              items={plan_items}
              on_remove={handle_remove}
              on_edit={set_editing_item}
              active_drag={active_drag_info}
            />
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {active_drag && <DragOverlayCard termin={active_drag} />}
      </DragOverlay>

      {/* Edit Modal */}
      {editing_item && (
        <EditModal
          item={editing_item}
          on_save={handle_edit_save}
          on_close={() => set_editing_item(null)}
        />
      )}
    </DndContext>
  );
}

/** Draggbare + klickbare Termin-Karte in der Sidebar */
function DraggableSidebarCard({
  termin,
  is_placed,
  on_click,
}: {
  termin: SidebarTermin;
  is_placed: boolean;
  on_click: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: termin.id,
    data: termin,
    disabled: is_placed,
  });

  const style = TYP_FARBEN[termin.typ] || DEFAULT_STYLE;

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={on_click}
      disabled={is_placed}
      className={`
        w-full text-left p-2 rounded-lg border text-xs transition-all
        ${isDragging ? "opacity-30" : ""}
        ${is_placed
          ? "opacity-40 cursor-default bg-slate-50 border-slate-200"
          : `${style.bg} hover:shadow-md cursor-pointer active:scale-[0.98]`
        }
      `}
    >
      <div className="flex items-center gap-1.5">
        <span className={`font-bold text-[10px] ${style.text}`}>{style.label}</span>
        <span className="font-semibold text-slate-800 truncate flex-1">{termin.name}</span>
        {is_placed && <span className="text-green-600 text-[10px]">&#10003;</span>}
      </div>
      <div className="text-slate-500 mt-0.5">
        {termin.tag} {termin.start_zeit}–{termin.end_zeit}
      </div>
      <div className="flex gap-1.5 mt-0.5 text-slate-400">
        {termin.raum && <span>{termin.raum}</span>}
        {termin.dozent && <span>· {termin.dozent}</span>}
        {termin.gruppe && <span>· {termin.gruppe}</span>}
      </div>
    </button>
  );
}

/** Overlay waehrend des Drags */
function DragOverlayCard({ termin }: { termin: SidebarTermin }) {
  const style = TYP_FARBEN[termin.typ] || DEFAULT_STYLE;
  return (
    <div className={`p-2 rounded-lg border ${style.bg} shadow-xl text-xs w-[220px]`}>
      <div className="flex items-center gap-1.5">
        <span className={`font-bold text-[10px] ${style.text}`}>{style.label}</span>
        <span className="font-semibold text-slate-800">{termin.name}</span>
      </div>
      <div className="text-slate-500 mt-0.5">
        {termin.tag} {termin.start_zeit}–{termin.end_zeit}
      </div>
    </div>
  );
}

/** Baut deduplizierte Termin-Liste fuer die Sidebar. */
function build_sidebar_termine(module: ModulAPI[], filter: string): SidebarTermin[] {
  const result: SidebarTermin[] = [];
  const filter_lower = filter.toLowerCase().trim();
  const global_seen = new Set<string>();
  let counter = 0;

  for (const modul of module) {
    if (filter_lower) {
      const name_match = modul.name.toLowerCase().includes(filter_lower);
      const sg_match = modul.studiengaenge.some((sg) => sg.toLowerCase().includes(filter_lower));
      const doz_match = Object.values(modul.dozenten).some((d) => d.toLowerCase().includes(filter_lower));
      if (!name_match && !sg_match && !doz_match) continue;
    }

    for (const veranstaltung of modul.veranstaltungen) {
      for (const termin of veranstaltung.termine) {
        const slot = zeit_zu_slot(termin.start_zeit);
        if (slot < 0) continue;

        const dozent = termin.dozent_name || termin.dozent_kuerzel || null;
        const dedup_key = [modul.modul_nummer, veranstaltung.typ, termin.tag, slot, termin.gruppe || "", dozent || "", termin.raum || ""].join("|");
        if (global_seen.has(dedup_key)) continue;
        global_seen.add(dedup_key);

        counter++;
        result.push({
          id: `sb-${counter}`,
          modul_nummer: modul.modul_nummer,
          name: modul.name,
          typ: veranstaltung.typ,
          tag: termin.tag,
          start_zeit: termin.start_zeit,
          end_zeit: termin.end_zeit,
          slot,
          raum: termin.raum,
          dozent,
          klassen: termin.klassen,
          gruppe: termin.gruppe,
        });
      }
    }
  }

  result.sort((a, b) => {
    const name_cmp = a.name.localeCompare(b.name);
    if (name_cmp !== 0) return name_cmp;
    const day_order = ["Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    return day_order.indexOf(a.tag) - day_order.indexOf(b.tag) || a.start_zeit.localeCompare(b.start_zeit);
  });

  return result;
}
