import supabase from "../SupabaseClient";
import {
  getCachedMedicines,
  getCachedInvestigations,
  getCachedCategories,
} from '../lib/masterCache';
import { cleanSearchTerm, ilikeAny, fetchAllRows } from "../utils/supabaseQuery";

// Supabase returns at most 1,000 rows per request. Long lists below are paged on
// the server; queues that are normally small (pending indents, departmental
// indents) are read with fetchAllRows so they can never be cut off silently.

const PATIENT_TABLE = "pharmacy";
const DEPARTMENTAL_TABLE = "departmental_pharmacy_indent";

// Asking for rows past the end returns PGRST103 instead of an empty list
// (e.g. rows were removed after the count was taken).
const isRangeError = (error) => error?.code === "PGRST103";

const countOf = async (query) => {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
};

/** Double-quotes a value for or() filters (names can contain , . : ( ) ). */
const quoteFilterValue = (value) =>
  `"${String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * or() filter for "the first non-empty of `columns` equals value" - how
 * pharmacyIndentUtils builds displayTitle (patient_name, else indent_no).
 */
const firstFilledEquals = (columns, value) => {
  const quoted = quoteFilterValue(value);
  return columns
    .map((col, i) => {
      const earlierEmpty = columns
        .slice(0, i)
        .map((c) => `or(${c}.is.null,${c}.eq."")`);
      return earlierEmpty.length
        ? `and(${[...earlierEmpty, `${col}.eq.${quoted}`].join(",")})`
        : `${col}.eq.${quoted}`;
    })
    .join(",");
};

const TITLE_COLUMNS = {
  [PATIENT_TABLE]: ["patient_name", "indent_no"],
  [DEPARTMENTAL_TABLE]: ["ward", "ward_location", "indent_no"],
};

const pad = (n, len = 2) => String(n).padStart(len, "0");

/**
 * pharmacy stores `timestamp without time zone` (Indian wall-clock time) and the
 * browser reads those values as local time, so a moment is compared on the
 * server as local wall-clock time without a zone. departmental_pharmacy_indent
 * uses timestamptz, which takes a normal ISO string.
 */
const toColumnTimestamp = (date, table) =>
  table === DEPARTMENTAL_TABLE
    ? date.toISOString()
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;

const byTimestampDesc = (query) =>
  query.order("timestamp", { ascending: false }).order("id", { ascending: false });

// ---------------------------------------------------------------------------
// Pharmacy Indents page
// ---------------------------------------------------------------------------

export const PHARMACY_INDENTS_PAGE_SIZE = 50;

// Everything the indent list, its view modal and its edit form read.
const INDENT_LIST_COLUMNS =
  "id, timestamp, indent_no, admission_number, ipd_number, staff_name, consultant_name, " +
  "patient_name, uhid_number, age, gender, ward_location, category, room, diagnosis, " +
  "request_types, medicines, investigations, investigation_advice, status, planned1";

// The fields the search box used to check in the browser.
const INDENT_SEARCH_COLUMNS = ["indent_no", "patient_name", "admission_number", "diagnosis"];

const withIndentSearch = (query, search) => {
  const term = cleanSearchTerm(search);
  return term ? query.or(ilikeAny(INDENT_SEARCH_COLUMNS, term)) : query;
};

/**
 * Fetches one chunk of pharmacy indents (newest first) for the infinite list.
 * Search runs on the server, so it also finds indents that are not loaded yet.
 *
 * @param {Object} options
 * @param {number} options.offset - rows already loaded
 * @param {string} options.search - matches indent no, patient, admission no or diagnosis
 */
export const getPharmacyIndents = async ({ offset = 0, search = "" } = {}) => {
  const { data, error } = await byTimestampDesc(
    withIndentSearch(supabase.from(PATIENT_TABLE).select(INDENT_LIST_COLUMNS), search),
  ).range(offset, offset + PHARMACY_INDENTS_PAGE_SIZE - 1);

  if (isRangeError(error)) return [];
  if (error) throw error;
  return data || [];
};

/**
 * Re-reads a few indents by id (rows a realtime event reported), with the same
 * search as the list. Deleted rows, and rows that no longer match, are absent.
 */
export const getPharmacyIndentsByIds = async (ids, search = "") => {
  if (!ids.length) return [];
  const { data, error } = await withIndentSearch(
    supabase.from(PATIENT_TABLE).select(INDENT_LIST_COLUMNS).in("id", ids),
    search,
  );
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
 * Over 1,000 admissions are open, so they are read in chunks: a single request
 * stopped at 1,000 and some current patients were missing from the dropdown.
 */
export const getActiveAdmissions = async () =>
  fetchAllRows((from, to) =>
    supabase
      .from("ipd_admissions")
      .select(
        "admission_no, patient_name, consultant_dr, age, gender, ward_type, floor, room, ipd_number",
      )
      .not("planned1", "is", null)
      .is("actual1", null)
      .order("admission_no", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to),
  );

/**
 * Days since each patient's OT was completed, keyed by IPD number.
 * ot_information is small, so all completed OTs are read at once instead of
 * sending every loaded IPD number in the URL (that request grew and was sent
 * again each time another page of indents loaded).
 */
export const getOtCompletionDays = async () => {
  const data = await fetchAllRows((from, to) =>
    supabase
      .from("ot_information")
      .select("ipd_number, actual2, status")
      .not("actual2", "is", null)
      .not("ipd_number", "is", null)
      .order("id")
      .range(from, to),
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const map = {};
  data.forEach((row) => {
    if (row.status === "Cancel") return;
    const completedDate = new Date(row.actual2);
    completedDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(
      (today - completedDate) / (1000 * 60 * 60 * 24),
    );
    if (map[row.ipd_number] === undefined || diffDays < map[row.ipd_number]) {
      map[row.ipd_number] = diffDays < 0 ? 0 : diffDays;
    }
  });
  return map;
};

/**
 * Fetches medicine list.
 * Results are cached in memory for 30 minutes via masterCache.
 * Call invalidateMasterCache() after any medicine create/update/delete.
 */
export const getMedicines = async () => {
  return getCachedMedicines();
};

/**
 * Fetches investigation tests.
 * Results are cached in memory for 30 minutes via masterCache.
 */
export const getInvestigations = async () => {
  return getCachedInvestigations();
};

/**
 * Fetches categories.
 * Results are cached in memory for 30 minutes via masterCache.
 */
export const getCategories = async () => {
  return getCachedCategories();
};

/**
 * Creates a new pharmacy indent.
 */
export const createPharmacyIndent = async (indentData) => {
  const { data, error } = await supabase
    .from("pharmacy")
    .insert(indentData)
    .select();
  if (error) throw error;
  return data[0];
};

/**
 * Updates an existing pharmacy indent.
 */
export const updatePharmacyIndent = async ({ id, updateData }) => {
  const { data, error } = await supabase
    .from("pharmacy")
    .update(updateData)
    .eq("id", id)
    .select();
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

// ---------------------------------------------------------------------------
// Pharmacy Approval page
// ---------------------------------------------------------------------------

/**
 * Fetches all pending indents (patient and departmental).
 * Kept whole (the edit form and the slip use every field); the queue is small,
 * and fetchAllRows makes sure it can't stop at 1,000.
 */
export const getPendingIndents = async () => {
  const [patient, departmental] = await Promise.all(
    [PATIENT_TABLE, DEPARTMENTAL_TABLE].map((table) =>
      fetchAllRows((from, to) =>
        byTimestampDesc(supabase.from(table).select("*").eq("status", "pending")).range(from, to),
      ),
    ),
  );
  return { patient, departmental };
};

export const APPROVAL_HISTORY_PAGE_SIZE = 50;

const HISTORY_STATUSES = ["approved", "rejected"];

// History table plus its view and slip modals (editing is only for pending indents).
const HISTORY_COLUMNS = {
  [PATIENT_TABLE]:
    "id, indent_no, admission_number, patient_name, uhid_number, age, gender, ward_location, " +
    "category, room, diagnosis, staff_name, consultant_name, request_types, medicines, " +
    "investigation_advice, status, planned1, actual1, slip_image",
  [DEPARTMENTAL_TABLE]:
    "id, indent_no, ward, ward_location, floor, room, category, requested_by, remarks, " +
    "request_types, medicines, investigation_advice, status, planned1, actual1, slip_image, " +
    "slip_image_url, approved_at, rejected_at",
};

/**
 * Approval filters on the server: "All Indents" (displayTitle) and the date,
 * which matched planned1's local calendar day. Rows without planned1 passed
 * the old date check, so they still do.
 */
const withApprovalFilters = (query, table, { patient, date } = {}) => {
  let q = query;
  if (patient) q = q.or(firstFilledEquals(TITLE_COLUMNS[table], patient));
  if (date) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const from = quoteFilterValue(toColumnTimestamp(start, table));
    const to = quoteFilterValue(toColumnTimestamp(end, table));
    q = q.or(`planned1.is.null,and(planned1.gte.${from},planned1.lt.${to})`);
  }
  return q;
};

const approvalHistoryQuery = (table, columns, filters, options) =>
  withApprovalFilters(
    supabase.from(table).select(columns, options).in("status", HISTORY_STATUSES),
    table,
    filters,
  );

// Newest decision first (missing dates last), as the old in-browser sort did.
const byActual1Desc = (query) =>
  query
    .order("actual1", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

const actual1Time = (row) => new Date(row.actual1 || 0).getTime();

/**
 * Number of history rows (approved/rejected) matching the filters, for the
 * History tab label.
 *
 * @param {{ indentType?: string, patient?: string, date?: string }} filters
 */
export const getApprovalHistoryCount = async (filters = {}) => {
  const [patient, departmental] = await Promise.all([
    filters.indentType === "departmental"
      ? 0
      : countOf(approvalHistoryQuery(PATIENT_TABLE, "id", filters, { count: "exact", head: true })),
    filters.indentType === "patient"
      ? 0
      : countOf(approvalHistoryQuery(DEPARTMENTAL_TABLE, "id", filters, { count: "exact", head: true })),
  ]);
  return patient + departmental;
};

/**
 * One page of approval history: patient and departmental indents merged and
 * sorted by actual1, like the old list (which stopped at 1,000 rows).
 *
 * Departmental history is small, so it is read whole. From the much larger
 * patient table only the rows that can land on this page are read: at most
 * one page, plus one row for each departmental row that may come before it.
 *
 * @returns {Promise<{ rows: { indentType: string, row: Object }[], total: number }>}
 */
export const getApprovalHistoryPage = async ({ page = 0, filters = {} } = {}) => {
  const size = APPROVAL_HISTORY_PAGE_SIZE;
  const start = page * size;
  const wantPatient = filters.indentType !== "departmental";
  const wantDepartmental = filters.indentType !== "patient";

  const [departmental, patientTotal] = await Promise.all([
    wantDepartmental
      ? fetchAllRows((from, to) =>
          byActual1Desc(
            approvalHistoryQuery(DEPARTMENTAL_TABLE, HISTORY_COLUMNS[DEPARTMENTAL_TABLE], filters),
          ).range(from, to),
        )
      : [],
    wantPatient
      ? countOf(approvalHistoryQuery(PATIENT_TABLE, "id", filters, { count: "exact", head: true }))
      : 0,
  ]);

  // Fewer than departmental.length departmental rows can come before `start`.
  const first = Math.max(0, start - departmental.length);
  let patient = [];
  if (wantPatient && first < patientTotal) {
    const { data, error } = await byActual1Desc(
      approvalHistoryQuery(PATIENT_TABLE, HISTORY_COLUMNS[PATIENT_TABLE], filters),
    ).range(first, start + size - 1);
    if (error && !isRangeError(error)) throw error;
    patient = data || [];
  }

  // Departmental rows newer than patient[0] sit before it. With first > 0 all
  // of them fall before this page, so only the rest is merged; patient[0] is
  // then at position first + (number of those rows).
  let skipped = 0;
  if (first > 0 && patient.length) {
    const firstTime = actual1Time(patient[0]);
    while (skipped < departmental.length && actual1Time(departmental[skipped]) > firstTime) {
      skipped++;
    }
  }
  const mergeStart = first > 0 ? first + skipped : 0;

  // Two sorted lists into one; on equal dates patient rows first (as before).
  const merged = [];
  let p = 0;
  let d = skipped;
  if (first === 0 || patient.length) {
    while (p < patient.length || d < departmental.length) {
      const takePatient =
        d >= departmental.length ||
        (p < patient.length && actual1Time(patient[p]) >= actual1Time(departmental[d]));
      merged.push(
        takePatient
          ? { indentType: "patient", row: patient[p++] }
          : { indentType: "departmental", row: departmental[d++] },
      );
    }
  }

  return {
    rows: merged.slice(start - mergeStart, start - mergeStart + size),
    total: patientTotal + departmental.length,
  };
};

/**
 * Every title the approval "All Indents" dropdown can offer for history rows.
 * Worked out in the database (get_pharmacy_history_titles, same title rules and
 * order as displayTitle) in one request, instead of reading 12k+ rows in chunks;
 * the page caches the result instead of reloading it on every change.
 */
export const getApprovalHistoryTitles = async () => {
  const { data, error } = await supabase.rpc("get_pharmacy_history_titles");
  if (error) throw error;
  return data || [];
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
      ...updateData,
    })
    .eq("id", id)
    .select();

  if (error) throw error;
  return data[0];
};

// ---------------------------------------------------------------------------
// Pharmacy Store page
// ---------------------------------------------------------------------------

/**
 * Ward groups of the Store "All Wards" filter, checked in this order. A location
 * that matches none of them is shown as itself (trimmed). "5th floor" also
 * covers the old "general ward(5th floor)" check, which contains it.
 */
const STORE_WARD_RULES = [
  { label: "PICU", key: "picu" },
  { label: "NICU", key: "nicu" },
  { label: "ICU", key: "icu" },
  { label: "HDU", key: "hdu" },
  { label: "Emergency", key: "emergency" },
  { label: "Private Ward", key: "private" },
  { label: "General Ward(5th floor)", key: "5th floor" },
];

/** Groups a ward location the way the Store filter shows it (e.g. "Icu 4th floor" -> "ICU"). */
export const normalizeStoreWard = (wardValue) => {
  const normalizedWard = String(wardValue || "").trim().toLowerCase();
  if (!normalizedWard) return "";
  const rule = STORE_WARD_RULES.find((r) => normalizedWard.includes(r.key));
  return rule ? rule.label : String(wardValue || "").trim();
};

// or() condition for "ward_location falls under ward rule `index`".
const wardRuleFilter = (index) => {
  const parts = [
    `ward_location.ilike."%${STORE_WARD_RULES[index].key}%"`,
    ...STORE_WARD_RULES.slice(0, index).map((r) => `ward_location.not.ilike."%${r.key}%"`),
  ];
  return parts.length > 1 ? `and(${parts.join(",")})` : parts[0];
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Fields the Store search box checks (indent no, title, UHID, staff, diagnosis/remarks, location).
const STORE_SEARCH_COLUMNS = {
  [PATIENT_TABLE]: [
    "indent_no", "admission_number", "patient_name", "uhid_number", "staff_name", "diagnosis", "ward_location",
  ],
  [DEPARTMENTAL_TABLE]: ["indent_no", "ward", "ward_location", "requested_by", "remarks"],
};

// Store table, view modal and slip modal.
const STORE_COLUMNS = {
  [PATIENT_TABLE]:
    "id, indent_no, admission_number, patient_name, uhid_number, staff_name, ward_location, " +
    "diagnosis, medicines, status, planned2, actual2, slip_image",
  [DEPARTMENTAL_TABLE]:
    "id, indent_no, ward, ward_location, requested_by, remarks, medicines, status, planned2, " +
    "actual2, slip_image",
};

// Indents that reached the store: sent on by approval (planned2) and not rejected.
const storeQuery = (table, columns, options) =>
  supabase
    .from(table)
    .select(columns, options)
    .not("planned2", "is", null)
    .neq("status", "rejected");

/**
 * Store filters on the server, same checks the page runs in the browser for
 * pending indents. The date matched planned2's UTC day (toISOString).
 */
const withStoreFilters = (query, table, { search, patient, ward, date } = {}) => {
  let q = query;

  const term = cleanSearchTerm(search);
  if (term) {
    // The search also matched the ward group name, e.g. "ward" -> "Private Ward"
    const lower = term.toLowerCase();
    const wardGroups = STORE_WARD_RULES.flatMap((r, i) =>
      r.label.toLowerCase().includes(lower) ? [wardRuleFilter(i)] : [],
    );
    q = q.or([ilikeAny(STORE_SEARCH_COLUMNS[table], term), ...wardGroups].join(","));
  }

  if (patient) q = q.or(firstFilledEquals(TITLE_COLUMNS[table], patient));

  if (ward) {
    const index = STORE_WARD_RULES.findIndex((r) => r.label === ward);
    q =
      index >= 0
        ? q.or(wardRuleFilter(index))
        : q.filter("ward_location", "match", `^\\s*${escapeRegExp(ward)}\\s*$`);
  }

  if (date) {
    const start = new Date(`${date}T00:00:00Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    q = q
      .gte("planned2", toColumnTimestamp(start, table))
      .lt("planned2", toColumnTimestamp(end, table));
  }

  return q;
};

