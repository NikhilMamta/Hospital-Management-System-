// ============================================================
// WhatsApp Notification Service (Maytapi)
// ============================================================
// Hardcoded recipient number for pharmacy indent approvals.
// Change APPROVAL_PHONE_NUMBER to the actual WhatsApp number
// (include country code, no + or spaces, e.g. "919876543210").
// ============================================================

const MAYTAPI_PRODUCT_ID = import.meta.env.VITE_MAYTAPI_PRODUCT_ID;
const MAYTAPI_PHONE_ID = import.meta.env.VITE_MAYTAPI_PHONE_ID;
const MAYTAPI_TOKEN = import.meta.env.VITE_MAYTAPI_TOKEN;
// ⬇️ Hardcoded recipients – change these numbers as needed
// Numbers should include country code, no + or spaces (e.g. "919876543210")
const APPROVAL_PHONE_NUMBERS = [
  "917089161648",
  "917000520856",
  "919340821622",
  "916267799443",
];

// ⬇️ Hardcoded recipient for dressing notifications
// Change DRESSING_PHONE_NUMBER to the actual WhatsApp number
const DRESSING_PHONE_NUMBER = "916267799443"; // Update this with the specific number for dressing notifications

// ⬇️ Hardcoded recipients for OT notifications
// Change OT_PHONE_NUMBERS to the actual WhatsApp numbers
const OT_PHONE_NUMBERS = [
  "916267799443", // Update with specific numbers for OT notifications
];

export { DRESSING_PHONE_NUMBER, OT_PHONE_NUMBERS };

/**
 * Build the approval WhatsApp message for a pharmacy indent.
 *
 * @param {Object} indent - The inserted pharmacy record from Supabase
 * @param {Array}  medicines - Array of { name, quantity } objects
 * @param {Object} requestTypes - { medicineSlip, investigation, package, nonPackage }
 * @param {string} approvalUrl - Full URL to the pharmacy approval page
 * @returns {string} Formatted WhatsApp message
 */
export const buildIndentApprovalMessage = (
  indent,
  medicines,
  requestTypes,
  approvalUrl,
) => {
  // Determine request type label
  const requestTypeLabels = [];
  if (requestTypes?.medicineSlip) requestTypeLabels.push("Medicine Slip");
  if (requestTypes?.investigation) requestTypeLabels.push("Investigation");
  if (requestTypes?.package) requestTypeLabels.push("Package");
  if (requestTypes?.nonPackage) requestTypeLabels.push("Non-Package");
  const requestTypeStr = requestTypeLabels.join(", ") || "N/A";

  // For medicine slip, list the first medicine (or summarise)
  let medicineName = "N/A";
  let medicineQty = "N/A";
  if (requestTypes?.medicineSlip && medicines?.length > 0) {
    medicineName = medicines[0].name || "N/A";
    medicineQty = medicines.map((m) => m.quantity).join(", ") || "N/A";
    if (medicines.length > 1) {
      medicineName = medicines.map((m) => m.name).join(", ");
    }
  }

  const serialNo = indent.id || "N/A";

  const message = `⚡ Approval Request – Medicine

🆔 Indent No.: ${indent.indent_no || "N/A"}
🔢 Serial No.: ${serialNo}
🏥 Admission No.: ${indent.admission_number || "N/A"}
👨‍💼 Requested By: ${indent.staff_name || "N/A"}
👨‍⚕️ Consultant: ${indent.consultant_name || "N/A"}
🧑‍🦱 Patient: ${indent.patient_name || "N/A"}
📂 Category: ${indent.category || "N/A"}
🛏️ Ward Location: ${indent.ward_location || "N/A"}
🚻 Gender: ${indent.gender || "N/A"}
🩺 Diagnosis: ${indent.diagnosis || "N/A"}

📑 Request Type: ${requestTypeStr}
💊 Medicine: ${medicineName}
🔢 Quantity: ${medicineQty}

👉 Please review & approve:
✅ ${approvalUrl}

✍️ NIKHIL KUMAR URANW
TEAM MAMTA HOSPITAL`;

  return message;
};

