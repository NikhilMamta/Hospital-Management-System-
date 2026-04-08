import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  Pill,
  RefreshCw,
  Search,
  User,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNotification } from "../../../contexts/NotificationContext";
import { getWorkflowData } from "../../../api/pharmacy";
import useRealtimeQuery from "../../../hooks/useRealtimeQuery";
import {
  normalizeDepartmentalPharmacyIndent,
  normalizePatientPharmacyIndent,
} from "../../../utils/pharmacyIndentUtils";

const STAGES = [
  { key: "request_received", label: "Prescription Received", shortLabel: "Received", route: "/admin/pharmacy/indent", icon: ClipboardList },
  { key: "medication_verification", label: "Medication Verification", shortLabel: "Verification", route: "/admin/pharmacy/approval", icon: FileText },
  { key: "dispensing_queue", label: "Inventory and Dispensing", shortLabel: "Dispensing", route: "/admin/pharmacy/store", icon: Pill },
  { key: "completed", label: "Completed", shortLabel: "Done", route: "/admin/pharmacy/store", icon: CheckCircle },
];

const REQUEST_TYPE_LABELS = { medicineSlip: "Medicine Slip", investigation: "Investigation", package: "Package", nonPackage: "Non-Package" };

const parseJsonField = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch (e) { return fallback; }
};

const normalizeStatus = (value) => String(value || "pending").trim().toLowerCase();

