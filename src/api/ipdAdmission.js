import supabase from '../SupabaseClient';

/**
 * Fetches all IPD admission records.
 */
export const getIpdAdmissions = async () => {
  const { data, error } = await supabase
    .from("ipd_admissions")
    .select("*")
    .order("timestamp", { ascending: false });

  if (error) throw error;
  return data || [];
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
 */
export const saveIpdAdmission = async ({ patientData, isEditing, id }) => {
  let result;
  if (isEditing) {
    const { data, error } = await supabase
      .from("ipd_admissions")
      .update(patientData)
      .eq("id", id)
      .select();
    if (error) throw error;
    result = data[0];
  } else {
    const { data, error } = await supabase
      .from("ipd_admissions")
      .insert([patientData])
      .select();
    if (error) throw error;
    result = data[0];
  }

  // Chain updates
  await Promise.all([
    // Occupy bed
    supabase.from("all_floor_bed").update({ status: "Occupied" })
      .eq("floor", patientData.floor)
      .eq("ward", patientData.ward_type)
      .eq("room", patientData.room)
      .eq("bed", patientData.bed_no),
    
    // Mark patient admission as completed in IPD selection
    !isEditing ? supabase.from("patient_admission").update({
      actual2: new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata", hour12: false }).replace(",", "")
    }).eq("admission_no", patientData.admission_no) : Promise.resolve()
  ]);

  return result;
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