/**
 * Fetches the Store's pending queue (planned2 set, not yet dispensed).
 * Before, pending and history were split in the browser from one list that
 * stopped at the newest 1,000 indents, so older pending indents were hidden.
 */
export const getStorePendingIndents = async () => {
  const [patient, departmental] = await Promise.all(
    [PATIENT_TABLE, DEPARTMENTAL_TABLE].map((table) =>
      fetchAllRows((from, to) =>
        byTimestampDesc(storeQuery(table, STORE_COLUMNS[table]).is("actual2", null)).range(from, to),
      ),
    ),
  );
  return { patient, departmental };
};

export const STORE_HISTORY_PAGE_SIZE = 50;

const storeHistoryQuery = (table, columns, filters, options) =>
  withStoreFilters(storeQuery(table, columns, options).not("actual2", "is", null), table, filters);

const getStoreHistoryCounts = async (filters = {}) => {
  const [patient, departmental] = await Promise.all([
    filters.indentType === "departmental"
      ? 0
      : countOf(storeHistoryQuery(PATIENT_TABLE, "id", filters, { count: "exact", head: true })),
    filters.indentType === "patient"
      ? 0
      : countOf(storeHistoryQuery(DEPARTMENTAL_TABLE, "id", filters, { count: "exact", head: true })),
  ]);
  return { patient, departmental };
};

