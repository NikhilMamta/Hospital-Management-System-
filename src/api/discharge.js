import supabase from '../SupabaseClient';
import { cleanSearchTerm, ilikeAny } from '../utils/supabaseQuery';

// Rows fetched per request. The page still reveals 10 more on each scroll and
// asks for the next chunk only when the loaded rows run out.
export const RMO_CHUNK_SIZE = 50;

const SEARCH_COLUMNS = ['patient_name', 'admission_no'];

const PENDING_COLUMNS = 'id, admission_no, patient_name, department, consultant_name, staff_name, planned1, actual1, remark, discharge_number, rmo_status, rmo_name, summary_report_image, summary_report_image_name';
const HISTORY_COLUMNS = 'id, admission_no, patient_name, department, consultant_name, staff_name, planned1, actual1, delay1, remark, discharge_number, rmo_status, rmo_name, summary_report_image, summary_report_image_name';

const pendingFilter = (query) => query.not('planned1', 'is', null).is('actual1', null);
const historyFilter = (query) =>
  query.not('planned1', 'is', null).not('actual1', 'is', null).not('rmo_name', 'is', null);

const applySearch = (query, search) => {
  const term = cleanSearchTerm(search);
  return term ? query.or(ilikeAny(SEARCH_COLUMNS, term)) : query;
};

/**
 * Fetches one chunk of pending patients for RMO initiation.
 * Patients who have a planned discharge but no actual discharge yet.
 * Paged and searched on the server: the whole list was cut at 1,000 rows.
 *
 * @param {Object} options
 * @param {number} options.page   - Zero-based chunk number (RMO_CHUNK_SIZE rows each)
 * @param {string} options.search - Matches patient name or admission no
 * @returns {Promise<{ rows: Array, total: number }>}
 */
export const getPendingPatients = async ({ page = 0, search = '' } = {}) => {
  const from = page * RMO_CHUNK_SIZE;
  const query = pendingFilter(
    supabase.from('discharge').select(PENDING_COLUMNS, { count: 'exact' })
  )
    .order('planned1', { ascending: true })
    .order('id', { ascending: true })
    .range(from, from + RMO_CHUNK_SIZE - 1);

  const { data, error, count } = await applySearch(query, search);

  if (error) throw error;

  const rows = (data || []).map(patient => ({
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

  return { rows, total: count ?? 0 };
};

/**
 * Fetches one chunk of history patients for RMO initiation.
 * Patients who have been initiated by RMO.
 * Paged and searched on the server: the whole list was cut at 1,000 rows.
 *
 * @param {Object} options
 * @param {number} options.page   - Zero-based chunk number (RMO_CHUNK_SIZE rows each)
 * @param {string} options.search - Matches patient name or admission no
 * @returns {Promise<{ rows: Array, total: number }>}
 */
export const getHistoryPatients = async ({ page = 0, search = '' } = {}) => {
  const from = page * RMO_CHUNK_SIZE;
  const query = historyFilter(
    supabase.from('discharge').select(HISTORY_COLUMNS, { count: 'exact' })
  )
    .order('actual1', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + RMO_CHUNK_SIZE - 1);

  const { data, error, count } = await applySearch(query, search);

  if (error) throw error;

  const rows = (data || []).map(patient => ({
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

  return { rows, total: count ?? 0 };
};

/**
 * Counts for the Pending / History tab badges (whole lists, not the search).
 * Head-only count queries, so neither tab has to be loaded to show its badge.
 */
export const getInitiationCounts = async () => {
  const [pending, history] = await Promise.all([
    pendingFilter(supabase.from('discharge').select('id', { count: 'exact', head: true })),
    historyFilter(supabase.from('discharge').select('id', { count: 'exact', head: true })),
  ]);

  if (pending.error) throw pending.error;
  if (history.error) throw history.error;

  return { pending: pending.count ?? 0, history: history.count ?? 0 };
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
