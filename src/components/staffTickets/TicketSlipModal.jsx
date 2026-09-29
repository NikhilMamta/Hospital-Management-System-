import React, { useEffect, useState } from "react";
import { X, Printer, Check, AlertCircle, FileText } from "lucide-react";
import {
  formatISTDateTime,
  formatDelayText,
  checkEarlierLodgedGrievance,
  fetchAssigneesForCategory,
  fetchTicketDetails,
} from "../../api/staffTickets";
import supabase from "../../SupabaseClient";
import hospitalLogo from "../../Image/logo.png";

/**
 * Grievance Redressal Slip Modal
 * Optimized component for A4 print layout.
 * Formatted with window.print() and @media print CSS for clean output.
 */
const TicketSlipModal = ({ ticket, updates = [], attachments = [], isOpen, onClose }) => {
  const [earlierHistory, setEarlierHistory] = useState({ lodgedEarlier: false, previousTickets: [] });
  const [assignees, setAssignees] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [localUpdates, setLocalUpdates] = useState(updates || []);
  const [localAttachments, setLocalAttachments] = useState(attachments || []);

  // Sync state if props change with items
  useEffect(() => {
    if (updates && updates.length > 0) {
      setLocalUpdates(updates);
    }
  }, [updates]);

  useEffect(() => {
    if (attachments && attachments.length > 0) {
      setLocalAttachments(attachments);
    }
  }, [attachments]);

  // Check for duplicate grievances and fetch full ticket updates & attachments
  useEffect(() => {
    if (ticket && isOpen) {
      const loadHistoryAndDetails = async () => {
        setLoadingHistory(true);
        try {
          const res = await checkEarlierLodgedGrievance(ticket.mobile, ticket.category_id, ticket.id);
          setEarlierHistory(res);

          const assList = await fetchAssigneesForCategory(ticket.category_id);
          setAssignees(assList || []);

          // Always fetch full updates and attachments for the ticket
          try {
            const details = await fetchTicketDetails(ticket.id, true);
            if (details) {
              if (details.updates && details.updates.length > 0) {
                setLocalUpdates(details.updates);
              }
              if (details.attachments && details.attachments.length > 0) {
                setLocalAttachments(details.attachments);
              }
            }
          } catch (detailsErr) {
            console.warn("fetchTicketDetails fallback to direct query:", detailsErr);
            const { data: dbUpdates } = await supabase
              .from("staff_ticket_updates")
              .select("*")
              .eq("ticket_id", ticket.id)
              .order("created_at", { ascending: true });
            if (dbUpdates && dbUpdates.length > 0) {
              setLocalUpdates(dbUpdates);
            }

            const { data: dbAttachments } = await supabase
              .from("staff_ticket_attachments")
              .select("*")
              .eq("ticket_id", ticket.id)
              .order("created_at", { ascending: true });
            if (dbAttachments && dbAttachments.length > 0) {
              setLocalAttachments(dbAttachments);
            }
          }
        } catch (e) {
          console.warn("Error fetching slip history & details:", e);
        } finally {
          setLoadingHistory(false);
        }
      };
      loadHistoryAndDetails();
    }
  }, [ticket?.id, isOpen]);

  if (!isOpen || !ticket) return null;

  // Determine current stage (Priority: Completed > Working > Analysis > Open)
  const currentStage = (ticket.status || "open").toLowerCase();

  // Group updates by stage (case-insensitive and tolerant of status naming)
  const analysisUpdates = localUpdates.filter((u) => {
    const s = (u.stage || "").toLowerCase().trim();
    return s === "analysis" || s === "investigation";
  });
  const workingUpdates = localUpdates.filter((u) => {
    const s = (u.stage || "").toLowerCase().trim();
    return s === "working" || s === "in_progress" || s === "wip";
  });
  const completedUpdates = localUpdates.filter((u) => {
    const s = (u.stage || "").toLowerCase().trim();
    return s === "completed" || s === "resolved" || s === "closed";
  });
  const otherUpdates = localUpdates.filter((u) => {
    const s = (u.stage || "").toLowerCase().trim();
    return !["analysis", "investigation", "working", "in_progress", "wip", "completed", "resolved", "closed"].includes(s);
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
      {/* ── Print Specific Styles ───────────────────────────────── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #ticket-slip-print-area, #ticket-slip-print-area * {
            visibility: visible;
          }
          #ticket-slip-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>

      {/* ── Outer Modal Window ─────────────────────────────────── */}
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Top Action Bar (Non-Printable) */}
        <div className="no-print bg-slate-800 text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight">Grievance Redressal Slip</h3>
              <p className="text-xs text-slate-300">Ticket: {ticket.ticket_no}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center shadow transition-colors"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── A4 Printable Document Sheet ───────────────────────── */}
        <div className="overflow-y-auto p-4 sm:p-8 flex-1 bg-slate-50 print:bg-white print:p-0">
          <div
            id="ticket-slip-print-area"
            className="bg-white border border-slate-300 rounded-lg p-6 sm:p-8 mx-auto shadow-sm max-w-[210mm] text-slate-900 print:border-none print:p-0"
            style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif" }}
          >
            {/* Header: Logo & Title */}
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-4">
              <div className="flex items-center space-x-4">
                <img
                  src={hospitalLogo}
                  alt="Hospital Logo"
                  className="h-16 w-auto object-contain"
                  onError={(e) => {
                    // Fallback to online official logo
                    e.target.onerror = null;
                    e.target.src = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Mamta%20Logo%20Background%20Remove-ojjmd6eZMLbOySeQy5Ykg35oIuNXid.jpg";
                  }}
                />
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                    Mamta Super Speciality Hospital
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    Quality Healthcare with Compassion | Process & Grievance Department
                  </p>
                  <p className="text-sm font-extrabold text-blue-700 tracking-wide mt-0.5">
                    STAFF HELP TICKET – GRIEVANCE REDRESSAL SLIP
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="inline-block bg-slate-100 border border-slate-300 rounded px-3 py-1.5 text-right">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Ticket ID</div>
                  <div className="text-lg font-black text-slate-900 tracking-wider">{ticket.ticket_no}</div>
                </div>
                <div className="text-[11px] text-slate-600 mt-1 font-medium">
                  Status: <span className="font-bold uppercase text-slate-800">{ticket.status}</span>
                </div>
              </div>
            </div>

            {/* Date Timestamps Ribbon */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded p-2.5 mb-4 text-xs">
              <div>
                <span className="text-slate-500 font-semibold block text-[10px] uppercase">Raised Date & Time:</span>
                <span className="font-bold text-slate-800">{formatISTDateTime(ticket.created_at)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[10px] uppercase">Planned SLA:</span>
                <span className="font-bold text-slate-800">{formatISTDateTime(ticket.planned_at)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[10px] uppercase">Completed Date:</span>
                <span className="font-bold text-slate-800">
                  {ticket.completed_at ? formatISTDateTime(ticket.completed_at) : "In Progress"}
                </span>
                <span className="ml-1 text-[11px] font-semibold text-emerald-700">
                  ({formatDelayText(ticket.delay_hours, ticket.is_overdue, ticket.status === "completed")})
                </span>
              </div>
            </div>

            {/* Section 1: Details of Complainant */}
            <div className="mb-4">
              <div className="bg-slate-800 text-white px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-t">
                1. Details of Complainant
              </div>
              <div className="border border-t-0 border-slate-300 rounded-b p-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Staff Name:</span>
                  <span className="font-bold text-slate-800">{ticket.staff_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Designation:</span>
                  <span className="font-medium text-slate-800">{ticket.designation || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Department:</span>
                  <span className="font-semibold text-slate-800">{ticket.department || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Contact Number:</span>
                  <span className="font-bold text-slate-800">{ticket.mobile}</span>
                </div>
                {ticket.email && (
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[10px] uppercase">Email:</span>
                    <span className="text-slate-700">{ticket.email}</span>
                  </div>
                )}
                {ticket.is_confidential && (
                  <div className="col-span-2 flex items-center">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded">
                      🔒 CONFIDENTIAL / MANAGEMENT ONLY
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Grievance Details */}
            <div className="mb-4">
              <div className="bg-slate-800 text-white px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-t">
                2. Grievance Classification & Problem Details
              </div>
              <div className="border border-t-0 border-slate-300 rounded-b p-3 text-xs space-y-2.5">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Category:</span>
                    <span className="font-bold text-blue-800 text-sm">{ticket.category_name || "-"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Issue Identified:</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {ticket.issue_name || "Custom Issue"}
                      {ticket.issue_other_text ? ` (${ticket.issue_other_text})` : ""}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                    Description of Grievance:
                  </span>
                  <div className="mt-1 bg-white border border-slate-200 rounded p-2 text-slate-800 whitespace-pre-wrap leading-relaxed text-xs">
                    {ticket.problem_text}
                  </div>
                </div>

                {/* Lodged earlier check */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="font-medium text-slate-700">
                    Has the same grievance been lodged earlier within 90 days?
                  </span>
                  <span className="font-bold">
                    {earlierHistory.lodgedEarlier ? (
                      <span className="text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                        YES (Previous Ticket: {earlierHistory.previousTickets.join(", ")})
                      </span>
                    ) : (
                      <span className="text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                        NO
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Office Use Only - Follow Up & Problem Solving Table */}
            <div className="mb-4">
              <div className="bg-slate-800 text-white px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-t">
                3. For Office Use Only – Action & Resolution Log
              </div>
              <div className="border border-t-0 border-slate-300 rounded-b overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                      <th className="py-2 px-3 w-16 text-center">Current</th>
                      <th className="py-2 px-3 w-28 font-bold">Stage</th>
                      <th className="py-2 px-3 font-bold">Actions Taken & Remarks (Problem Solving)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* Stage 1: Analysis */}
                    <tr className={currentStage === "analysis" ? "bg-amber-50/50" : ""}>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {currentStage === "analysis" && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 text-white text-xs">
                            ✓
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        Analysis
                        <span className="block text-[10px] text-slate-500 font-normal">Initial Investigation</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {analysisUpdates.length > 0 ? (
                          <div className="space-y-1">
                            {analysisUpdates.map((u, i) => (
                              <div key={i} className="text-xs">
                                <span className="font-semibold text-slate-800">
                                  {u.updated_by || u.updated_by_name || u.updated_by_email || "Staff"}
                                </span>{" "}
                                ({formatISTDateTime(u.created_at)}):{" "}
                                <span className="font-medium text-slate-900">
                                  {u.description || u.remarks || u.notes || u.note || u.comment || "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No notes recorded yet</span>
                        )}
                      </td>
                    </tr>

                    {/* Stage 2: Working */}
                    <tr className={currentStage === "working" ? "bg-blue-50/50" : ""}>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {currentStage === "working" && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs">
                            ✓
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        Working
                        <span className="block text-[10px] text-slate-500 font-normal">Work in Progress</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {workingUpdates.length > 0 || otherUpdates.length > 0 ? (
                          <div className="space-y-1.5">
                            {workingUpdates.map((u, i) => (
                              <div key={i} className="text-xs">
                                <span className="font-semibold text-slate-800">
                                  {u.updated_by || u.updated_by_name || u.updated_by_email || "Staff"}
                                </span>{" "}
                                ({formatISTDateTime(u.created_at)}):{" "}
                                <span className="font-medium text-slate-900">
                                  {u.description || u.remarks || u.notes || u.note || u.comment || "—"}
                                </span>
                              </div>
                            ))}
                            {otherUpdates.map((u, i) => (
                              <div key={`other-${i}`} className="text-xs bg-slate-50 border border-slate-200 rounded p-1.5">
                                <span className="font-bold text-slate-700 uppercase text-[9px] bg-slate-200 px-1 py-0.5 rounded mr-1">
                                  {u.stage || "Remark"}
                                </span>
                                <span className="font-semibold text-slate-800">
                                  {u.updated_by || u.updated_by_name || u.updated_by_email || "Staff"}
                                </span>{" "}
                                ({formatISTDateTime(u.created_at)}):{" "}
                                <span className="font-medium text-slate-900">
                                  {u.description || u.remarks || u.notes || u.note || u.comment || "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No notes recorded yet</span>
                        )}
                      </td>
                    </tr>

                    {/* Stage 3: Completed */}
                    <tr className={currentStage === "completed" ? "bg-emerald-50/50" : ""}>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {currentStage === "completed" && (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-xs">
                            ✓
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        Completed
                        <span className="block text-[10px] text-emerald-700 font-normal">Issue Resolved</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {completedUpdates.length > 0 ? (
                          <div className="space-y-1">
                            {completedUpdates.map((u, i) => (
                              <div key={i} className="text-xs">
                                <span className="font-bold text-emerald-900">
                                  {u.updated_by || u.updated_by_name || u.updated_by_email || "Staff"}
                                </span>{" "}
                                ({formatISTDateTime(u.created_at)}):{" "}
                                <span className="font-medium text-slate-900">
                                  {u.description || u.remarks || u.notes || u.note || u.comment}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : ticket.remarks || ticket.resolution_notes || ticket.notes || ticket.closing_remarks ? (
                          <div className="text-xs">
                            <span className="font-medium text-slate-900">
                              {ticket.remarks || ticket.resolution_notes || ticket.notes || ticket.closing_remarks}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pending completion confirmation</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 4: Evidence & Attachments list */}
            <div className="mb-6 text-xs">
              <div className="border border-slate-300 rounded p-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Evidence / Attachments ({localAttachments.length}):
                </span>
                {localAttachments.length > 0 ? (
                  <div className="space-y-0.5">
                    {localAttachments.map((att, i) => (
                      <div key={i} className="text-slate-800 truncate">
                        📎 {att.file_name || att.name || "Attachment"}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500 italic">No attachments provided</span>
                )}
              </div>
            </div>

            {/* Section 5: Signatures & Acknowledgement Footer */}
            <div className="border-t-2 border-slate-800 pt-6 mt-4 grid grid-cols-3 gap-6 text-center text-xs">
              <div>
                <div className="border-b border-slate-400 pb-8 mb-1"></div>
                <span className="font-bold text-slate-800 block">Name of GR Hospital Personnel</span>
                <span className="text-[10px] text-slate-500">Grievance Redressal Officer</span>
              </div>

              <div>
                <div className="border-b border-slate-400 pb-8 mb-1"></div>
                <span className="font-bold text-slate-800 block">Officer Signature & Date/Time</span>
                <span className="text-[10px] text-slate-500">Authorized Signatory</span>
              </div>

              <div>
                <div className="border-b border-slate-400 pb-8 mb-1"></div>
                <span className="font-bold text-slate-800 block">Complainant Acknowledgement</span>
                <span className="text-[10px] text-slate-500">Signature & Date</span>
              </div>
            </div>

            <div className="mt-6 pt-2 border-t border-slate-200 text-[10px] text-center text-slate-400">
              Mamta Super Speciality Hospital | Generated electronically on {new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketSlipModal;