/**
 * Send a WhatsApp message via Maytapi.
 *
 * @param {string} toNumber - Recipient phone number (with country code, no +)
 * @param {string} message  - Text message to send
 * @returns {Promise<boolean>} true on success, false on failure
 */
export const sendWhatsAppMessage = async (toNumber, message) => {
  console.log(MAYTAPI_PRODUCT_ID, MAYTAPI_PHONE_ID, MAYTAPI_TOKEN);

  if (!MAYTAPI_PRODUCT_ID || !MAYTAPI_PHONE_ID || !MAYTAPI_TOKEN) {
    console.warn("[WhatsApp] Maytapi credentials are not configured in .env");
    return false;
  }

  const url = `https://api.maytapi.com/api/${MAYTAPI_PRODUCT_ID}/${MAYTAPI_PHONE_ID}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-maytapi-key": MAYTAPI_TOKEN,
      },
      body: JSON.stringify({
        to_number: toNumber,
        type: "text",
        message: message,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error("[WhatsApp] Failed to send message:", data);
      return false;
    }

    console.log("[WhatsApp] Message sent successfully:", data);
    return true;
  } catch (error) {
    console.error("[WhatsApp] Error sending message:", error);
    return false;
  }
};

/**
 * Send the same WhatsApp message to multiple numbers in parallel.
 * Returns an array of result objects { number, success }.
 */
export const sendWhatsAppMessages = async (numbers, message) => {
  if (!Array.isArray(numbers) || numbers.length === 0) return [];

  const promises = numbers.map(async (num) => {
    try {
      const ok = await sendWhatsAppMessage(num, message);
      return { number: num, success: !!ok };
    } catch (err) {
      console.error("[WhatsApp] Error sending to", num, err);
      return { number: num, success: false };
    }
  });

  return Promise.all(promises);
};

/**
 * High-level helper: send the pharmacy indent approval notification.
 *
 * @param {Object} indent      - Inserted pharmacy record from Supabase
 * @param {Array}  medicines   - Array of medicine objects
 * @param {Object} requestTypes - Request type flags
 */
export const sendIndentApprovalNotification = async (
  indent,
  medicines,
  requestTypes,
) => {
  try {
    console.log("[WhatsApp] Sending indent approval notification...");
    // Build the approval URL pointing to the pharmacy approval page
    const approvalUrl = `${window.location.origin}/admin/pharmacy/approval`;

    const message = buildIndentApprovalMessage(
      indent,
      medicines,
      requestTypes,
      approvalUrl,
    );

    const results = await sendWhatsAppMessages(APPROVAL_PHONE_NUMBERS, message);

    const successful = results.filter((r) => r.success).map((r) => r.number);
    const failed = results.filter((r) => !r.success).map((r) => r.number);

    if (successful.length > 0) {
      console.log(
        "[WhatsApp] Indent approval notification sent to",
        successful.join(", "),
      );
    }
    if (failed.length > 0) {
      console.warn(
        "[WhatsApp] Failed to send indent approval notification to",
        failed.join(", "),
      );
    }

    return successful.length === APPROVAL_PHONE_NUMBERS.length;
  } catch (error) {
    console.error("[WhatsApp] sendIndentApprovalNotification error:", error);
    return false;
  }
};

/**
 * Build the dressing notification WhatsApp message.
 *
 * @param {Object} dressingData - The dressing record data
 * @param {Object} patientData - Additional patient data from patient_admission
 * @param {string} completeUrl - Full URL to the dressing page
 * @returns {string} Formatted WhatsApp message
 */
export const buildDressingNotificationMessage = (
  dressingData,
  patientData,
  completeUrl,
) => {
  const message = `📌 Dressing Intimation

👤 Patient Name: ${dressingData.patient_name || "N/A"}
🆔 Admission No.: ${dressingData.admission_number || "N/A"}
🏨 Wards: ${dressingData.ward_type || "N/A"} | Bed: ${dressingData.bed_no || "N/A"}

🎯 Reason for Visit: ${patientData?.reason_for_visit || "N/A"}
📅 Age/Gender: ${patientData?.age || "N/A"} / ${patientData?.gender || "N/A"}

✅ Complete Link: ${completeUrl}

📢 Kindly proceed for patient dressing at the scheduled time.

THANKS & REGARDS
NIKHIL KUMAR URANW
MIS`;

  return message;
};

/**
 * High-level helper: send the dressing notification.
 *
 * @param {Object} dressingData - The dressing record data
 * @param {Object} patientData - Additional patient data from patient_admission
 */
export const sendDressingNotification = async (dressingData, patientData) => {
  try {
    console.log("[WhatsApp] Sending dressing notification...");
    const patientId =
      dressingData.patient_id || dressingData.patientId || dressingData.id;
    // Build the complete URL pointing to the dressing page
    const completeUrl = `${window.location.origin}/admin/patient-profile${
      patientId ? `/${patientId}/dressing` : ""
    }`;

    const message = buildDressingNotificationMessage(
      dressingData,
      patientData,
      completeUrl,
    );

    const success = await sendWhatsAppMessage(DRESSING_PHONE_NUMBER, message);

    if (success) {
      console.log("[WhatsApp] Dressing notification sent successfully");
    } else {
      console.warn("[WhatsApp] Failed to send dressing notification");
    }

    return success;
  } catch (error) {
    console.error("[WhatsApp] sendDressingNotification error:", error);
    return false;
  }
};

/**
 * Build the OT notification WhatsApp message.
 *
 * @param {Object} otData - The OT record data
 * @param {Object} patientData - Additional patient data from patient_admission
 * @param {string} completeUrl - Full URL to the OT page
 * @returns {string} Formatted WhatsApp message
 */
export const buildOTNotificationMessage = (
  otData,
  patientData,
  completeUrl,
  isUpdate = false,
) => {
  const operationDateTime =
    otData.ot_date && otData.ot_time
      ? `${otData.ot_date} ${otData.ot_time}`
      : "N/A";

  const title = isUpdate
    ? "📌 OT SURGICAL PATIENT ALERT - UPDATED"
    : "📌 OT SURGICAL PATIENT ALERT";

  const message = `${title}

👤 Patient Name: ${otData.patient_name || "N/A"}
🆔 Admission No.: ${otData.ipd_number || "N/A"}
🏥 Ward: ${otData.ward_type || "N/A"} | Bed: ${otData.bed_no || "N/A"}
🎯 Reason for Visit: ${patientData?.reason_for_visit || "N/A"}
📅 Age/Gender: ${patientData?.age || "N/A"} / ${patientData?.gender || "N/A"}
📂 Category: ${patientData?.category || "N/A"}

⏰ Operation Timing Fixed: ${operationDateTime}
👨‍⚕️ Surgeon: ${otData.doctor || "N/A"}
👨‍⚕️ RMO: ${otData.rmo || "N/A"}

📢 Kindly be present in OT as per the scheduled timing.
✅ Complete Link: ${completeUrl}

NIKHIL KUMAR URANW (MIS)
TEAM MAMTA HOSPITAL`;

  return message;
};

/**
 * High-level helper: send the OT notification.
 *
 * @param {Object} otData - The OT record data
 * @param {Object} patientData - Additional patient data from patient_admission
 * @param {boolean} isUpdate - Whether this is an update notification
 */
export const sendOTNotification = async (
  otData,
  patientData,
  isUpdate = false,
) => {
  try {
    console.log("[WhatsApp] Sending OT notification...");
    // Build the complete URL pointing to the OT page
    const completeUrl = `${window.location.origin}/admin/ot/assign-ot-time`;

    const message = buildOTNotificationMessage(
      otData,
      patientData,
      completeUrl,
      isUpdate,
    );

    const results = await sendWhatsAppMessages(OT_PHONE_NUMBERS, message);

    const successful = results.filter((r) => r.success).map((r) => r.number);
    const failed = results.filter((r) => !r.success).map((r) => r.number);

    if (successful.length > 0) {
      console.log("[WhatsApp] OT notification sent to", successful.join(", "));
    }
    if (failed.length > 0) {
      console.warn(
        "[WhatsApp] Failed to send OT notification to",
        failed.join(", "),
      );
    }

    return successful.length === OT_PHONE_NUMBERS.length;
  } catch (error) {
    console.error("[WhatsApp] sendOTNotification error:", error);
    return false;
  }
};