const formatDateTime = (value) => {
  if (!value) return { date: "-", time: "-" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "-", time: "-" };
  return {
    date: parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: parsed.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
};

const formatDuration = (minutes) => {
  const total = Math.max(Math.abs(minutes), 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
};

const getTimingMeta = (plannedAt, actualAt) => {
  if (!plannedAt) return { label: "Not scheduled", tone: "muted", overdue: false };
  const plannedMs = new Date(plannedAt).getTime();
  if (Number.isNaN(plannedMs)) return { label: "Invalid schedule", tone: "muted", overdue: false };
  const compareMs = actualAt ? new Date(actualAt).getTime() : Date.now();
  const diffMinutes = Math.round((compareMs - plannedMs) / 60000);
  if (actualAt) {
    if (Math.abs(diffMinutes) <= 5) return { label: "On time", tone: "success", overdue: false };
    if (diffMinutes > 0) return { label: `${formatDuration(diffMinutes)} late`, tone: "warning", overdue: true };
    return { label: `${formatDuration(diffMinutes)} early`, tone: "info", overdue: false };
  }
  if (diffMinutes > 5) return { label: `Overdue by ${formatDuration(diffMinutes)}`, tone: "danger", overdue: true };
  if (diffMinutes >= -5) return { label: "Due now", tone: "warning", overdue: false };
  return { label: `Due in ${formatDuration(diffMinutes)}`, tone: "info", overdue: false };
};

const getStatusClasses = (status) => {
  switch (status) {
    case "completed": return "bg-green-50 text-green-700 border-green-200";
    case "blocked": return "bg-red-50 text-red-700 border-red-200";
    case "overdue": return "bg-amber-50 text-amber-700 border-amber-200";
    case "pending": return "bg-blue-50 text-blue-700 border-blue-200";
    default: return "bg-gray-50 text-gray-600 border-gray-200";
  }
};

const getDashboardClasses = (status) => {
  switch (status) {
    case "completed": return "bg-green-50 text-green-700 border-green-200";
    case "rejected": return "bg-red-50 text-red-700 border-red-200";
    case "overdue": return "bg-amber-50 text-amber-700 border-amber-200";
    case "ready_to_dispense": return "bg-blue-50 text-blue-700 border-blue-200";
    case "pending_review": return "bg-purple-50 text-purple-700 border-purple-200";
    default: return "bg-gray-50 text-gray-600 border-gray-200";
  }
};

const getDashboardLabel = (status) => {
  switch (status) {
    case "completed": return "Completed";
    case "rejected": return "Rejected";
    case "overdue": return "Delayed";
    case "ready_to_dispense": return "Ready to Dispense";
    case "pending_review": return "Pending Review";
    default: return "Active";
  }
};

const getTimingClasses = (tone) => {
  switch (tone) {
    case "success": return "text-green-700";
    case "warning": return "text-amber-700";
    case "danger": return "text-red-700";
    case "info": return "text-blue-700";
    default: return "text-gray-500";
  }
};

const getProgressColor = (progress) => {
  if (progress >= 100) return "bg-green-500";
  if (progress >= 70) return "bg-green-400";
  if (progress >= 40) return "bg-blue-400";
  if (progress >= 20) return "bg-amber-400";
  return "bg-red-400";
};

const getInitials = (name) => {
  if (!name) return "PT";
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
};

const resolveStatus = ({ plannedAt, actualAt, blocked = false }) => {
  if (blocked) return "blocked";
  if (actualAt) return "completed";
  if (plannedAt && getTimingMeta(plannedAt, actualAt).overdue) return "overdue";
  if (plannedAt) return "pending";
  return "not_started";
};

const getRequestTypeLabelsArr = (requestTypes) =>
  Object.entries(REQUEST_TYPE_LABELS)
    .filter(([key]) => requestTypes?.[key])
    .map(([, label]) => label);

const buildStage = (definition, order) => {
  const status = normalizeStatus(order.status);
  const slipUrl = order.slip_image || order.slip_image_url || order.slipImage || order.slipImageUrl || null;

  switch (definition.key) {
    case "request_received":
      return {
        ...definition,
        route: order.indentType === "departmental" ? "/admin/pharmacy/departmental-indent" : definition.route,
        plannedAt: order.planned1 || order.timestamp || null,
        actualAt: order.timestamp || order.planned1 || null,
        owner: order.requestedBy || order.staffName || "",
        ownerRole: "Requested by",
        result: order.requestTypeLabels.length > 0 ? order.requestTypeLabels.join(", ") : "Order created",
        status: "completed",
        timing: { label: "Created", tone: "success", overdue: false },
        note: order.indentNumber ? `Indent No: ${order.indentNumber}` : "Workflow initiated",
      };
    case "medication_verification": {
      const blocked = status === "rejected";
      return {
        ...definition,
        plannedAt: order.planned1 || null,
        actualAt: order.actual1 || null,
        owner: order.approvedBy || "",
        ownerRole: "Verified by",
        result: status === "approved" ? "Approved" : blocked ? "Rejected" : "Awaiting review",
        attachmentUrl: slipUrl,
        attachmentLabel: slipUrl ? "View Pharmacy Slip" : "",
        status: resolveStatus({ plannedAt: order.planned1, actualAt: status === "approved" ? order.actual1 : null, blocked }),
        timing: getTimingMeta(order.planned1, order.actual1),
        note: blocked ? "Order rejected during verification." : "",
      };
    }
    case "dispensing_queue": {
      const blocked = status === "rejected";
      return {
        ...definition,
        plannedAt: order.planned2 || null,
        actualAt: order.actual2 || null,
        owner: "",
        ownerRole: "Store Desk",
        result: blocked ? "Not forwarded" : order.actual2 ? "Dispensed" : "Awaiting dispensing",
        attachmentUrl: slipUrl,
        attachmentLabel: slipUrl ? "View Pharmacy Slip" : "",
        status: resolveStatus({ plannedAt: order.planned2, actualAt: order.actual2, blocked }),
        timing: getTimingMeta(order.planned2, order.actual2),
      };
    }
    case "completed":
      return {
        ...definition,
        plannedAt: order.planned2 || null,
        actualAt: order.actual2 || null,
        result: status === "rejected" ? "Closed (Rejected)" : order.actual2 ? "Completed" : "Awaiting completion",
        status: status === "rejected" ? "blocked" : order.actual2 ? "completed" : "not_started",
        timing: order.actual2 ? getTimingMeta(order.planned2, order.actual2) : { label: "Pending", tone: "muted", overdue: false },
      };
    default:
      return { ...definition, status: "not_started", timing: { label: "Not started", tone: "muted", overdue: false } };
  }
};

const getDashboardStatus = (order, currentStage) => {
  const status = normalizeStatus(order.status);
  if (status === "rejected") return "rejected";
  if (order.actual2) return "completed";
  if (currentStage.status === "overdue") return "overdue";
  if (currentStage.key === "medication_verification") return "pending_review";
  if (currentStage.key === "dispensing_queue" || currentStage.key === "completed") return "ready_to_dispense";
  return "active";
};

const buildWorkflowOrder = (row) => {
  const requestTypes = row.requestTypes || parseJsonField(row.request_types, {});
  const medicines = Array.isArray(row.medicines) ? row.medicines : parseJsonField(row.medicines, []);
  const investigations = Array.isArray(row.investigations) ? row.investigations : parseJsonField(row.investigations, []);
  const requestTypeLabels = getRequestTypeLabelsArr(requestTypes);
  const stages = STAGES.map(d => buildStage(d, { ...row, requestTypeLabels, medicines, investigations }));
  const completedCount = stages.filter(s => s.status === "completed").length;
  const progress = Math.round((completedCount / stages.length) * 100);
  const currentStage = stages.find(s => s.status !== "completed") || stages[stages.length - 1];
  const dashboardStatus = getDashboardStatus(row, currentStage);

  return {
    ...row,
    stages,
    currentStage,
    progress,
    dashboardStatus,
    medicationCount: medicines.length,
    investigationCount: investigations.length,
    completedCount,
    totalStages: stages.length,
    searchableText: [row.displayTitle, row.patientName, row.indentNumber, row.admissionNumber, row.ipdNumber, row.consultantName, row.diagnosis, row.remarks, row.location, currentStage.label].filter(Boolean).join(" ").toLowerCase(),
  };
};

const SummaryCard = ({ icon: Icon, label, value, accentClass }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
    <div className="flex items-center gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentClass}`}><Icon className="h-5 w-5" /></div>
      <div><p className="text-xs uppercase tracking-wide text-gray-500">{label}</p><h3 className="text-2xl font-semibold text-gray-900">{value}</h3></div>
    </div>
  </div>
);

const StatusPill = ({ status }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${getStatusClasses(status)}`}>
    {status === "completed" ? <CheckCircle className="h-3.5 w-3.5" /> : (status === "blocked" || status === "overdue") ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
    {status === "completed" ? "Completed" : status === "blocked" ? "Blocked" : status === "overdue" ? "Overdue" : status === "pending" ? "Pending" : "Not Started"}
  </span>
);

const WorkflowBadge = ({ status }) => <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDashboardClasses(status)}`}>{getDashboardLabel(status)}</span>;

const WorkflowStepper = ({ stages, currentStageKey }) => (
  <div className="overflow-x-auto pb-2">
    <div className="flex min-w-max items-start gap-2">
      {stages.map((stage, index) => {
        const Icon = stage.icon;
        const isCurrent = stage.key === currentStageKey;
        return (
          <React.Fragment key={stage.key}>
            <div className="min-w-[132px]">
              <div className="flex items-center gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-all ${isCurrent ? "border-green-300 bg-green-50 text-green-700 ring-4 ring-green-100" : getStatusClasses(stage.status)}`}><Icon className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-800">{stage.shortLabel}</p>
                  <p className={`text-[11px] ${getTimingClasses(stage.timing.tone)}`}>{stage.status === "completed" ? "Done" : stage.timing.label}</p>
                </div>
              </div>
            </div>
            {index < stages.length - 1 && <div className="mt-4 h-0.5 w-9 flex-shrink-0 rounded-full bg-gray-200" />}
          </React.Fragment>
        );
      })}
    </div>
  </div>
);

const StageDetailCard = ({ stage, isCurrent, onOpenStage, onOpenAttachment, onHandlerClick }) => (
  <div className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${isCurrent ? "border-green-200 ring-1 ring-green-100" : "border-gray-200"}`}>
    <div className="mb-3 flex items-start justify-between gap-3">
      <div><p className="text-sm font-semibold text-gray-900">{stage.label}</p><p className="mt-1 text-xs text-gray-500">{stage.ownerRole || "Workflow stage"}</p></div>
      <StatusPill status={stage.status} />
    </div>
    <div className="space-y-2 text-xs text-gray-600">
      <div className="flex justify-between"><span>Planned</span><span className="font-medium text-gray-800">{formatDateTime(stage.plannedAt).date} {formatDateTime(stage.plannedAt).time}</span></div>
      <div className="flex justify-between"><span>Actual</span><span className="font-medium text-gray-800">{formatDateTime(stage.actualAt).date} {formatDateTime(stage.actualAt).time}</span></div>
      <div className="flex justify-between"><span>Handler</span>
        {stage.owner ? <button onClick={() => onHandlerClick(stage)} className="text-green-700 underline font-medium">{stage.owner}</button> : <span className="text-gray-500">Not recorded</span>}
      </div>
    </div>
    <div className="mt-4 flex gap-2">
      <button onClick={() => onOpenStage(stage)} className="px-3 py-1.5 border rounded text-xs font-medium hover:bg-gray-100 flex items-center gap-1">Open Stage <ArrowRight className="w-3 h-3"/></button>
      {stage.attachmentUrl && <button onClick={() => onOpenAttachment(stage)} className="px-3 py-1.5 border rounded text-xs font-medium hover:bg-gray-100 flex items-center gap-1"><FileText className="w-3 h-3"/> View Slip</button>}
    </div>
  </div>
);

const PharmacyOrderCard = ({ workflow, isExpanded, onToggle, onOpenStage, onOpenAttachment, onHandlerClick }) => (
  <div className={`rounded-2xl border bg-white shadow-sm transition-all ${isExpanded ? "border-green-300 ring-1 ring-green-100" : "border-gray-200"}`}>
    <button onClick={onToggle} className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors">
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-600">{getInitials(workflow.displayTitle || workflow.patientName)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold truncate">{workflow.displayTitle || workflow.patientName}</h3>
          <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded border">ID: {workflow.indentNumber}</span>
        </div>
        <div className="text-xs text-gray-500 flex gap-3">
          <span>{workflow.indentType === "departmental" ? `Loc: ${workflow.location}` : `Adm: ${workflow.admissionNumber}`}</span>
          <span>{workflow.wardLocation || workflow.location}</span>
        </div>
        <div className="mt-2 flex gap-2"><WorkflowBadge status={workflow.dashboardStatus} /><span className="text-[10px] bg-white border px-2 py-0.5 rounded-full">Current: {workflow.currentStage.shortLabel}</span></div>
      </div>
      <div className="hidden sm:block w-32">
        <div className="flex justify-between text-[10px] font-bold mb-1"><span>{workflow.completedCount}/{workflow.totalStages}</span><span>{workflow.progress}%</span></div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${getProgressColor(workflow.progress)}`} style={{ width: `${workflow.progress}%` }} /></div>
      </div>
      <div className="text-gray-400">{isExpanded ? <ChevronUp/> : <ChevronDown/>}</div>
    </button>
    {isExpanded && (
      <div className="p-4 bg-gray-50 border-t border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {workflow.stages.map(s => <StageDetailCard key={s.key} stage={s} isCurrent={s.key === workflow.currentStage.key} onOpenStage={onOpenStage} onOpenAttachment={onOpenAttachment} onHandlerClick={onHandlerClick}/>)}
        </div>
      </div>
    )}
  </div>
);

const PharmacyWorkflowDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [requestTypeFilter, setRequestTypeFilter] = useState("all");
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [activeHandler, setActiveHandler] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);

  const { data: rawData = { orders: { patient: [], departmental: [] }, contacts: {} }, isLoading: loading } = useQuery({
    queryKey: ['pharmacy', 'workflow'],
    queryFn: getWorkflowData
  });

  useRealtimeQuery(['pharmacy', 'departmental_pharmacy_indent'], ['pharmacy', 'workflow']);

  const workflows = useMemo(() => {
    const orders = [
      ...rawData.orders.patient.map(normalizePatientPharmacyIndent),
      ...rawData.orders.departmental.map(normalizeDepartmentalPharmacyIndent)
    ];
    return orders.map(buildWorkflowOrder);
  }, [rawData]);

  const filteredWorkflows = useMemo(() => workflows.filter(w => {
    if (searchTerm && !w.searchableText.includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== "all" && w.dashboardStatus !== statusFilter) return false;
    if (stageFilter !== "all" && w.currentStage.key !== stageFilter) return false;
    if (requestTypeFilter !== "all" && !w.requestTypes?.[requestTypeFilter]) return false;
    return true;
  }), [workflows, searchTerm, statusFilter, stageFilter, requestTypeFilter]);

  const visibleWorkflows = useMemo(() => filteredWorkflows.slice(0, visibleCount), [filteredWorkflows, visibleCount]);

  const stats = useMemo(() => {
    return {
      total: workflows.length,
      pending: workflows.filter(w => w.dashboardStatus === "pending_review").length,
      ready: workflows.filter(w => w.dashboardStatus === "ready_to_dispense").length,
      delayed: workflows.filter(w => w.dashboardStatus === "overdue").length,
      completed: workflows.filter(w => w.dashboardStatus === "completed").length,
    };
  }, [workflows]);

  const handleOpenStage = (stage) => navigate(stage.route);
  const handleOpenAttachment = (stage) => stage.attachmentUrl && setAttachmentPreview({ url: stage.attachmentUrl, label: stage.attachmentLabel || stage.label });
  const handleHandlerClick = (stage) => setActiveHandler({ name: stage.owner, role: stage.ownerRole || "Handler", phone: rawData.contacts[stage.owner] || "" });

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gray-50"><div className="animate-spin h-10 w-10 border-b-2 border-green-500 rounded-full"/></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 text-gray-800">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div><h1 className="text-2xl font-bold">Pharmacy Workflow Dashboard</h1><p className="text-xs text-gray-500">Live multi-stage order tracking</p></div>
          <button onClick={() => queryClient.invalidateQueries(['pharmacy', 'workflow'])} className="px-4 py-2 bg-white border rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50"><RefreshCw className="w-4 h-4"/> Refresh</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard icon={ClipboardList} label="Total Orders" value={stats.total} accentClass="bg-blue-50 text-blue-700" />
          <SummaryCard icon={FileText} label="Pending Review" value={stats.pending} accentClass="bg-purple-50 text-purple-700" />
          <SummaryCard icon={Pill} label="Ready" value={stats.ready} accentClass="bg-green-50 text-green-700" />
          <SummaryCard icon={AlertCircle} label="Delayed" value={stats.delayed} accentClass="bg-amber-50 text-amber-700" />
          <SummaryCard icon={CheckCircle} label="Completed" value={stats.completed} accentClass="bg-emerald-50 text-emerald-700" />
        </div>

        <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur py-3">
          <div className="bg-white p-3 rounded-xl shadow-sm border space-y-3 lg:space-y-0 lg:flex lg:gap-3">
             <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-100 focus:border-green-400 transition-all"/></div>
             <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-2 border rounded-lg text-sm outline-none">
                <option value="all">All statuses</option>
                <option value="pending_review">Pending Review</option>
                <option value="ready_to_dispense">Ready to Dispense</option>
                <option value="overdue">Delayed</option>
                <option value="completed">Completed</option>
             </select>
          </div>
        </div>

        <div className="space-y-4">
          {visibleWorkflows.map(w => <PharmacyOrderCard key={w.id} workflow={w} isExpanded={expandedOrder === w.id} onToggle={() => setExpandedOrder(expandedOrder === w.id ? null : w.id)} onOpenStage={handleOpenStage} onOpenAttachment={handleOpenAttachment} onHandlerClick={handleHandlerClick} />)}
          {visibleWorkflows.length === 0 && <div className="text-center py-20 bg-white border rounded-2xl text-gray-400 italic">No matching orders found</div>}
          {visibleWorkflows.length < filteredWorkflows.length && <button onClick={() => setVisibleCount(v => v + 12)} className="w-full py-3 bg-white border rounded-xl text-sm font-medium hover:bg-gray-50">Load More</button>}
        </div>
      </div>

      {activeHandler && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setActiveHandler(null)}><div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-start mb-6"><div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">{getInitials(activeHandler.name)}</div><button onClick={() => setActiveHandler(null)}><X className="w-6 h-6 text-gray-400"/></button></div>
          <h2 className="text-xl font-bold mb-1">{activeHandler.name}</h2><p className="text-sm text-gray-500 mb-6">{activeHandler.role}</p>
          <div className="space-y-4">
             <div className="flex items-center gap-3 text-sm"><User className="w-4 h-4 text-gray-400"/><span>Contact info available below</span></div>
             <div className="flex gap-3"><a href={`tel:${activeHandler.phone}`} className="flex-1 py-3 bg-green-600 text-white text-center rounded-xl font-bold hover:bg-green-700 transition-colors">Call Handler</a><a href={`https://wa.me/${activeHandler.phone?.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="flex-1 py-3 bg-green-100 text-green-700 text-center rounded-xl font-bold hover:bg-green-200 transition-colors">WhatsApp</a></div>
          </div>
      </div></div>}

      {attachmentPreview && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setAttachmentPreview(null)}><div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b flex justify-between items-center"><span className="font-bold">{attachmentPreview.label}</span><button onClick={() => setAttachmentPreview(null)}><X className="w-6 h-6"/></button></div>
          <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center"><img src={attachmentPreview.url} alt="Slip" className="max-w-full h-auto object-contain" /></div>
      </div></div>}
    </div>
  );
};

export default PharmacyWorkflowDashboard;
