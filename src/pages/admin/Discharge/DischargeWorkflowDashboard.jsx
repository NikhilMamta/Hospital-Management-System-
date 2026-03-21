import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bed,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import supabase from "../../../SupabaseClient";
import useRealtimeTable from "../../../hooks/useRealtimeTable";
import { useNotification } from "../../../contexts/NotificationContext";

const STAGES = [
  {
    key: "request_created",
    label: "Request Created",
    shortLabel: "Request",
    route: "/admin/discharge/patient",
    icon: ClipboardList,
  },
  {
    key: "rmo_initiation",
    label: "RMO Initiation",
    shortLabel: "RMO",
    route: "/admin/discharge/initiation",
    icon: Activity,
  },
  {
    key: "complete_file_work",
    label: "Complete File Work",
    shortLabel: "File Work",
    route: "/admin/discharge/complete-file",
    icon: FileText,
  },
  {
    key: "concern_department",
    label: "Concern Department",
    shortLabel: "Department",
    route: "/admin/discharge/concern-department",
    icon: Building2,
  },
  {
    key: "concern_authority",
    label: "Concern Authority",
    shortLabel: "Authority",
    route: "/admin/discharge/concern-authority",
    icon: Users,
  },
  {
    key: "billing_final_discharge",
    label: "Billing and Final Discharge",
    shortLabel: "Billing",
    route: "/admin/discharge/bill",
    icon: CheckCircle,
  },
];

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

