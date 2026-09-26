import supabase from '../SupabaseClient';
import { cleanSearchTerm, ilikeAny } from '../utils/supabaseQuery';

export const PATIENTS_PAGE_SIZE = 50;

// Columns used by the Admission list and its edit form
const PATIENT_COLUMNS =
  "id, admission_no, patient_name, phone_no, attender_name, reason_for_visit, date_of_birth, age, gender, status, timestamp, submitted_by";

const SEARCH_COLUMNS = ["patient_name", "phone_no", "admission_no", "attender_name"];

/**
 * Fetches one page of patient admissions, newest first.
 * Search and the date of birth filter run on the server, so every patient can
 * be found (fetching the whole table was silently capped at 1,000 rows).
 *
 * @param {Object} options
 * @param {number} options.page   - Zero-based page number
 * @param {string} options.search - Matches name, phone, admission no or attender name
 * @param {string} options.date   - "YYYY-MM-DD": only patients with that date of birth
 * @returns {Promise<{ rows: Array, total: number }>}
 */
export const getPatients = async ({ page = 0, search = "", date = "" } = {}) => {
  const from = page * PATIENTS_PAGE_SIZE;

  let query = supabase
    .from("patient_admission")
    .select(PATIENT_COLUMNS, { count: "exact" })
    .order("timestamp", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + PATIENTS_PAGE_SIZE - 1);

  const term = cleanSearchTerm(search);
  if (term) query = query.or(ilikeAny(SEARCH_COLUMNS, term));
  if (date) query = query.eq("date_of_birth", date);

  const { data, error, count } = await query;

  if (error) throw error;

  const rows = (data || []).map((patient) => ({
    id: patient.id,
    admissionNo:
      patient.admission_no ||
      `ADM-${patient.id?.toString().padStart(3, "0") || "001"}`,
    patientName: patient.patient_name || "",
    phoneNumber: patient.phone_no || "",
    attenderName: patient.attender_name || "",
    reasonForVisit: patient.reason_for_visit || "",
    dateOfBirth: patient.date_of_birth || "",
    age: patient.age || calculateAge(patient.date_of_birth),
    gender: patient.gender || "Male",
    status: patient.status || "pending",
    timestamp: patient.timestamp || "",
    timestampFormatted: patient.timestamp ? patient.timestamp : "-",
    submittedBy: patient.submitted_by || "-",
  }));

  return { rows, total: count ?? 0 };
};

/**
 * Helper to calculate age from DOB
 */
const calculateAge = (dob) => {
  if (!dob) return "";
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * Creates a new patient admission.
 */
export const createPatient = async (patientData) => {
  const { data, error } = await supabase
    .from("patient_admission")
    .insert(patientData)
    .select();

  if (error) throw error;
  return data[0];
};

/**
 * Updates an existing patient admission.
 */
export const updatePatient = async ({ id, updateData }) => {
  const { data, error } = await supabase
    .from("patient_admission")
    .update(updateData)
    .eq("id", id)
    .select();

  if (error) throw error;
  return data[0];
};
