import supabase from '../SupabaseClient';

/**
 * Fetches discharged admission numbers from the discharge table.
 */
export const getDischargedAdmissions = async () => {
  const { data, error } = await supabase
    .from("discharge")
    .select("admission_no");

  if (error) throw error;
  
  const set = new Set(
    (data || [])
      .map((d) => String(d.admission_no || "").trim().toLowerCase())
      .filter(Boolean)
  );
  return set;
};

/**
 * Fetches IPD admissions based on user role and assigned tasks.
 */
export const fetchIpdPatients = async ({ userRole, userName, doctorTab, shiftRange }) => {
  let ipdNumbers = [];
  let shouldFilter = false;

  // NURSE / OT / OT STAFF
  if (["nurse", "ot", "ot staff"].includes(userRole)) {
    shouldFilter = true;
    const { data, error } = await supabase
      .from("nurse_assign_task")
      .select("Ipd_number")
      .ilike("assign_nurse", `%${userName.trim()}%`)
      .not("Ipd_number", "is", null);

    if (error) throw error;
    if (data) {
      ipdNumbers = Array.from(
        new Set(
          data
            .map((t) => t.Ipd_number)
            .filter((num) => num)
            .map((num) => String(num).trim())
        )
      );
    }
  }
  // RMO
  else if (userRole === "rmo") {
    shouldFilter = true;
    const { data, error } = await supabase
      .from("rmo_assign_task")
      .select("ipd_number")
      .eq("assign_rmo", userName)
      .gte("planned1", shiftRange.start)
      .lte("planned1", shiftRange.end);

    if (error) throw error;
    if (data) {
      ipdNumbers = data.map((t) => t.ipd_number);
    }
  }

  // FETCH PATIENTS
  let query = supabase
    .from("ipd_admissions")
    .select("*")
    .order("timestamp", { ascending: false });

  if (userRole === "doctor") {
    if (doctorTab === "active" || doctorTab === "discharged") {
      query = query.eq("consultant_dr", userName);
    }
  }

  if (shouldFilter) {
    if (ipdNumbers.length > 0) {
      query = query.in("ipd_number", ipdNumbers);
    } else {
      query = query.eq("id", -1); // Force empty result if should filter but no IDs found
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/**
 * Deletes a patient admission record.
 */
export const deleteIpdPatient = async (patientId) => {
  const { error } = await supabase
    .from("ipd_admissions")
    .delete()
    .eq("id", patientId);

  if (error) throw error;
  return true;
};

/**
 * Fetches a single patient's full details and transforms it for the UI.
 */
export const fetchPatientDetails = async (patientId) => {
  const { data: patient, error } = await supabase
    .from('ipd_admissions')
    .select(`
      id, patient_name, ipd_number, age, gender, phone_no, 
      house_no_street, area_colony, city, state, pincode, 
      consultant_dr, refer_by_dr, 
      kin_name, kin_mobile_no, kin_relation, 
      timestamp, patient_case, 
      medical_surgical, adm_purpose, 
      status, department, ward_no, bed_location, location_status, 
      bed_no, room, ward_type, 
      advance_amount, 
      pat_category, diagnosis
    `)
    .eq('id', patientId)
    .single();

  if (error) throw error;
  if (!patient) throw new Error('Patient not found');

  // Fetch UHID from pharmacy table
  const ipdNumber = patient.ipd_number || patient.id;
  let uhidFromPharmacy = null;
  
  if (ipdNumber && ipdNumber !== 'N/A') {
    const { data: pharmacyData } = await supabase
      .from('pharmacy')
      .select('uhid_number')
      .eq('ipd_number', ipdNumber)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    
    uhidFromPharmacy = pharmacyData?.uhid_number || null;
  }

  return transformPatientData(patient, uhidFromPharmacy);
};

// --- Transformation Helpers ---

const transformPatientData = (patient, uhidFromPharmacy) => {
  const defaultTasks = {
    nurseTasks: [
      { id: 1, task: 'Vital Signs Monitoring', status: 'Pending', time: 'N/A', assignedTo: 'Nurse on Duty', dueDate: new Date().toISOString().split('T')[0] },
      { id: 2, task: 'Medication Administration', status: 'Pending', time: 'N/A', assignedTo: 'Nurse on Duty', dueDate: new Date().toISOString().split('T')[0] },
      { id: 3, task: 'Blood Sample Collection', status: 'Pending', time: 'N/A', assignedTo: 'Nurse on Duty', dueDate: new Date().toISOString().split('T')[0] },
      { id: 4, task: 'Wound Dressing', status: 'Pending', time: 'N/A', assignedTo: 'Nurse on Duty', dueDate: new Date().toISOString().split('T')[0] },
      { id: 5, task: 'Patient Hygiene Care', status: 'Pending', time: 'N/A', assignedTo: 'Nurse on Duty', dueDate: new Date().toISOString().split('T')[0] },
      { id: 6, task: 'ECG Monitoring Setup', status: 'Pending', time: 'N/A', assignedTo: 'Nurse on Duty', dueDate: new Date().toISOString().split('T')[0] },
    ],
    labTests: [
      { name: 'Complete Blood Count (CBC)', type: 'Pathology', status: 'Pending', requestDate: new Date().toISOString().split('T')[0], reportDate: 'N/A', results: 'Awaiting sample collection' },
      { name: 'Blood Glucose', type: 'Pathology', status: 'Pending', requestDate: new Date().toISOString().split('T')[0], reportDate: 'N/A', results: 'Awaiting sample collection' },
      { name: 'Chest X-Ray', type: 'Radiology', status: 'Pending', requestDate: new Date().toISOString().split('T')[0], reportDate: 'N/A', results: 'Awaiting scan' },
    ],
    pharmacyIndent: [
      { date: new Date().toISOString().split('T')[0], medicineName: 'To be prescribed', quantity: 0, status: 'Pending', approvedBy: 'Pending' },
    ],
    treatmentPlan: {
      diagnosis: patient.diagnosis || 'To be diagnosed by doctor',
      procedures: [{ name: 'Initial Assessment', date: new Date().toISOString().split('T')[0], status: 'Scheduled', notes: 'Pending doctor review' }],
      medications: [],
    },
    vitalsMonitoring: { lastUpdated: new Date().toLocaleString(), bloodPressure: 'N/A', heartRate: 'N/A', temperature: 'N/A', respiratoryRate: 'N/A', oxygenSaturation: 'N/A', status: 'Pending Assessment' },
    staffAssigned: {
      rmo: { name: 'To be assigned', designation: 'Resident Medical Officer', contact: 'N/A', assignedDate: new Date().toISOString().split('T')[0] },
      nurses: [
        { name: 'To be assigned', shift: 'Morning (6 AM - 2 PM)', assignedDate: new Date().toISOString().split('T')[0] },
        { name: 'To be assigned', shift: 'Evening (2 PM - 10 PM)', assignedDate: new Date().toISOString().split('T')[0] },
        { name: 'To be assigned', shift: 'Night (10 PM - 6 AM)', assignedDate: new Date().toISOString().split('T')[0] },
      ],
    },
  };

  return {
    personalInfo: {
      name: patient.patient_name || 'N/A',
      uhid: uhidFromPharmacy || patient.id || 'N/A',
      ipd: patient.ipd_number || 'N/A',
      age: patient.age || 'N/A',
      gender: patient.gender || 'N/A',
      phone: patient.phone_no || 'N/A',
      address: formatAddress(patient),
      consultantDr: patient.consultant_dr || 'To be assigned',
      allergies: 'None reported',
      emergencyContact: formatEmergencyContact(patient),
    },
    admissionInfo: {
      admissionDate: patient.timestamp || new Date().toLocaleString(),
      admissionType: patient.patient_case || 'General',
      admissionMode: patient.medical_surgical || 'N/A',
      reasonForAdmission: patient.adm_purpose || 'N/A',
      status: patient.status || 'Active',
    },
    departmentInfo: {
      department: patient.department || 'N/A',
      ward: patient.ward_no || patient.bed_location || 'N/A',
      bedNumber: patient.bed_no || 'N/A',
      room: patient.room || 'N/A',
      ward_type: patient.ward_type || 'N/A',
      bedStatus: 'Occupied',
    },
    doctorInfo: {
      primaryDoctor: patient.consultant_dr || 'To be assigned',
      specialty: patient.department || 'N/A',
      consultants: patient.refer_by_dr ? [patient.refer_by_dr] : [],
      doctorPhone: 'N/A',
      officeHours: '10:00 AM - 4:00 PM',
    },
    billing: {
      totalBilledAmount: parseFloat(patient.advance_amount || 0),
      outstandingAmount: 0,
      paymentMode: patient.pat_category || 'N/A',
      insuranceCompany: 'N/A',
    },
    ...defaultTasks,
  };
};

const formatAddress = (p) => {
  return [p.house_no_street, p.area_colony, p.city, p.state, p.pincode ? `Pincode: ${p.pincode}` : null]
    .filter(Boolean).join(', ') || 'N/A';
};

const formatEmergencyContact = (p) => {
  const name = p.kin_name || 'N/A';
  const mobile = p.kin_mobile_no || 'N/A';
  return p.kin_relation ? `${name} - ${mobile} (${p.kin_relation})` : `${name} - ${mobile}`;
};
