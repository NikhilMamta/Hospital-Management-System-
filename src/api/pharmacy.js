import supabase from '../SupabaseClient';

/**
 * Fetches pharmacy indents.
 */
export const getPharmacyIndents = async () => {
  const { data, error } = await supabase
    .from("pharmacy")
    .select("*")
    .order("timestamp", { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Fetches pharmacy indents for a specific patient.
 */
export const getPatientPharmacyIndents = async (ipdNumber) => {
  if (!ipdNumber) return [];

  const { data, error } = await supabase
    .from("pharmacy")
    .select("*")
    .or(`ipd_number.eq.${ipdNumber},admission_number.eq.${ipdNumber}`)
    .order("timestamp", { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Fetches active IPD admissions for patient selection.
 */
export const getActiveAdmissions = async () => {
  const { data, error } = await supabase
    .from("ipd_admissions")
    .select("admission_no, patient_name, consultant_dr, age, gender, ward_type, floor, room, bed_no, ipd_number, planned1, actual1")
    .not("planned1", "is", null)
    .is("actual1", null)
    .order("admission_no", { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Fetches OT information to calculate OT completion days.
 */
export const getOtCompletionDays = async (ipdNumbers) => {
  if (!ipdNumbers || ipdNumbers.length === 0) return {};

  const { data, error } = await supabase
    .from("ot_information")
    .select("ipd_number, actual2, status")
    .in("ipd_number", ipdNumbers)
    .not("actual2", "is", null);

  if (error) throw error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const map = {};
  data.forEach((row) => {
    if (row.status === "Cancel") return;
    const completedDate = new Date(row.actual2);
    completedDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - completedDate) / (1000 * 60 * 60 * 24));
    if (map[row.ipd_number] === undefined || diffDays < map[row.ipd_number]) {
      map[row.ipd_number] = diffDays < 0 ? 0 : diffDays;
    }
  });
  return map;
};

/**
 * Fetches medicine list.
 */
export const getMedicines = async () => {
  const { data, error } = await supabase.from("medicine").select("medicine_name");
  if (error) throw error;
  return (data || []).map(m => m.medicine_name).filter(Boolean);
};

/**
 * Fetches investigation tests.
 */
export const getInvestigations = async () => {
  const { data, error } = await supabase.from("investigation").select("name, type").order("name");
  if (error) throw error;
  
  const tests = {
    Pathology: [],
    'X-ray': [],
    'CT-scan': [],
    USG: []
  };

  data.forEach(item => {
    const type = item.type === 'CT Scan' ? 'CT-scan' : item.type;
    if (tests[type]) {
      tests[type].push(item.name);
    }
  });

  return tests;
};

/**
 * Fetches categories.
 */
export const getCategories = async () => {
  const { data, error } = await supabase.from("category").select("name").order("name");
  if (error) throw error;
  return data || [];
};

/**
 * Generates the next indent number.
 */
export const getNextIndentNumber = async () => {
  const { data, error } = await supabase
    .from("pharmacy")
    .select("indent_no")
    .order("timestamp", { ascending: false })
    .limit(1);

  if (error) throw error;

  if (data && data.length > 0) {
    const last = data[0].indent_no;
    if (last && last.startsWith("IND-")) {
      const num = parseInt(last.replace("IND-", ""), 10);
      if (!isNaN(num)) {
        return `IND-${num >= 15000 ? num + 1 : 15000}`;
      }
    }
  }
  return "IND-15000";
};

/**
 * Creates a new pharmacy indent.
 */
export const createPharmacyIndent = async (indentData) => {
  const { data, error } = await supabase.from("pharmacy").insert(indentData).select();
  if (error) throw error;
  return data[0];
};

/**
 * Updates an existing pharmacy indent.
 */
export const updatePharmacyIndent = async ({ id, updateData }) => {
  const { data, error } = await supabase.from("pharmacy").update(updateData).eq("id", id).select();
  if (error) throw error;
  return data[0];
};

/**
 * Deletes a pharmacy indent.
 */
export const deletePharmacyIndent = async (id) => {
  const { error } = await supabase.from("pharmacy").delete().eq("id", id);
  if (error) throw error;
  return true;
};

/**
 * Fetches all pending indents (patient and departmental).
 */
export const getPendingIndents = async () => {
  const [patientRes, deptRes] = await Promise.all([
    supabase.from("pharmacy").select("*").eq("status", "pending").order("timestamp", { ascending: false }),
    supabase.from("departmental_pharmacy_indent").select("*").eq("status", "pending").order("timestamp", { ascending: false })
  ]);

  if (patientRes.error) throw patientRes.error;
  if (deptRes.error) throw deptRes.error;

  return {
    patient: patientRes.data || [],
    departmental: deptRes.data || []
  };
};

/**
 * Fetches all history indents (approved/rejected).
 */
export const getHistoryIndents = async () => {
  const [patientRes, deptRes] = await Promise.all([
    supabase.from("pharmacy").select("*").in("status", ["approved", "rejected"]).order("actual1", { ascending: false }),
    supabase.from("departmental_pharmacy_indent").select("*").in("status", ["approved", "rejected"]).order("actual1", { ascending: false })
  ]);

  if (patientRes.error) throw patientRes.error;
  if (deptRes.error) throw deptRes.error;

  return {
    patient: patientRes.data || [],
    departmental: deptRes.data || []
  };
};

/**
 * Uploads a base64 pharmacy slip image to storage.
 */
export const uploadSlipToStorage = async (base64Data, indentNumber) => {
  const base64Response = await fetch(base64Data);
  const blob = await base64Response.blob();
  const fileName = `pharmacy_slip_${indentNumber}_${Date.now()}.png`;

  const { error } = await supabase.storage
    .from("slip_image")
    .upload(fileName, blob, { contentType: "image/png", upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from("slip_image").getPublicUrl(fileName);
  return data.publicUrl;
};

/**
 * Updates an indent status and metadata.
 */
export const updateIndentStatus = async ({ table, id, status, updateData }) => {
  const { data, error } = await supabase
    .from(table)
    .update({ 
      status: status.toLowerCase(),
      ...updateData
    })
    .eq("id", id)
    .select();

  if (error) throw error;
  return data[0];
};

/**
 * Fetches indents for the Pharmacy Store (planned2 exists, not rejected).
 */
export const getStoreIndents = async () => {
  const [patientRes, deptRes] = await Promise.all([
    supabase.from("pharmacy").select("*").not("planned2", "is", null).neq("status", "rejected").order("timestamp", { ascending: false }),
    supabase.from("departmental_pharmacy_indent").select("*").not("planned2", "is", null).neq("status", "rejected").order("timestamp", { ascending: false })
  ]);

  if (patientRes.error) throw patientRes.error;
  if (deptRes.error) throw deptRes.error;

  return {
    patient: patientRes.data || [],
    departmental: deptRes.data || []
  };
};

/**
 * Fetches all workflow data for the dashboard.
 */
export const getWorkflowData = async () => {
  const [pharmacyRes, deptRes, staffRes] = await Promise.all([
    supabase.from("pharmacy").select("*").order("timestamp", { ascending: false }),
    supabase.from("departmental_pharmacy_indent").select("*").order("timestamp", { ascending: false }),
    supabase.from("all_staff").select("name, phone_number"),
  ]);

  if (pharmacyRes.error) throw pharmacyRes.error;
  if (deptRes.error) throw deptRes.error;

  const contacts = {};
  (staffRes.data || []).forEach((member) => {
    contacts[member.name] = member.phone_number || "";
  });
  return {
    orders: {
      patient: pharmacyRes.data || [],
      departmental: deptRes.data || [],
    },
    contacts,
  };
};

/**
 * Fetches masters needed for departmental indents.
 */
export const getDepartmentalMasters = async () => {
  const [floorBedRes, medicineRes] = await Promise.all([
    supabase.from("all_floor_bed").select("floor, ward, room"),
    supabase.from("medicine").select("medicine_name").order("medicine_name").limit(5000),
  ]);

  if (floorBedRes.error) throw floorBedRes.error;
  if (medicineRes.error) throw medicineRes.error;

  return {
    locations: floorBedRes.data || [],
    medicines: (medicineRes.data || []).map(m => m.medicine_name).filter(Boolean),
  };
};

/**
 * Fetches all departmental indents.
 */
export const getDepartmentalIndentsList = async () => {
  const { data, error } = await supabase
    .from("departmental_pharmacy_indent")
    .select("*")
    .order("timestamp", { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Creates a new departmental indent.
 */
export const createDepartmentalIndent = async (payload) => {
  const { data, error } = await supabase
    .from("departmental_pharmacy_indent")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Updates an existing departmental indent.
 */
export const updateDepartmentalIndent = async (id, payload) => {
  const { data, error } = await supabase
    .from("departmental_pharmacy_indent")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Deletes a departmental indent.
 */
export const deleteDepartmentalIndent = async (id) => {
  const { error } = await supabase
    .from("departmental_pharmacy_indent")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return true;
};
