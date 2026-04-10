import supabase from '../SupabaseClient';

/**
 * Fetches pending patients for RMO initiation.
 * Patients who have a planned discharge but no actual discharge yet.
 */
export const getPendingPatients = async () => {
  const { data, error } = await supabase
    .from('discharge')
    .select('id, admission_no, patient_name, department, consultant_name, staff_name, planned1, actual1, remark, discharge_number, rmo_status, rmo_name, summary_report_image, summary_report_image_name')
    .not('planned1', 'is', null)
    .is('actual1', null)
    .order('planned1', { ascending: true });

  if (error) throw error;

  return data.map(patient => ({
    id: patient.id,
    admissionNo: patient.admission_no,
    patientName: patient.patient_name,
    department: patient.department,
    consultantName: patient.consultant_name,
    staffName: patient.staff_name,
    dischargeDate: patient.planned1 ? new Date(patient.planned1).toLocaleDateString('en-GB') : 'N/A',
    dischargeTime: patient.planned1 ? new Date(patient.planned1).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }) : 'N/A',
    planned1: patient.planned1,
    actual1: patient.actual1,
    remark: patient.remark,
    dischargeNumber: patient.discharge_number,
    rmo_status: patient.rmo_status,
    rmo_name: patient.rmo_name,
    summary_report_image: patient.summary_report_image,
    summary_report_image_name: patient.summary_report_image_name
  }));
};

/**
 * Fetches history patients for RMO initiation.
 * Patients who have been initiated by RMO.
 */
export const getHistoryPatients = async () => {
  const { data, error } = await supabase
    .from('discharge')
    .select('id, admission_no, patient_name, department, consultant_name, staff_name, planned1, actual1, delay1, remark, discharge_number, rmo_status, rmo_name, summary_report_image, summary_report_image_name')
    .not('planned1', 'is', null)
    .not('actual1', 'is', null)
    .not('rmo_name', 'is', null)
    .order('actual1', { ascending: false });

  if (error) throw error;

  return data.map(patient => ({
    id: patient.id,
    admissionNo: patient.admission_no,
    patientName: patient.patient_name,
    department: patient.department,
    consultantName: patient.consultant_name,
    staffName: patient.staff_name,
    dischargeDate: patient.planned1 ? new Date(patient.planned1).toLocaleDateString('en-GB') : 'N/A',
    dischargeTime: patient.planned1 ? new Date(patient.planned1).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }) : 'N/A',
    actualDate: patient.actual1 ? new Date(patient.actual1).toLocaleDateString('en-GB') : 'N/A',
    actualTime: patient.actual1 ? new Date(patient.actual1).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }) : 'N/A',
    planned1: patient.planned1,
    actual1: patient.actual1,
    delay1: patient.delay1,
    remark: patient.remark,
    dischargeNumber: patient.discharge_number,
    rmo_status: patient.rmo_status,
    rmo_name: patient.rmo_name,
    summary_report_image: patient.summary_report_image,
    summary_report_image_name: patient.summary_report_image_name,
    initiation_date: patient.actual1
  }));
};

/**
 * Updates a discharge record with RMO initiation data.
 */
export const updateRMOInitiation = async ({ id, updateData }) => {
  const { data, error } = await supabase
    .from('discharge')
    .update(updateData)
    .eq('id', id)
    .select();

  if (error) throw error;
  return data[0];
};