/** Number of dispensed indents matching the filters, for the History tab label. */
export const getStoreHistoryCount = async (filters = {}) => {
  const counts = await getStoreHistoryCounts(filters);
  return counts.patient + counts.departmental;
};

/**
 * One page of Store history (dispensed indents). As before, patient indents
 * come first (newest first), then departmental ones.
 *
 * @returns {Promise<{ patient: Object[], departmental: Object[], total: number }>}
 */
export const getStoreHistoryPage = async ({ page = 0, filters = {} } = {}) => {
  const size = STORE_HISTORY_PAGE_SIZE;
  const start = page * size;
  const counts = await getStoreHistoryCounts(filters);

  const readRange = async (table, from, to) => {
    if (to < from) return [];
    const { data, error } = await byTimestampDesc(
      storeHistoryQuery(table, STORE_COLUMNS[table], filters),
    ).range(from, to);
    if (isRangeError(error)) return [];
    if (error) throw error;
    return data || [];
  };

  const [patient, departmental] = await Promise.all([
    readRange(PATIENT_TABLE, start, Math.min(start + size, counts.patient) - 1),
    readRange(
      DEPARTMENTAL_TABLE,
      Math.max(0, start - counts.patient),
      Math.min(start + size - counts.patient, counts.departmental) - 1,
    ),
  ]);

  return { patient, departmental, total: counts.patient + counts.departmental };
};

