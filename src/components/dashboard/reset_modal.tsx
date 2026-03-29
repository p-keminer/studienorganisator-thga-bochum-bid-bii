/**
 * Granularer Reset-Dialog: Gezielt Datenkategorien löschen.
 */

import { useState, useEffect, type ReactNode } from "react";
import { api_get_reset_info, api_reset_selective, type ResetInfoAPI } from "../../lib/api_client";

interface ResetModalProps {
  on_close: () => void;
  on_reset_all: () => void;
}

export function ResetModal({ on_close, on_reset_all }: ResetModalProps) {
  const [info, set_info] = useState<ResetInfoAPI | null>(null);
  const [loading, set_loading] = useState(true);
  const [deleting, set_deleting] = useState(false);

  // Checkboxen
  const [del_veranstaltungen, set_del_veranstaltungen] = useState(false);
  const [del_wochenplan, set_del_wochenplan] = useState(false);
  const [del_mh, set_del_mh] = useState<Record<string, boolean>>({});
  const [del_fpo, set_del_fpo] = useState<Record<string, boolean>>({});
  const [del_sv, set_del_sv] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api_get_reset_info().then((data) => {
      set_info(data);
      // Alle Checkboxen vorinitialisieren (aus)
      const mh: Record<string, boolean> = {};
      for (const item of data.modulhandbuch) mh[item.studiengang] = false;
      set_del_mh(mh);
      const fpo: Record<string, boolean> = {};
      for (const item of data.fpo) fpo[item.studiengang] = false;
      set_del_fpo(fpo);
      const sv: Record<string, boolean> = {};
      for (const item of data.studienverlauf) sv[item.plan_name] = false;
      set_del_sv(sv);
      set_loading(false);
    });
  }, []);

  const anything_selected =
    del_veranstaltungen ||
    del_wochenplan ||
    Object.values(del_mh).some(Boolean) ||
    Object.values(del_fpo).some(Boolean) ||
    Object.values(del_sv).some(Boolean);

  const handle_selective_reset = async () => {
    set_deleting(true);
    await api_reset_selective({
      veranstaltungen: del_veranstaltungen || undefined,
      wochenplan: del_wochenplan || undefined,
      modulhandbuch_studiengaenge: Object.entries(del_mh).filter(([, v]) => v).map(([k]) => k),
      fpo_studiengaenge: Object.entries(del_fpo).filter(([, v]) => v).map(([k]) => k),
      studienverlauf_plaene: Object.entries(del_sv).filter(([, v]) => v).map(([k]) => k),
    });
    // Nach dem Löschen: Seite neu laden
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Daten zurücksetzen</h3>
          <button onClick={on_close} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Lade Übersicht...</div>
        ) : info ? (
          <div className="space-y-4">
            {/* Veranstaltungsliste */}
            {info.veranstaltungen > 0 && (
              <Section label="Veranstaltungsliste">
                <CheckRow
                  label={`${info.veranstaltungen} Veranstaltungen + Wochenplan-Einträge`}
                  checked={del_veranstaltungen}
                  onChange={set_del_veranstaltungen}
                />
              </Section>
            )}

            {/* Wochenplan (nur wenn Veranstaltungen nicht schon gewählt) */}
            {info.wochenplan > 0 && !del_veranstaltungen && (
              <Section label="Wochenplan">
                <CheckRow
                  label={`${info.wochenplan} Plan-Einträge`}
                  checked={del_wochenplan}
                  onChange={set_del_wochenplan}
                />
              </Section>
            )}

            {/* Modulhandbücher */}
            {info.modulhandbuch.length > 0 && (
              <Section label="Modulhandbücher">
                {info.modulhandbuch.map((item) => (
                  <CheckRow
                    key={item.studiengang}
                    label={`${item.studiengang} (${item.anzahl} Module)`}
                    checked={!!del_mh[item.studiengang]}
                    onChange={(v) => set_del_mh((prev) => ({ ...prev, [item.studiengang]: v }))}
                  />
                ))}
              </Section>
            )}

            {/* FPO */}
            {info.fpo.length > 0 && (
              <Section label="Prüfungspläne (FPO)">
                {info.fpo.map((item) => (
                  <CheckRow
                    key={item.studiengang}
                    label={`${item.studiengang} (${item.anzahl} Module)`}
                    checked={!!del_fpo[item.studiengang]}
                    onChange={(v) => set_del_fpo((prev) => ({ ...prev, [item.studiengang]: v }))}
                  />
                ))}
              </Section>
            )}

            {/* Studienverlauf */}
            {info.studienverlauf.length > 0 && (
              <Section label="Studienverlauf-Pläne">
                {info.studienverlauf.map((item) => (
                  <CheckRow
                    key={item.plan_name}
                    label={`${item.plan_name} (${item.anzahl} Module)`}
                    checked={!!del_sv[item.plan_name]}
                    onChange={(v) => set_del_sv((prev) => ({ ...prev, [item.plan_name]: v }))}
                  />
                ))}
              </Section>
            )}

            {/* Buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={handle_selective_reset}
                disabled={!anything_selected || deleting}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium
                           hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? "Wird gelöscht..." : "Auswahl löschen"}
              </button>
              <button
                onClick={on_close}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
              >
                Abbrechen
              </button>
            </div>

            <button
              onClick={() => { if (window.confirm("Wirklich ALLE Daten löschen?")) on_reset_all(); }}
              className="w-full text-xs text-slate-400 hover:text-red-500 text-center pt-1"
            >
              Alles löschen
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CheckRow({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-red-500"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}
