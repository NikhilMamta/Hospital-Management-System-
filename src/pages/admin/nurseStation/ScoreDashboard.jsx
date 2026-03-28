import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Award,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  BarChart3,
  Eye,
  RefreshCw,
  CalendarRange,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import supabase from "../../../SupabaseClient";
import CompleteDetail from "./CompleteDetail";
import useRealtimeTable from "../../../hooks/useRealtimeTable";

const FILTER_OPTIONS = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "custom", label: "Custom Range" },
];

const createEmptySummary = () => ({
  totalTasks: 0,
  totalCompleted: 0,
  pendingTasks: 0,
  uniqueNurses: 0,
  avgScore: 0,
  topPerformer: "N/A",
});

const getTodayDateString = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split("T")[0];
};

const parseDateOnly = (value) => {
  if (!value || typeof value !== "string") return null;

  const datePart = value.split("T")[0].split(" ")[0];
  const parts = datePart.split("-");

  if (parts.length !== 3) return null;

  const [year, month, day] = parts.map(Number);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const getRelativeStartDate = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
};

const getRangeLabel = (filterType, startDate, endDate) => {
  if (filterType === "weekly") return "Last 7 days";
  if (filterType === "monthly") return "Last 30 days";
  if (filterType === "custom" && startDate && endDate) {
    return `${startDate} to ${endDate}`;
  }
  return "Select dates";
};

