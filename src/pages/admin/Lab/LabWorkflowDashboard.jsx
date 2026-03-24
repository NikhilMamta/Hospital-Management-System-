import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Beaker,
  Bed,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  Layers,
  Microscope,
  RefreshCw,
  Search,
  Timer,
  User,
  X,
} from "lucide-react";
import supabase from "../../../SupabaseClient";
import useRealtimeTable from "../../../hooks/useRealtimeTable";
import { useNotification } from "../../../contexts/NotificationContext";

// ─── Constants & Configuration ───────────────────────────────

const LAB_STAGES = [
  {
    key: "advice",
    label: "Test Advised",
    shortLabel: "Advice",
    icon: ClipboardList,
    accent: "blue",
  },
  {
    key: "collection",
    label: "Sample Collection",
    shortLabel: "Collection",
    icon: Beaker,
    accent: "orange",
  },
  {
    key: "reception",
    label: "Lab Received",
    shortLabel: "Received",
    icon: Layers,
    accent: "green",
  },
  {
    key: "processing",
    label: "In Processing",
    shortLabel: "Processing",
    icon: Microscope,
    accent: "purple",
  },
  {
    key: "result_entry",
    label: "Result Entry",
    shortLabel: "Result",
    icon: FileText,
    accent: "teal",
  },
  {
    key: "finalized",
    label: "Report Released",
    shortLabel: "Finalized",
    icon: CheckCircle,
    accent: "indigo",
  },
];

const CATEGORIES = ["Pathology", "Radiology", "USG", "CT", "X-Ray"];

