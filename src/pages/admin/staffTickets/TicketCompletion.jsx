import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  Printer,
  Search,
  Calendar,
  Clock,
  TrendingUp,
  Tag,
  Building,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Lock,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  fetchTicketsOverview,
  fetchCompletedAnalytics,
  fetchActiveCategories,
  fetchActiveDepartments,
  formatISTDateTime,
  formatDelayText,
} from "../../../api/staffTickets";
import TicketSlipModal from "../../../components/staffTickets/TicketSlipModal";
import TicketDetailDrawer from "../../../components/staffTickets/TicketDetailDrawer";

/**
 * TicketCompletion Page
 * Register of resolved tickets and generator for Grievance Redressal Slips.
 * Includes Turnaround Time (TAT) metrics and On-time % statistics.
 */
const TicketCompletion = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Analytics stats
  const [stats, setStats] = useState({
    totalCompleted: 0,
    onTimePercent: 100,
    avgTatHours: 0,
    categoryBreakdown: {},
  });

  // Filter states
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination & data
  const [tickets, setTickets] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [loading, setLoading] = useState(true);

  // Selected ticket for Slip & Drawer
  const [activeSlipTicket, setActiveSlipTicket] = useState(null);
  const [isSlipOpen, setIsSlipOpen] = useState(false);
  const [drawerTicketId, setDrawerTicketId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Load categories and departments
  useEffect(() => {
    const loadMasterFilters = async () => {
      try {
        const [cats, depts] = await Promise.all([
          fetchActiveCategories(),
          fetchActiveDepartments(),
        ]);
        setCategories(cats || []);
        setDepartments(depts || []);
      } catch (e) {
        console.error("Error loading filters:", e);
      }
    };
    loadMasterFilters();
  }, []);

  // Fetch analytics stats
  const loadStats = useCallback(async () => {
    try {
      const data = await fetchCompletedAnalytics(isAdmin);
      setStats(data);
    } catch (e) {
      console.warn("Error loading analytics:", e);
    }
  }, [isAdmin]);

  // Fetch completed tickets list
  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTicketsOverview({
        status: "completed",
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
    } catch (e) {
      console.error("Error loading completed tickets:", e);
    } finally {
      setLoading(false);
    }
  }, [
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
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleOpenSlip = (ticket) => {
    setActiveSlipTicket(ticket);
    setIsSlipOpen(true);
  };

  const handleOpenDrawer = (ticketId) => {
    setDrawerTicketId(ticketId);
    setIsDrawerOpen(true);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Calculate TAT string e.g. "1d 4h"
  const calculateTatText = (createdAt, completedAt) => {
    if (!createdAt || !completedAt) return "-";
    const diffMs = new Date(completedAt) - new Date(createdAt);
    const totalHours = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    let res = "";
    if (days > 0) res += `${days}d `;
    res += `${hours}h`;
    return res;
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
            <CheckCircle2 className="w-6 h-6 mr-2 text-emerald-600" />
            Completed Help Tickets & Grievance Slips
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Resolved complaints register, Turnaround Time (TAT) stats & print-ready A4 Redressal Slips
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              loadStats();
              loadTickets();
            }}
            className="flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Top Statistics Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Completed */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Total Solved Tickets
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.totalCompleted}</div>
        </div>

        {/* On-Time Resolution % */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            SLA On-Time Rate
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {stats.onTimePercent}%
          </div>
        </div>

        {/* Average TAT */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Average TAT (Time Taken)
          </span>
          <div className="text-2xl font-black text-blue-700 mt-1">
            {Math.floor(stats.avgTatHours / 24) > 0 ? `${Math.floor(stats.avgTatHours / 24)}d ` : ""}
            {stats.avgTatHours % 24}h
          </div>
        </div>

        {/* Category Breakdown Snippet */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Category Breakdown
          </span>
          <div className="space-y-1 overflow-y-auto max-h-12 text-[11px]">
            {Object.entries(stats.categoryBreakdown).slice(0, 3).map(([cat, val]) => (
              <div key={cat} className="flex justify-between items-center text-slate-700">
                <span className="truncate max-w-[120px] font-medium">{cat}:</span>
                <span className="font-bold">
                  {val.count} ({Math.round((val.onTime / val.count) * 100)}% on-time)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filters Bar ─────────────────────────────────────────── */}
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

          {/* Date range */}
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

        {(selectedCategory || selectedDepartment || searchTerm || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSelectedCategory("");
              setSelectedDepartment("");
              setSearchTerm("");
              setDateFrom("");
              setDateTo("");
              setPage(0);
            }}
            className="text-blue-600 hover:text-blue-800 font-semibold text-xs"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* ── Completed Tickets Table ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Ticket No</th>
                <th className="py-3 px-4">Complainant / Dept</th>
                <th className="py-3 px-4">Category & Issue</th>
                <th className="py-3 px-4">Raised On</th>
                <th className="py-3 px-4">Completed On</th>
                <th className="py-3 px-4">TAT</th>
                <th className="py-3 px-4">SLA Performance</th>
                <th className="py-3 px-4 text-right">Redressal Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading completed tickets...</span>
                  </td>
                </tr>
              ) : tickets.length > 0 ? (
                tickets.map((t) => {
                  const isLate =
                    t.is_overdue ||
                    (t.completed_at && t.planned_at && new Date(t.completed_at) > new Date(t.planned_at));

                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      {/* Ticket No */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleOpenDrawer(t.id)}
                            className="text-blue-600 hover:underline"
                            title="Click to view details"
                          >
                            {t.ticket_no}
                          </button>
                          {t.is_confidential && (
                            <Lock className="w-3.5 h-3.5 text-amber-600" title="Confidential" />
                          )}
                        </div>
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

                      {/* Raised On */}
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {formatISTDateTime(t.created_at)}
                      </td>

                      {/* Completed On */}
                      <td className="py-3 px-4 text-slate-800 font-semibold whitespace-nowrap">
                        {formatISTDateTime(t.completed_at)}
                      </td>

                      {/* TAT */}
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap font-medium">
                        {calculateTatText(t.created_at, t.completed_at)}
                      </td>

                      {/* SLA Performance Result */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isLate ? (
                          <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-red-100 text-red-800 border border-red-200">
                            {formatDelayText(t.delay_hours, true, true)}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✓ On Time
                          </span>
                        )}
                      </td>

                      {/* Redressal Slip Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenSlip(t)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg text-xs shadow-sm transition-colors flex items-center ml-auto"
                        >
                          <Printer className="w-3.5 h-3.5 mr-1.5" />
                          View / Print Slip
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No completed tickets found
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

      {/* ── Grievance Redressal Slip Modal ─────────────────────── */}
      {isSlipOpen && activeSlipTicket && (
        <TicketSlipModal
          key={activeSlipTicket.id}
          ticket={activeSlipTicket}
          isOpen={isSlipOpen}
          onClose={() => {
            setIsSlipOpen(false);
            setActiveSlipTicket(null);
          }}
        />
      )}

      {/* ── Ticket Detail Drawer ─────────────────────────────────── */}
      {isDrawerOpen && drawerTicketId && (
        <TicketDetailDrawer
          ticketId={drawerTicketId}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setDrawerTicketId(null);
          }}
          currentUser={user}
          isAdmin={isAdmin}
          onTicketUpdated={() => {
            loadStats();
            loadTickets();
          }}
        />
      )}
    </div>
  );
};

export default TicketCompletion;