const ScoreDashboard = () => {
  const [nurseStats, setNurseStats] = useState([]);
  const [summary, setSummary] = useState(createEmptySummary);
  const [loading, setLoading] = useState(true);
  const [selectedNurse, setSelectedNurse] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [filterType, setFilterType] = useState("weekly");
  const [customStartDate, setCustomStartDate] = useState(getTodayDateString());
  const [customEndDate, setCustomEndDate] = useState(getTodayDateString());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("score");
  const [sortOrder, setSortOrder] = useState("desc");
  const [density, setDensity] = useState("comfortable");


  const customRangeIncomplete =
    filterType === "custom" && (!customStartDate || !customEndDate);
  const invalidCustomRange =
    filterType === "custom" &&
    customStartDate &&
    customEndDate &&
    customStartDate > customEndDate;

  // Filter and sort data
  const filteredAndSortedData = React.useMemo(() => {
    // First filter by search
    let filtered = nurseStats.filter((n) =>
      n.name.toLowerCase().includes(search.toLowerCase()),
    );

    // Then sort
    return filtered.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (sortKey === "name") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (
        sortKey === "score" ||
        sortKey === "total" ||
        sortKey === "completed" ||
        sortKey === "pending"
      ) {
        return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
      }

      return 0;
    });
  }, [nurseStats, search, sortKey, sortOrder]);


  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setIsRefreshing(true);

      if (customRangeIncomplete || invalidCustomRange) {
        setSummary(createEmptySummary());
        setNurseStats([]);
        setLastUpdated(new Date().toLocaleTimeString());
        return;
      }

      let startBoundary = null;
      let endBoundary = null;

      if (filterType === "weekly") {
        startBoundary = getRelativeStartDate(7);
        endBoundary = new Date();
      } else if (filterType === "monthly") {
        startBoundary = getRelativeStartDate(30);
        endBoundary = new Date();
      } else {
        startBoundary = parseDateOnly(customStartDate);
        endBoundary = parseDateOnly(customEndDate);
      }

      if (!startBoundary || !endBoundary) {
        setSummary(createEmptySummary());
        setNurseStats([]);
        setLastUpdated(new Date().toLocaleTimeString());
        return;
      }

      const startDateValue = startBoundary.toISOString().split("T")[0];
      const endDateValue = endBoundary.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("nurse_assign_task")
        .select("assign_nurse, shift, planned1, actual1, start_date")
        .gte("start_date", startDateValue)
        .lte("start_date", endDateValue);

      if (error) throw error;

      endBoundary.setHours(23, 59, 59, 999);

      const filteredTasks = (data || []).filter((task) => {
        if (!task.assign_nurse || task.assign_nurse.trim() === "") return false;

        const taskDate = parseDateOnly(task.start_date);
        if (!taskDate) return false;

        return taskDate >= startBoundary && taskDate <= endBoundary;
      });

      const totalTasks = filteredTasks.length;
      const completedTasks = filteredTasks.filter(
        (task) => task.planned1 && task.actual1,
      ).length;
      const pendingTasks = filteredTasks.filter(
        (task) => task.planned1 && !task.actual1,
      ).length;

      const nurseStatsMap = new Map();
      const uniqueNurses = new Set();

      filteredTasks.forEach((task) => {
        const nurseName = task.assign_nurse.trim();
        uniqueNurses.add(nurseName);

        if (!nurseStatsMap.has(nurseName)) {
          nurseStatsMap.set(nurseName, {
            name: nurseName,
            total: 0,
            completed: 0,
            pending: 0,
            shifts: new Set(),
          });
        }

        const stats = nurseStatsMap.get(nurseName);
        stats.total += 1;

        if (task.planned1 && task.actual1) {
          stats.completed += 1;
        } else if (task.planned1 && !task.actual1) {
          stats.pending += 1;
        }

        if (task.shift) {
          stats.shifts.add(task.shift);
        }
      });

      const formattedNurseStats = Array.from(nurseStatsMap.values())
        .map((stat) => {
          const shiftsArray = Array.from(stat.shifts);
          const score =
            stat.total > 0
              ? Math.round((stat.completed / stat.total) * 100)
              : 0;

          return {
            ...stat,
            shifts:
              shiftsArray.length > 0
                ? shiftsArray.slice(0, 2).join(", ") +
                  (shiftsArray.length > 2 ? "..." : "")
                : "N/A",
            score,
          };
        })
        .sort((a, b) => b.score - a.score || b.completed - a.completed);

      const topPerformer =
        formattedNurseStats.length > 0 ? formattedNurseStats[0].name : "N/A";
      const avgScore =
        formattedNurseStats.length > 0
          ? Math.round(
              formattedNurseStats.reduce((sum, stat) => sum + stat.score, 0) /
                formattedNurseStats.length,
            )
          : 0;

      setNurseStats(formattedNurseStats);
      setSummary({
        totalTasks,
        totalCompleted: completedTasks,
        pendingTasks,
        uniqueNurses: uniqueNurses.size,
        avgScore,
        topPerformer,
      });
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Error fetching dashboard data", error);
      setSummary(createEmptySummary());
      setNurseStats([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [
    customEndDate,
    customRangeIncomplete,
    customStartDate,
    filterType,
    invalidCustomRange,
  ]);

  const handleViewNurseTasks = (nurseName) => {
    setSelectedNurse(nurseName);
  };

  const handleCloseCompleteDetail = () => {
    setSelectedNurse(null);
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const getSortIcon = (key) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 ml-1" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1" />
    );
  };

  useRealtimeTable("nurse_assign_task", fetchDashboardData);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600 bg-green-50";
    if (score >= 50) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getProgressBarColor = (score) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const handleManualRefresh = () => {
    if (!isRefreshing) {
      fetchDashboardData();
    }
  };

  const summaryCards = [
    {
      label: "Total Tasks",
      value: summary.totalTasks,
      icon: BarChart3,
      iconClass: "bg-blue-100 text-blue-600",
    },
    {
      label: "Pending",
      value: summary.pendingTasks,
      icon: AlertCircle,
      iconClass: "bg-orange-100 text-orange-600",
    },
    {
      label: "Completed",
      value: summary.totalCompleted,
      icon: CheckCircle,
      iconClass: "bg-green-100 text-green-600",
    },
    {
      label: "Active Staff",
      value: summary.uniqueNurses,
      icon: Users,
      iconClass: "bg-purple-100 text-purple-600",
    },
    {
      label: "Avg Perf.",
      value: `${summary.avgScore}%`,
      icon: TrendingUp,
      iconClass: "bg-sky-100 text-sky-600",
      accentClass: getScoreColor(summary.avgScore).split(" ")[0],
      progress: summary.avgScore,
    },
    {
      label: "Top Staff",
      value: summary.topPerformer,
      icon: Award,
      iconClass: "bg-amber-100 text-amber-600",
      progress: nurseStats[0]?.score || 0,
    },
  ];

  const showEmptyState = filteredAndSortedData.length === 0;
  const rangeLabel = getRangeLabel(filterType, customStartDate, customEndDate);

  if (loading && !isRefreshing) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto border-b-2 border-blue-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {selectedNurse && (
        <CompleteDetail
          nurseName={selectedNurse}
          onClose={handleCloseCompleteDetail}
        />
      )}

      <div className="flex flex-col w-full h-full min-h-0 gap-4 p-4 mx-auto max-w-7xl md:p-6">
        {/* Header Section */}
        <div className="flex flex-col gap-2 shrink-0 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-gray-900 md:text-2xl">
              <Award className="w-6 h-6 text-green-600 md:w-7 md:h-7 shrink-0" />
              <span className="truncate">Staff Performance</span>
            </h1>
            <p className="hidden mt-0.5 text-xs text-gray-500 sm:block">
              Real-time nurse performance metrics based on task completion
            </p>
          </div>

          <div className="flex flex-row items-center gap-2 mt-1 sm:mt-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 shadow-sm rounded-lg md:text-xs">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="truncate">Updated: {lastUpdated || "--"}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 border border-blue-100 rounded-lg bg-blue-50 md:text-xs">
              <CalendarRange className="w-3.5 h-3.5" />
              <span className="truncate">{rangeLabel}</span>
            </div>
          </div>
        </div>

        {/* Summary Cards - Horizontal scroll on mobile, Grid on md+ */}
        <div className="flex gap-3 overflow-x-auto pb-1.5 scrollbar-hide snap-x md:grid md:grid-cols-3 xl:grid-cols-6 md:pb-0 shrink-0">
          {summaryCards.map((card, idx) => {
            const Icon = card.icon;

            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="min-w-[160px] flex-1 snap-center p-3 transition-all bg-white border border-gray-200 shadow-sm rounded-xl md:p-4 hover:shadow-md md:min-w-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                      {card.label}
                    </p>
                    <h3
                      className={`mt-1 text-base font-black text-gray-900 md:text-xl truncate ${
                        card.accentClass || ""
                      }`}
                    >
                      {card.value}
                    </h3>
                  </div>
                  <div className={`p-2 rounded-lg shrink-0 ${card.iconClass}`}>
                    <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </div>
                </div>

                {typeof card.progress === "number" && (
                  <div className="mt-2.5">
                    <div className="h-1.5 overflow-hidden bg-gray-100 rounded-full">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressBarColor(card.progress)}`}
                        style={{ width: `${card.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Sticky Control Bar */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 rounded-t-xl sm:rounded-t-2xl">
          <div className="p-3 sm:p-4 md:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-sm font-black text-gray-800 sm:text-base md:text-lg">
                    Staff Rankings
                  </h2>
                  <p className="hidden mt-0.5 text-xs text-gray-500 sm:block">
                    Performance based on scheduled task frequency
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  {/* Density Toggle - Hidden on Mobile */}
                  <div className="hidden items-center gap-1 p-1 bg-gray-100 rounded-lg sm:flex">
                    {["compact", "comfortable"].map((d) => (
                      <button
                        key={d}
                        onClick={() => setDensity(d)}
                        className={`px-3 py-1 rounded-md text-[10px] md:text-xs font-bold transition-all capitalize ${
                          density === d
                            ? "bg-white text-gray-900 shadow-sm"
                            : "bg-transparent text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 text-[11px] md:text-xs font-black text-white transition-all bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                    />
                    <span>{isRefreshing ? "Syncing..." : "Sync"}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setFilterType(option.key)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        filterType === option.key
                          ? "bg-gray-900 text-white border-gray-900 shadow-md"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 lg:max-w-xs">
                  <Search className="absolute w-3.5 h-3.5 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
                  <input
                    placeholder="Quick search staff..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full py-2 pr-3 text-xs font-medium border border-gray-200 pl-9 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Custom Range Inputs */}
              {filterType === "custom" && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="relative">
                    <span className="absolute -top-2 left-2 px-1 text-[10px] font-black text-gray-400 bg-white uppercase tracking-tighter z-10">Start Date</span>
                    <input
                      type="date"
                      value={customStartDate}
                      max={customEndDate || undefined}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50/30 hover:bg-white"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute -top-2 left-2 px-1 text-[10px] font-black text-gray-400 bg-white uppercase tracking-tighter z-10">End Date</span>
                    <input
                      type="date"
                      value={customEndDate}
                      min={customStartDate || undefined}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold border border-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-gray-50/30 hover:bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Custom Range Notification - Compact */}
              {filterType === "custom" && (customRangeIncomplete || invalidCustomRange) && (
                <div className={`px-3 py-2 text-[11px] font-bold border rounded-lg ${
                  invalidCustomRange ? "bg-red-50 text-red-700 border-red-100" : "bg-amber-50 text-amber-700 border-amber-100"
                }`}>
                  {invalidCustomRange ? "Start date cannot be after end date." : "Please select both dates to view custom range stats."}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Content: Table (LG+) vs Cards (Mobile/Tablet) */}
        <div
          className="flex-1 overflow-auto bg-white border border-gray-200 rounded-b-xl sm:rounded-b-2xl hidden lg:block"
        >
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 font-semibold text-gray-600 border-b border-gray-200 bg-gray-50">
              <tr>
                <th
                  className={`${density === "compact" ? "px-3 py-3" : "px-6 py-4"} w-16 cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap`}
                  onClick={() => handleSort("rank")}
                >
                  <div className="flex items-center">
                    Rank {getSortIcon("rank")}
                  </div>
                </th>
                <th
                  className={`${density === "compact" ? "px-3 py-3" : "px-6 py-4"} cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap`}
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">
                    Nurse Name {getSortIcon("name")}
                  </div>
                </th>
                <th
                  className={`${density === "compact" ? "px-3 py-3" : "px-6 py-4"} whitespace-nowrap`}
                >
                  Assigned Shift
                </th>
                <th
                  className={`${density === "compact" ? "px-3 py-3" : "px-6 py-4"} text-center cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap`}
                  onClick={() => handleSort("total")}
                >
                  <div className="flex items-center justify-center">
                    Total {getSortIcon("total")}
                  </div>
                </th>
                <th
                  className={`${density === "compact" ? "px-3 py-3" : "px-6 py-4"} text-center cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap`}
                  onClick={() => handleSort("completed")}
                >
                  <div className="flex items-center justify-center">
                    Done {getSortIcon("completed")}
                  </div>
                </th>
                <th
                  className={`${density === "compact" ? "px-3 py-3" : "px-6 py-4"} text-center cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap`}
                  onClick={() => handleSort("pending")}
                >
                  <div className="flex items-center justify-center">
                    Pending {getSortIcon("pending")}
                  </div>
                </th>
                <th
                  className={`${density === "compact" ? "px-3 py-3" : "px-6 py-4"} w-1/4 cursor-pointer hover:bg-gray-100 transition-colors whitespace-nowrap`}
                  onClick={() => handleSort("score")}
                >
                  <div className="flex items-center">
                    Score {getSortIcon("score")}
                  </div>
                </th>
                <th
                  className={`${density === "compact" ? "px-3 py-3" : "px-6 py-4"} text-center whitespace-nowrap`}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <AnimatePresence>
                {showEmptyState ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      {invalidCustomRange
                        ? "Fix the custom date range to view nurse performance."
                        : customRangeIncomplete
                          ? "Select both custom dates to load nurse performance."
                          : search
                            ? "No nurses match your search criteria."
                            : "No nurse data available for the selected period."}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedData.map((stat) => {
                    const globalIndex = nurseStats.findIndex(
                      (s) => s.name === stat.name,
                    );

                    return (
                      <motion.tr
                        key={stat.name}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="transition-colors group hover:bg-gray-50"
                      >
                        <td
                          className={`${density === "compact" ? "px-3 py-2" : "px-6 py-4"} font-bold text-gray-400`}
                        >
                          #{globalIndex + 1}
                        </td>
                        <td
                          className={`${density === "compact" ? "px-3 py-2" : "px-6 py-4"}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-gray-900">
                              {stat.name}
                            </span>
                            {globalIndex === 0 && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold text-yellow-700 bg-yellow-100 rounded">
                                TOP
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className={`${density === "compact" ? "px-3 py-2" : "px-6 py-4"} text-gray-600`}
                        >
                          {stat.shifts}
                        </td>
                        <td
                          className={`${density === "compact" ? "px-3 py-2" : "px-6 py-4"} text-center`}
                        >
                          {stat.total}
                        </td>
                        <td
                          className={`${density === "compact" ? "px-3 py-2" : "px-6 py-4"} text-center text-green-600`}
                        >
                          {stat.completed}
                        </td>
                        <td
                          className={`${density === "compact" ? "px-3 py-2" : "px-6 py-4"} text-center text-orange-500`}
                        >
                          {stat.pending}
                        </td>
                        <td
                          className={`${density === "compact" ? "px-3 py-2" : "px-6 py-4"}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 overflow-hidden bg-gray-100 rounded-full">
                              <div
                                className={`h-full rounded-full ${getProgressBarColor(stat.score)}`}
                                style={{ width: `${stat.score}%` }}
                              />
                            </div>
                            <span
                               className={`text-xs font-bold ${getScoreColor(stat.score).split(" ")[0]}`}
                            >
                              {stat.score}%
                            </span>
                          </div>
                        </td>
                        <td
                          className={`${density === "compact" ? "px-3 py-2" : "px-6 py-4"} text-center`}
                        >
                          <button
                            onClick={() => handleViewNurseTasks(stat.name)}
                            className="text-sm font-medium text-blue-600 transition-opacity opacity-0 group-hover:opacity-100 hover:text-blue-800"
                          >
                            View
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Card View for Mobile/Tablet (below LG) */}
        <div className="flex-1 overflow-y-auto lg:hidden bg-gray-50/50">
          <div className="p-3 sm:p-4">
            {showEmptyState ? (
              <div className="p-10 text-sm font-medium text-center text-gray-400 bg-white border border-gray-100 rounded-2xl shadow-sm">
                {search ? "No matches found for your search." : "No performance data found for this period."}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {filteredAndSortedData.map((stat) => {
                  const globalIndex = nurseStats.findIndex(
                    (s) => s.name === stat.name,
                  );
                  return (
                    <motion.div
                      key={stat.name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col gap-3 p-4 bg-white border border-gray-100 shadow-sm rounded-2xl"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className={`flex items-center justify-center w-7 h-7 text-xs font-black rounded-full shrink-0 ${
                            globalIndex === 0 ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-gray-100 text-gray-500"
                          }`}>
                            {globalIndex + 1}
                          </div>
                          <h4 className="flex items-center gap-1.5 font-black text-gray-900 truncate">
                            {stat.name}
                            {globalIndex === 0 && <Award className="w-4 h-4 text-amber-500 shrink-0" />}
                          </h4>
                        </div>
                        <div
                          className={`px-2.5 py-1 rounded-lg text-xs font-black border tracking-tight shrink-0 ${getScoreColor(stat.score)}`}
                        >
                          {stat.score}%
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-3 px-1 border-t border-b border-gray-50">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
                          <p className="text-base font-black text-gray-800">{stat.total}</p>
                        </div>
                        <div className="text-center border-x border-gray-100">
                          <p className="text-[10px] font-bold text-green-500/80 uppercase tracking-widest">Done</p>
                          <p className="text-base font-black text-green-600">{stat.completed}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Wait</p>
                          <p className="text-base font-black text-orange-600">{stat.pending}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="p-1 bgColor-blue-50 rounded-md">
                            <Clock className="w-3 h-3 text-blue-500" />
                          </div>
                          <span className="text-[11px] font-bold text-gray-500 truncate italic">
                            {stat.shifts}
                          </span>
                        </div>
                        <button
                          onClick={() => handleViewNurseTasks(stat.name)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black text-blue-600 bg-blue-50/50 rounded-lg hover:bg-blue-100 transition-all shrink-0"
                        >
                          Details <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreDashboard;