/**
 * Every patient/indent title and ward the Store filters can offer, in list
 * order. The database (get_pharmacy_store_filter_options) returns the distinct
 * titles and raw ward locations in one request; ward grouping stays here.
 * The page caches the result.
 *
 * @returns {Promise<{ titles: string[], wards: string[] }>}
 */
export const getStoreFilterOptions = async () => {
  const { data, error } = await supabase.rpc("get_pharmacy_store_filter_options");
  if (error) throw error;

  return {
    titles: (data?.titles || []).filter(Boolean),
    wards: [...new Set((data?.locations || []).map(normalizeStoreWard).filter(Boolean))],
  };
};

// ---------------------------------------------------------------------------
// Pharmacy Workflow Dashboard
// ---------------------------------------------------------------------------

export const WORKFLOW_PAGE_SIZE = 12;

// Order cards, their stages and the slip preview.
const WORKFLOW_COLUMNS = {
  [PATIENT_TABLE]:
    "id, timestamp, indent_no, admission_number, ipd_number, staff_name, consultant_name, " +
    "patient_name, ward_location, diagnosis, request_types, medicines, investigations, status, " +
    "planned1, actual1, approved_by, slip_image, planned2, actual2",
  [DEPARTMENTAL_TABLE]:
    "id, indent_no, timestamp, requested_by, ward, ward_location, remarks, request_types, " +
    "medicines, investigations, status, planned1, actual1, planned2, actual2, approved_by, " +
    "slip_image, slip_image_url",
};

