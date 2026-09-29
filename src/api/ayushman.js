/**
 * Ayushman Portal API Layer
 * Connects to Supabase `ayushman_portal_view`, `ayushman_portal` table, and `ayushman_photos` storage bucket.
 */
import supabase from "../SupabaseClient";

export const ALLOWED_CATEGORIES = [
  "BSKY",
  "AYUSHMAN BHARAT",
  "AYUSHMAN BHARAT(GJAY)",
  "PRIVATE",
  "ESIC",
];

/**
 * Format IST Date and Time e.g. "29/09/2026, 11:15 AM"
 */
export const formatISTDateTime = (dateString) => {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateString;
  }
};

/**
 * Convert ISO / Date to datetime-local string format "YYYY-MM-DDTHH:mm" for input fields
 */
export const toDateTimeLocal = (dateString) => {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
};

/**
 * Fetch eligible patients from `ayushman_portal_view`
 */
export const fetchAyushmanPatients = async ({
  search = "",
  category = "All",
  dateFrom = null,
  dateTo = null,
  excludeDischarged = true,
} = {}) => {
  let query = supabase.from("ayushman_portal_view").select("*");

  // Category filter
  if (category && category !== "All") {
    query = query.ilike("category", category);
  }

  // Date filters
  if (dateFrom) {
    query = query.gte("admission_timestamp", `${dateFrom} 00:00:00`);
  }
  if (dateTo) {
    query = query.lte("admission_timestamp", `${dateTo} 23:59:59`);
  }

  // Concurrently fetch Ayushman records and discharged admission numbers
  const [patientsRes, dischargeRes] = await Promise.all([
    query,
    excludeDischarged
      ? supabase.from("discharge").select("admission_no")
      : Promise.resolve({ data: [] }),
  ]);

  if (patientsRes.error) {
    console.error("Error fetching ayushman patients:", patientsRes.error);
    throw patientsRes.error;
  }

  let list = patientsRes.data || [];

  // Filter out discharged patients if requested
  if (excludeDischarged && dischargeRes?.data) {
    const dischargedSet = new Set(
      dischargeRes.data
        .map((d) => String(d.admission_no || "").trim().toLowerCase())
        .filter(Boolean),
    );

    list = list.filter((p) => {
      const adm = String(p.admission_no || "").trim().toLowerCase();
      return !dischargedSet.has(adm);
    });
  }

  // Client-side multi-field search filtering for instant responsive feel
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter((p) => {
      const name = (p.patient_name || "").toLowerCase();
      const adm = (p.admission_no || "").toLowerCase();
      const phone = (p.attender_mobile_number || "").toLowerCase();
      const bed = (p.bed_number || "").toLowerCase();
      const ward = (p.ward_number || "").toLowerCase();
      const cat = (p.category || "").toLowerCase();
      const reason = (p.reason_for_visit || "").toLowerCase();
      return (
        name.includes(q) ||
        adm.includes(q) ||
        phone.includes(q) ||
        bed.includes(q) ||
        ward.includes(q) ||
        cat.includes(q) ||
        reason.includes(q)
      );
    });
  }

  return list;
};

/**
 * Update Planned and/or Actual date-time for an admission
 */
export const updateAyushmanPlannedActual = async ({
  admissionNo,
  ipdAdmissionId,
  planned,
  actual,
}) => {
  if (!admissionNo) throw new Error("Admission number is required");

  const payload = {
    admission_no: admissionNo,
    ipd_admission_id: ipdAdmissionId || null,
    updated_at: new Date().toISOString(),
  };

  if (planned !== undefined) {
    payload.planned = planned ? new Date(planned).toISOString() : null;
  }
  if (actual !== undefined) {
    payload.actual = actual ? new Date(actual).toISOString() : null;
  }

  const { data, error } = await supabase
    .from("ayushman_portal")
    .upsert(payload, { onConflict: "admission_no" })
    .select()
    .single();

  if (error) {
    console.error("Error saving planned/actual:", error);
    throw error;
  }

  return data;
};

/**
 * Upload one or multiple photos to `ayushman_photos` bucket (max 20 per patient)
 */
export const uploadAyushmanPhotos = async ({
  admissionNo,
  ipdAdmissionId,
  files = [],
  currentPhotos = [],
}) => {
  if (!admissionNo) throw new Error("Admission number is required");
  if (!files || files.length === 0) return currentPhotos;

  const currentCount = Array.isArray(currentPhotos) ? currentPhotos.length : 0;
  if (currentCount + files.length > 20) {
    throw new Error(
      `Maximum 20 photos allowed per patient row. You already have ${currentCount} photo(s) and selected ${files.length} more.`
    );
  }

  const uploadedObjects = [];

  for (const file of files) {
    // Validate file type
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      throw new Error(`File ${file.name} is not a valid image or PDF.`);
    }

    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${admissionNo}/${Date.now()}_${cleanName}`;

    const { error: uploadError } = await supabase.storage
      .from("ayushman_photos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error(`Upload error for ${file.name}:`, uploadError);
      throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from("ayushman_photos")
      .getPublicUrl(filePath);

    uploadedObjects.push({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: file.name,
      path: filePath,
      url: urlData?.publicUrl || "",
      size: file.size,
      type: file.type,
      uploaded_at: new Date().toISOString(),
    });
  }

  const updatedPhotos = [...(Array.isArray(currentPhotos) ? currentPhotos : []), ...uploadedObjects];

  // Save to database
  const { error: dbError } = await supabase
    .from("ayushman_portal")
    .upsert(
      {
        admission_no: admissionNo,
        ipd_admission_id: ipdAdmissionId || null,
        photos: updatedPhotos,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "admission_no" }
    );

  if (dbError) {
    console.error("Error saving photos list to database:", dbError);
    throw dbError;
  }

  return updatedPhotos;
};

/**
 * Delete a photo from `ayushman_photos` bucket and database
 */
export const deleteAyushmanPhoto = async ({
  admissionNo,
  ipdAdmissionId,
  photoPath,
  currentPhotos = [],
}) => {
  if (!admissionNo || !photoPath) throw new Error("Invalid photo deletion request");

  // Remove from bucket
  const { error: storageError } = await supabase.storage
    .from("ayushman_photos")
    .remove([photoPath]);

  if (storageError) {
    console.warn("Could not delete from storage, proceeding with DB removal:", storageError);
  }

  const filteredPhotos = (currentPhotos || []).filter((p) => p.path !== photoPath);

  const { error: dbError } = await supabase
    .from("ayushman_portal")
    .upsert(
      {
        admission_no: admissionNo,
        ipd_admission_id: ipdAdmissionId || null,
        photos: filteredPhotos,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "admission_no" }
    );

  if (dbError) {
    console.error("Error updating photos list after delete:", dbError);
    throw dbError;
  }

  return filteredPhotos;
};
