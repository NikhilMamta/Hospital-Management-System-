import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Check,
  X,
  Save,
  Tag,
  ListFilter,
  Building,
  UserCheck,
  Shield,
  Phone,
} from "lucide-react";
import supabase from "../../SupabaseClient";
import {
  adminSaveCategory,
  adminSaveIssueOption,
  adminSaveDepartment,
  adminSaveAssignee,
  adminToggleActiveStatus,
} from "../../api/staffTickets";

/**
 * TicketMasterSettings
 * Admin CRUD management for staff ticket master data (Categories, Issues, Departments, Assignees).
 * Matches existing hospital settings styling.
 */
const TicketMasterSettings = () => {
  const [activeTab, setActiveTab] = useState("categories");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Data lists
  const [categories, setCategories] = useState([]);
  const [issueOptions, setIssueOptions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [assignees, setAssignees] = useState([]);

  // Selected category for filtering issues
  const [selectedCatFilter, setSelectedCatFilter] = useState("all");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [catForm, setCatForm] = useState({ name: "", sla_working_days: 1, sort_order: 0 });
  const [issueForm, setIssueForm] = useState({ name: "", category_id: "", sort_order: 0 });
  const [deptForm, setDeptForm] = useState({ name: "", sort_order: 0 });
  const [assigneeForm, setAssigneeForm] = useState({
    person_name: "",
    mobile: "",
    role: "assignee",
    category_id: "",
  });

  // Load all master data
  const loadAllMasters = async () => {
    setLoading(true);
    try {
      const [catsRes, issuesRes, deptsRes, assigneesRes] = await Promise.all([
        supabase.from("staff_ticket_categories").select("*").order("sort_order", { ascending: true }),
        supabase.from("staff_ticket_issue_options").select("*").order("sort_order", { ascending: true }),
        supabase.from("staff_ticket_departments").select("*").order("sort_order", { ascending: true }),
        supabase.from("staff_ticket_assignees").select("*").order("id", { ascending: true }),
      ]);

      setCategories(catsRes.data || []);
      setIssueOptions(issuesRes.data || []);
      setDepartments(deptsRes.data || []);
      setAssignees(assigneesRes.data || []);
    } catch (e) {
      console.error("Error loading ticket master data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllMasters();
  }, []);

  // Open modal for add
  const handleOpenAdd = () => {
    setEditingItem(null);
    if (activeTab === "categories") {
      setCatForm({ name: "", sla_working_days: 1, sort_order: categories.length + 1 });
    } else if (activeTab === "issues") {
      setIssueForm({
        name: "",
        category_id: selectedCatFilter !== "all" ? selectedCatFilter : categories[0]?.id || "",
        sort_order: issueOptions.length + 1,
      });
    } else if (activeTab === "departments") {
      setDeptForm({ name: "", sort_order: departments.length + 1 });
    } else if (activeTab === "assignees") {
      setAssigneeForm({ person_name: "", mobile: "", role: "assignee", category_id: "" });
    }
    setIsModalOpen(true);
  };

  // Open modal for edit
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    if (activeTab === "categories") {
      setCatForm({
        id: item.id,
        name: item.name,
        sla_working_days: item.sla_working_days || 1,
        sort_order: item.sort_order || 0,
        is_active: item.is_active,
      });
    } else if (activeTab === "issues") {
      setIssueForm({
        id: item.id,
        name: item.name,
        category_id: item.category_id,
        sort_order: item.sort_order || 0,
        is_active: item.is_active,
      });
    } else if (activeTab === "departments") {
      setDeptForm({
        id: item.id,
        name: item.name,
        sort_order: item.sort_order || 0,
        is_active: item.is_active,
      });
    } else if (activeTab === "assignees") {
      setAssigneeForm({
        id: item.id,
        person_name: item.person_name,
        mobile: item.mobile,
        role: item.role || "assignee",
        category_id: item.category_id || "",
        is_active: item.is_active,
      });
    }
    setIsModalOpen(true);
  };

  // Toggle active status (Soft delete / reactivate)
  const handleToggleActive = async (table, id, currentStatus) => {
    try {
      await adminToggleActiveStatus(table, id, currentStatus);
      await loadAllMasters();
    } catch (e) {
      console.error("Error toggling active status:", e);
      alert("Failed to update status.");
    }
  };

  // Submit modal form
  const handleSaveForm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (activeTab === "categories") {
        await adminSaveCategory(catForm);
      } else if (activeTab === "issues") {
        await adminSaveIssueOption(issueForm);
      } else if (activeTab === "departments") {
        await adminSaveDepartment(deptForm);
      } else if (activeTab === "assignees") {
        await adminSaveAssignee(assigneeForm);
      }
      setIsModalOpen(false);
      await loadAllMasters();
    } catch (err) {
      console.error("Error saving master record:", err);
      alert(err.message || "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter lists based on search
  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredIssues = issueOptions.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat =
      selectedCatFilter === "all" || String(i.category_id) === String(selectedCatFilter);
    return matchesSearch && matchesCat;
  });

  const filteredDepartments = departments.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAssignees = assignees.filter((a) =>
    a.person_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.mobile.includes(searchTerm)
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
      {/* Sub Tabs */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex space-x-2">
          {[
            { id: "categories", label: "Categories & SLA", icon: Tag },
            { id: "issues", label: "Category Issue Options", icon: ListFilter },
            { id: "departments", label: "Departments", icon: Building },
            { id: "assignees", label: "Assignees & Routing", icon: UserCheck },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTab(t.id);
                  setSearchTerm("");
                }}
                className={`flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === t.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5 mr-1.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search master data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 sm:w-56"
            />
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add New
          </button>
        </div>
      </div>

      {/* ── Tab 1: Categories ──────────────────────────────────── */}
      {activeTab === "categories" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Sort</th>
                <th className="py-2.5 px-4">Category Name</th>
                <th className="py-2.5 px-4">SLA (Working Days)</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono text-slate-500">{c.sort_order}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{c.name}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {c.sla_working_days} working day(s) (Sunday off)
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() =>
                          handleToggleActive("staff_ticket_categories", c.id, c.is_active)
                        }
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.is_active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {c.is_active ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No categories found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab 2: Issue Options ───────────────────────────────── */}
      {activeTab === "issues" && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-semibold text-slate-700">Filter by Category:</span>
            <select
              value={selectedCatFilter}
              onChange={(e) => setSelectedCatFilter(e.target.value)}
              className="p-1.5 text-xs rounded border border-slate-300 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Sort</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Issue Name</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIssues.length > 0 ? (
                  filteredIssues.map((i) => {
                    const cat = categories.find((c) => c.id === i.category_id);
                    return (
                      <tr key={i.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono text-slate-500">{i.sort_order}</td>
                        <td className="py-3 px-4 text-blue-700 font-semibold">{cat?.name || "-"}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{i.name}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() =>
                              handleToggleActive("staff_ticket_issue_options", i.id, i.is_active)
                            }
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              i.is_active
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {i.is_active ? "Active" : "Disabled"}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenEdit(i)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No issues found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: Departments ─────────────────────────────────── */}
      {activeTab === "departments" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Sort</th>
                <th className="py-2.5 px-4">Department Name</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDepartments.length > 0 ? (
                filteredDepartments.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono text-slate-500">{d.sort_order}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{d.name}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() =>
                          handleToggleActive("staff_ticket_departments", d.id, d.is_active)
                        }
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.is_active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {d.is_active ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(d)}
                        className="text-blue-600 hover:text-blue-800 p-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No departments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab 4: Assignees ───────────────────────────────────── */}
      {activeTab === "assignees" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Person Name</th>
                <th className="py-2.5 px-4">Mobile Number</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Category Assigned</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssignees.length > 0 ? (
                filteredAssignees.map((a) => {
                  const cat = categories.find((c) => c.id === a.category_id);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-bold text-slate-800">{a.person_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        <a href={`tel:${a.mobile}`} className="text-blue-600 hover:underline">
                          {a.mobile}
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            a.role === "pc"
                              ? "bg-purple-100 text-purple-800"
                              : a.role === "admin"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {a.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {cat ? cat.name : "All Categories (Global PC)"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() =>
                            handleToggleActive("staff_ticket_assignees", a.id, a.is_active)
                          }
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            a.is_active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {a.is_active ? "Active" : "Disabled"}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenEdit(a)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No assignees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal for Add / Edit ───────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingItem ? "Edit Master Record" : "Add New Master Record"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5 text-xs">
              {/* Category Form */}
              {activeTab === "categories" && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Category Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={catForm.name}
                      onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                      className="w-full p-2.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      SLA Working Days (Sunday is off)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={catForm.sla_working_days}
                      onChange={(e) => setCatForm({ ...catForm, sla_working_days: e.target.value })}
                      className="w-full p-2.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={catForm.sort_order}
                      onChange={(e) => setCatForm({ ...catForm, sort_order: e.target.value })}
                      className="w-full p-2.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {/* Issue Option Form */}
              {activeTab === "issues" && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Parent Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={issueForm.category_id}
                      onChange={(e) => setIssueForm({ ...issueForm, category_id: e.target.value })}
                      className="w-full p-2.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Issue Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={issueForm.name}
                      onChange={(e) => setIssueForm({ ...issueForm, name: e.target.value })}
                      className="w-full p-2.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={issueForm.sort_order}
                      onChange={(e) => setIssueForm({ ...issueForm, sort_order: e.target.value })}
                      className="w-full p-2.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {/* Department Form */}
              {activeTab === "departments" && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Department Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={deptForm.name}
                      onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                      className="w-full p-2.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={deptForm.sort_order}
                      onChange={(e) => setDeptForm({ ...deptForm, sort_order: e.target.value })}
                      className="w-full p-2.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {/* Assignee Form */}
              {activeTab === "assignees" && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Person Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={assigneeForm.person_name}
                      onChange={(e) =>
                        setAssigneeForm({ ...assigneeForm, person_name: e.target.value })
                      }
                      className="w-full p-2.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Mobile Number (10 digits) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      required
                      value={assigneeForm.mobile}
                      onChange={(e) =>
                        setAssigneeForm({
                          ...assigneeForm,
                          mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                        })
                      }
                      className="w-full p-2.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Role</label>
                    <select
                      value={assigneeForm.role}
                      onChange={(e) => setAssigneeForm({ ...assigneeForm, role: e.target.value })}
                      className="w-full p-2.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="assignee">Assignee (Department Level)</option>
                      <option value="pc">Process Coordinator (PC)</option>
                      <option value="admin">Escalation / Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Assigned Category
                    </label>
                    <select
                      value={assigneeForm.category_id}
                      onChange={(e) =>
                        setAssigneeForm({ ...assigneeForm, category_id: e.target.value })
                      }
                      className="w-full p-2.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">All Categories (Global PC / Admin)</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold shadow"
                >
                  {submitting ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketMasterSettings;
