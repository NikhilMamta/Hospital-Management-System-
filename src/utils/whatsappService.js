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
// ⬇️  Hardcoded recipient – change this number as needed
const APPROVAL_PHONE_NUMBER = "916267799443"; // e.g. 919876543210

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
✅ 'https://hospital-management-system-rho-nine.vercel.app'

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

    const success = await sendWhatsAppMessage(APPROVAL_PHONE_NUMBER, message);

    if (success) {
      console.log(
        "[WhatsApp] Indent approval notification sent to",
        APPROVAL_PHONE_NUMBER,
      );
    } else {
      console.warn(
        "[WhatsApp] Indent approval notification could not be sent.",
      );
    }

    return success;
  } catch (error) {
    console.error("[WhatsApp] sendIndentApprovalNotification error:", error);
    return false;
  }
};
