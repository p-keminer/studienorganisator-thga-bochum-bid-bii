/**
 * FPO-Seite: Zeigt die Pruefungsplaene aus der Fachpruefungsordnung.
 *
 * Umschaltbar zwischen Vollzeit und Praxisbegleitend.
 * Zeigt Pflichtmodule + Wahlpflichtmodule als Tabelle.
 */

import React, { useState, useEffect, useCallback } from "react";
import { api_get_fpo, api_get_fpo_studiengaenge, type FpoPlanAPI, type FpoModulAPI } from "../../lib/api_client";

export function FpoPage() {
  const [plaene, set_plaene] = useState<FpoPlanAPI[]>([]);
  const [active_variante, set_active_variante] = useState<string>("");
  const [studiengaenge, set_studiengaenge] = useState<string[]>([]);
  const [active_studiengang, set_active_studiengang] = useState<string>("");

  const load = useCallback(async (sg?: string) => {
    const data = await api_get_fpo(sg || undefined);
    set_plaene(data.plaene);
    if (data.plaene.length > 0) {
      set_active_variante(data.plaene[0].variante);
    } else {
      set_active_variante("");
    }
  }, []);

  useEffect(() => {
    api_get_fpo_studiengaenge().then((sg_list) => {
      set_studiengaenge(sg_list);
      if (sg_list.length > 0) {
        set_active_studiengang(sg_list[0]);
        load(sg_list[0]);
      } else {
        load();
      }
    });
  }, [load]);

  const handle_switch_studiengang = (sg: string) => {
    set_active_studiengang(sg);
    set_active_variante("");
    load(sg);
  };

  if (studiengaenge.length === 0 && plaene.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-4">Prüfungsplan (FPO)</h2>
        <p className="text-slate-400">
          Noch keine FPO hochgeladen. Lade die Fachprüfungsordnung (PDF) in der Modulübersicht hoch.
        </p>
      </div>
    );
  }

  const active_plan = plaene.find((p) => p.variante === active_variante);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Prüfungsplan (FPO)</h2>

      {/* Studiengang-Switcher */}
      {studiengaenge.length > 1 && (
        <div className="flex gap-1 mb-3">
          {studiengaenge.map((sg) => (
            <button
              key={sg}
              onClick={() => handle_switch_studiengang(sg)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active_studiengang === sg
                  ? "bg-blue-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {sg}
            </button>
          ))}
        </div>
      )}

      {/* Studiengang-Info wenn nur einer */}
      {studiengaenge.length === 1 && (
        <p className="text-sm text-slate-500 mb-3">{studiengaenge[0]}</p>
      )}

      {/* Varianten-Umschalter */}
      {plaene.length > 1 && (
        <div className="flex gap-1 mb-4">
          {plaene.map((plan) => (
            <button
              key={plan.variante}
              onClick={() => set_active_variante(plan.variante)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active_variante === plan.variante
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {plan.variante}
            </button>
          ))}
        </div>
      )}

      {active_plan && (
        <>
          {/* Pflichtmodule */}
          <PruefungsTabelle
            titel="Pflichtmodule"
            module={active_plan.pflichtmodule}
          />

          {/* Wahlpflichtmodule */}
          {active_plan.wahlpflichtmodule.length > 0 && (
            <PruefungsTabelle
              titel="Empfohlene Wahlpflichtmodule"
              module={active_plan.wahlpflichtmodule}
            />
          )}
        </>
      )}
    </div>
  );
}

function PruefungsTabelle({
  titel,
  module,
}: {
  titel: string;
  module: FpoModulAPI[];
}) {
  // Nach Kategorie gruppieren
  let aktuelle_kategorie: string | null = null;

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-2">{titel}</h3>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-3 py-2 font-medium text-slate-600 w-[100px]">Prüf.-Nr.</th>
              <th className="px-3 py-2 font-medium text-slate-600">Modul</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-center w-[50px]">CP</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-center w-[60px]">PVL</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-center w-[70px]">Prüfung</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-center w-[80px]">Form</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-center w-[50px]">Sem.</th>
            </tr>
          </thead>
          <tbody>
            {module.map((m, i) => {
              const show_kategorie = m.kategorie && m.kategorie !== aktuelle_kategorie;
              if (m.kategorie) aktuelle_kategorie = m.kategorie;

              return (
                <React.Fragment key={`row-${i}`}>
                  {show_kategorie && (
                    <tr className="bg-blue-50">
                      <td colSpan={7} className="px-3 py-1.5 font-semibold text-blue-800 text-xs">
                        {m.kategorie}
                      </td>
                    </tr>
                  )}
                  <tr
                    className={`border-t border-slate-100 hover:bg-slate-50 ${
                      m.pvl ? "bg-amber-50/30" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">
                      {m.pruefungsnummer}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {m.name}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold">
                      {m.cp != null ? (m.cp % 1 === 0 ? m.cp : m.cp.toFixed(1)) : ""}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {m.pvl && (
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                          {m.pvl}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-slate-500">
                      {m.pruefungsereignis}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {m.pruefungsform}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {m.semester && (
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full text-xs font-medium">
                          {m.semester}
                        </span>
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
