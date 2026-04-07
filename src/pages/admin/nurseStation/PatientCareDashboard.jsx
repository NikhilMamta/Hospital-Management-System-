import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  Search,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  Clock,
  CheckCircle,
  Bed,
  ClipboardList,
  Timer,
  Filter,
  RefreshCw,
} from "lucide-react";
import supabase from "../../../SupabaseClient";
import useRealtimeTable from "../../../hooks/useRealtimeTable";
import { useNotification } from "../../../contexts/NotificationContext";

// ─── Helpers ───────────────────────────────────────────────
const formatDateTime = (dateStr) => {
  if (!dateStr) return { date: "—", time: "—" };
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
};

const computeDelay = (planned, actual) => {
  if (!planned || !actual) return null;
  const diffMs = new Date(actual) - new Date(planned);
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin <= 0) return { text: "On time", minutes: 0 };
  if (diffMin < 60)
    return { text: `${diffMin} min difference`, minutes: diffMin };
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return { text: `${hrs}h ${mins}m difference`, minutes: diffMin };
};

const getTaskStatus = (task) => {
  if (task.planned1 && task.actual1) return "Completed";
  return "In progress";
};

// Current shift helper with color coding
const getCurrentShift = () => {
  const now = new Date();
  const hour = now.getHours();

  if (hour >= 8 && hour < 14)
    return { name: "Shift A (08:00–14:00)", code: "A" };
  if (hour >= 14 && hour < 20)
    return { name: "Shift B (14:00–20:00)", code: "B" };
  return { name: "Shift C (20:00–08:00)", code: "C" };
};

const getShiftColor = (shiftCode) => {
  if (shiftCode === "A") return "bg-green-50 text-green-700 border-green-200";
  if (shiftCode === "B") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-purple-50 text-purple-700 border-purple-200";
};

// ─── Sub-components ────────────────────────────────────────

const SummaryCard = ({ icon: Icon, label, value }) => (
  <div className="p-4 transition-all bg-white border border-gray-200 rounded-xl hover:shadow-lg hover:scale-[1.01] hover:border-green-200">
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-50">
        <Icon className="w-5 h-5 text-green-600" />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase">{label}</p>
        <h3 className="text-2xl font-semibold text-gray-900">{value}</h3>
      </div>
    </div>
  </div>
);

const TaskRow = ({ task, index, nurseMap, onNurseClick }) => {
  const status = getTaskStatus(task);
  const planned = formatDateTime(task.planned1);
  const actual = formatDateTime(task.actual1);
  const delay = computeDelay(task.planned1, task.actual1);

  return (
    <div
      className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-0 px-4 py-3 transition-colors border-l-2 ${
        index % 2 === 0
          ? "bg-white border-gray-100"
          : "bg-gray-50/30 border-gray-100"
      } hover:border-green-300 hover:bg-green-50/20`}
    >
      {/* Task name + status */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-800 truncate">
            {task.task || "Unnamed Task"}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${
              status === "Completed"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-yellow-50 text-yellow-700 border-yellow-200"
            }`}
          >
            {status === "Completed" ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
            {status}
          </span>
        </div>
      </div>

      {/* Nurse - clickable with tap feedback and role context */}
      <div className="flex items-center gap-1.5 text-xs md:w-36">
        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        {task.assign_nurse ? (
          <span
            onClick={() => onNurseClick(task.assign_nurse)}
            className="font-medium text-green-700 truncate cursor-pointer hover:text-green-900 underline-offset-2 hover:underline active:scale-[0.98] transition-transform"
          >
            {task.assign_nurse}
            <span className="text-[10px] text-gray-500 ml-1">Nurse</span>
          </span>
        ) : (
          <span className="text-gray-500 truncate">—</span>
        )}
      </div>

      {/* Planned */}
      <div className="text-xs text-gray-600 md:w-36">
        <span className="font-medium text-gray-500 md:hidden">Planned: </span>
        <span>{planned.date}</span>{" "}
        <span className="text-gray-600">{planned.time}</span>
      </div>

      {/* Actual */}
      <div className="text-xs text-gray-600 md:w-36">
        <span className="font-medium text-gray-500 md:hidden">Actual: </span>
        <span>{actual.date}</span>{" "}
        <span className="text-gray-600">{actual.time}</span>
      </div>

      {/* Delay - with visual indicator */}
      <div className="flex items-center gap-1 text-xs md:w-28">
        {delay?.minutes > 0 && (
          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
        )}
        <span
          className={`font-medium ${
            delay?.minutes > 0 ? "text-yellow-700" : "text-gray-500"
          }`}
        >
          {delay ? delay.text : "—"}
        </span>
      </div>
    </div>
  );
};

