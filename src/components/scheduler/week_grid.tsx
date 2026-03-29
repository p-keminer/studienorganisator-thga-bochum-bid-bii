/**
 * Wochenplan-Grid mit THGA-Zeitraster.
 *
 * Features:
 * - Mehrere Eintraege pro Zeitslot (nebeneinander)
 * - Einstellbare Zellengroesse (S/M/L/XL)
 * - Drop-Targets: Module koennen per Drag & Drop platziert werden
 * - Bearbeiten: Klick auf ein Modul oeffnet ein Edit-Popup (Raum aendern etc.)
 */

import React, { useState } from "react";
import { useDroppable } from "@dnd-kit/core";

export interface PlanItem {
  id: string;
  modul_nummer: string;
  name: string;
  typ: string;
  tag: string;
  slot: number;
  raum: string | null;
  dozent: string | null;
  gruppe: string | null;
}

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr"];

const SLOTS: { slot: number; start: string; end: string }[] = [
  { slot: 0, start: "7:30", end: "8:15" },
  { slot: 1, start: "8:15", end: "9:00" },
  { slot: 2, start: "9:15", end: "10:00" },
  { slot: 3, start: "10:15", end: "11:00" },
  { slot: 4, start: "11:15", end: "12:00" },
  { slot: 5, start: "12:15", end: "13:00" },
  { slot: 6, start: "13:15", end: "14:00" },
  { slot: 7, start: "14:15", end: "15:00" },
  { slot: 8, start: "15:15", end: "16:00" },
  { slot: 9, start: "16:15", end: "17:00" },
  { slot: 10, start: "17:15", end: "18:00" },
  { slot: 11, start: "18:00", end: "18:45" },
  { slot: 12, start: "18:45", end: "19:30" },
  { slot: 13, start: "19:45", end: "20:30" },
  { slot: 14, start: "20:30", end: "21:15" },
  { slot: 15, start: "21:15", end: "22:00" },
];

export function zeit_zu_slot(start_zeit: string): number {
  return SLOTS.findIndex((s) => s.start === start_zeit);
}

/** Erzeugt eine Drop-ID aus Tag + Slot */
export function make_drop_id(tag: string, slot: number): string {
  return `drop-${tag}-${slot}`;
}

/** Parst eine Drop-ID zurueck */
export function parse_drop_id(id: string): { tag: string; slot: number } | null {
  const match = String(id).match(/^drop-(Mo|Di|Mi|Do|Fr|Sa)-(\d+)$/);
  if (!match) return null;
  return { tag: match[1], slot: parseInt(match[2]) };
}

const TYP_STYLE: Record<string, { bg: string; badge: string; label: string }> = {
  V:  { bg: "bg-blue-100 border-blue-300 text-blue-900",       badge: "bg-blue-500",    label: "V" },
  Ü:  { bg: "bg-purple-100 border-purple-300 text-purple-900", badge: "bg-purple-500",  label: "Ü" },
  P:  { bg: "bg-red-100 border-red-300 text-red-900",          badge: "bg-red-500",     label: "P" },
  S:  { bg: "bg-amber-100 border-amber-300 text-amber-900",    badge: "bg-amber-500",   label: "S" },
  SU: { bg: "bg-emerald-100 border-emerald-300 text-emerald-900", badge: "bg-emerald-500", label: "SU" },
};
const DEFAULT_STYLE = { bg: "bg-slate-100 border-slate-300 text-slate-900", badge: "bg-slate-500", label: "?" };

const SIZE_PRESETS = [
  { label: "S", height: 40, font: "text-[8px]" },
  { label: "M", height: 60, font: "text-[9px]" },
  { label: "L", height: 80, font: "text-[10px]" },
  { label: "XL", height: 110, font: "text-[11px]" },
];

/** Info ueber den aktuell gedraggten Termin (fuer gruen/rot Highlighting) */
export interface ActiveDragInfo {
  tag: string;
  slot: number;
}

interface WeekGridProps {
  items: PlanItem[];
  on_remove: (item_id: string) => void;
  on_edit: (item: PlanItem) => void;
  active_drag: ActiveDragInfo | null;
}

