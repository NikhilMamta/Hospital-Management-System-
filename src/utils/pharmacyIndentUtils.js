export const REQUEST_TYPE_LABELS = {
  medicineSlip: "Medicine Slip",
  investigation: "Investigation",
};

export const parseJsonField = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    console.error("Error parsing pharmacy JSON field:", error);
    return fallback;
  }
};

export const getRequestTypeLabels = (requestTypes = {}) =>
  Object.entries(REQUEST_TYPE_LABELS)
    .filter(([key]) => requestTypes?.[key])
    .map(([, label]) => label);

export const normalizeWardLocation = (parts = []) =>
  parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" - ");

export const normalizePatientPharmacyIndent = (row = {}) => {
  const requestTypes = parseJsonField(row.request_types, {});
  const medicines = parseJsonField(row.medicines, []);
  const investigations = parseJsonField(row.investigations, []);
  const investigationAdvice = parseJsonField(row.investigation_advice, {});

  return {
    id: `pharmacy-${row.id}`,
    sourceId: row.id,
    sourceTable: "pharmacy",
    indentType: "patient",
    indentScope: "patient",
    indentNumber: row.indent_no || "",
    admissionNumber: row.admission_number || "",
    ipdNumber: row.ipd_number || "",
    patientName: row.patient_name || "",
    displayTitle: row.patient_name || row.indent_no || "Patient Indent",
    displaySubtitle: row.admission_number || row.ipd_number || "",
    requestedBy: row.staff_name || "",
    staffName: row.staff_name || "",
    consultantName: row.consultant_name || "",
    uhidNumber: row.uhid_number || "",
    age: row.age || "",
    gender: row.gender || "",
    floor: "",
    ward: row.ward_location || "",
    room: row.room || "",
    wardLocation: row.ward_location || "",
    location: row.ward_location || "",
    category: row.category || "",
    diagnosis: row.diagnosis || "",
    remarks: row.remarks || "",
    requestTypes,
    requestTypeLabels: getRequestTypeLabels(requestTypes),
    medicines: Array.isArray(medicines) ? medicines : [],
    investigations: Array.isArray(investigations) ? investigations : [],
    investigationAdvice,
    timestamp: row.timestamp || null,
    status: String(row.status || "pending").toLowerCase(),
    planned1: row.planned1 || null,
    actual1: row.actual1 || null,
    planned2: row.planned2 || null,
    actual2: row.actual2 || null,
    approvedAt: row.approved_at || null,
    rejectedAt: row.rejected_at || null,
    approvedBy: row.approved_by || "",
    updatedAt: row.updated_at || null,
    slipImage: row.slip_image || null,
    slipImageUrl: row.slip_image_url || row.slip_image || null,
    raw: row,
  };
};

export const normalizeDepartmentalPharmacyIndent = (row = {}) => {
  const requestTypes = parseJsonField(row.request_types, {});
  const medicines = parseJsonField(row.medicines, []);
  const investigations = parseJsonField(row.investigations, []);
  const investigationAdvice = parseJsonField(row.investigation_advice, {});
  const wardLocation = row.ward_location || row.ward || "Departmental";
  const title = row.ward || row.ward_location || row.indent_no || "Departmental Indent";

  return {
    id: `departmental-pharmacy-indent-${row.id}`,
    sourceId: row.id,
    sourceTable: "departmental_pharmacy_indent",
    indentType: "departmental",
    indentScope: "departmental",
    indentNumber: row.indent_no || "",
    admissionNumber: wardLocation,
    ipdNumber: "",
    patientName: title,
    displayTitle: title,
    displaySubtitle: row.remarks || "",
    requestedBy: row.requested_by || row.staff_name || "",
    staffName: row.requested_by || row.staff_name || "",
    consultantName: "Departmental",
    uhidNumber: "",
    age: "",
    gender: "",
    floor: row.floor || "",
    ward: row.ward || "",
    room: row.room || "",
    wardLocation,
    location: wardLocation,
    category: row.category || "",
    diagnosis: row.remarks || row.purpose || "",
    remarks: row.remarks || row.purpose || "",
    requestTypes,
    requestTypeLabels: getRequestTypeLabels(requestTypes),
    medicines: Array.isArray(medicines) ? medicines : [],
    investigations: Array.isArray(investigations) ? investigations : [],
    investigationAdvice,
    timestamp: row.timestamp || null,
    status: String(row.status || "pending").toLowerCase(),
    planned1: row.planned1 || null,
    actual1: row.actual1 || null,
    planned2: row.planned2 || null,
    actual2: row.actual2 || null,
    approvedAt: row.approved_at || null,
    rejectedAt: row.rejected_at || null,
    approvedBy: row.approved_by || "",
    updatedAt: row.updated_at || null,
    slipImage: row.slip_image || null,
    slipImageUrl: row.slip_image_url || row.slip_image || null,
    raw: row,
  };
};

export const normalizeAnyPharmacyIndent = (row = {}, indentType = "patient") =>
  indentType === "departmental"
    ? normalizeDepartmentalPharmacyIndent(row)
    : normalizePatientPharmacyIndent(row);
