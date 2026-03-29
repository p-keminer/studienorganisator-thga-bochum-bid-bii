/**
 * Droppable Zeitslot im Wochenplan-Grid.
 *
 * Jede Zelle (Tag + Zeitslot) ist ein Drop-Target.
 */

import { useDroppable } from "@dnd-kit/core";
import type { PlanItem } from "./week_grid";

/** Farbe pro Veranstaltungstyp */
const TYP_BG: Record<string, string> = {
  V: "bg-blue-100 border-blue-300",
  Ü: "bg-purple-100 border-purple-300",
  P: "bg-red-100 border-red-300",
  S: "bg-amber-100 border-amber-300",
  SU: "bg-emerald-100 border-emerald-300",
};

interface DroppableSlotProps {
  id: string;
  /** Bereits platziertes Item (falls vorhanden) */
  item: PlanItem | null;
  /** Entfernen-Handler */
  on_remove: (item_id: string) => void;
}

export function DroppableSlot({ id, item, on_remove }: DroppableSlotProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[40px] transition-colors relative
        ${isOver ? "bg-blue-100 ring-2 ring-blue-400 ring-inset" : "bg-white"}
        ${!item ? "hover:bg-slate-50" : ""}
      `}
    >
      {item && (
        <PlacedItem item={item} on_remove={() => on_remove(item.id)} />
      )}
    </div>
  );
}

/** Ein platziertes Element im Grid */
function PlacedItem({
  item,
  on_remove,
}: {
  item: PlanItem;
  on_remove: () => void;
}) {
  const style = TYP_BG[item.typ] || "bg-slate-100 border-slate-300";

  return (
    <div
      className={`absolute inset-0.5 rounded border ${style} p-1 text-[10px] overflow-hidden group`}
    >
      {/* Entfernen-Button */}
      <button
        onClick={on_remove}
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white
                   text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100
                   transition-opacity hover:bg-red-600"
        title="Entfernen"
      >
        x
      </button>

      <div className="font-semibold text-slate-800 truncate leading-tight">
        {item.name}
      </div>
      {item.raum && (
        <div className="text-slate-500 truncate">{item.raum}</div>
      )}
      {item.dozent && (
        <div className="text-slate-400 truncate">{item.dozent}</div>
      )}
    </div>
  );
}
