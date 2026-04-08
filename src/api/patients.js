import supabase from '../SupabaseClient';

/**
 * Fetches all patient admissions.
 */
export const getPatients = async () => {
  const { data, error } = await supabase
    .from("patient_admission")
    .select("*")
    .order("timestamp", { ascending: false });

  if (error) throw error;

  return (data || []).map((patient) => ({
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
