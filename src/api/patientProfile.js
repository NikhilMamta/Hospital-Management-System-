import supabase from '../SupabaseClient';
import { fetchAllRows } from '../utils/supabaseQuery';

// Columns the Patient Profile list, its filters and PatientCard use (was select *)
const PATIENT_LIST_COLUMNS =
  "id, ipd_number, admission_no, patient_name, consultant_dr, age, gender, phone_no, department, " +
  "ward_type, location_status, bed_location, bed_no, room, pat_category, time_in_ward, timestamp";

/**
 * Fetches discharged admission numbers from the discharge table.
 * All of them, 1,000 at a time: a single request stopped at 1,000 of 2,000+,
 * so discharged patients beyond that showed up as Active.
 */
export const getDischargedAdmissions = async () => {
  const data = await fetchAllRows((from, to) =>
    supabase
      .from("discharge")
      .select("admission_no")
      .order("id", { ascending: true })
      .range(from, to)
  );

  const set = new Set(
    (data || [])
      .map((d) => String(d.admission_no || "").trim().toLowerCase())
      .filter(Boolean)
  );
  return set;
};

// Nurse -> IPD numbers of every patient she has tasks for, kept for 2 minutes so
// realtime refreshes of the patient list don't re-read her whole task history.
const NURSE_IPDS_TTL = 2 * 60 * 1000;
let nurseIpdsCache = null; // { nurse, fetchedAt, ipds }

const getNurseAssignedIpds = async (userName) => {
  const nurse = userName.trim();
  if (
    nurseIpdsCache &&
    nurseIpdsCache.nurse === nurse &&
    Date.now() - nurseIpdsCache.fetchedAt < NURSE_IPDS_TTL
  ) {
    return nurseIpdsCache.ipds;
  }

  // Distinct IPD numbers of all her tasks, worked out in the database
  // (get_nurse_patient_ipds). Reading tasks directly stopped at 1,000 of her
  // ~12,000 tasks, so most of her patients (e.g. 180 of 230) were missing.
  const { data, error } = await supabase.rpc("get_nurse_patient_ipds", { p_nurse: nurse });
  if (error) throw error;

  const ipds = data || [];
  nurseIpdsCache = { nurse, fetchedAt: Date.now(), ipds };
  return ipds;
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
    ipdNumbers = await getNurseAssignedIpds(userName);
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

  if (shouldFilter && ipdNumbers.length === 0) {
    return []; // should filter but no IDs found
  }

  // FETCH PATIENTS: the whole list, 1,000 at a time (the page filters, counts and
  // splits Active/Discharged in the browser; one request stopped at 1,000 patients)
  const buildQuery = (ipdBatch) => {
    let query = supabase
      .from("ipd_admissions")
      .select(PATIENT_LIST_COLUMNS)
      .order("timestamp", { ascending: false })
      .order("id", { ascending: false });

    if (userRole === "doctor") {
      if (doctorTab === "active" || doctorTab === "discharged") {
        query = query.eq("consultant_dr", userName);
      }
    }

    if (ipdBatch) {
      query = query.in("ipd_number", ipdBatch);
    }

    return query;
  };

  if (!shouldFilter) {
    return fetchAllRows((from, to) => buildQuery().range(from, to));
  }

  // A nurse can have hundreds of patients: send the IPD numbers in batches so
  // the request URL stays short, then merge back into newest-first order.
  const IPD_BATCH = 200;
  const batches = [];
  for (let i = 0; i < ipdNumbers.length; i += IPD_BATCH) {
    batches.push(ipdNumbers.slice(i, i + IPD_BATCH));
  }
  const results = await Promise.all(
    batches.map((batch) => fetchAllRows((from, to) => buildQuery(batch).range(from, to)))
  );
  return results
    .flat()
    .sort(
      (a, b) =>
        String(b.timestamp || "").localeCompare(String(a.timestamp || "")) || b.id - a.id
    );
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
 * Nurses per patient for the given shift, for a whole page of patient cards in
 * one call (each PatientCard used to run its own query).
 * @returns {Promise<Record<string, string[]>>} IPD number -> nurse names, most recent first
 */
export const getPatientCardNurses = async (ipdNumbers, shift) => {
  if (!ipdNumbers.length) return {};

  const { data, error } = await supabase.rpc("get_patient_card_nurses", {
    p_ipds: ipdNumbers,
    p_shift: shift,
  });

  if (error) throw error;
  return Object.fromEntries((data || []).map((row) => [row.ipd, row.nurses || []]));
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
