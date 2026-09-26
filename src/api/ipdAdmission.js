import supabase from '../SupabaseClient';

export const IPD_ADMISSIONS_PAGE_SIZE = 50;

const SEARCH_COLUMNS = ["patient_name", "admission_no", "ipd_number", "phone_no", "whatsapp_no"];

/**
 * Fetches one page of IPD admissions, newest first.
 * Search and date filtering run on the server, so every admission can be found
 * (fetching the whole table was silently capped at 1,000 rows by Supabase).
 *
 * @param {Object} options
 * @param {number} options.page   - Zero-based page number
 * @param {string} options.search - Matches name, admission no, IPD no, phone or WhatsApp
 * @param {string} options.date   - "YYYY-MM-DD": only admissions (planned1) on that day
 * @returns {Promise<{ rows: Array, total: number }>}
 */
export const getIpdAdmissions = async ({ page = 0, search = "", date = "" } = {}) => {
  const from = page * IPD_ADMISSIONS_PAGE_SIZE;

  let query = supabase
    .from("ipd_admissions")
    .select("*", { count: "exact" })
    .order("timestamp", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + IPD_ADMISSIONS_PAGE_SIZE - 1);

  // Drop characters that have a meaning in PostgREST's or() filter syntax.
  const term = search.replace(/[,()"\\]/g, " ").trim();
  if (term) {
    query = query.or(SEARCH_COLUMNS.map((col) => `${col}.ilike."%${term}%"`).join(","));
  }

  if (date) {
    query = query.gte("planned1", `${date} 00:00:00`).lte("planned1", `${date} 23:59:59.999`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data || [], total: count ?? 0 };
};

/**
 * Fetches patients eligible for IPD admission.
 */
export const getEligibleIpdPatients = async () => {
  const { data, error } = await supabase
    .from("patient_admission")
    .select("*")
    .eq("department", "IPD")
    .eq("status", "assigned")
    .is("actual2", null)
    .not("planned2", "is", null)
    .order("timestamp", { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Fetches all master data for IPD Admission form.
 */
export const getIpdMasters = async () => {
  const [deptRes, doctorRes, categoryRes, bedRes] = await Promise.all([
    supabase.from("master").select("department").not("department", "is", null).order("department"),
    supabase.from("doctors").select("id, name").not("name", "is", null).order("name"),
    supabase.from("category").select("name").not("name", "is", null).order("name"),
    supabase.from("all_floor_bed").select("*").order("floor", { ascending: true }).order("ward", { ascending: true }).order("room", { ascending: true }).order("bed", { ascending: true })
  ]);

  if (deptRes.error) throw deptRes.error;
  if (doctorRes.error) throw doctorRes.error;
  if (categoryRes.error) throw categoryRes.error;
  if (bedRes.error) throw bedRes.error;

  return {
    departments: [...new Set(deptRes.data.map(i => i.department).filter(v => v && v.trim() !== ""))],
    doctors: [...new Set(doctorRes.data.map(i => i.name).filter(v => v && v.trim() !== ""))],
    categories: [...new Set(categoryRes.data.map(i => i.name).filter(v => v && v.trim() !== ""))],
    beds: bedRes.data || []
  };
};

/**
 * Saves (Insert/Update) IPD Admission.
 *
 * Bed status and patient_admission.actual2 are set by database triggers on
 * ipd_admissions (see sql_scripts/IPD_ADMISSION_FIX_LOG.md), inside the same
 * transaction as this insert/update, so a save either fully succeeds or fails.
 */
export const saveIpdAdmission = async ({ patientData, isEditing, id }) => {
  if (isEditing) {
    const { data, error } = await supabase
      .from("ipd_admissions")
      .update(patientData)
      .eq("id", id)
      .select();
    if (error) throw error;
    return data[0];
  }

  const { data, error } = await supabase
    .from("ipd_admissions")
    .insert([patientData])
    .select();
  if (error) throw error;
  return data[0];
};

/**
 * Deletes an IPD Admission record.
 */
export const deleteIpdAdmission = async (id, bedInfo) => {
  const { error } = await supabase.from("ipd_admissions").delete().eq("id", id);
  if (error) throw error;

  // Free bed if info provided
  if (bedInfo) {
    await supabase.from("all_floor_bed").update({ status: null })
      .eq("floor", bedInfo.floor)
      .eq("ward", bedInfo.ward)
      .eq("room", bedInfo.room)
      .eq("bed", bedInfo.bed);
  }
  return true;
};
