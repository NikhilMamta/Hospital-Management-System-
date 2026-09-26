/**
 * Realtime filters for patient-specific screens.
 *
 * A screen showing one patient should reload only when a change belongs to that
 * patient, not for every change anywhere in the hospital. Pass the result as the
 * `shouldHandleChange` predicate of useRealtimeTable, or as `options.filter` of
 * useRealtimeQuery.
 */

/**
 * @param {Object}   payload - Supabase realtime payload ({ eventType, new, old })
 * @param {string[]} keys    - Columns that hold the patient id on this table, e.g. ["Ipd_number"]
 * @param {string|number} patientId - The value shown on screen (IPD number, row id, ...)
 * @returns {boolean} true when the change belongs to this patient (or cannot be told apart)
 */
export const isChangeForPatient = (payload, keys, patientId) => {
  const target = String(patientId ?? "").trim();

  // No patient yet (still loading) or a screen showing everyone: keep reloading
  if (!target || target === "N/A") return true;

  // DELETE events usually carry only the primary key, so we can't tell whose
  // row it was; reload to be safe (deletes are rare).
  const old = payload?.old || {};
  if (payload?.eventType === "DELETE" && !keys.some((key) => old[key] != null)) {
    return true;
  }

  const rows = [payload?.new, payload?.old].filter(Boolean);
  return rows.some((row) =>
    keys.some((key) => String(row?.[key] ?? "").trim() === target),
  );
};
