import React, { useState, useEffect, useCallback } from "react";
import {
  LifeBuoy,
  Search,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Phone,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Shield,
  Tag,
  Building,
  Calendar,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  fetchTicketsOverview,
  fetchActiveCategories,
  fetchActiveDepartments,
  formatISTDateTime,
  formatDelayText,
} from "../../../api/staffTickets";
import TicketDetailDrawer from "../../../components/staffTickets/TicketDetailDrawer";

/**
 * TicketFollowUp Page
 * Follow-up workbench for Process Coordinators (PC), Admin, and Department Heads.
 * Track and update Pending, Overdue, Analysis, and Working tickets.
 */
const TicketFollowUp = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Filter states
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination & data
  const [tickets, setTickets] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);

  // Drawer state
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Load categories and departments on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [cats, depts] = await Promise.all([
          fetchActiveCategories(),
          fetchActiveDepartments(),
        ]);
        setCategories(cats || []);
        setDepartments(depts || []);
      } catch (e) {
        console.error("Error loading filter lists:", e);
      }
    };
    loadFilters();
  }, []);

  // Fetch tickets list
  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTicketsOverview({
        tab: selectedStatus ? null : "all",
        status: selectedStatus || null,
        categoryId: selectedCategory || null,
        departmentId: selectedDepartment || null,
        search: searchTerm,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        page,
        pageSize,
        isAdmin,
      });

      setTickets(res.tickets || []);
      setTotalCount(res.totalCount || 0);
    } catch (err) {
      console.error("Error loading tickets:", err);
    } finally {
      setLoading(false);
    }
  }, [
    selectedStatus,
    selectedCategory,
    selectedDepartment,
    searchTerm,
    dateFrom,
    dateTo,
    page,
    pageSize,
    isAdmin,
  ]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleOpenDrawer = (ticketId) => {
    setSelectedTicketId(ticketId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedTicketId(null);
  };

  const handleTicketUpdated = () => {
    loadTickets();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "open")
      return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-300">Open</span>;
    if (s === "analysis")
      return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">Analysis</span>;
    if (s === "working")
      return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-300">Working</span>;
    if (s === "completed")
      return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">Completed</span>;
    return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-slate-100 text-slate-700">{status}</span>;
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page Title Bar ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
            <LifeBuoy className="w-6 h-6 mr-2 text-blue-600" />
            Staff Help Ticket Follow-Up
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Process Coordinator & Responsible Persons follow-up register
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              loadTickets();
            }}
            className="flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Ticket Workbench ───────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Filters Bar */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Ticket No / Name / Mobile..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(0);
              }}
              className="py-1.5 px-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 bg-white"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Department Filter */}
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setPage(0);
              }}
              className="py-1.5 px-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 bg-white"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(0);
              }}
              className="py-1.5 px-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 bg-white"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="analysis">In Analysis</option>
              <option value="working">Working</option>
              <option value="completed">Completed</option>
            </select>

            {/* Date Filters */}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(0);
              }}
              className="py-1.5 px-2 rounded-lg border border-slate-300 text-slate-700 text-xs"
              title="Raised From"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
              className="py-1.5 px-2 rounded-lg border border-slate-300 text-slate-700 text-xs"
              title="Raised To"
            />
          </div>

          {(selectedCategory || selectedDepartment || selectedStatus || searchTerm || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setSelectedCategory("");
                setSelectedDepartment("");
                setSelectedStatus("");
                setSearchTerm("");
                setDateFrom("");
                setDateTo("");
                setPage(0);
              }}
              className="text-blue-600 hover:text-blue-800 font-semibold text-xs cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>

          {/* Tickets Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-center whitespace-nowrap">Action</th>
                    <th className="py-3 px-4">Ticket No</th>
                    <th className="py-3 px-4">Raised On</th>
                    <th className="py-3 px-4">Complainant / Dept</th>
                    <th className="py-3 px-4">Category & Issue</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Planned SLA</th>
                    <th className="py-3 px-4">Delay</th>
                    <th className="py-3 px-4">Last Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                        <span>Loading tickets...</span>
                      </td>
                    </tr>
                  ) : tickets.length > 0 ? (
                    tickets.map((t) => {
                      const isOverdue = t.is_overdue;
                      return (
                        <tr
                          key={t.id}
                          className={`transition-colors hover:bg-slate-50 ${
                            isOverdue ? "bg-red-50/40" : ""
                          }`}
                        >
                          {/* Action Button */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleOpenDrawer(t.id)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-lg text-xs shadow-xs transition-all cursor-pointer"
                            >
                              View / Update
                            </button>
                          </td>

                          {/* Ticket No */}
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-blue-700 font-extrabold">{t.ticket_no}</span>
                              {t.is_confidential && (
                                <Lock className="w-3.5 h-3.5 text-amber-600" title="Confidential" />
                              )}
                            </div>
                          </td>

                          {/* Raised On */}
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {formatISTDateTime(t.created_at)}
                          </td>

                          {/* Complainant & Dept */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{t.staff_name}</div>
                            <div className="text-[11px] text-slate-500">
                              {t.department} • <span className="italic">{t.designation || "Staff"}</span>
                            </div>
                          </td>

                          {/* Category & Issue */}
                          <td className="py-3 px-4">
                            <div className="font-medium text-blue-800">{t.category_name}</div>
                            <div className="text-[11px] text-slate-600 truncate max-w-[200px]">
                              {t.issue_name}
                              {t.issue_other_text ? ` (${t.issue_other_text})` : ""}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {getStatusBadge(t.status)}
                          </td>

                          {/* Planned SLA */}
                          <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                            {formatISTDateTime(t.planned_at)}
                          </td>

                          {/* Delay */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`font-bold ${
                                isOverdue ? "text-red-600" : "text-slate-600"
                              }`}
                            >
                              {formatDelayText(t.delay_hours, t.is_overdue, t.status === "completed")}
                            </span>
                          </td>

                          {/* Last Update */}
                          <td className="py-3 px-4 text-slate-600">
                            {t.last_update_text ? (
                              <div className="truncate max-w-[180px]" title={t.last_update_text}>
                                {t.last_update_text}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No update yet</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No tickets found matching this filter
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Showing {page * pageSize + 1} -{" "}
                  {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} tickets
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-bold">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* ── Detail Drawer ────────────────────────────────────────── */}
      {isDrawerOpen && selectedTicketId && (
        <TicketDetailDrawer
          ticketId={selectedTicketId}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          currentUser={user}
          isAdmin={isAdmin}
          onTicketUpdated={handleTicketUpdated}
        />
      )}
    </div>
  );
};

export default TicketFollowUp;
