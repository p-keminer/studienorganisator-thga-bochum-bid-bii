/**
 * React Hook fuer Modul-Daten vom Backend.
 */

import { useState, useEffect, useCallback } from "react";
import {
  api_get_modules,
  api_upload_document,
  api_reset_database,
  api_has_any_data,
  type ModulAPI,
  type UploadResultat,
} from "../lib/api_client";

export interface ModulFilter {
  studiengang: string;
  semester: number | null;
  suche: string;
}

export function use_modules() {
  const [module, set_module] = useState<ModulAPI[]>([]);
  const [total, set_total] = useState(0);
  /** true wenn die DB ueberhaupt Daten hat (unabhaengig vom Filter) */
  const [db_has_data, set_db_has_data] = useState(false);
  const [semester_info, set_semester_info] = useState<string | null>(null);
  const [stand_info, set_stand_info] = useState<string | null>(null);
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [filter, set_filter] = useState<ModulFilter>({
    studiengang: "",
    semester: null,
    suche: "",
  });
  const [upload_result, set_upload_result] = useState<UploadResultat | null>(
    null,
  );

  const load_modules = useCallback(async () => {
    set_loading(true);
    set_error(null);
    try {
      // Gefilterte Daten laden
      const data = await api_get_modules({
        studiengang: filter.studiengang || undefined,
        semester: filter.semester ?? undefined,
        suche: filter.suche || undefined,
      });
      set_module(data.module);
      set_total(data.total);
      set_semester_info(data.semester);
      set_stand_info(data.stand);

      // DB-Check: Prüfe ob irgendwelche Daten existieren (inkl. Modulhandbuch, FPO)
      if (data.total > 0 || !!data.semester) {
        set_db_has_data(true);
      } else {
        // Auch Modulhandbuch/FPO prüfen
        const has_data = await api_has_any_data();
        set_db_has_data(has_data);
      }
    } catch (e) {
      set_error(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      set_loading(false);
    }
  }, [filter]);

  const upload_file = useCallback(async (file: File) => {
    set_loading(true);
    set_error(null);
    set_upload_result(null);
    try {
      const result = await api_upload_document(file);
      set_upload_result(result);
      // Nach Upload: Module neu laden (ohne Filter, damit alles sichtbar)
      const data = await api_get_modules();
      set_module(data.module);
      set_total(data.total);
      set_semester_info(data.semester);
      set_stand_info(data.stand);
      // db_has_data: true wenn Veranstaltungen ODER andere Daten hochgeladen
      set_db_has_data(data.total > 0 || !!result.doc_type);
      // Filter zuruecksetzen damit alle Module sichtbar sind
      set_filter({ studiengang: "", semester: null, suche: "" });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload fehlgeschlagen";
      set_error(msg);
      throw e;
    } finally {
      set_loading(false);
    }
  }, []);

  const reset_db = useCallback(async () => {
    set_loading(true);
    try {
      await api_reset_database();
      set_module([]);
      set_total(0);
      set_db_has_data(false);
      set_semester_info(null);
      set_stand_info(null);
      set_upload_result(null);
      set_error(null);
    } finally {
      set_loading(false);
    }
  }, []);

  useEffect(() => {
    load_modules();
  }, [load_modules]);

  return {
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
    reload: load_modules,
  };
}
