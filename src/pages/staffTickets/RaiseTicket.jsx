import React, { useState, useEffect } from "react";
import {
  LifeBuoy,
  Plus,
  Edit,
  CheckCircle2,
  AlertCircle,
  Upload,
  X,
  Lock,
  Phone,
  Clock,
  Building,
  User,
  Tag,
  Paperclip,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import supabase from "../../SupabaseClient";
import {
  FALLBACK_CATEGORIES,
  fetchActiveCategories,
  fetchIssueOptionsByCategory,
  fetchActiveDepartments,
  raiseTicket,
  updateTicket,
  formatISTDateTime,
} from "../../api/staffTickets";
import hospitalLogo from "../../Image/logo.png";

/**
 * RaiseTicket Page
 * Displays staff ticket entries in a tabular format with an Action column (Edit),
 * and provides a "+ Raise New Ticket" button that opens the form inside a modal.
 */
const RaiseTicket = () => {
  // Master data
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [issueOptions, setIssueOptions] = useState([]);
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);

  // Tickets table state
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal & Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null); // null = create mode, ticket object = edit mode
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successToast, setSuccessToast] = useState("");

  const [formData, setFormData] = useState({
    staff_name: "",
    mobile: "",
    email: "",
    designation: "",
    department: "",
    category_id: "",
    issue_option_id: "",
    issue_other_text: "",
    problem_text: "",
    is_confidential: false,
    honeypot: "",
  });

  const [files, setFiles] = useState([]);
  const [isOtherSelected, setIsOtherSelected] = useState(false);

  // Load tickets list from Supabase
  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from("staff_tickets")
        .select(`
          *,
          category:staff_ticket_categories(id, name),
          issue_option:staff_ticket_issue_options(id, name)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        // Fallback to simple select if relations aren't declared in FK schema
        const { data: fallbackData, error: fbErr } = await supabase
          .from("staff_tickets")
          .select("*")
          .order("created_at", { ascending: false });

        if (fbErr) throw fbErr;
        setTickets(fallbackData || []);
      } else {
        setTickets(data || []);
      }
    } catch (err) {
      console.error("Error loading tickets:", err);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Load masters on mount
  useEffect(() => {
    const loadMasters = async () => {
      setLoadingMasters(true);
      try {
        const [depts, cats] = await Promise.all([
          fetchActiveDepartments(),
          fetchActiveCategories(),
        ]);
        setDepartments(depts || []);
        if (cats && cats.length > 0) {
          setCategories(cats);
        }
      } catch (err) {
        console.error("Error loading master options:", err);
      } finally {
        setLoadingMasters(false);
      }
    };

    loadMasters();
    loadTickets();
  }, []);

  // Open modal in Create mode
  const handleOpenCreate = () => {
    setEditingTicket(null);
    setFormData({
      staff_name: "",
      mobile: "",
      email: "",
      designation: "",
      department: "",
      category_id: "",
      issue_option_id: "",
      issue_other_text: "",
      problem_text: "",
      is_confidential: false,
      honeypot: "",
    });
    setIssueOptions([]);
    setIsOtherSelected(false);
    setFiles([]);
    setErrorMsg("");
    setIsModalOpen(true);
  };

  // Open modal in Edit mode
  const handleOpenEdit = async (ticket) => {
    setEditingTicket(ticket);
    setErrorMsg("");
    setFiles([]);

    const catId = ticket.category_id ? String(ticket.category_id) : "";
    const issueId = ticket.issue_option_id ? String(ticket.issue_option_id) : "";

    setFormData({
      staff_name: ticket.staff_name || "",
      mobile: ticket.mobile || "",
      email: ticket.email || "",
      designation: ticket.designation || "",
      department: ticket.department || "",
      category_id: catId,
      issue_option_id: issueId || (ticket.issue_other_text ? "other" : ""),
      issue_other_text: ticket.issue_other_text || "",
      problem_text: ticket.problem_text || "",
      is_confidential: Boolean(ticket.is_confidential),
      honeypot: "",
    });

    if (catId) {
      setLoadingIssues(true);
      try {
        const options = await fetchIssueOptionsByCategory(catId);
        setIssueOptions(options || []);
        const opt = (options || []).find((o) => String(o.id) === String(issueId));
        const isOther =
          Boolean(ticket.issue_other_text) ||
          opt?.name?.toLowerCase().includes("other") ||
          issueId === "other";
        setIsOtherSelected(isOther);
      } catch (e) {
        console.error("Error loading issue options for edit:", e);
      } finally {
        setLoadingIssues(false);
      }
    } else {
      setIssueOptions([]);
      setIsOtherSelected(false);
    }

    setIsModalOpen(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTicket(null);
    setErrorMsg("");
  };

  // Category change handler
  const handleCategoryChange = async (categoryId) => {
    setFormData((prev) => ({
      ...prev,
      category_id: categoryId,
      issue_option_id: "",
      issue_other_text: "",
    }));
    setIsOtherSelected(false);
    setIssueOptions([]);

    if (!categoryId) return;

    setLoadingIssues(true);
    try {
      const options = await fetchIssueOptionsByCategory(categoryId);
      setIssueOptions(options || []);
    } catch (e) {
      console.error("Error fetching issue options:", e);
    } finally {
      setLoadingIssues(false);
    }
  };

  // Issue change handler
  const handleIssueChange = (issueId) => {
    if (!issueId) {
      setIsOtherSelected(false);
      setFormData((prev) => ({
        ...prev,
        issue_option_id: "",
        issue_other_text: "",
      }));
      return;
    }

    const opt = issueOptions.find((o) => String(o.id) === String(issueId));
    const isOther = issueId === "other" || opt?.name?.toLowerCase().includes("other");
    setIsOtherSelected(Boolean(isOther));

    setFormData((prev) => ({
      ...prev,
      issue_option_id: issueId,
      issue_other_text: isOther ? prev.issue_other_text : "",
    }));
  };

  // File selection
  const handleFileSelect = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Form submission (Create or Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (formData.honeypot) {
      return;
    }

    // 10 digits mobile validation
    const cleanMobile = formData.mobile.replace(/\D/g, "");
    if (cleanMobile.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    // Problem description minimum 10 characters
    if (formData.problem_text.trim().length < 10) {
      setErrorMsg("Problem description must be at least 10 characters long.");
      return;
    }

    // Other issue text validation
    if (isOtherSelected && !formData.issue_other_text.trim()) {
      setErrorMsg("You selected 'Other'. Please specify your issue.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingTicket) {
        // Edit mode
        await updateTicket(editingTicket.id, formData, files);
        setSuccessToast(`Ticket #${editingTicket.ticket_no} updated successfully!`);
      } else {
        // Create mode
        const newTicket = await raiseTicket(formData, files);
        setSuccessToast(`Ticket #${newTicket.ticket_no} raised successfully!`);
      }

      handleCloseModal();
      await loadTickets();

      // Auto clear toast after 4s
      setTimeout(() => {
        setSuccessToast("");
      }, 4000);
    } catch (err) {
      console.error("Error submitting ticket form:", err);
      setErrorMsg(err.message || "Failed to save ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Status Badge UI helper
  const getStatusBadge = (status) => {
    switch ((status || "").toLowerCase()) {
      case "open":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Open
          </span>
        );
      case "analysis":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            In Analysis
          </span>
        );
      case "working":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            Working
          </span>
        );
      case "completed":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Completed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status || "Open"}
          </span>
        );
    }
  };

  // Helper to resolve Category Name
  const getCategoryName = (ticket) => {
    if (ticket.category?.name) return ticket.category.name;
    const found = categories.find((c) => Number(c.id) === Number(ticket.category_id));
    return found ? found.name : "General";
  };

  // Helper to resolve Issue Name
  const getIssueName = (ticket) => {
    if (ticket.issue_option?.name) return ticket.issue_option.name;
    if (ticket.issue_other_text) return `Other: ${ticket.issue_other_text}`;
    return "General / Unspecified";
  };

  // Filtered tickets
  const filteredTickets = tickets.filter((t) => {
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNo = t.ticket_no?.toLowerCase().includes(q);
      const matchName = t.staff_name?.toLowerCase().includes(q);
      const matchMobile = t.mobile?.includes(q);
      const matchProblem = t.problem_text?.toLowerCase().includes(q);
      const matchDept = t.department?.toLowerCase().includes(q);
      if (!matchNo && !matchName && !matchMobile && !matchProblem && !matchDept) {
        return false;
      }
    }

    // Department filter
    if (deptFilter !== "all" && t.department?.toLowerCase() !== deptFilter.toLowerCase()) {
      return false;
    }

    // Status filter
    if (statusFilter !== "all" && (t.status || "").toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6">
      {/* ── Page Header & Action Bar ─────────────────────────────── */}
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Success Toast */}
        {successToast && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successToast}</span>
            </div>
            <button
              onClick={() => setSuccessToast("")}
              className="text-emerald-700 hover:text-emerald-900 font-bold"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center shrink-0">
              <LifeBuoy className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Staff Help Ticket System
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                  FMS
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Mamta Super Speciality Hospital • Grievance Redressal & Help Desk
              </p>
            </div>
          </div>

          {/* Primary Button: Put form inside this button */}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Raise New Ticket</span>
          </button>
        </div>

        {/* ── Filters & Search Bar ──────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ticket no, staff name, mobile, problem..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            {/* Department Filter */}
            <div className="flex items-center space-x-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="py-2 px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="analysis">In Analysis</option>
              <option value="working">Working</option>
              <option value="completed">Completed</option>
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={loadTickets}
              title="Refresh tickets"
              className="p-2 text-slate-600 hover:text-blue-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loadingTickets ? "animate-spin text-blue-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── Table Form Showing Entries ────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 whitespace-nowrap text-center">Action</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Ticket No</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Date & Time</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Complainant</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Mobile</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Department</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Category & Issue</th>
                  <th className="py-3.5 px-4">Problem Summary</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingTickets ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      <span className="font-medium">Loading ticket entries...</span>
                    </td>
                  </tr>
                ) : filteredTickets.length > 0 ? (
                  filteredTickets.map((t) => {
                    const catName = getCategoryName(t);
                    const issueName = getIssueName(t);

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Action Column with Edit Button */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(t)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 transition-colors space-x-1.5 cursor-pointer shadow-xs"
                          >
                            <Edit className="w-3.5 h-3.5 text-blue-600" />
                            <span>Edit</span>
                          </button>
                        </td>

                        {/* Ticket No */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-blue-700 font-extrabold">{t.ticket_no}</span>
                            {t.is_confidential && (
                              <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" title="Confidential" />
                            )}
                          </div>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatISTDateTime(t.created_at)}
                        </td>

                        {/* Complainant */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-800">{t.staff_name}</div>
                          <div className="text-[11px] text-slate-500 italic">
                            {t.designation || "Staff"}
                          </div>
                        </td>

                        {/* Mobile */}
                        <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                          <div className="flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{t.mobile}</span>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {t.department}
                          </span>
                        </td>

                        {/* Category & Issue */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-blue-900">{catName}</div>
                          <div className="text-[11px] text-slate-600 truncate max-w-[180px]">
                            {issueName}
                          </div>
                        </td>

                        {/* Problem Summary */}
                        <td className="py-3.5 px-4 max-w-xs text-slate-700">
                          <p className="line-clamp-2 leading-relaxed">
                            {t.problem_text}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getStatusBadge(t.status)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400">
                      <LifeBuoy className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-600 font-semibold">No ticket entries found</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {searchQuery || deptFilter !== "all" || statusFilter !== "all"
                          ? "Try clearing filters to see more results."
                          : "Click 'Raise New Ticket' to create the first entry."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer info */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-slate-500 text-xs flex justify-between items-center px-4">
            <span>
              Showing <b className="text-slate-800">{filteredTickets.length}</b> of{" "}
              <b className="text-slate-800">{tickets.length}</b> total tickets
            </span>
            <span className="flex items-center space-x-1 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mamta Hospital Grievance Cell</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Modal Dialog containing the Ticket Form ─────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center">
                  {editingTicket ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingTicket
                      ? `Edit Ticket #${editingTicket.ticket_no}`
                      : "Raise New Help Ticket"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {editingTicket
                      ? "Update ticket details and grievance information"
                      : "Provide accurate details for prompt resolution"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Honeypot field */}
              <input
                type="text"
                name="website_url_hp"
                value={formData.honeypot}
                onChange={(e) => setFormData({ ...formData, honeypot: e.target.value })}
                style={{ display: "none" }}
                tabIndex="-1"
                autoComplete="off"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                {/* 1. Full Name */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Enter Your Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.staff_name}
                      onChange={(e) => setFormData({ ...formData, staff_name: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
                    />
                  </div>
                </div>

                {/* 2. Mobile Number */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Enter Your Mobile Number (10 digits) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="10-digit mobile"
                      value={formData.mobile}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                        })
                      }
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-800"
                    />
                  </div>
                </div>

                {/* 3. Email (optional) */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="ward / personal gmail"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>

                {/* 4. Designation */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Designation <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Staff Nurse, Ward Attendant, HR"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
                  />
                </div>

                {/* 5. Department */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Your Department <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <select
                      required
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white"
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 6. Grievance Category */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Grievance Category <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Tag className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <select
                      required
                      value={formData.category_id}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white"
                    >
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 7. Issue Dropdown (from staff_ticket_issue_options table) */}
              {formData.category_id && (
                <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-200 text-xs space-y-3">
                  <div>
                    <label className="block font-semibold text-blue-950 mb-1">
                      Select Specific Issue <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.issue_option_id}
                      onChange={(e) => handleIssueChange(e.target.value)}
                      disabled={loadingIssues}
                      className="w-full p-2.5 rounded-xl border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white"
                    >
                      <option value="">
                        {loadingIssues ? "Loading issues..." : "Choose specific issue..."}
                      </option>
                      {issueOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                      {!loadingIssues &&
                        !issueOptions.some((opt) =>
                          opt.name?.toLowerCase().includes("other")
                        ) && (
                          <option value="other">Other (Please specify)</option>
                        )}
                    </select>
                  </div>

                  {/* Free text input if "Other" is selected */}
                  {isOtherSelected && (
                    <div>
                      <label className="block font-semibold text-blue-950 mb-1">
                        Please Specify Your Other Issue <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Type your specific issue here..."
                        value={formData.issue_other_text}
                        onChange={(e) =>
                          setFormData({ ...formData, issue_other_text: e.target.value })
                        }
                        className="w-full p-2.5 rounded-xl border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 8. Problem Description Textarea */}
              <div className="text-xs">
                <label className="block font-semibold text-slate-700 mb-1">
                  Please Specify Your Problem (in detail){" "}
                  <span className="text-red-500">* (Min 10 characters)</span>
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={10}
                  placeholder="Describe the issue, affected equipment, or ward location in detail..."
                  value={formData.problem_text}
                  onChange={(e) => setFormData({ ...formData, problem_text: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 leading-relaxed"
                />
              </div>

              {/* 9. Attachments Upload */}
              <div className="text-xs">
                <label className="block font-semibold text-slate-700 mb-1">
                  Attachments / Photos / Evidence{" "}
                  <span className="text-slate-400 font-normal">(Multiple files allowed)</span>
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-3.5 text-center hover:border-blue-500 bg-slate-50/50 transition-colors">
                  <input
                    type="file"
                    id="ticket-files-modal-input"
                    multiple
                    accept="image/*,.pdf,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="ticket-files-modal-input"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-1"
                  >
                    <Upload className="w-5 h-5 text-blue-600" />
                    <span className="text-blue-700 font-semibold text-xs">
                      Click to upload files or photos
                    </span>
                    <span className="text-[11px] text-slate-400">
                      PNG, JPG, PDF, MP4 (Compressed automatically)
                    </span>
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {files.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center space-x-1.5 bg-slate-100 text-slate-800 text-[11px] px-2.5 py-1 rounded-lg border border-slate-200"
                      >
                        <Paperclip className="w-3 h-3 text-slate-500" />
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-slate-400 hover:text-red-600 font-bold ml-1"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 10. Confidential Checkbox */}
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 text-xs flex items-start space-x-2.5">
                <input
                  type="checkbox"
                  id="confidential-modal-check"
                  checked={formData.is_confidential}
                  onChange={(e) => setFormData({ ...formData, is_confidential: e.target.checked })}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="confidential-modal-check" className="cursor-pointer">
                  <span className="font-bold text-amber-950 flex items-center">
                    <Lock className="w-3.5 h-3.5 mr-1 text-amber-700" /> Mark as Confidential (Management Only)
                  </span>
                  <span className="text-slate-600 block text-[11px] mt-0.5">
                    This grievance will only be visible to Hospital Management and Admin.
                  </span>
                </label>
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-end space-x-3 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{editingTicket ? "Updating Ticket..." : "Submitting Ticket..."}</span>
                    </>
                  ) : (
                    <span>{editingTicket ? "Update Ticket" : "Submit Ticket"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RaiseTicket;
