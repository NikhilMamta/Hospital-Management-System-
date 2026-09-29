/**
 * Staff Help Ticket System - API Layer
 * Supabase database operations and helper functions.
 */

import supabase from "../SupabaseClient";

// ── Out-of-scope hook for WhatsApp / SMS notifications ─────────────
export const notifyAssignees = async (ticket) => {
  // WhatsApp / SMS integration is out of scope; hook prepared for future triggers
  console.log("[StaffTickets] notifyAssignees called for ticket:", ticket?.ticket_no);
  return true;
};

// ── Hardcoded Categories & Issues (Staff Ticket System) ────────────
export const HARDCODED_CATEGORIES = [
  {
    id: 1,
    name: "General",
    issues: [
      { id: 1, name: "Billing / Accounts Issue" },
      { id: 15, name: "Reception / Front Desk Issue" },
      { id: 16, name: "Cafeteria / Food Quality" },
      { id: 17, name: "Administrative Support" },
      { id: 7, name: "Other" },
    ],
  },
  {
    id: 2,
    name: "IT Related",
    issues: [
      { id: 2, name: "Network / Internet Issue" },
      { id: 18, name: "Computer / Printer Hardware" },
      { id: 19, name: "Software / HMS Issue" },
      { id: 20, name: "Email / Login Issue" },
      { id: 8, name: "Other" },
    ],
  },
  {
    id: 3,
    name: "Maintenance Related",
    issues: [
      { id: 3, name: "Medical Equipment Issue (Monitor, Ventilator, OT Machine, etc.)" },
      { id: 21, name: "Electrical / Light / Fan / AC Issue" },
      { id: 22, name: "Plumbing / Water Supply / Washroom" },
      { id: 23, name: "Civil / Furniture / Bed Repair" },
      { id: 9, name: "Other" },
    ],
  },
  {
    id: 4,
    name: "Housekeeping Related",
    issues: [
      { id: 24, name: "Ward / Room Cleaning" },
      { id: 25, name: "Washroom Cleaning" },
      { id: 26, name: "Linen / Bed Sheet Replacement" },
      { id: 27, name: "Waste Disposal / Dustbin" },
      { id: 10, name: "Other" },
    ],
  },
  {
    id: 5,
    name: "Pharmacy / Medical Supply Related",
    issues: [
      { id: 28, name: "Medicine Stock / Availability" },
      { id: 29, name: "Surgical / Disposable Items Shortage" },
      { id: 30, name: "Indent Delay" },
      { id: 31, name: "Expired / Damaged Medicine" },
      { id: 11, name: "Other" },
    ],
  },
  {
    id: 6,
    name: "Security Related",
    issues: [
      { id: 4, name: "Patient Attendant Issue / Crowding" },
      { id: 32, name: "Theft / Lost Item" },
      { id: 33, name: "Guard Required" },
      { id: 34, name: "Visitor Restriction Issue" },
      { id: 12, name: "Other" },
    ],
  },
  {
    id: 7,
    name: "Ward / Patient Care Related",
    issues: [
      { id: 5, name: "Bed Shortage" },
      { id: 6, name: "Equipment Needed (Wheelchair, Stretcher, Oxygen Cylinder)" },
      { id: 35, name: "Nursing Staff Requirement" },
      { id: 36, name: "Patient Transfer Issue" },
      { id: 13, name: "Other" },
    ],
  },
  {
    id: 8,
    name: "Laboratory / Radiology Related",
    issues: [
      { id: 37, name: "Sample Collection Delay" },
      { id: 38, name: "Report Delay" },
      { id: 39, name: "Machine / Equipment Breakdown" },
      { id: 40, name: "Urgent Report Request" },
      { id: 14, name: "Other" },
    ],
  },
];

// ── Master Data Fetchers ──────────────────────────────────────────

// Standard fallback categories matching exact DB IDs
export const FALLBACK_CATEGORIES = [
  { id: 2, name: "IT Related", sla_working_days: 1 },
  { id: 3, name: "Maintenance Related", sla_working_days: 1 },
  { id: 4, name: "Housekeeping Related", sla_working_days: 1 },
  { id: 5, name: "Pharmacy / Medical Supply Related", sla_working_days: 1 },
  { id: 6, name: "Security Related", sla_working_days: 1 },
  { id: 7, name: "Ward / Patient Care Related", sla_working_days: 1 },
  { id: 8, name: "Laboratory / Radiology Related", sla_working_days: 1 },
  { id: 1, name: "General", sla_working_days: 1 },
];