// A stage counts as delayed once it is still open 5.5+ minutes after its
// planned time (the dashboard rounds to whole minutes and checks > 5).
const WORKFLOW_OVERDUE_MS = 5.5 * 60 * 1000;

const NOT_REJECTED = "status.is.null,status.neq.rejected";
// Verification done = approved with actual1; otherwise the order waits at verification.
const VERIFIED = "status.eq.approved,actual1.not.is.null";
const NOT_VERIFIED = "status.is.null,status.neq.approved,actual1.is.null";

// "Current stage" of an order as a filter (matched by the dashboard's search box).
// Prescription Received is always done, so it is never the current stage.
const WORKFLOW_STAGE_FILTERS = {
  medication_verification: NOT_VERIFIED,
  dispensing_queue: `and(${VERIFIED},actual2.is.null)`,
  completed: `and(${VERIFIED},actual2.not.is.null)`,
};

const WORKFLOW_SEARCH_COLUMNS = [
  "patient_name", "indent_no", "admission_number", "ipd_number", "consultant_name", "diagnosis", "ward_location",
];

/**
 * The dashboard statuses (getDashboardStatus in PharmacyWorkflowDashboard.jsx)
 * as filters on the pharmacy table, so they can be counted and paged there.
 */
const withWorkflowStatus = (query, status) => {
  if (!status || status === "all") return query;
  const cutoff = quoteFilterValue(
    toColumnTimestamp(new Date(Date.now() - WORKFLOW_OVERDUE_MS), PATIENT_TABLE),
  );
  // Builders change in place, so the "still open" filter is added per case.
  const open = () => query.or(NOT_REJECTED).is("actual2", null);

  switch (status) {
    case "completed":
      return query.or(NOT_REJECTED).not("actual2", "is", null);
    case "ready_to_dispense":
      return open()
        .eq("status", "approved")
        .not("actual1", "is", null)
        .or(`planned2.is.null,planned2.gt.${cutoff}`);
    case "overdue":
      return open().or(
        `and(${VERIFIED},planned2.lte.${cutoff}),and(or(${NOT_VERIFIED}),planned1.lte.${cutoff})`,
      );
    case "pending_review":
      return open().or(NOT_VERIFIED).or(`planned1.is.null,planned1.gt.${cutoff}`);
    default:
      return query;
  }
};