export function WeekGrid({ items, on_remove, on_edit, active_drag }: WeekGridProps) {
  const [size_index, set_size_index] = useState(1);
  const size = SIZE_PRESETS[size_index];

  const item_map = new Map<string, PlanItem[]>();
  for (const item of items) {
    const key = `${item.tag}-${item.slot}`;
    const existing = item_map.get(key) || [];
    existing.push(item);
    item_map.set(key, existing);
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-2 justify-end">
        <span className="text-[10px] text-slate-400 mr-1">Zellengröße:</span>
        {SIZE_PRESETS.map((preset, i) => (
          <button
            key={preset.label}
            onClick={() => set_size_index(i)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              i === size_index
                ? "bg-blue-500 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className={`grid grid-cols-[70px_repeat(5,1fr)] gap-px bg-slate-200 rounded-lg overflow-hidden ${size.font}`}>
        <div className="bg-slate-50 p-2 text-center text-[10px] font-medium text-slate-500">Zeit</div>
        {DAYS.map((day) => (
          <div key={day} className="bg-slate-50 p-2 text-center font-semibold text-sm text-slate-700">{day}</div>
        ))}

        {SLOTS.map((slot_info) => (
          <React.Fragment key={`row-${slot_info.slot}`}>
            <div className="bg-slate-50 p-1 text-[10px] text-slate-500 text-center flex flex-col items-center justify-center">
              <span>{slot_info.start}</span>
              <span className="text-slate-300">–</span>
              <span>{slot_info.end}</span>
            </div>

            {DAYS.map((day) => {
              const key = `${day}-${slot_info.slot}`;
              const cell_items = item_map.get(key) || [];

              // Waehrend eines Drags: ist diese Zelle der richtige Slot?
              const is_valid_target = active_drag
                ? active_drag.tag === day && active_drag.slot === slot_info.slot
                : null; // null = kein Drag aktiv

              return (
                <DroppableCell
                  key={key}
                  drop_id={make_drop_id(day, slot_info.slot)}
                  items={cell_items}
                  size_height={size.height}
                  on_remove={on_remove}
                  on_edit={on_edit}
                  is_valid_target={is_valid_target}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/** Droppable Zelle — nimmt Drag & Drop Elemente an */
function DroppableCell({
  drop_id,
  items,
  size_height,
  on_remove,
  on_edit,
  is_valid_target,
}: {
  drop_id: string;
  items: PlanItem[];
  size_height: number;
  on_remove: (id: string) => void;
  on_edit: (item: PlanItem) => void;
  /** null = kein Drag aktiv, true = gueltig (gruen), false = ungueltig (rot) */
  is_valid_target: boolean | null;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: drop_id });

  // Hintergrundfarbe bestimmen
  let bg_class = "bg-white";
  if (is_valid_target !== null) {
    // Drag ist aktiv — alle Zellen einfaerben
    if (is_valid_target) {
      bg_class = isOver
        ? "bg-green-200 ring-2 ring-green-500 ring-inset"
        : "bg-green-50";
    } else {
      bg_class = isOver
        ? "bg-red-200 ring-2 ring-red-400 ring-inset"
        : "bg-red-50/40";
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`relative transition-colors ${bg_class}`}
      style={{ minHeight: `${size_height}px` }}
    >
      {items.length > 0 && (
        <div className="absolute inset-0 flex gap-px p-px">
          {items.map((item) => (
            <PlacedItem
              key={item.id}
              item={item}
              count={items.length}
              size_height={size_height}
              on_remove={() => on_remove(item.id)}
              on_edit={() => on_edit(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlacedItem({
  item,
  count,
  size_height,
  on_remove,
  on_edit,
}: {
  item: PlanItem;
  count: number;
  size_height: number;
  on_remove: () => void;
  on_edit: () => void;
}) {
  const style = TYP_STYLE[item.typ] || DEFAULT_STYLE;
  const show_details = size_height >= 60;
  const show_dozent = size_height >= 80 && count <= 2;

  return (
    <div
      onClick={on_edit}
      className={`flex-1 min-w-0 rounded border ${style.bg} p-0.5 overflow-hidden group cursor-pointer relative`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); on_remove(); }}
        className="absolute top-0 right-0.5 w-3 h-3 rounded-full bg-red-500 text-white
                   text-[7px] flex items-center justify-center opacity-0 group-hover:opacity-100
                   transition-opacity hover:bg-red-600 cursor-pointer z-10"
        title="Entfernen"
      >
        x
      </button>

      <div className="flex items-center gap-0.5 leading-tight">
        <span className={`${style.badge} text-white rounded px-0.5 font-bold shrink-0`} style={{ fontSize: "7px" }}>
          {style.label}
        </span>
        <span className="font-semibold truncate">{item.name}</span>
      </div>
      {show_details && item.raum && <div className="opacity-70 truncate">{item.raum}</div>}
      {show_dozent && item.dozent && <div className="opacity-60 truncate">{item.dozent}</div>}
      {show_details && item.gruppe && <div className="text-blue-600 truncate">{item.gruppe}</div>}
    </div>
  );
}

/** Edit-Modal fuer einen Wochenplan-Eintrag */
export function EditModal({
  item,
  on_save,
  on_close,
}: {
  item: PlanItem;
  on_save: (updated: PlanItem) => void;
  on_close: () => void;
}) {
  const [raum, set_raum] = useState(item.raum || "");
  const [dozent, set_dozent] = useState(item.dozent || "");
  const [gruppe, set_gruppe] = useState(item.gruppe || "");

  const style = TYP_STYLE[item.typ] || DEFAULT_STYLE;
  const slot_info = SLOTS[item.slot];

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={on_close}>
      <div className="bg-white rounded-xl shadow-xl p-5 w-[380px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`${style.badge} text-white rounded px-1.5 py-0.5 text-xs font-bold`}>
            {style.label}
          </span>
          <h3 className="font-bold text-lg">{item.name}</h3>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          {item.tag} {slot_info?.start}–{slot_info?.end} · {item.modul_nummer}
        </p>

        {/* Felder */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Raum</label>
            <input
              type="text"
              value={raum}
              onChange={(e) => set_raum(e.target.value)}
              placeholder="z.B. G1 R119, EDV R101, NTL"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Dozent</label>
            <input
              type="text"
              value={dozent}
              onChange={(e) => set_dozent(e.target.value)}
              placeholder="z.B. Welp, Keune"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Gruppe</label>
            <input
              type="text"
              value={gruppe}
              onChange={(e) => set_gruppe(e.target.value)}
              placeholder="z.B. Gr.1"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={on_close}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
          >
            Abbrechen
          </button>
          <button
            onClick={() => on_save({
              ...item,
              raum: raum || null,
              dozent: dozent || null,
              gruppe: gruppe || null,
            })}
            className="px-4 py-2 rounded-lg text-sm bg-blue-500 text-white hover:bg-blue-600"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