/**
 * Fetch active categories from staff_ticket_categories
 */
export const fetchActiveCategories = async () => {
  try {
    const { data, error } = await supabase
      .from("staff_ticket_categories")
      .select("id, name, sla_working_days, sort_order, is_active")
      .eq("is_active", true);

    if (!error && data && data.length > 0) {
      const preferredOrder = [
        "it related",
        "maintenance related",
        "housekeeping related",
        "pharmacy / medical supply related",
        "security related",
        "ward / patient care related",
        "laboratory / radiology related",
        "general",
      ];
      return [...data].sort((a, b) => {
        const idxA = preferredOrder.indexOf(a.name?.toLowerCase().trim());
        const idxB = preferredOrder.indexOf(b.name?.toLowerCase().trim());
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
    }
  } catch (e) {
    console.warn("Using fallback categories:", e);
  }

  return FALLBACK_CATEGORIES;
};

/**
 * Fetch issue options for a specific category directly from staff_ticket_issue_options table
 */
export const fetchIssueOptionsByCategory = async (categoryId) => {
  if (!categoryId) return [];

  const { data, error } = await supabase
    .from("staff_ticket_issue_options")
    .select("id, name, category_id, sort_order")
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching issue options from staff_ticket_issue_options table:", error);
    return [];
  }

  return data || [];
};

/**
 * Fetch active departments from the Department Management (master) table
 */
export const fetchActiveDepartments = async () => {
  const { data, error } = await supabase
    .from("master")
    .select("id, department")
    .not("department", "is", null)
    .order("department", { ascending: true });

  if (error) {
    console.error("Error fetching departments from master table:", error);
    throw error;
  }

  // Deduplicate and filter non-empty department names
  const seen = new Set();
  const list = [];
  (data || []).forEach((d) => {
    const name = d.department?.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      list.push({
        id: d.id,
        name: name,
        department: name,
      });
    }
  });

  return list;
};

/**
 * Fetch responsible assignees and Process Coordinators for a category
 */