/**
 * Stats for patient indents (Total, Pending Review, Ready, Delayed, Completed),
 * counted on the server - they used to be counted from a list cut at 1,000.
 */
export const getWorkflowPatientStats = async () => {
  const count = (status) =>
    countOf(
      withWorkflowStatus(
        supabase.from(PATIENT_TABLE).select("id", { count: "exact", head: true }),
        status,
      ),
    );
  const [total, pending, ready, delayed, completed] = await Promise.all(
    ["all", "pending_review", "ready_to_dispense", "overdue", "completed"].map(count),
  );
  return { total, pending, ready, delayed, completed };
};

/**
 * One chunk of patient indents for the dashboard cards (newest first), with
 * the dashboard's search and status filter applied on the server.
 *
 * @param {Object}   options
 * @param {number}   options.offset    - cards already loaded
 * @param {string}   options.search    - search box text
 * @param {string}   options.status    - status filter ("all", "pending_review", ...)
 * @param {string[]} options.stageKeys - stages whose name contains the search text
 * @returns {Promise<{ rows: Object[], total?: number }>} total only on the first chunk
 */
export const getWorkflowPatientPage = async ({ offset = 0, search = "", status = "all", stageKeys = [] } = {}) => {
  let query = withWorkflowStatus(
    supabase
      .from(PATIENT_TABLE)
      .select(WORKFLOW_COLUMNS[PATIENT_TABLE], offset === 0 ? { count: "exact" } : undefined),
    status,
  );

  const term = cleanSearchTerm(search);
  if (term) {
    const stageFilters = stageKeys.map((key) => WORKFLOW_STAGE_FILTERS[key]).filter(Boolean);
    query = query.or([ilikeAny(WORKFLOW_SEARCH_COLUMNS, term), ...stageFilters].join(","));
  }

  const { data, error, count } = await byTimestampDesc(query).range(
    offset,
    offset + WORKFLOW_PAGE_SIZE - 1,
  );
  if (isRangeError(error)) return { rows: [] };
  if (error) throw error;
  return { rows: data || [], total: count ?? undefined };
};