const PatientCard = ({
  patient,
  tasks,
  isExpanded,
  onToggle,
  nurseMap,
  onNurseClick,
}) => {
  const completed = tasks.filter(
    (t) => getTaskStatus(t) === "Completed",
  ).length;
  const total = tasks.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Check for delays in patient tasks
  const hasDelay = tasks.some(
    (t) => computeDelay(t.planned1, t.actual1)?.minutes > 10,
  );

  // Progress bar color based on completion
  const getProgressBarColor = () => {
    if (progress >= 80) return "bg-green-500";
    if (progress >= 50) return "bg-green-400";
    if (progress >= 20) return "bg-yellow-400";
    return "bg-red-400";
  };

  // Progress meaning text
  const getProgressMeaning = () => {
    if (progress === 100) return "Done";
    if (progress > 70) return "On track";
    if (progress > 30) return "Ongoing";
    return "Attention";
  };

  return (
    <div
      className={`bg-white rounded-xl border transition-all duration-300 hover:shadow-lg hover:scale-[1.01] overflow-hidden ${
        hasDelay ? "border-yellow-300 bg-yellow-50/30" : ""
      } ${
        isExpanded
          ? "shadow-md border-green-200 ring-1 ring-green-100"
          : "shadow-sm border-gray-200 hover:border-green-200"
      }`}
    >
      {/* Card header — always visible */}
      <button
        onClick={onToggle}
        className="flex items-center w-full gap-3 px-3 py-3 text-left border-l-4 border-transparent md:gap-4 md:px-5 md:py-4 hover:border-green-400 focus:outline-none active:scale-[0.99] transition-transform"
      >
        {/* Patient avatar - neutral */}
        <div className="flex items-center justify-center flex-shrink-0 text-sm font-medium text-gray-600 bg-gray-100 rounded-full w-11 h-11">
          {patient.patient_name
            ? patient.patient_name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()
            : "PT"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-gray-900 truncate md:text-base">
              {patient.patient_name || "Unknown Patient"}
            </h3>
            <span className="px-2 py-0.5 text-[10px] rounded bg-gray-100 text-gray-600 border border-gray-200 whitespace-nowrap">
              IPD: {patient.Ipd_number || "N/A"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Bed className="w-3 h-3 text-gray-400" /> Bed{" "}
              {patient.bed_no || "N/A"}
            </span>
            <span>
              {patient.ward_type || ""} • {patient.room || ""}
            </span>
          </div>
        </div>

        {/* Progress with meaning - always visible */}
        <div className="items-center hidden gap-4 sm:flex">
          <div className="w-24">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">
                {completed}/{total}
              </span>
              <span className="text-xs font-medium text-gray-600">
                {progress}%
              </span>
            </div>
            <div className="h-1 overflow-hidden bg-gray-100 rounded-full">
              <div
                className={`h-full transition-all duration-500 rounded-full ${getProgressBarColor()}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-500 font-medium mt-0.5 block text-right">
              {getProgressMeaning()}
            </span>
          </div>
        </div>

        {/* Expand icon */}
        <div className="flex-shrink-0 text-gray-400">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>

      {/* Mobile progress */}
      <div className="px-4 pb-4 -mt-2 sm:hidden">
        <div className="flex items-center justify-between mb-1 text-xs font-medium text-gray-600">
          <span>
            {completed}/{total} tasks
          </span>
          <span className="flex items-center gap-1">
            <span>{progress}%</span>
            <span className="text-[10px] text-gray-500">
              ({getProgressMeaning()})
            </span>
          </span>
        </div>
        <div className="h-1 overflow-hidden bg-gray-100 rounded-full">
          <div
            className={`h-full rounded-full ${getProgressBarColor()}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Expanded task list */}
      {isExpanded && (
        <div className="border-t border-gray-100 animate-fade-in">
          {/* Table header (desktop) */}
          <div className="sticky top-0 z-10 hidden bg-white md:flex items-center px-4 py-2 bg-gray-50/50 text-[10px] text-gray-500 border-b border-gray-100">
            <div className="flex-1">Task</div>
            <div className="w-36">Nurse</div>
            <div className="w-36">Planned</div>
            <div className="w-36">Actual</div>
            <div className="w-28">Timing</div>
          </div>

          {/* Task rows */}
          {tasks.map((task, idx) => (
            <TaskRow
              key={task.id}
              task={task}
              index={idx}
              nurseMap={nurseMap}
              onNurseClick={onNurseClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard ────────────────────────────────────────

const PatientCareDashboard = () => {
  const [rawTasks, setRawTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedPatient, setExpandedPatient] = useState(null);
  const [nurseMap, setNurseMap] = useState({});
  const [currentShift, setCurrentShift] = useState(getCurrentShift());
  const [activeNurse, setActiveNurse] = useState(null);
  const [showSheet, setShowSheet] = useState(false);
  const [isTabletOrMobile, setIsTabletOrMobile] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const { showNotification } = useNotification();

  // Detect device: tablets (768-1024) use bottom sheet too
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsTabletOrMobile(width < 1024);
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);

    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  // Auto-update shift every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentShift(getCurrentShift());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // ── Fetch nurses ──
  const fetchNurses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("all_staff")
        .select("name, phone_number");

      if (error) throw error;

      const map = {};
      data?.forEach((n) => {
        map[n.name] = n.phone_number;
      });

      setNurseMap(map);
    } catch (err) {
      console.error("Error fetching nurse contacts:", err);
    }
  }, []);

  // ── Fetch all tasks once ──
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setVisibleCount(10);

      const { data, error } = await supabase
        .from("nurse_assign_task")
        .select("id, Ipd_number, patient_name, bed_no, ward_type, room, patient_location, task, assign_nurse, planned1, actual1, timestamp")
        .order("timestamp", { ascending: false })
        .limit(1000);

      if (error) throw error;
      setRawTasks(data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error loading data:", err);
      showNotification("Error loading patient care data", "error");
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Real-time updates
  useRealtimeTable("nurse_assign_task", fetchTasks);

  // Initial load
  useEffect(() => {
    fetchTasks();
    fetchNurses();
  }, [fetchTasks, fetchNurses]);

  // ── Nurse interaction handlers ──
  const handleNurseClick = (nurseName) => {
    setActiveNurse(nurseName);
    if (isTabletOrMobile) {
      setShowSheet(true);
    }
  };

  // ── Group by patient and sort by latest activity ──
  const patientGroups = useMemo(() => {
    const map = new Map();

    rawTasks.forEach((task) => {
      const key = task.Ipd_number || `unknown-${task.id}`;
      if (!map.has(key)) {
        map.set(key, {
          patient: {
            Ipd_number: task.Ipd_number,
            patient_name: task.patient_name,
            bed_no: task.bed_no,
            ward_type: task.ward_type,
            room: task.room,
            patient_location: task.patient_location,
          },
          tasks: [],
        });
      }
      map.get(key).tasks.push(task);
    });

    const groups = Array.from(map.values());

    // Sort by latest task timestamp - newest first
    groups.sort((a, b) => {
      const aTime = new Date(a.tasks[0]?.timestamp || 0);
      const bTime = new Date(b.tasks[0]?.timestamp || 0);
      return bTime - aTime;
    });

    return groups;
  }, [rawTasks]);

  // ── Filter ──
  const filteredGroups = useMemo(() => {
    let groups = patientGroups;

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      groups = groups.filter(
        (g) =>
          (g.patient.patient_name || "").toLowerCase().includes(q) ||
          (g.patient.Ipd_number || "").toLowerCase().includes(q) ||
          (g.patient.bed_no || "").toLowerCase().includes(q),
      );
    }

    // Status filter
    if (statusFilter === "in-progress") {
      groups = groups.filter((g) =>
        g.tasks.some((t) => getTaskStatus(t) === "In progress"),
      );
    } else if (statusFilter === "completed") {
      groups = groups.filter((g) =>
        g.tasks.every((t) => getTaskStatus(t) === "Completed"),
      );
    }

    return groups;
  }, [patientGroups, searchTerm, statusFilter]);

  const visibleGroups = useMemo(
    () => filteredGroups.slice(0, visibleCount),
    [filteredGroups, visibleCount],
  );

  // Scroll detection for grouped patient pagination
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 200 &&
        visibleCount < filteredGroups.length
      ) {
        setVisibleCount((prev) => Math.min(prev + 10, filteredGroups.length));
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [visibleCount, filteredGroups.length]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(10);
  }, [searchTerm, statusFilter]);

  // ── Summary stats ──
  const stats = useMemo(() => {
    const totalPatients = patientGroups.length;
    const totalTasks = rawTasks.length;
    const completed = rawTasks.filter(
      (t) => getTaskStatus(t) === "Completed",
    ).length;
    const inProgress = totalTasks - completed;

    return { totalPatients, totalTasks, completed, inProgress };
  }, [rawTasks, patientGroups]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 text-gray-800 sm:p-6 bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-2 border-gray-200 rounded-full border-t-green-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 text-gray-800 sm:p-6 bg-gray-50">
      <div className="mx-auto space-y-6 max-w-7xl">
        {/* ── Header with shift and live pulse ── */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-light text-gray-800 md:text-2xl">
                Patient Care
              </h1>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Live updates enabled
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span
                className={`px-2 py-1 rounded-full border ${getShiftColor(currentShift.code)}`}
              >
                🟢 {currentShift.name}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Monitoring view • Tap a nurse name to view contact details
            </p>
          </div>
          <button
            onClick={fetchTasks}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 transition-all bg-white border border-gray-200 rounded-lg hover:border-green-200 hover:text-green-700 active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {/* ── Quick Stats Bar ── */}
        <div className="flex gap-4 text-xs font-medium text-gray-600">
          <span>⚡ Active: {stats.inProgress}</span>
          <span>✅ Done: {stats.completed}</span>
          <span>👥 Patients: {stats.totalPatients}</span>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4 md:gap-4">
          <SummaryCard
            icon={Users}
            label="Patients"
            value={stats.totalPatients}
          />
          <SummaryCard
            icon={ClipboardList}
            label="Total Tasks"
            value={stats.totalTasks}
          />
          <SummaryCard
            icon={CheckCircle}
            label="Completed"
            value={stats.completed}
          />
          <SummaryCard
            icon={Clock}
            label="In Progress"
            value={stats.inProgress}
          />
        </div>

        {/* ── Search & Filter ── */}
        <div className="sticky top-0 z-20 pb-3 bg-gray-50">
          <div className="p-3 bg-white border border-gray-200 rounded-lg">
            <div className="flex flex-col gap-2 sm:flex-row">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute w-3.5 h-3.5 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search patient, IPD, or bed..."
                  className="w-full py-2 pr-3 text-sm text-gray-700 placeholder-gray-400 transition-all border border-gray-200 rounded-lg pl-9 focus:ring-2 focus:ring-green-200 focus:border-green-300"
                />
              </div>

              {/* Filter */}
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                {[
                  { key: "all", label: "All" },
                  { key: "in-progress", label: "In Progress" },
                  { key: "completed", label: "Completed" },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`px-3 py-1.5 rounded text-xs transition-all active:scale-[0.98] ${
                      statusFilter === f.key
                        ? "bg-green-600 text-white"
                        : "text-gray-600 hover:text-green-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Patient Cards ── */}
        <div className="space-y-3">
          {filteredGroups.length === 0 ? (
            <div className="p-12 text-center bg-white border border-gray-200 rounded-xl">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">
                No patients match your filters
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Try adjusting search or status filter
              </p>
            </div>
          ) : (
            visibleGroups.map((group) => (
              <PatientCard
                key={group.patient.Ipd_number || group.tasks[0]?.id}
                patient={group.patient}
                tasks={group.tasks}
                isExpanded={
                  expandedPatient ===
                  (group.patient.Ipd_number || group.tasks[0]?.id)
                }
                onToggle={() =>
                  setExpandedPatient((prev) =>
                    prev === (group.patient.Ipd_number || group.tasks[0]?.id)
                      ? null
                      : group.patient.Ipd_number || group.tasks[0]?.id,
                  )
                }
                nurseMap={nurseMap}
                onNurseClick={handleNurseClick}
              />
            ))
          )}
        </div>

        {/* Infinite scroll loading indicator */}
        {visibleGroups.length < filteredGroups.length && (
          <div className="py-4 text-sm text-center text-gray-500">
            Loading more...
          </div>
        )}

        {/* ── Desktop Popover (centered overlay) ── */}
        {activeNurse && !isTabletOrMobile && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
            onClick={() => setActiveNurse(null)}
          >
            <div
              className="w-64 p-4 bg-white border border-green-100 shadow-lg rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-sm font-semibold text-gray-900">
                {activeNurse}
              </div>

              <div className="mt-2 text-xs text-gray-600">
                📞 {nurseMap[activeNurse] || "No number available"}
              </div>

              {nurseMap[activeNurse] && (
                <div className="flex gap-2 mt-4">
                  <a
                    href={`tel:${nurseMap[activeNurse]}`}
                    className="flex-1 py-1.5 text-xs text-center bg-green-50 text-green-700 rounded-md hover:bg-green-100 active:scale-[0.98] transition-all"
                  >
                    Call
                  </a>
                  <a
                    href={`https://wa.me/${(nurseMap[activeNurse] || "").replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 text-xs text-center bg-green-50 text-green-700 rounded-md hover:bg-green-100 active:scale-[0.98] transition-all"
                  >
                    WhatsApp
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Mobile/Tablet Bottom Sheet ── */}
        {showSheet && (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/20"
            onClick={() => setShowSheet(false)}
          >
            <div
              className="w-full max-w-md p-5 mx-auto bg-white rounded-t-2xl animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 mx-auto mb-4 bg-gray-200 rounded-full"></div>

              <h3 className="text-base font-medium text-center text-gray-900">
                {activeNurse}
              </h3>

              <p className="mt-2 text-xs text-center text-gray-600">
                📞 {nurseMap[activeNurse] || "No number available"}
              </p>

              {nurseMap[activeNurse] && (
                <div className="flex gap-3 mt-5">
                  <a
                    href={`tel:${nurseMap[activeNurse]}`}
                    className="flex-1 py-2.5 text-sm text-center bg-green-50 text-green-700 rounded-lg hover:bg-green-100 active:scale-[0.98] transition-all"
                  >
                    Call
                  </a>
                  <a
                    href={`https://wa.me/${(nurseMap[activeNurse] || "").replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 text-sm text-center bg-green-50 text-green-700 rounded-lg hover:bg-green-100 active:scale-[0.98] transition-all"
                  >
                    WhatsApp
                  </a>
                </div>
              )}

              <button
                onClick={() => setShowSheet(false)}
                className="w-full mt-4 text-sm text-center text-gray-500 active:scale-[0.98] transition-transform"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── Footer with last updated and count ── */}
        {filteredGroups.length > 0 && (
          <div className="flex items-center justify-between pb-2">
            <p className="text-xs text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
            <div className="text-xs text-center text-gray-500">
              Showing {visibleGroups.length} of {filteredGroups.length}
            </div>
          </div>
        )}
      </div>

      {/* Add animation styles */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.25s ease;
        }
      `}</style>
    </div>
  );
};

export default PatientCareDashboard;
