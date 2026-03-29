/**
 * Draggbares Veranstaltungs-Element fuer die Sidebar des Wochenplaners.
 *
 * Kann aus der Sidebar in das Wochenplan-Grid gezogen werden.
 */

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

/** Farbe pro Veranstaltungstyp */
const TYP_FARBEN: Record<string, string> = {
  V: "bg-blue-500",
  Ü: "bg-purple-500",
  P: "bg-red-500",
  S: "bg-amber-500",
  SU: "bg-emerald-500",
};

export interface DragEventData {
  modul_nummer: string;
  name: string;
  typ: string;
  tag: string;
  start_zeit: string;
  end_zeit: string;
  raum: string | null;
  dozent: string | null;
  klassen: string[];
  gruppe: string | null;
}

interface DraggableEventProps {
  id: string;
  data: DragEventData;
}

export function DraggableEvent({ id, data }: DraggableEventProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, data });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const typ_color = TYP_FARBEN[data.typ] || "bg-slate-500";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        flex items-start gap-2 p-2 rounded-lg border cursor-grab
        bg-white hover:shadow-md transition-shadow text-xs
        ${isDragging ? "opacity-50 shadow-lg z-50" : "border-slate-200"}
      `}
    >
      {/* Typ-Indikator */}
      <div className={`w-1 self-stretch rounded-full ${typ_color} shrink-0`} />

      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-800 truncate">
          {data.name}
        </div>
        <div className="text-slate-500 mt-0.5">
          {data.tag} {data.start_zeit}–{data.end_zeit}
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {data.raum && (
            <span className="bg-slate-100 px-1 rounded text-[10px]">
              {data.raum}
            </span>
          )}
          {data.dozent && (
            <span className="text-slate-400 text-[10px]">{data.dozent}</span>
          )}
          {data.gruppe && (
            <span className="text-blue-500 text-[10px]">{data.gruppe}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Overlay-Version die waehrend des Drags angezeigt wird */
export function DragOverlay({ data }: { data: DragEventData }) {
  const typ_color = TYP_FARBEN[data.typ] || "bg-slate-500";

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg border border-blue-400 bg-white shadow-xl text-xs w-[200px]">
      <div className={`w-1 self-stretch rounded-full ${typ_color} shrink-0`} />
      <div>
        <div className="font-semibold text-slate-800">{data.name}</div>
        <div className="text-slate-500">
          {data.tag} {data.start_zeit}–{data.end_zeit}
        </div>
      </div>
    </div>
  );
}
