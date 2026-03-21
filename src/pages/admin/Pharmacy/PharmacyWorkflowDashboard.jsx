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
import supabase from "../../../SupabaseClient";
import useRealtimeTable from "../../../hooks/useRealtimeTable";
import { useNotification } from "../../../contexts/NotificationContext";

const STAGES = [
  {
    key: "request_received",
    label: "Prescription Received",
    shortLabel: "Received",
    route: "/admin/pharmacy/indent",
    icon: ClipboardList,
  },
  {
    key: "medication_verification",
    label: "Medication Verification",
    shortLabel: "Verification",
    route: "/admin/pharmacy/approval",
    icon: FileText,
  },
  {
    key: "dispensing_queue",
    label: "Inventory and Dispensing",
    shortLabel: "Dispensing",
    route: "/admin/pharmacy/store",
    icon: Pill,
  },
  {
    key: "completed",
    label: "Completed",
    shortLabel: "Done",
    route: "/admin/pharmacy/store",
    icon: CheckCircle,
  },
];

const REQUEST_TYPE_LABELS = {
  medicineSlip: "Medicine Slip",
  investigation: "Investigation",
  package: "Package",
  nonPackage: "Non-Package",
};

const parseJsonField = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    console.error("Error parsing pharmacy JSON field:", error);
    return fallback;
  }
};

const normalizeStatus = (value) => String(value || "pending").trim().toLowerCase();

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
  if (!plannedAt) {
    return { label: "Not scheduled", tone: "muted", overdue: false };
  }

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

const getDashboardClasses = (status) => {
  switch (status) {
    case "completed":
      return "bg-green-50 text-green-700 border-green-200";
    case "rejected":
      return "bg-red-50 text-red-700 border-red-200";
    case "overdue":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "ready_to_dispense":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "pending_review":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-gray-50 text-gray-600 border-gray-200";
  }
};