const formatDuration = (minutes) => {
  const total = Math.max(Math.abs(minutes), 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;

  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
};

const getTimingMeta = (plannedAt, actualAt) => {
  if (!plannedAt)
    return { label: "Not scheduled", tone: "muted", overdue: false };

  const plannedMs = new Date(plannedAt).getTime();
  if (Number.isNaN(plannedMs)) {
    return { label: "Invalid schedule", tone: "muted", overdue: false };
  }

  const compareMs = actualAt ? new Date(actualAt).getTime() : Date.now();
  if (Number.isNaN(compareMs)) {
    return { label: "Invalid timing", tone: "muted", overdue: false };
  }

  const diffMinutes = Math.round((compareMs - plannedMs) / 60000);

  if (actualAt) {
    if (Math.abs(diffMinutes) <= 5) {
      return { label: "On time", tone: "success", overdue: false };
    }
    if (diffMinutes > 0) {
      return {
        label: `${formatDuration(diffMinutes)} late`,
        tone: "warning",
        overdue: true,
      };
    }
    return {
      label: `${formatDuration(diffMinutes)} early`,
      tone: "info",
      overdue: false,
    };
  }

  if (diffMinutes > 5) {
    return {
      label: `Overdue by ${formatDuration(diffMinutes)}`,
      tone: "danger",
      overdue: true,
    };
  }
  if (diffMinutes >= -5) {
    return { label: "Due now", tone: "warning", overdue: false };
  }
  return {
    label: `Due in ${formatDuration(diffMinutes)}`,
    tone: "info",
    overdue: false,
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

const getTimingClasses = (tone) => {
  switch (tone) {
    case "success":
      return "text-green-700";
    case "warning":
      return "text-amber-700";
    case "danger":
      return "text-red-700";
    case "info":
      return "text-blue-700";
    default:
      return "text-gray-500";
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
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const resolveStatus = ({ plannedAt, actualAt, blocked = false }) => {
  if (blocked) return "blocked";
  if (actualAt) return "completed";
  if (plannedAt && getTimingMeta(plannedAt, actualAt).overdue) return "overdue";
  if (plannedAt) return "pending";
  return "not_started";
};

const buildStage = (definition, record) => {
  const ipdActualDischarge = record.ipdDetails?.actual1 || null;

  switch (definition.key) {
    case "request_created":
      return {
        ...definition,
        plannedAt: record.planned1 || record.timestamp || null,
        actualAt: record.timestamp || record.planned1 || null,
        owner: record.staff_name || "",
        ownerRole: "Created by",
        result: record.remark || "Discharge request recorded",
        attachmentUrl: null,
        attachmentLabel: "",
        status: "completed",
        timing: { label: "Created", tone: "success", overdue: false },
        note: record.discharge_number
          ? `Discharge No: ${record.discharge_number}`
          : "Workflow initiated",
      };

    case "rmo_initiation": {
      const blocked = record.rmo_status === "Pending Documentation";
      return {
        ...definition,
        plannedAt: record.planned1 || null,
        actualAt: record.actual1 || null,
        owner: record.rmo_name || "",
        ownerRole: "RMO",
        result: record.rmo_status || "Awaiting RMO initiation",
        attachmentUrl: record.summary_report_image || null,
        attachmentLabel: record.summary_report_image_name || "Summary Report",
        status: resolveStatus({
          plannedAt: record.planned1,
          actualAt: record.actual1,
          blocked,
        }),
        timing: getTimingMeta(record.planned1, record.actual1),
        note: blocked ? "Pending documentation is blocking this stage." : "",
      };
    }

    case "complete_file_work": {
      const blocked = record.work_file === "No";
      return {
        ...definition,
        plannedAt: record.planned2 || null,
        actualAt: record.actual2 || null,
        owner: record.staff_name || "",
        ownerRole: "File Desk",
        result: record.work_file || "Awaiting file completion",
        attachmentUrl: null,
        attachmentLabel: "",
        status: resolveStatus({
          plannedAt: record.planned2,
          actualAt: record.actual2,
          blocked,
        }),
        timing: getTimingMeta(record.planned2, record.actual2),
        note: blocked ? "File work was marked as not ready." : "",
      };
    }

    case "concern_department": {
      const blocked = record.concern_dept === "No";
      return {
        ...definition,
        plannedAt: record.planned3 || null,
        actualAt: record.actual3 || null,
        owner: record.staff_name || "",
        ownerRole: "Department",
        result: record.concern_dept || "Awaiting departmental clearance",
        attachmentUrl: null,
        attachmentLabel: "",
        status: resolveStatus({
          plannedAt: record.planned3,
          actualAt: record.actual3,
          blocked,
        }),
        timing: getTimingMeta(record.planned3, record.actual3),
        note: blocked ? "Concern Department rejected or held this case." : "",
      };
    }

    case "concern_authority": {
      const blocked = record.concern_authority_work_file === "No";
      return {
        ...definition,
        plannedAt: record.planned4 || null,
        actualAt: record.actual4 || null,
        owner: record.staff_name || "",
        ownerRole: "Authority",
        result:
          record.concern_authority_work_file || "Awaiting authority clearance",
        attachmentUrl: null,
        attachmentLabel: "",
        status: resolveStatus({
          plannedAt: record.planned4,
          actualAt: record.actual4,
          blocked,
        }),
        timing: getTimingMeta(record.planned4, record.actual4),
        note: blocked
          ? "Concern Authority marked the work file as not ready."
          : "",
      };
    }

    case "billing_final_discharge": {
      const syncPending = record.actual5 && !ipdActualDischarge;
      const blocked = record.bill_status === "No" || syncPending;
      return {
        ...definition,
        plannedAt: record.planned5 || null,
        actualAt: record.actual5 || null,
        owner: record.staff_name || "",
        ownerRole: "Billing",
        result: record.bill_status || "Awaiting billing completion",
        attachmentUrl: record.bill_image || null,
        attachmentLabel: "Bill Document",
        status: resolveStatus({
          plannedAt: record.planned5,
          actualAt: record.actual5,
          blocked,
        }),
        timing: getTimingMeta(record.planned5, record.actual5),
        note: syncPending
          ? "Billing is saved, but IPD discharge sync is still pending."
          : record.bill_status === "No"
            ? "Billing was marked incomplete."
            : "",
      };
    }

    default:
      return {
        ...definition,
        plannedAt: null,
        actualAt: null,
        owner: "",
        ownerRole: "",
        result: "",
        attachmentUrl: null,
        attachmentLabel: "",
        status: "not_started",
        timing: { label: "Not started", tone: "muted", overdue: false },
        note: "",
      };
  }
};

const buildWorkflowCase = (record) => {
  const stages = STAGES.map((definition) => buildStage(definition, record));
  const completedCount = stages.filter(
    (stage) => stage.status === "completed",
  ).length;
  const progress = Math.round((completedCount / stages.length) * 100);
  const currentStage =
    stages.find((stage) => stage.status !== "completed") ||
    stages[stages.length - 1];

  let overallStatus = "in_progress";
  if (completedCount === stages.length) {
    overallStatus = "completed";
  } else if (currentStage.status === "blocked") {
    overallStatus = "blocked";
  } else if (currentStage.status === "overdue") {
    overallStatus = "overdue";
  }

  return {
    ...record,
    ipdNumber: record.ipdDetails?.ipd_number || "",
    bedNo: record.ipdDetails?.bed_no || "",
    wardType: record.ipdDetails?.ward_type || "",
    room: record.ipdDetails?.room || "",
    patientLocation: record.ipdDetails?.patient_location || "",
    stages,
    currentStage,
    progress,
    completedCount,
    totalStages: stages.length,
    overallStatus,
    searchableText: [
      record.patient_name,
      record.admission_no,
      record.ipdDetails?.ipd_number,
      record.ipdDetails?.bed_no,
      record.consultant_name,
      record.department,
      currentStage.label,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
};

const SummaryCard = ({ icon: Icon, label, value, accentClass }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
    <div className="flex items-center gap-3">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentClass}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs tracking-wide text-gray-500 uppercase">{label}</p>
        <h3 className="text-2xl font-semibold text-gray-900">{value}</h3>
      </div>
    </div>
  </div>
);

const StatusPill = ({ status }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${getStatusClasses(status)}`}
  >
    {status === "completed" && <CheckCircle className="h-3.5 w-3.5" />}
    {(status === "blocked" || status === "overdue") && (
      <AlertCircle className="h-3.5 w-3.5" />
    )}
    {status === "pending" && <Clock className="h-3.5 w-3.5" />}
    {status === "not_started" && <Activity className="h-3.5 w-3.5" />}
    {status === "completed"
      ? "Completed"
      : status === "blocked"
        ? "Blocked"
        : status === "overdue"
          ? "Overdue"
          : status === "pending"
            ? "Pending"
            : "Not Started"}
  </span>
);

const WorkflowStepper = ({ stages, currentStageKey }) => (
  <div className="pb-2 overflow-x-auto">
    <div className="flex items-start gap-2 min-w-max">
      {stages.map((stage, index) => {
        const Icon = stage.icon;
        const isCurrent = stage.key === currentStageKey;

        return (
          <React.Fragment key={stage.key}>
            <div className="min-w-[132px]">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-all ${
                    isCurrent
                      ? "border-green-300 bg-green-50 text-green-700 ring-4 ring-green-100"
                      : getStatusClasses(stage.status)
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">
                    {stage.shortLabel}
                  </p>
                  <p
                    className={`text-[11px] ${getTimingClasses(stage.timing.tone)}`}
                  >
                    {stage.status === "completed" ? "Done" : stage.timing.label}
                  </p>
                </div>
              </div>
            </div>
            {index < stages.length - 1 && (
              <div className="mt-4 h-0.5 w-9 flex-shrink-0 rounded-full bg-gray-200" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  </div>
);

const StageDetailCard = ({
  stage,
  isCurrent,
  onOpenStage,
  onOpenAttachment,
}) => {
  const planned = formatDateTime(stage.plannedAt);
  const actual = formatDateTime(stage.actualAt);

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${
        isCurrent ? "border-green-200 ring-1 ring-green-100" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{stage.label}</p>
          <p className="mt-1 text-xs text-gray-500">
            {stage.ownerRole || "Workflow stage"}
          </p>
        </div>
        <StatusPill status={stage.status} />
      </div>

      <div className="space-y-2 text-xs text-gray-600">
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500">Planned</span>
          <span className="font-medium text-right text-gray-800">
            {planned.date} {planned.time}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500">Actual</span>
          <span className="font-medium text-right text-gray-800">
            {actual.date} {actual.time}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500">Timing</span>
          <span
            className={`text-right font-medium ${getTimingClasses(stage.timing.tone)}`}
          >
            {stage.timing.label}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-gray-500">Result</span>
          <span className="font-medium text-right text-gray-800">
            {stage.result || "-"}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-gray-500">Owner</span>
          <span className="font-medium text-right text-gray-800">
            {stage.owner || "-"}
          </span>
        </div>
      </div>

      {stage.note && (
        <div className="px-3 py-2 mt-3 text-xs border rounded-lg border-amber-200 bg-amber-50 text-amber-800">
          {stage.note}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button
          type="button"
          onClick={() => onOpenStage(stage)}
          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-700 transition-all border border-gray-200 rounded-lg bg-gray-50 hover:border-green-200 hover:bg-green-50 hover:text-green-700"
        >
          Open Stage
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        {stage.attachmentUrl && (
          <button
            type="button"
            onClick={() => onOpenAttachment(stage)}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-700 transition-all bg-white border border-gray-200 rounded-lg hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <FileText className="h-3.5 w-3.5" />
            {stage.attachmentLabel || "View Attachment"}
          </button>
        )}
      </div>
    </div>
  );
};

const PatientWorkflowCard = ({
  workflow,
  isExpanded,
  onToggle,
  onOpenStage,
  onOpenAttachment,
}) => {
  const currentStageClasses = getStatusClasses(workflow.currentStage.status);

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
        workflow.overallStatus === "blocked"
          ? "border-red-200"
          : workflow.overallStatus === "overdue"
            ? "border-amber-200"
            : isExpanded
              ? "border-green-200 ring-1 ring-green-100"
              : "border-gray-200"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-green-50/40 md:px-5"
      >
        <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 text-sm font-semibold text-gray-700 bg-gray-100 rounded-full">
          {getInitials(workflow.patient_name)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {workflow.patient_name || "Unknown Patient"}
            </h3>
            <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
              Admission: {workflow.admission_no || "N/A"}
            </span>
            {workflow.ipdNumber && (
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                IPD: {workflow.ipdNumber}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Bed className="h-3.5 w-3.5 text-gray-400" />
              Bed {workflow.bedNo || "N/A"}
            </span>
            <span>{workflow.department || "Department N/A"}</span>
            <span>
              {workflow.wardType || workflow.room
                ? `${workflow.wardType || ""} ${workflow.room || ""}`.trim()
                : "Location N/A"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${currentStageClasses}`}
            >
              Current: {workflow.currentStage.shortLabel}
            </span>
            <StatusPill
              status={
                workflow.overallStatus === "in_progress"
                  ? "pending"
                  : workflow.overallStatus
              }
            />
          </div>
        </div>

        <div className="flex-shrink-0 hidden w-40 sm:block">
          <div className="flex items-center justify-between mb-1 text-xs font-medium text-gray-600">
            <span>
              {workflow.completedCount}/{workflow.totalStages}
            </span>
            <span>{workflow.progress}%</span>
          </div>
          <div className="h-2 overflow-hidden bg-gray-100 rounded-full">
            <div
              className={`h-full rounded-full transition-all ${getProgressColor(workflow.progress)}`}
              style={{ width: `${workflow.progress}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[11px] text-gray-500">
            {workflow.currentStage.status === "completed"
              ? "Completed"
              : workflow.currentStage.timing.label}
          </p>
        </div>

        <div className="flex-shrink-0 text-gray-400">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>

      <div className="px-4 pb-4 sm:hidden">
        <div className="flex items-center justify-between mb-1 text-xs font-medium text-gray-600">
          <span>
            {workflow.completedCount}/{workflow.totalStages} complete
          </span>
          <span>{workflow.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden bg-gray-100 rounded-full">
          <div
            className={`h-full rounded-full ${getProgressColor(workflow.progress)}`}
            style={{ width: `${workflow.progress}%` }}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 py-4 border-t border-gray-100 animate-fade-in bg-gray-50/40 md:px-5">
          <div className="p-4 mb-4 bg-white border border-gray-200 rounded-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Workflow Progress
                </p>
                <p className="text-xs text-gray-500">
                  Follow the discharge path from request to billing closure.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenStage(workflow.currentStage)}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white transition-all bg-green-600 rounded-lg hover:bg-green-700"
              >
                Open Current Stage
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <WorkflowStepper
              stages={workflow.stages}
              currentStageKey={workflow.currentStage.key}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {workflow.stages.map((stage) => (
              <StageDetailCard
                key={stage.key}
                stage={stage}
                isCurrent={stage.key === workflow.currentStage.key}
                onOpenStage={onOpenStage}
                onOpenAttachment={onOpenAttachment}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DischargeWorkflowDashboard = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [expandedCase, setExpandedCase] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [visibleCount, setVisibleCount] = useState(12);

  const fetchWorkflowData = useCallback(async () => {
    try {
      setLoading(true);

      const { data: dischargeData, error: dischargeError } = await supabase
        .from("discharge")
        .select("*")
        .order("timestamp", { ascending: false });

      if (dischargeError) throw dischargeError;

      const admissionNumbers = [
        ...new Set(
          (dischargeData || [])
            .map((record) => record.admission_no)
            .filter(Boolean),
        ),
      ];

      const { data: ipdData, error: ipdError } = admissionNumbers.length
        ? await supabase
            .from("ipd_admissions")
            .select(
              "admission_no, ipd_number, bed_no, ward_type, room, bed_location, actual1",
            )
            .in("admission_no", admissionNumbers)
        : { data: [], error: null };

      if (ipdError) throw ipdError;

      const ipdMap = {};
      (ipdData || []).forEach((item) => {
        ipdMap[normalizeKey(item.admission_no)] = item;
      });

      const merged = (dischargeData || []).map((record) => ({
        ...record,
        ipdDetails: ipdMap[normalizeKey(record.admission_no)] || null,
      }));

      setRecords(merged);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error loading discharge workflow dashboard:", error);
      showNotification("Error loading discharge workflow dashboard", "error");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useRealtimeTable("discharge", fetchWorkflowData);
  useRealtimeTable("ipd_admissions", fetchWorkflowData);

  useEffect(() => {
    fetchWorkflowData();
  }, [fetchWorkflowData]);

  const workflows = useMemo(
    () => records.map((record) => buildWorkflowCase(record)),
    [records],
  );

  const departments = useMemo(
    () =>
      [
        ...new Set(
          workflows.map((workflow) => workflow.department).filter(Boolean),
        ),
      ].sort(),
    [workflows],
  );

  const filteredWorkflows = useMemo(
    () =>
      workflows.filter((workflow) => {
        const matchesSearch = searchTerm.trim()
          ? workflow.searchableText.includes(searchTerm.toLowerCase())
          : true;
        const matchesStage =
          stageFilter === "all" || workflow.currentStage.key === stageFilter;
        const matchesStatus =
          statusFilter === "all" || workflow.overallStatus === statusFilter;
        const matchesDepartment =
          departmentFilter === "all" ||
          workflow.department === departmentFilter;

        return (
          matchesSearch && matchesStage && matchesStatus && matchesDepartment
        );
      }),
    [workflows, searchTerm, stageFilter, statusFilter, departmentFilter],
  );

  const visibleWorkflows = useMemo(
    () => filteredWorkflows.slice(0, visibleCount),
    [filteredWorkflows, visibleCount],
  );

  const stats = useMemo(() => {
    const total = workflows.length;
    const completed = workflows.filter(
      (workflow) => workflow.overallStatus === "completed",
    ).length;
    const blocked = workflows.filter(
      (workflow) => workflow.overallStatus === "blocked",
    ).length;
    const overdue = workflows.filter(
      (workflow) => workflow.overallStatus === "overdue",
    ).length;
    const active = total - completed;
    const atBilling = workflows.filter(
      (workflow) => workflow.currentStage.key === "billing_final_discharge",
    ).length;

    return { total, completed, blocked, overdue, active, atBilling };
  }, [workflows]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 240 &&
        visibleCount < filteredWorkflows.length
      ) {
        setVisibleCount((previous) =>
          Math.min(previous + 12, filteredWorkflows.length),
        );
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [visibleCount, filteredWorkflows.length]);

  useEffect(() => {
    setVisibleCount(12);
  }, [searchTerm, stageFilter, statusFilter, departmentFilter]);

  const handleOpenStage = (stage) => {
    navigate(stage.route);
  };

  const handleOpenAttachment = (stage) => {
    if (!stage.attachmentUrl) return;

    setAttachmentPreview({
      url: stage.attachmentUrl,
      label: stage.attachmentLabel || stage.label,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 text-gray-800 bg-gray-50 sm:p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-2 border-gray-200 rounded-full border-t-green-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading discharge workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 text-gray-800 bg-gray-50 sm:p-6">
      <div className="mx-auto space-y-6 max-w-7xl">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-light text-gray-800 md:text-2xl">
                Discharge Workflow Dashboard
              </h1>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Live updates enabled
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Unified monitoring view for discharge request, initiation, file
              work, clearances, and billing.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchWorkflowData}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs text-gray-600 transition-all bg-white border border-gray-200 rounded-lg hover:border-green-200 hover:text-green-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-600">
          <span>Active: {stats.active}</span>
          <span>Completed: {stats.completed}</span>
          <span>Blocked: {stats.blocked}</span>
          <span>Overdue: {stats.overdue}</span>
          <span>At Billing: {stats.atBilling}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
          <SummaryCard
            icon={Users}
            label="Cases"
            value={stats.total}
            accentClass="bg-green-50 text-green-700"
          />
          <SummaryCard
            icon={Clock}
            label="Active"
            value={stats.active}
            accentClass="bg-blue-50 text-blue-700"
          />
          <SummaryCard
            icon={AlertCircle}
            label="Blocked"
            value={stats.blocked}
            accentClass="bg-red-50 text-red-700"
          />
          <SummaryCard
            icon={Activity}
            label="Overdue"
            value={stats.overdue}
            accentClass="bg-amber-50 text-amber-700"
          />
          <SummaryCard
            icon={CheckCircle}
            label="Completed"
            value={stats.completed}
            accentClass="bg-emerald-50 text-emerald-700"
          />
        </div>

        <div className="sticky top-0 z-20 pb-3 bg-gray-50">
          <div className="p-3 bg-white border border-gray-200 shadow-sm rounded-xl">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search patient, admission, IPD, bed, consultant..."
                  className="w-full py-2 pr-3 text-sm text-gray-700 placeholder-gray-400 transition-all border border-gray-200 rounded-lg pl-9 focus:border-green-300 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <select
                  value={stageFilter}
                  onChange={(event) => setStageFilter(event.target.value)}
                  className="w-full py-2 pr-8 text-sm text-gray-700 transition-all bg-white border border-gray-200 rounded-lg appearance-none pl-9 focus:border-green-300 focus:ring-2 focus:ring-green-200"
                >
                  <option value="all">All stages</option>
                  {STAGES.map((stage) => (
                    <option key={stage.key} value={stage.key}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-700 transition-all bg-white border border-gray-200 rounded-lg focus:border-green-300 focus:ring-2 focus:ring-green-200"
                >
                  <option value="all">All statuses</option>
                  <option value="in_progress">In progress</option>
                  <option value="overdue">Overdue</option>
                  <option value="blocked">Blocked</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <select
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-700 transition-all bg-white border border-gray-200 rounded-lg focus:border-green-300 focus:ring-2 focus:ring-green-200"
                >
                  <option value="all">All departments</option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredWorkflows.length === 0 ? (
            <div className="p-12 text-center bg-white border border-gray-200 shadow-sm rounded-2xl">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-700">
                No discharge cases match your filters
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Try widening the search, status, stage, or department filters.
              </p>
            </div>
          ) : (
            visibleWorkflows.map((workflow) => (
              <PatientWorkflowCard
                key={workflow.id}
                workflow={workflow}
                isExpanded={expandedCase === workflow.id}
                onToggle={() =>
                  setExpandedCase((previous) =>
                    previous === workflow.id ? null : workflow.id,
                  )
                }
                onOpenStage={handleOpenStage}
                onOpenAttachment={handleOpenAttachment}
              />
            ))
          )}
        </div>

        {visibleWorkflows.length < filteredWorkflows.length && (
          <div className="py-4 text-sm text-center text-gray-500">
            Loading more...
          </div>
        )}

        {filteredWorkflows.length > 0 && (
          <div className="flex flex-col gap-2 pt-3 text-xs text-gray-500 border-t border-gray-200 sm:flex-row sm:items-center sm:justify-between">
            <p>Last updated: {lastUpdated.toLocaleTimeString()}</p>
            <p>
              Showing {visibleWorkflows.length} of {filteredWorkflows.length}
            </p>
          </div>
        )}
      </div>

      {attachmentPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setAttachmentPreview(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {attachmentPreview.label}
                </p>
                <p className="text-xs text-gray-500">Attachment preview</p>
              </div>
              <button
                type="button"
                onClick={() => setAttachmentPreview(null)}
                className="p-2 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-4 overflow-auto bg-gray-50">
              {attachmentPreview.url.toLowerCase().includes(".pdf") ? (
                <iframe
                  src={attachmentPreview.url}
                  title={attachmentPreview.label}
                  className="h-[72vh] w-full rounded-xl border border-gray-200 bg-white"
                />
              ) : (
                <img
                  src={attachmentPreview.url}
                  alt={attachmentPreview.label}
                  className="mx-auto max-h-[72vh] w-auto rounded-xl border border-gray-200 bg-white object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.25s ease;
        }
      `}</style>
    </div>
  );
};

export default DischargeWorkflowDashboard;