// ─── Helpers ───────────────────────────────────────────────

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const formatDateTime = (value) => {
  if (!value) return { date: "-", time: "-" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "-", time: "-" };

  return {
    date: parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: parsed.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
};

const getStatusClasses = (status) => {
  switch (status) {
    case "completed":
      return "bg-green-50 text-green-700 border-green-200";
    case "blocked":
      return "bg-red-50 text-red-700 border-red-200";
    case "overdue":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "pending":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-gray-50 text-gray-600 border-gray-200";
  }
};

const getProgressColor = (progress) => {
  if (progress >= 100) return "bg-green-500";
  if (progress >= 70) return "bg-green-400";
  if (progress >= 40) return "bg-blue-400";
  if (progress >= 20) return "bg-amber-400";
  return "bg-red-400";
};

// ─── Logic for Building Stages ──────────────────────────────

const resolveStageStatus = (planned, actual) => {
  if (actual) return "completed";
  if (planned) {
    const plannedMs = new Date(planned).getTime();
    if (Date.now() > plannedMs + 3600000) return "overdue"; // 1hr tolerance
    return "pending";
  }
  return "not_started";
};

const buildLabStage = (definition, record) => {
  let plannedAt = null;
  let actualAt = null;

  switch (definition.key) {
    case "advice":
      plannedAt = record.timestamp;
      actualAt = record.timestamp;
      break;
    case "collection":
      plannedAt = record.planned1;
      actualAt = record.actual1;
      break;
    case "reception":
      plannedAt = record.planned2;
      actualAt = record.actual2;
      break;
    case "processing":
      plannedAt = record.planned3;
      actualAt = record.actual3;
      break;
    case "result_entry":
      plannedAt = record.planned4;
      actualAt = record.actual4;
      break;
    case "finalized":
      plannedAt = record.planned5;
      actualAt = record.actual5;
      break;
    default:
      break;
  }

  return {
    ...definition,
    plannedAt,
    actualAt,
    status: resolveStageStatus(plannedAt, actualAt),
  };
};

// ─── Components ─────────────────────────────────────────────

const SummaryCard = ({ icon: Icon, label, value, colorClass }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md hover:scale-[1.01]">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

const LabWorkflowCard = ({ labCase, isExpanded, onToggle }) => {
  const currentStage =
    labCase.stages.find((s) => s.status !== "completed") ||
    labCase.stages[labCase.stages.length - 1];

  const tests =
    labCase.category === "Pathology"
      ? labCase.pathology_tests
      : labCase.radiology_tests;

  const testList = Array.isArray(tests)
    ? tests.join(", ")
    : tests || "N/A";

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
        isExpanded
          ? "border-green-200 ring-1 ring-green-100 shadow-md"
          : "border-gray-200 shadow-sm hover:border-green-200"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-5 text-left transition-colors hover:bg-green-50/30"
      >
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 shrink-0">
          {labCase.patient_name?.charAt(0).toUpperCase() || "L"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-gray-900 truncate">
              {labCase.patient_name}
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-md border border-blue-100">
              Lab No: {labCase.lab_no || "N/A"}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-50 text-gray-600 rounded-md border border-gray-100">
              {labCase.category}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Bed className="w-3.5 h-3.5" /> Bed {labCase.bed_no || "N/A"}
            </span>
            <span className="flex items-center gap-1">
              <Microscope className="w-3.5 h-3.5" /> {testList}
            </span>
          </div>
        </div>

        <div className="hidden md:flex flex-col items-end gap-2 shrink-0 w-48">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${getStatusClasses(currentStage.status)}`}
            >
              {currentStage.label}
            </span>
          </div>
          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(labCase.progress)}`}
              style={{ width: `${labCase.progress}%` }}
            />
          </div>
        </div>

        <div className="text-gray-400">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-5 border-t border-gray-100 bg-gray-50/30 animate-fade-in">
          {/* Workflow Stepper */}
          <div className="mb-8 overflow-x-auto pb-4">
            <div className="flex items-center min-w-max px-4">
              {labCase.stages.map((stage, idx) => {
                const Icon = stage.icon;
                const isDone = stage.status === "completed";
                const isActive = stage.key === currentStage.key;

                return (
                  <React.Fragment key={stage.key}>
                    <div className="relative flex flex-col items-center group">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                          isDone
                            ? "bg-green-500 border-green-500 text-white shadow-sm"
                            : isActive
                              ? "bg-white border-green-600 text-green-600 ring-4 ring-green-100"
                              : "bg-white border-gray-200 text-gray-400"
                        }`}
                      >
                        {isDone ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                      </div>
                      <div className="mt-2 text-center">
                        <p className={`text-[11px] font-bold ${isActive ? "text-green-700" : isDone ? "text-gray-900" : "text-gray-400"}`}>
                          {stage.shortLabel}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium whitespace-nowrap">
                          {isDone ? formatDateTime(stage.actualAt).time : stage.status === "pending" ? "Waiting..." : "-"}
                        </p>
                      </div>
                    </div>
                    {idx < labCase.stages.length - 1 && (
                      <div className={`h-0.5 w-12 sm:w-20 mx-2 -mt-10 rounded-full transition-colors ${isDone ? "bg-green-500" : "bg-gray-200"}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
             <div className="bg-white p-3 rounded-xl border border-gray-100">
               <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Patient Details</p>
               <div className="space-y-1 text-xs">
                 <div className="flex justify-between">
                   <span className="text-gray-500">Admission No:</span>
                   <span className="font-bold text-gray-800">{labCase.admission_no}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-gray-500">IPD No:</span>
                   <span className="font-bold text-gray-800">{labCase.ipd_number}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-gray-500">Bed / Room:</span>
                   <span className="font-bold text-gray-800">{labCase.bed_no} / {labCase.room}</span>
                 </div>
               </div>
             </div>

             <div className="bg-white p-3 rounded-xl border border-gray-100">
               <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Test Info</p>
               <div className="space-y-1 text-xs">
                 <div className="flex justify-between">
                   <span className="text-gray-500">Category:</span>
                   <span className={`font-bold px-1.5 py-0.5 rounded ${labCase.category === 'Pathology' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{labCase.category}</span>
                 </div>
                 <div className="flex flex-col gap-1 mt-1">
                   <span className="text-gray-500">Tests:</span>
                   <span className="font-bold text-gray-800 bg-gray-50 p-1.5 rounded border border-gray-100">{testList}</span>
                 </div>
               </div>
             </div>

             <div className="bg-white p-3 rounded-xl border border-gray-100">
               <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Responsible Staff</p>
               <div className="space-y-2 text-xs">
                 <div className="flex items-center gap-2">
                   <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                     <User className="w-3.5 h-3.5" />
                   </div>
                   <div>
                     <p className="text-gray-400 text-[9px] uppercase font-bold">Advised By</p>
                     <p className="font-bold text-gray-800">{labCase.consultant_dr || "Hospital System"}</p>
                   </div>
                 </div>
                 {labCase.remarks && (
                    <div className="mt-2 bg-amber-50 p-2 rounded-lg border border-amber-100">
                       <p className="text-[9px] font-bold text-amber-700 uppercase mb-1">Clinical Remarks</p>
                       <p className="text-[11px] text-amber-800 italic">"{labCase.remarks}"</p>
                    </div>
                 )}
               </div>
             </div>
          </div>

          <p className="text-[10px] font-bold text-gray-400 uppercase mb-3 px-1">Stage Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {labCase.stages.map((stage) => {
              const dtActual = formatDateTime(stage.actualAt);
              const dtPlanned = formatDateTime(stage.plannedAt);
              return (
                <div key={stage.key} className={`p-3 bg-white border rounded-xl shadow-sm transition-all ${stage.status === 'completed' ? 'border-green-100' : stage.status === 'pending' ? 'border-blue-100 bg-blue-50/10' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${stage.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                        <stage.icon className="w-3.5 h-3.5" />
                      </div>
                      <span className={`text-[11px] font-bold ${stage.status === 'completed' ? 'text-gray-900' : 'text-gray-500'}`}>{stage.label}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${getStatusClasses(stage.status)}`}>
                      {stage.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Planned:</span>
                      <span className="text-gray-600 font-medium">{dtPlanned.date} {dtPlanned.time}</span>
                    </div>
                    {stage.actualAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Completed:</span>
                        <span className="text-green-700 font-bold">{dtActual.date} {dtActual.time}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard ─────────────────────────────────────────

const LabWorkflowDashboard = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [expandedId, setExpandedId] = useState(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const { showNotification } = useNotification();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("lab")
        .select("*")
        .eq("payment_status", "Yes")
        .order("timestamp", { ascending: false });

      if (error) throw error;

      const processed = (data || []).map((record) => {
        const stages = LAB_STAGES.map((def) => buildLabStage(def, record));
        const completedCount = stages.filter((s) => s.status === "completed").length;
        const progress = Math.round((completedCount / stages.length) * 100);

        return { ...record, stages, progress, completedCount };
      });

      setRecords(processed);
    } catch (err) {
      console.error("Error fetching lab workflow:", err);
      showNotification("Failed to load lab workflow data.", "error");
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useRealtimeTable("lab", fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filters
  const filteredRecords = useMemo(() => {
    let result = records;

    if (categoryFilter !== "all") {
      result = result.filter((r) => r.category === categoryFilter);
    }

    if (statusFilter === "active") {
      result = result.filter((r) => r.progress < 100);
    } else if (statusFilter === "completed") {
      result = result.filter((r) => r.progress === 100);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.patient_name?.toLowerCase().includes(q) ||
          r.lab_no?.toLowerCase().includes(q) ||
          r.admission_no?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [records, categoryFilter, statusFilter, searchTerm]);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 200 &&
        visibleCount < filteredRecords.length
      ) {
        setVisibleCount((prev) => Math.min(prev + 10, filteredRecords.length));
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [visibleCount, filteredRecords.length]);

  const stats = useMemo(() => {
    const active = records.filter((r) => r.progress < 100);
    return {
      total: records.length,
      active: active.length,
      pendingCollection: records.filter((r) => r.stages[1].status === "pending").length,
      inProcessing: records.filter((r) => r.stages[3].status === "pending").length,
      ready: records.filter((r) => r.stages[4].status === "completed" && r.progress < 100).length,
    };
  }, [records]);

  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-100 border-t-green-600 rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Syncing Lab Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-gray-800 tracking-tight">LAB WORKFLOW</h1>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-100 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-green-700 uppercase">Live</span>
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-500 font-medium tracking-tight">
              Monitoring sample lifecycle from Advice to Result release.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-green-300 hover:text-green-700 transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={Activity}
            label="Total Active"
            value={stats.active}
            colorClass="bg-blue-50 text-blue-600"
          />
          <SummaryCard
            icon={Beaker}
            label="Pending Collection"
            value={stats.pendingCollection}
            colorClass="bg-orange-50 text-orange-600"
          />
          <SummaryCard
            icon={Microscope}
            label="In Processing"
            value={stats.inProcessing}
            colorClass="bg-purple-50 text-purple-600"
          />
          <SummaryCard
            icon={CheckCircle}
            label="Ready Reports"
            value={stats.ready}
            colorClass="bg-green-50 text-green-600"
          />
        </div>

        {/* Filters Sticky Bar */}
        <div className="sticky top-0 z-30 bg-gray-50/80 backdrop-blur-md pb-4 pt-2">
          <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Patient, Lab No, or Admission No..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-green-100 transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                {["active", "completed", "all"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                      statusFilter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-gray-200 mx-2 hidden lg:block" />

              <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                <button
                  onClick={() => setCategoryFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${
                    categoryFilter === "all" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  All Depts
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all whitespace-nowrap ${
                      categoryFilter === c ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="space-y-4">
          {filteredRecords.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center bg-white border border-dashed border-gray-300 rounded-3xl">
              <div className="p-4 bg-gray-50 rounded-full mb-4">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-black uppercase text-xs tracking-widest">No matching records found</p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setCategoryFilter("all");
                  setStatusFilter("active");
                }}
                className="mt-4 text-green-600 font-bold text-sm underline underline-offset-4"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            filteredRecords.slice(0, visibleCount).map((item) => (
              <LabWorkflowCard
                key={item.id}
                labCase={item}
                isExpanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              />
            ))
          )}
        </div>

        {/* Loading Footer */}
        {visibleCount < filteredRecords.length && (
          <div className="flex justify-center py-6">
            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s] mx-1" />
            <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
          </div>
        )}
      </div>
    </div>
  );
};

export default LabWorkflowDashboard;