const getDashboardLabel = (status) => {
  switch (status) {
    case "completed":
      return "Completed";
    case "rejected":
      return "Rejected";
    case "overdue":
      return "Delayed";
    case "ready_to_dispense":
      return "Ready to Dispense";
    case "pending_review":
      return "Pending Review";
    default:
      return "Active";
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

const getRequestTypeLabels = (requestTypes) =>
  Object.entries(REQUEST_TYPE_LABELS)
    .filter(([key]) => requestTypes?.[key])
    .map(([, label]) => label);

const buildStage = (definition, order) => {
  const status = normalizeStatus(order.status);
  const slipUrl = order.slip_image || order.slip_image_url || null;

  switch (definition.key) {
    case "request_received":
      return {
        ...definition,
        plannedAt: order.planned1 || order.timestamp || null,
        actualAt: order.timestamp || order.planned1 || null,
        owner: order.staff_name || "",
        ownerRole: "Requested by",
        result:
          order.requestTypeLabels.length > 0
            ? order.requestTypeLabels.join(", ")
            : "Order created",
        attachmentUrl: null,
        attachmentLabel: "",
        status: "completed",
        timing: { label: "Created", tone: "success", overdue: false },
        note: order.indent_no ? `Indent No: ${order.indent_no}` : "Workflow initiated",
      };

    case "medication_verification": {
      const blocked = status === "rejected";
      return {
        ...definition,
        plannedAt: order.planned1 || null,
        actualAt: order.actual1 || null,
        owner: order.approved_by || "",
        ownerRole: "Verified by",
        result:
          status === "approved"
            ? "Approved"
            : blocked
              ? "Rejected"
              : "Awaiting pharmacist/admin review",
        attachmentUrl: slipUrl,
        attachmentLabel: slipUrl ? "View Pharmacy Slip" : "",
        status: resolveStatus({
          plannedAt: order.planned1,
          actualAt: status === "approved" ? order.actual1 : null,
          blocked,
        }),
        timing: getTimingMeta(order.planned1, order.actual1),
        note: blocked
          ? "This order was rejected during verification."
          : status === "approved" && !slipUrl
            ? "Approved, but no slip attachment is available."
            : "",
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
        result: blocked
          ? "Not forwarded to store"
          : order.actual2
            ? "Dispensed"
            : order.planned2
              ? "Awaiting dispensing"
              : "Waiting for approval",
        attachmentUrl: slipUrl,
        attachmentLabel: slipUrl ? "View Pharmacy Slip" : "",
        status: resolveStatus({
          plannedAt: order.planned2,
          actualAt: order.actual2,
          blocked,
        }),
        timing: getTimingMeta(order.planned2, order.actual2),
        note:
          order.planned2 && !order.actual2
            ? "Current schema does not separate inventory check from store confirmation."
            : "",
      };
    }

    case "completed":
      return {
        ...definition,
        plannedAt: order.planned2 || null,
        actualAt: order.actual2 || null,
        owner: "",
        ownerRole: "Completion",
        result: status === "rejected" ? "Closed as rejected" : order.actual2 ? "Completed" : "Awaiting completion",
        attachmentUrl: slipUrl,
        attachmentLabel: slipUrl ? "View Pharmacy Slip" : "",
        status:
          status === "rejected"
            ? "blocked"
            : order.actual2
              ? "completed"
              : "not_started",
        timing: order.actual2
          ? getTimingMeta(order.planned2, order.actual2)
          : { label: "Final confirmation pending", tone: "muted", overdue: false },
        note:
          order.actual2 && !order.dispensed_by
            ? "Store handler is not captured in the current schema."
            : "",
      };

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

const getDashboardStatus = (order, currentStage) => {
  const status = normalizeStatus(order.status);

  if (status === "rejected") return "rejected";
  if (order.actual2) return "completed";
  if (currentStage.status === "overdue") return "overdue";
  if (currentStage.key === "medication_verification") return "pending_review";
  if (currentStage.key === "dispensing_queue" || currentStage.key === "completed") {
    return "ready_to_dispense";
  }
  return "active";
};

const buildWorkflowOrder = (row) => {
  const requestTypes = parseJsonField(row.request_types, {});
  const medicines = parseJsonField(row.medicines, []);
  const investigations = parseJsonField(row.investigations, []);
  const requestTypeLabels = getRequestTypeLabels(requestTypes);
  const medicationCount = Array.isArray(medicines) ? medicines.length : 0;
  const investigationCount = Array.isArray(investigations) ? investigations.length : 0;
  const stages = STAGES.map((definition) =>
    buildStage(definition, {
      ...row,
      requestTypeLabels,
      medicines,
      investigations,
    }),
  );
  const completedCount = stages.filter((stage) => stage.status === "completed").length;
  const progress = Math.round((completedCount / stages.length) * 100);
  const currentStage =
    stages.find((stage) => stage.status !== "completed") || stages[stages.length - 1];
  const dashboardStatus = getDashboardStatus(row, currentStage);

  return {
    ...row,
    status: normalizeStatus(row.status),
    requestTypes,
    requestTypeLabels,
    medicines,
    investigations,
    medicationCount,
    investigationCount,
    stages,
    currentStage,
    completedCount,
    totalStages: stages.length,
    progress,
    dashboardStatus,
    searchableText: [
      row.patient_name,
      row.indent_no,
      row.admission_number,
      row.ipd_number,
      row.consultant_name,
      row.diagnosis,
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
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
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
    {status === "not_started" && <ClipboardList className="h-3.5 w-3.5" />}
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

const WorkflowBadge = ({ status }) => (
  <span
    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDashboardClasses(status)}`}
  >
    {getDashboardLabel(status)}
  </span>
);

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
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-all ${
                    isCurrent
                      ? "border-green-300 bg-green-50 text-green-700 ring-4 ring-green-100"
                      : getStatusClasses(stage.status)
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-800">
                    {stage.shortLabel}
                  </p>
                  <p className={`text-[11px] ${getTimingClasses(stage.timing.tone)}`}>
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
  onHandlerClick,
}) => {
  const planned = formatDateTime(stage.plannedAt);
  const actual = formatDateTime(stage.actualAt);

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${
        isCurrent ? "border-green-200 ring-1 ring-green-100" : "border-gray-200"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{stage.label}</p>
          <p className="mt-1 text-xs text-gray-500">{stage.ownerRole || "Workflow stage"}</p>
        </div>
        <StatusPill status={stage.status} />
      </div>

      <div className="space-y-2 text-xs text-gray-600">
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500">Planned</span>
          <span className="text-right font-medium text-gray-800">
            {planned.date} {planned.time}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500">Actual</span>
          <span className="text-right font-medium text-gray-800">
            {actual.date} {actual.time}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-gray-500">Timing</span>
          <span className={`text-right font-medium ${getTimingClasses(stage.timing.tone)}`}>
            {stage.timing.label}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-gray-500">Result</span>
          <span className="text-right font-medium text-gray-800">
            {stage.result || "-"}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-gray-500">Handler</span>
          {stage.owner ? (
            <button
              type="button"
              onClick={() => onHandlerClick(stage)}
              className="text-right font-medium text-green-700 underline-offset-2 hover:text-green-800 hover:underline"
            >
              {stage.owner}
            </button>
          ) : (
            <span className="text-right font-medium text-gray-500">Not recorded</span>
          )}
        </div>
      </div>

      {stage.note && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {stage.note}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenStage(stage)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 transition-all hover:border-green-200 hover:bg-green-50 hover:text-green-700"
        >
          Open Stage
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        {stage.attachmentUrl && (
          <button
            type="button"
            onClick={() => onOpenAttachment(stage)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <FileText className="h-3.5 w-3.5" />
            {stage.attachmentLabel || "View Attachment"}
          </button>
        )}
      </div>
    </div>
  );
};

const PharmacyOrderCard = ({
  workflow,
  isExpanded,
  onToggle,
  onOpenStage,
  onOpenAttachment,
  onHandlerClick,
}) => {
  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
        workflow.dashboardStatus === "rejected"
          ? "border-red-200"
          : workflow.dashboardStatus === "overdue"
            ? "border-amber-200"
            : isExpanded
              ? "border-green-200 ring-1 ring-green-100"
              : "border-gray-200"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-green-50/40 md:px-5"
      >
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
          {getInitials(workflow.patient_name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-gray-900">
              {workflow.patient_name || "Unknown Patient"}
            </h3>
            <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
              Indent: {workflow.indent_no || "N/A"}
            </span>
            {workflow.ipd_number && (
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                IPD: {workflow.ipd_number}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span>Admission {workflow.admission_number || "N/A"}</span>
            <span>{workflow.ward_location || "Ward N/A"}</span>
            <span>{workflow.consultant_name || "Consultant N/A"}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {workflow.requestTypeLabels.map((label) => (
              <span
                key={`${workflow.id}-${label}`}
                className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <WorkflowBadge status={workflow.dashboardStatus} />
            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600">
              Current: {workflow.currentStage.shortLabel}
            </span>
          </div>
        </div>

        <div className="hidden w-40 flex-shrink-0 sm:block">
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-gray-600">
            <span>
              {workflow.completedCount}/{workflow.totalStages}
            </span>
            <span>{workflow.progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
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
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </div>
      </button>

      <div className="px-4 pb-4 sm:hidden">
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-gray-600">
          <span>
            {workflow.completedCount}/{workflow.totalStages} complete
          </span>
          <span>{workflow.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${getProgressColor(workflow.progress)}`}
            style={{ width: `${workflow.progress}%` }}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="animate-fade-in border-t border-gray-100 bg-gray-50/40 px-4 py-4 md:px-5">
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-600 md:grid-cols-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">
                    Medicines
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {workflow.medicationCount}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">
                    Investigations
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {workflow.investigationCount}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">
                    Category
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {workflow.category || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">
                    Room
                  </p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {workflow.room || "N/A"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenStage(workflow.currentStage)}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-green-700"
              >
                Open Current Stage
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {workflow.diagnosis && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                <span className="font-semibold text-gray-900">Diagnosis:</span>{" "}
                {workflow.diagnosis}
              </div>
            )}

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
                onHandlerClick={onHandlerClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PharmacyWorkflowDashboard = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [rawOrders, setRawOrders] = useState([]);
  const [handlerMap, setHandlerMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [requestTypeFilter, setRequestTypeFilter] = useState("all");
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [activeHandler, setActiveHandler] = useState(null);
  const [showHandlerSheet, setShowHandlerSheet] = useState(false);
  const [isTabletOrMobile, setIsTabletOrMobile] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState(null);

  useEffect(() => {
    const checkDevice = () => {
      setIsTabletOrMobile(window.innerWidth < 1024);
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [{ data: pharmacyData, error: pharmacyError }, { data: staffData, error: staffError }] =
        await Promise.all([
          supabase.from("pharmacy").select("*").order("timestamp", { ascending: false }),
          supabase.from("all_staff").select("name, phone_number"),
        ]);

      if (pharmacyError) throw pharmacyError;
      if (staffError) {
        console.error("Error loading pharmacy handler contacts:", staffError);
      }

      const contacts = {};
      (staffData || []).forEach((member) => {
        contacts[member.name] = member.phone_number || "";
      });

      setRawOrders(pharmacyData || []);
      setHandlerMap(contacts);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error loading pharmacy workflow dashboard:", error);
      showNotification("Error loading pharmacy workflow dashboard", "error");
      setRawOrders([]);
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useRealtimeTable("pharmacy", fetchDashboardData);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const workflows = useMemo(
    () => rawOrders.map((row) => buildWorkflowOrder(row)),
    [rawOrders],
  );

  const filteredWorkflows = useMemo(
    () =>
      workflows.filter((workflow) => {
        const matchesSearch = searchTerm.trim()
          ? workflow.searchableText.includes(searchTerm.toLowerCase())
          : true;
        const matchesStatus =
          statusFilter === "all" || workflow.dashboardStatus === statusFilter;
        const matchesStage =
          stageFilter === "all" || workflow.currentStage.key === stageFilter;
        const matchesRequestType =
          requestTypeFilter === "all" || workflow.requestTypes?.[requestTypeFilter];

        return matchesSearch && matchesStatus && matchesStage && matchesRequestType;
      }),
    [workflows, searchTerm, statusFilter, stageFilter, requestTypeFilter],
  );

  const visibleWorkflows = useMemo(
    () => filteredWorkflows.slice(0, visibleCount),
    [filteredWorkflows, visibleCount],
  );

  const stats = useMemo(() => {
    const totalOrders = workflows.length;
    const pendingReview = workflows.filter(
      (workflow) => workflow.dashboardStatus === "pending_review",
    ).length;
    const readyToDispense = workflows.filter(
      (workflow) => workflow.dashboardStatus === "ready_to_dispense",
    ).length;
    const delayed = workflows.filter(
      (workflow) => workflow.dashboardStatus === "overdue",
    ).length;
    const completed = workflows.filter(
      (workflow) => workflow.dashboardStatus === "completed",
    ).length;

    return { totalOrders, pendingReview, readyToDispense, delayed, completed };
  }, [workflows]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 220 &&
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
  }, [searchTerm, statusFilter, stageFilter, requestTypeFilter]);

  const handleOpenStage = (stage) => {
    navigate(stage.route);
  };

  const handleHandlerClick = (stage) => {
    if (!stage.owner) return;

    setActiveHandler({
      name: stage.owner,
      role: stage.ownerRole || "Handler",
      phone: handlerMap[stage.owner] || "",
    });

    if (isTabletOrMobile) {
      setShowHandlerSheet(true);
    }
  };

  const handleOpenAttachment = (stage) => {
    if (!stage.attachmentUrl) return;

    setAttachmentPreview({
      url: stage.attachmentUrl,
      label: stage.attachmentLabel || stage.label,
    });
  };

  const closeHandlerCard = () => {
    setActiveHandler(null);
    setShowHandlerSheet(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 text-gray-800 sm:p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full border-2 border-gray-200 border-t-green-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading pharmacy workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 text-gray-800 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-light text-gray-800 md:text-2xl">
                Pharmacy Workflow Dashboard
              </h1>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                Live updates enabled
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Monitor pharmacy requests from prescription receipt through verification
              and dispensing.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 transition-all hover:border-green-200 hover:text-green-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-600">
          <span>Orders: {stats.totalOrders}</span>
          <span>Pending Review: {stats.pendingReview}</span>
          <span>Ready to Dispense: {stats.readyToDispense}</span>
          <span>Delayed: {stats.delayed}</span>
          <span>Completed: {stats.completed}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
          <SummaryCard
            icon={ClipboardList}
            label="Orders"
            value={stats.totalOrders}
            accentClass="bg-green-50 text-green-700"
          />
          <SummaryCard
            icon={FileText}
            label="Pending Review"
            value={stats.pendingReview}
            accentClass="bg-purple-50 text-purple-700"
          />
          <SummaryCard
            icon={Pill}
            label="Ready"
            value={stats.readyToDispense}
            accentClass="bg-blue-50 text-blue-700"
          />
          <SummaryCard
            icon={AlertCircle}
            label="Delayed"
            value={stats.delayed}
            accentClass="bg-amber-50 text-amber-700"
          />
          <SummaryCard
            icon={CheckCircle}
            label="Completed"
            value={stats.completed}
            accentClass="bg-emerald-50 text-emerald-700"
          />
        </div>

        <div className="sticky top-0 z-20 bg-gray-50 pb-3">
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search patient, indent, admission, IPD, consultant..."
                  className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 transition-all focus:border-green-300 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm text-gray-700 transition-all focus:border-green-300 focus:ring-2 focus:ring-green-200"
                >
                  <option value="all">All statuses</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="ready_to_dispense">Ready to Dispense</option>
                  <option value="overdue">Delayed</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <select
                  value={stageFilter}
                  onChange={(event) => setStageFilter(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-all focus:border-green-300 focus:ring-2 focus:ring-green-200"
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
                  value={requestTypeFilter}
                  onChange={(event) => setRequestTypeFilter(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-all focus:border-green-300 focus:ring-2 focus:ring-green-200"
                >
                  <option value="all">All request types</option>
                  {Object.entries(REQUEST_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredWorkflows.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              <Pill className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-700">
                No pharmacy orders match your filters
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Try widening the search, status, stage, or request type filters.
              </p>
            </div>
          ) : (
            visibleWorkflows.map((workflow) => (
              <PharmacyOrderCard
                key={workflow.id}
                workflow={workflow}
                isExpanded={expandedOrder === workflow.id}
                onToggle={() =>
                  setExpandedOrder((previous) =>
                    previous === workflow.id ? null : workflow.id,
                  )
                }
                onOpenStage={handleOpenStage}
                onOpenAttachment={handleOpenAttachment}
                onHandlerClick={handleHandlerClick}
              />
            ))
          )}
        </div>

        {visibleWorkflows.length < filteredWorkflows.length && (
          <div className="py-4 text-center text-sm text-gray-500">Loading more...</div>
        )}

        {filteredWorkflows.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-gray-200 pt-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <p>Last updated: {lastUpdated.toLocaleTimeString()}</p>
            <p>
              Showing {visibleWorkflows.length} of {filteredWorkflows.length}
            </p>
          </div>
        )}
      </div>

      {activeHandler && !isTabletOrMobile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          onClick={closeHandlerCard}
        >
          <div
            className="w-72 rounded-2xl border border-green-100 bg-white p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{activeHandler.name}</p>
                <p className="mt-1 text-xs text-gray-500">{activeHandler.role}</p>
              </div>
              <button
                type="button"
                onClick={closeHandlerCard}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span>{activeHandler.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span>{activeHandler.phone || "No phone number available"}</span>
              </div>
            </div>

            {activeHandler.phone && (
              <div className="mt-4 flex gap-2">
                <a
                  href={`tel:${activeHandler.phone}`}
                  className="flex-1 rounded-lg bg-green-50 px-3 py-2 text-center text-xs font-medium text-green-700 hover:bg-green-100"
                >
                  Call
                </a>
                <a
                  href={`https://wa.me/${String(activeHandler.phone).replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg bg-green-50 px-3 py-2 text-center text-xs font-medium text-green-700 hover:bg-green-100"
                >
                  WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {showHandlerSheet && activeHandler && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/20"
          onClick={closeHandlerCard}
        >
          <div
            className="w-full rounded-t-3xl bg-white p-5 shadow-xl animate-slide-up"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200" />
            <div className="text-center">
              <p className="text-base font-semibold text-gray-900">{activeHandler.name}</p>
              <p className="mt-1 text-xs text-gray-500">{activeHandler.role}</p>
              <p className="mt-3 text-sm text-gray-600">
                {activeHandler.phone || "No phone number available"}
              </p>
            </div>

            {activeHandler.phone && (
              <div className="mt-5 flex gap-3">
                <a
                  href={`tel:${activeHandler.phone}`}
                  className="flex-1 rounded-lg bg-green-50 px-4 py-2.5 text-center text-sm font-medium text-green-700 hover:bg-green-100"
                >
                  Call
                </a>
                <a
                  href={`https://wa.me/${String(activeHandler.phone).replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg bg-green-50 px-4 py-2.5 text-center text-sm font-medium text-green-700 hover:bg-green-100"
                >
                  WhatsApp
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={closeHandlerCard}
              className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm text-gray-500"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {attachmentPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setAttachmentPreview(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {attachmentPreview.label}
                </p>
                <p className="text-xs text-gray-500">Attachment preview</p>
              </div>
              <button
                type="button"
                onClick={() => setAttachmentPreview(null)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 p-4">
              {String(attachmentPreview.url).toLowerCase().includes(".pdf") ? (
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

        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.25s ease;
        }

        .animate-slide-up {
          animation: slideUp 0.25s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PharmacyWorkflowDashboard;