/** All departmental indents for the dashboard (a small table, filtered on the page). */
export const getWorkflowDepartmentalIndents = async () =>
  fetchAllRows((from, to) =>
    byTimestampDesc(
      supabase.from(DEPARTMENTAL_TABLE).select(WORKFLOW_COLUMNS[DEPARTMENTAL_TABLE]),
    ).range(from, to),
  );

/** Staff phone numbers by name, for the dashboard's handler popup. */
export const getStaffContacts = async () => {
  const staff = await fetchAllRows((from, to) =>
    supabase.from("all_staff").select("name, phone_number").order("id").range(from, to),
  );
  const contacts = {};
  staff.forEach((member) => {
    contacts[member.name] = member.phone_number || "";
  });
  return contacts;
};

// ---------------------------------------------------------------------------
// Departmental Indent page
// ---------------------------------------------------------------------------

/**
 * Fetches masters needed for departmental indents.
 * Medicine list is served from the 30-minute in-memory cache.
 */
export const getDepartmentalMasters = async () => {
  const [floorBedRes, medicines] = await Promise.all([
    // Only the ward names are used (for the Ward dropdown)
    supabase.from("all_floor_bed").select("ward"),
    getCachedMedicines(),
  ]);

  if (floorBedRes.error) throw floorBedRes.error;

  return {
    locations: floorBedRes.data || [],
    medicines,
  };
};

/**
 * Fetches all departmental indents (list, view modal and edit form).
 * A small table, read whole with fetchAllRows so it can't stop at 1,000.
 */
export const getDepartmentalIndentsList = async () =>
  fetchAllRows((from, to) =>
    byTimestampDesc(
      supabase
        .from(DEPARTMENTAL_TABLE)
        .select(
          "id, indent_no, timestamp, requested_by, ward, ward_location, remarks, request_types, medicines, status",
        ),
    ).range(from, to),
  );

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