export const fetchAssigneesForCategory = async (categoryId) => {
  let query = supabase
    .from("staff_ticket_assignees")
    .select("*")
    .eq("is_active", true);

  if (categoryId) {
    // Specific category assignees OR global PC (category_id is null)
    query = query.or(`category_id.eq.${categoryId},category_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching assignees:", error);
    return [];
  }
  return data || [];
};

// ── Client-side Image Compression Helper ─────────────────────────
export const compressImageIfNeeded = async (file, maxWidth = 1600) => {
  // Only compress images (skip PDFs and videos)
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        // If image dimensions are within limit, return as-is
        if (img.width <= maxWidth && img.height <= maxWidth) {
          resolve(file);
          return;
        }

        const scale = Math.min(maxWidth / img.width, maxWidth / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          file.type,
          0.85
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

// ── File Upload to Private Storage Bucket ────────────────────────
export const uploadTicketFile = async (ticketNo, rawFile, updateId = null, uploadedBy = "Staff") => {
  try {
    // Compress image to optimize bandwidth
    const file = await compressImageIfNeeded(rawFile);

    // Sanitize file name
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `tickets/${ticketNo}/${timestamp}-${sanitizedName}`;

    // Upload to private bucket 'staff-ticket-files'
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("staff-ticket-files")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw uploadError;
    }

    return {
      filePath,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    };
  } catch (err) {
    console.error("Error in uploadTicketFile:", err);
    throw err;
  }
};

/**
 * Storage bucket se short-lived signed URL generate karta hai
 */
export const getSignedFileUrl = async (filePath, expiresInSeconds = 3600) => {
  if (!filePath) return null;
  try {
    const { data, error } = await supabase.storage
      .from("staff-ticket-files")
      .createSignedUrl(filePath, expiresInSeconds);

    if (error) {
      console.warn("Error creating signed URL for:", filePath, error);
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.warn("Exception in getSignedFileUrl:", err);
    return null;
  }
};

// ── Ticket Operations ─────────────────────────────────────────────

/**
 * Submit a new ticket
 * Note: ticket_no, planned_at, and status are automatically populated by the DB trigger
 */
export const raiseTicket = async (formData, files = []) => {
  const categoryId = parseInt(formData.category_id, 10);

  // Parse issue_option_id: strictly null if unselected, 0, 'other', or not a valid positive integer
  let issueOptionId = null;
  if (
    formData.issue_option_id &&
    String(formData.issue_option_id).toLowerCase() !== "other" &&
    String(formData.issue_option_id).trim() !== "" &&
    String(formData.issue_option_id) !== "0"
  ) {
    const parsedId = parseInt(formData.issue_option_id, 10);
    if (!isNaN(parsedId) && parsedId > 0) {
      try {
        const { data: opt } = await supabase
          .from("staff_ticket_issue_options")
          .select("id")
          .eq("id", parsedId)
          .maybeSingle();

        if (opt) {
          issueOptionId = parsedId;
        }
      } catch (checkErr) {
        console.warn("Could not verify issue_option_id, falling back to null:", checkErr);
        issueOptionId = null;
      }
    }
  }

  // Send issue_other_text separately if provided
  const issueOtherText = formData.issue_other_text && formData.issue_other_text.trim()
    ? formData.issue_other_text.trim()
    : null;

  const insertPayload = {
    staff_name: formData.staff_name.trim(),
    mobile: formData.mobile.trim(),
    email: formData.email?.trim() || null,
    designation: formData.designation.trim(),
    department: formData.department.trim(),
    category_id: categoryId,
    issue_option_id: issueOptionId,
    issue_other_text: issueOtherText,
    problem_text: formData.problem_text.trim(),
    is_confidential: Boolean(formData.is_confidential),
  };

  const { data: ticket, error: ticketError } = await supabase
    .from("staff_tickets")
    .insert([insertPayload])
    .select("*")
    .single();

  if (ticketError) {
    console.error("Error creating ticket:", ticketError);
    throw ticketError;
  }

  // Upload attachments if selected
  if (files && files.length > 0) {
    const attachmentRecords = [];
    for (const file of files) {
      try {
        const uploaded = await uploadTicketFile(ticket.ticket_no, file, null, ticket.staff_name);
        attachmentRecords.push({
          ticket_id: ticket.id,
          update_id: null,
          file_path: uploaded.filePath,
          file_name: uploaded.fileName,
          mime_type: uploaded.mimeType,
          size_bytes: uploaded.sizeBytes,
          uploaded_by: ticket.staff_name,
        });
      } catch (uploadErr) {
        console.warn("Could not upload a file:", file.name, uploadErr);
      }
    }

    if (attachmentRecords.length > 0) {
      await supabase.from("staff_ticket_attachments").insert(attachmentRecords);
    }
  }

  // Hook trigger for assignees (WhatsApp / SMS future extension)
  notifyAssignees(ticket);

  return ticket;
};

/**
 * Update an existing ticket details
 */
export const updateTicket = async (ticketId, formData, files = []) => {
  const categoryId = parseInt(formData.category_id, 10);

  // Parse issue_option_id: strictly null if unselected, 0, 'other', or not a valid positive integer
  let issueOptionId = null;
  if (
    formData.issue_option_id &&
    String(formData.issue_option_id).toLowerCase() !== "other" &&
    String(formData.issue_option_id).trim() !== "" &&
    String(formData.issue_option_id) !== "0"
  ) {
    const parsedId = parseInt(formData.issue_option_id, 10);
    if (!isNaN(parsedId) && parsedId > 0) {
      try {
        const { data: opt } = await supabase
          .from("staff_ticket_issue_options")
          .select("id")
          .eq("id", parsedId)
          .maybeSingle();

        if (opt) {
          issueOptionId = parsedId;
        }
      } catch (checkErr) {
        console.warn("Could not verify issue_option_id, falling back to null:", checkErr);
        issueOptionId = null;
      }
    }
  }

  // Send issue_other_text separately if provided
  const issueOtherText = formData.issue_other_text && formData.issue_other_text.trim()
    ? formData.issue_other_text.trim()
    : null;

  const updatePayload = {
    staff_name: formData.staff_name.trim(),
    mobile: formData.mobile.trim(),
    email: formData.email?.trim() || null,
    designation: formData.designation.trim(),
    department: formData.department.trim(),
    category_id: categoryId,
    issue_option_id: issueOptionId,
    issue_other_text: issueOtherText,
    problem_text: formData.problem_text.trim(),
    is_confidential: Boolean(formData.is_confidential),
  };

  const { data: ticket, error: ticketError } = await supabase
    .from("staff_tickets")
    .update(updatePayload)
    .eq("id", ticketId)
    .select("*")
    .single();

  if (ticketError) {
    console.error("Error updating ticket:", ticketError);
    throw ticketError;
  }

  // Upload attachments if selected
  if (files && files.length > 0) {
    const attachmentRecords = [];
    for (const file of files) {
      try {
        const uploaded = await uploadTicketFile(ticket.ticket_no, file, null, ticket.staff_name);
        attachmentRecords.push({
          ticket_id: ticket.id,
          update_id: null,
          file_path: uploaded.filePath,
          file_name: uploaded.fileName,
          mime_type: uploaded.mimeType,
          size_bytes: uploaded.sizeBytes,
          uploaded_by: ticket.staff_name,
        });
      } catch (uploadErr) {
        console.warn("Could not upload a file:", file.name, uploadErr);
      }
    }

    if (attachmentRecords.length > 0) {
      await supabase.from("staff_ticket_attachments").insert(attachmentRecords);
    }
  }

  return ticket;
};

/**
 * Public Track Ticket: verify Ticket No and Mobile Number
 */
export const trackPublicTicket = async (ticketNo, mobile) => {
  if (!ticketNo || !mobile) {
    throw new Error("Both Ticket Number and Mobile Number are required");
  }

  const cleanNo = ticketNo.trim().toUpperCase();
  const cleanMobile = mobile.trim();

  // Verify ticket details
  const { data: ticket, error } = await supabase
    .from("staff_tickets")
    .select("id, ticket_no, staff_name, mobile, department, problem_text, created_at, planned_at, completed_at, status, is_confidential")
    .eq("ticket_no", cleanNo)
    .single();

  if (error || !ticket) {
    throw new Error("Ticket not found. Please verify your Ticket Number.");
  }

  // Mobile number exact 10 digits match hona chahiye
  if (ticket.mobile !== cleanMobile) {
    throw new Error("Mobile Number does not match. Please enter the registered 10-digit mobile number.");
  }

  // Fetch public update timeline
  const { data: updates } = await supabase
    .from("staff_ticket_updates")
    .select("id, stage, description, updated_by_name, updated_by_email, created_at")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });

  const mappedUpdates = (updates || []).map((u) => ({
    ...u,
    updated_by: u.updated_by_name || u.updated_by_email || "Staff",
  }));

  return {
    ticket,
    updates: mappedUpdates,
  };
};

/**
 * Fetch ticket list from overview view (Pagination, filters, search, tabs)
 */
export const fetchTicketsOverview = async ({
  tab = "all_pending",
  categoryId = null,
  departmentId = null,
  search = "",
  dateFrom = null,
  dateTo = null,
  page = 0,
  pageSize = 25,
  isAdmin = false,
  status = null,
}) => {
  let query = supabase
    .from("staff_tickets_overview")
    .select("*", { count: "exact" });

  // Confidential filter: hide confidential tickets from non-admin users
  if (!isAdmin) {
    query = query.eq("is_confidential", false);
  }

  // Status or Tab based filtering
  if (status) {
    query = query.eq("status", status);
  } else if (tab === "overdue") {
    query = query.neq("status", "completed").eq("is_overdue", true);
  } else if (tab === "analysis") {
    query = query.eq("status", "analysis");
  } else if (tab === "working") {
    query = query.eq("status", "working");
  } else if (tab === "open") {
    query = query.eq("status", "open");
  } else if (tab === "all_pending") {
    query = query.neq("status", "completed");
  } else if (tab === "completed") {
    query = query.eq("status", "completed");
  }

  // Category filter
  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  // Department filter
  if (departmentId) {
    query = query.eq("department", departmentId);
  }

  // Date range filter
  if (dateFrom) {
    query = query.gte("created_at", `${dateFrom}T00:00:00Z`);
  }
  if (dateTo) {
    query = query.lte("created_at", `${dateTo}T23:59:59Z`);
  }

  // Search filter (Ticket No, Staff Name, Mobile)
  const cleanSearch = search.trim();
  if (cleanSearch) {
    query = query.or(
      `ticket_no.ilike.%${cleanSearch}%,staff_name.ilike.%${cleanSearch}%,mobile.ilike.%${cleanSearch}%,problem_text.ilike.%${cleanSearch}%`
    );
  }

  // Default sorting
  if (tab === "overdue") {
    query = query.order("delay_hours", { ascending: false, nullsFirst: false });
  } else if (tab === "completed") {
    query = query.order("completed_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  // Server-side Pagination
  const from = page * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) {
    console.error("Error fetching staff tickets overview:", error);
    throw error;
  }

  const enrichedTickets = (data || []).map((t) => {
    const cat = HARDCODED_CATEGORIES.find((c) => Number(c.id) === Number(t.category_id));
    const categoryName = t.category_name || cat?.name || "General";
    const issueOption = cat?.issues.find((i) => Number(i.id) === Number(t.issue_option_id));
    const issueName = t.issue_name || issueOption?.name || (t.issue_option_id ? "Specific Issue" : "General Issue");
    return {
      ...t,
      category_name: categoryName,
      issue_name: issueName,
    };
  });

  return {
    tickets: enrichedTickets,
    totalCount: count || 0,
    page,
    pageSize,
  };
};

/**
 * Fetch summary KPI counts (Open, Analysis, Working, Overdue, Completed Month)
 */
export const fetchTicketDashboardCounts = async (isAdmin = false) => {
  let baseQuery = supabase.from("staff_tickets_overview").select("status, is_overdue, completed_at, is_confidential");

  if (!isAdmin) {
    baseQuery = baseQuery.eq("is_confidential", false);
  }

  const { data, error } = await baseQuery;
  if (error) {
    console.error("Error fetching summary counts:", error);
    return { open: 0, analysis: 0, working: 0, overdue: 0, completedMonth: 0 };
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let open = 0;
  let analysis = 0;
  let working = 0;
  let overdue = 0;
  let completedMonth = 0;

  (data || []).forEach((t) => {
    if (t.status === "open") open++;
    if (t.status === "analysis") analysis++;
    if (t.status === "working") working++;
    if (t.status !== "completed" && t.is_overdue) overdue++;

    if (t.status === "completed" && t.completed_at) {
      const cDate = new Date(t.completed_at);
      if (cDate.getMonth() === currentMonth && cDate.getFullYear() === currentYear) {
        completedMonth++;
      }
    }
  });

  return { open, analysis, working, overdue, completedMonth };
};

/**
 * Fetch ticket details, update timeline, attachments, and signed URLs for detail drawer
 */
export const fetchTicketDetails = async (ticketId, isAdmin = false) => {
  // Fetch ticket details
  const { data: ticket, error: ticketErr } = await supabase
    .from("staff_tickets_overview")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (ticketErr || !ticket) {
    throw new Error("Failed to load ticket details");
  }

  if (ticket.is_confidential && !isAdmin) {
    throw new Error("You do not have permission to view this confidential ticket");
  }

  // Enrich category_name and issue_name if missing
  const cat = HARDCODED_CATEGORIES.find((c) => Number(c.id) === Number(ticket.category_id));
  ticket.category_name = ticket.category_name || cat?.name || "General";
  const issueOption = cat?.issues.find((i) => Number(i.id) === Number(ticket.issue_option_id));
  ticket.issue_name = ticket.issue_name || issueOption?.name || (ticket.issue_option_id ? "Specific Issue" : "General Issue");

  // Fetch updates history (ordered chronologically)
  const { data: updates, error: updateErr } = await supabase
    .from("staff_ticket_updates")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (updateErr) console.warn("Error fetching updates:", updateErr);

  // Fetch attachments
  const { data: attachments, error: attachErr } = await supabase
    .from("staff_ticket_attachments")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (attachErr) console.warn("Error fetching attachments:", attachErr);

  // Generate signed URLs for attachments
  const attachmentsWithUrls = await Promise.all(
    (attachments || []).map(async (att) => {
      const signedUrl = await getSignedFileUrl(att.file_path);
      return {
        ...att,
        signedUrl,
      };
    })
  );

  // Fetch category assignees for tap-to-call
  const assignees = await fetchAssigneesForCategory(ticket.category_id);

  const mappedUpdates = (updates || []).map((u) => ({
    ...u,
    updated_by: u.updated_by_name || u.updated_by_email || u.updated_by || "Staff",
  }));

  return {
    ticket,
    updates: mappedUpdates,
    attachments: attachmentsWithUrls,
    assignees,
  };
};

/**
 * Post a new progress update on a ticket (Stage: analysis, working, completed)
 * DB trigger automatically handles ticket status and completion timestamps
 */
export const addTicketUpdate = async ({
  ticketId,
  ticketNo,
  stage,
  description,
  updatedBy,
  files = [],
}) => {
  // Completed status requires a non-empty description
  if (stage === "completed" && (!description || !description.trim())) {
    throw new Error("A problem-solving description is required for Completed status");
  }

  const payload = {
    ticket_id: ticketId,
    stage: stage.toLowerCase(),
    description: description ? description.trim() : "",
    updated_by_name: updatedBy || "System User",
  };

  const { data: newUpdate, error: insertErr } = await supabase
    .from("staff_ticket_updates")
    .insert([payload])
    .select("*")
    .single();

  if (insertErr) {
    console.error("Error inserting update:", insertErr);
    throw insertErr;
  }

  // Upload attachment if included with update
  if (files && files.length > 0) {
    const attachmentRecords = [];
    for (const file of files) {
      try {
        const uploaded = await uploadTicketFile(ticketNo, file, newUpdate.id, updatedBy);
        attachmentRecords.push({
          ticket_id: ticketId,
          update_id: newUpdate.id,
          file_path: uploaded.filePath,
          file_name: uploaded.fileName,
          mime_type: uploaded.mimeType,
          size_bytes: uploaded.sizeBytes,
          uploaded_by: updatedBy,
        });
      } catch (uploadErr) {
        console.warn("Could not upload update file:", file.name, uploadErr);
      }
    }

    if (attachmentRecords.length > 0) {
      await supabase.from("staff_ticket_attachments").insert(attachmentRecords);
    }
  }

  return newUpdate;
};

/**
 * Re-open completed ticket (Inserts analysis or working update with mandatory reason)
 */
export const reopenTicket = async ({ ticketId, ticketNo, newStage, reason, updatedBy }) => {
  if (!reason || !reason.trim()) {
    throw new Error("A valid reason is required to re-open this ticket");
  }
  return addTicketUpdate({
    ticketId,
    ticketNo,
    stage: newStage || "analysis",
    description: `[RE-OPENED]: ${reason.trim()}`,
    updatedBy,
  });
};

/**
 * Check if the same mobile + category lodged a grievance within the last 90 days
 */
export const checkEarlierLodgedGrievance = async (mobile, categoryId, currentTicketId) => {
  if (!mobile || !categoryId) return { lodgedEarlier: false, previousTickets: [] };

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data, error } = await supabase
    .from("staff_tickets")
    .select("ticket_no, created_at, status")
    .eq("mobile", mobile)
    .eq("category_id", categoryId)
    .neq("id", currentTicketId)
    .gte("created_at", ninetyDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Error checking earlier lodged tickets:", error);
    return { lodgedEarlier: false, previousTickets: [] };
  }

  return {
    lodgedEarlier: (data && data.length > 0) || false,
    previousTickets: (data || []).map((t) => t.ticket_no),
  };
};

/**
 * Fetch analytics and stats for completed tickets
 */
export const fetchCompletedAnalytics = async (isAdmin = false) => {
  let query = supabase
    .from("staff_tickets_overview")
    .select("id, ticket_no, category_name, created_at, planned_at, completed_at, is_overdue, is_confidential")
    .eq("status", "completed");

  if (!isAdmin) {
    query = query.eq("is_confidential", false);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching completed stats:", error);
    return { totalCompleted: 0, onTimePercent: 0, avgTatHours: 0, categoryBreakdown: {} };
  }

  const total = data.length;
  if (total === 0) {
    return { totalCompleted: 0, onTimePercent: 100, avgTatHours: 0, categoryBreakdown: {} };
  }

  let onTimeCount = 0;
  let totalTatHours = 0;
  const categoryMap = {};

  data.forEach((t) => {
    const isLate = t.is_overdue || (t.completed_at && t.planned_at && new Date(t.completed_at) > new Date(t.planned_at));
    if (!isLate) onTimeCount++;

    if (t.completed_at && t.created_at) {
      const diffMs = new Date(t.completed_at) - new Date(t.created_at);
      const diffHours = Math.max(0, diffMs / (1000 * 60 * 60));
      totalTatHours += diffHours;
    }

    const catName = t.category_name || "General";
    if (!categoryMap[catName]) {
      categoryMap[catName] = { count: 0, onTime: 0 };
    }
    categoryMap[catName].count++;
    if (!isLate) categoryMap[catName].onTime++;
  });

  return {
    totalCompleted: total,
    onTimePercent: Math.round((onTimeCount / total) * 100),
    avgTatHours: Math.round(totalTatHours / total),
    categoryBreakdown: categoryMap,
  };
};

// ── Time & Delay Formatting Utilities ──────────────────────────────

/**
 * Format IST Date: "dd MMM yyyy, hh:mm a"
 */
export const formatISTDateTime = (dateStr) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch (e) {
    return dateStr;
  }
};

/**
 * Delay format helper: "2d 4h" style
 */
export const formatDelayText = (delayHours, isOverdue, isCompleted) => {
  if (delayHours === null || delayHours === undefined) return "-";

  const absHours = Math.abs(Math.round(delayHours));
  const days = Math.floor(absHours / 24);
  const remainingHours = absHours % 24;

  let text = "";
  if (days > 0) text += `${days}d `;
  text += `${remainingHours}h`;

  if (isCompleted) {
    return isOverdue ? `Late by ${text}` : "On time";
  }

  return isOverdue ? `Overdue by ${text}` : `${text} left`;
};

// ── Master Data Admin CRUD ────────────────────────────────────────

export const adminSaveCategory = async (catData) => {
  if (catData.id) {
    const { data, error } = await supabase
      .from("staff_ticket_categories")
      .update({
        name: catData.name,
        sla_working_days: parseInt(catData.sla_working_days) || 1,
        sort_order: parseInt(catData.sort_order) || 0,
        is_active: catData.is_active ?? true,
      })
      .eq("id", catData.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("staff_ticket_categories")
      .insert([{
        name: catData.name,
        sla_working_days: parseInt(catData.sla_working_days) || 1,
        sort_order: parseInt(catData.sort_order) || 0,
        is_active: true,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export const adminSaveIssueOption = async (issueData) => {
  if (issueData.id) {
    const { data, error } = await supabase
      .from("staff_ticket_issue_options")
      .update({
        name: issueData.name,
        category_id: issueData.category_id,
        sort_order: parseInt(issueData.sort_order) || 0,
        is_active: issueData.is_active ?? true,
      })
      .eq("id", issueData.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("staff_ticket_issue_options")
      .insert([{
        name: issueData.name,
        category_id: issueData.category_id,
        sort_order: parseInt(issueData.sort_order) || 0,
        is_active: true,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export const adminSaveDepartment = async (deptData) => {
  if (deptData.id) {
    const { data, error } = await supabase
      .from("staff_ticket_departments")
      .update({
        name: deptData.name,
        sort_order: parseInt(deptData.sort_order) || 0,
        is_active: deptData.is_active ?? true,
      })
      .eq("id", deptData.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("staff_ticket_departments")
      .insert([{
        name: deptData.name,
        sort_order: parseInt(deptData.sort_order) || 0,
        is_active: true,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export const adminSaveAssignee = async (assigneeData) => {
  const payload = {
    person_name: assigneeData.person_name,
    mobile: assigneeData.mobile,
    role: assigneeData.role || "assignee",
    category_id: assigneeData.category_id || null, // null means global PC
    is_active: assigneeData.is_active ?? true,
  };

  if (assigneeData.id) {
    const { data, error } = await supabase
      .from("staff_ticket_assignees")
      .update(payload)
      .eq("id", assigneeData.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from("staff_ticket_assignees")
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export const adminToggleActiveStatus = async (table, id, currentStatus) => {
  const { data, error } = await supabase
    .from(table)
    .update({ is_active: !currentStatus })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};
