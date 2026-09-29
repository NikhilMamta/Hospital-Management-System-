import React, { useState, useEffect } from "react";
import {
  X,
  Clock,
  User,
  Phone,
  Building,
  Tag,
  Paperclip,
  Send,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RotateCcw,
  FileText,
  Printer,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  fetchTicketDetails,
  addTicketUpdate,
  reopenTicket,
  formatISTDateTime,
  formatDelayText,
} from "../../api/staffTickets";
import TicketSlipModal from "./TicketSlipModal";

/**
 * TicketDetailDrawer
 * Drawer for ticket details, updates timeline, attachments, and posting progress updates.
 */
const TicketDetailDrawer = ({
  ticketId,
  isOpen,
  onClose,
  currentUser,
  isAdmin = false,
  onTicketUpdated,
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Update form state
  const [stage, setStage] = useState("analysis");
  const [description, setDescription] = useState("");
  const [updateFiles, setUpdateFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Reopen modal state
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenStage, setReopenStage] = useState("analysis");

  // Slip modal state
  const [showSlipModal, setShowSlipModal] = useState(false);

  // Load ticket data
  const loadTicket = async () => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTicketDetails(ticketId, isAdmin);
      setData(res);
      // Default stage to current status if not completed
      if (res.ticket.status !== "completed") {
        setStage(res.ticket.status === "open" ? "analysis" : res.ticket.status);
      }
    } catch (err) {
      console.error("Error loading ticket detail:", err);
      setError(err.message || "Failed to load ticket details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && ticketId) {
      loadTicket();
    } else {
      setData(null);
      setDescription("");
      setUpdateFiles([]);
      setShowCompleteConfirm(false);
      setShowReopenModal(false);
    }
  }, [isOpen, ticketId]);

  if (!isOpen) return null;

  const ticket = data?.ticket;
  const isCompleted = ticket?.status === "completed";

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setUpdateFiles((prev) => [...prev, ...selected]);
    }
  };

  const removeSelectedFile = (index) => {
    setUpdateFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit update
  const handleSubmitUpdate = async (e) => {
    if (e) e.preventDefault();

    if (stage === "completed" && !showCompleteConfirm) {
      if (!description.trim()) {
        alert("Resolution description is required to mark the ticket as completed.");
        return;
      }
      setShowCompleteConfirm(true);
      return;
    }

    if (stage === "completed" && !description.trim()) {
      alert("Problem solving description is required to mark the ticket as completed.");
      return;
    }

    setSubmitting(true);
    try {
      const updaterName = currentUser?.name || currentUser?.email || "Admin User";
      await addTicketUpdate({
        ticketId: ticket.id,
        ticketNo: ticket.ticket_no,
        stage,
        description,
        updatedBy: updaterName,
        files: updateFiles,
      });

      setDescription("");
      setUpdateFiles([]);
      setShowCompleteConfirm(false);

      // Refresh drawer details and close
      if (onTicketUpdated) onTicketUpdated();
      if (onClose) onClose();
    } catch (err) {
      console.error("Error saving update:", err);
      alert(err.message || "Failed to save update.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle re-open
  const handleReopen = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      alert("Please provide a reason to re-open the ticket.");
      return;
    }

    setSubmitting(true);
    try {
      const updaterName = currentUser?.name || currentUser?.email || "Admin User";
      await reopenTicket({
        ticketId: ticket.id,
        ticketNo: ticket.ticket_no,
        newStage: reopenStage,
        reason: reopenReason,
        updatedBy: updaterName,
      });

      setShowReopenModal(false);
      setReopenReason("");
      if (onTicketUpdated) onTicketUpdated();
      if (onClose) onClose();
    } catch (err) {
      console.error("Error reopening ticket:", err);
      alert(err.message || "Reopen failed");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "open")
      return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300">Open</span>;
    if (s === "analysis")
      return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300">Analysis</span>;
    if (s === "working")
      return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-300">Working</span>;
    if (s === "completed")
      return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">Completed</span>;
    return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">{status}</span>;
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
          {/* Top Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-white">{ticket?.ticket_no || "Loading..."}</span>
                {ticket && getStatusBadge(ticket.status)}
                {ticket?.is_confidential && (
                  <span className="flex items-center text-xs font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40">
                    <Lock className="w-3 h-3 mr-1" /> Confidential
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Raised on {formatISTDateTime(ticket?.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isCompleted && (
              <button
                onClick={() => setShowSlipModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center shadow transition-colors"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                View Slip
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-3 text-sm font-medium">Loading ticket details...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 shrink-0" />
              <span>{error}</span>
            </div>
          ) : ticket ? (
            <>
              {/* SLA & Time Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Planned SLA Time</span>
                  <span className="text-slate-800 font-bold block mt-0.5">{formatISTDateTime(ticket.planned_at)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Resolution Status</span>
                  <span
                    className={`font-bold block mt-0.5 ${
                      ticket.is_overdue ? "text-red-600" : "text-emerald-700"
                    }`}
                  >
                    {formatDelayText(ticket.delay_hours, ticket.is_overdue, isCompleted)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Completed Date</span>
                  <span className="text-slate-800 font-bold block mt-0.5">
                    {ticket.completed_at ? formatISTDateTime(ticket.completed_at) : "In Progress"}
                  </span>
                </div>
              </div>

              {/* Complainant Profile Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center">
                  <User className="w-4 h-4 mr-1.5 text-blue-600" /> Complainant Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-400 block">Name:</span>
                    <span className="font-semibold text-slate-800">{ticket.staff_name}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Designation:</span>
                    <span className="text-slate-700">{ticket.designation || "-"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Department:</span>
                    <span className="text-slate-700">{ticket.department || "-"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Contact Mobile:</span>
                    <a
                      href={`tel:${ticket.mobile}`}
                      className="text-blue-600 hover:text-blue-800 font-medium flex items-center mt-0.5"
                    >
                      <Phone className="w-3.5 h-3.5 mr-1" />
                      {ticket.mobile}
                    </a>
                  </div>
                  {ticket.email && (
                    <div className="col-span-2">
                      <span className="text-xs text-slate-400 block">Email:</span>
                      <span className="text-slate-700 text-xs">{ticket.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Grievance & Problem Description */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center">
                  <Tag className="w-4 h-4 mr-1.5 text-blue-600" /> Grievance Category & Problem
                </h4>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-800 font-semibold rounded-md border border-blue-200">
                      Category: {ticket.category_name}
                    </span>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-medium rounded-md border border-slate-200">
                      Issue: {ticket.issue_name}
                      {ticket.issue_other_text ? ` (${ticket.issue_other_text})` : ""}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Problem Description:</span>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm whitespace-pre-wrap leading-relaxed">
                      {ticket.problem_text}
                    </div>
                  </div>

                  {/* Initial Attachments */}
                  {data?.attachments && data.attachments.length > 0 && (
                    <div>
                      <span className="text-xs text-slate-400 block mb-1.5 font-medium">
                        Attachments ({data.attachments.length}):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {data.attachments.map((att, idx) => (
                          <div
                            key={idx}
                            className="group relative border border-slate-200 rounded-lg p-2 bg-slate-50 hover:bg-white hover:border-blue-400 transition-all text-xs flex flex-col justify-between"
                          >
                            <div className="truncate font-medium text-slate-700">{att.file_name}</div>
                            {att.signedUrl ? (
                              att.mime_type?.startsWith("image/") ? (
                                <a
                                  href={att.signedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 block"
                                >
                                  <img
                                    src={att.signedUrl}
                                    alt={att.file_name}
                                    className="h-20 w-full object-cover rounded border border-slate-200"
                                  />
                                </a>
                              ) : (
                                <a
                                  href={att.signedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 text-blue-600 hover:underline flex items-center text-xs"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> View / Download
                                </a>
                              )
                            ) : (
                              <span className="text-[10px] text-slate-400 mt-1">Processing link...</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Updates Timeline Log */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center">
                  <Clock className="w-4 h-4 mr-1.5 text-blue-600" /> Follow-Up Timeline Log
                </h4>

                {data?.updates && data.updates.length > 0 ? (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {data.updates.map((upd, idx) => (
                      <div key={idx} className="relative">
                        <div
                          className={`absolute -left-[19px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            upd.stage === "completed"
                              ? "bg-emerald-600"
                              : upd.stage === "working"
                              ? "bg-blue-600"
                              : "bg-amber-500"
                          }`}
                        />
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                              {upd.stage}
                            </span>
                            <span className="text-[11px] text-slate-400">{formatISTDateTime(upd.created_at)}</span>
                          </div>
                          <p className="text-xs text-slate-800 whitespace-pre-wrap">{upd.description}</p>
                          <div className="mt-1 text-[11px] text-slate-500 font-medium">By: {upd.updated_by_name || upd.updated_by || "Staff"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No updates logged yet.</p>
                )}
              </div>

              {/* Action: Add Update or Re-open */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                {isCompleted ? (
                  <div className="text-center py-3 space-y-3">
                    <div className="inline-flex items-center text-emerald-700 font-semibold text-sm">
                      <CheckCircle2 className="w-5 h-5 mr-1.5" />
                      This ticket has been marked as Completed.
                    </div>
                    <p className="text-xs text-slate-500">
                      To post new updates, please re-open this ticket first.
                    </p>
                    <div className="flex justify-center space-x-3">
                      <button
                        onClick={() => setShowSlipModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded-lg flex items-center shadow transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 mr-1.5" />
                        Print Redressal Slip
                      </button>
                      <button
                        onClick={() => setShowReopenModal(true)}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-4 py-2 rounded-lg flex items-center shadow transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        Re-open Ticket
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitUpdate} className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
                      <Send className="w-4 h-4 mr-1.5 text-blue-600" /> Post Follow-Up Update
                    </h4>

                    {/* Stage selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Select Progress Stage <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {["analysis", "working", "completed"].map((st) => (
                          <button
                            type="button"
                            key={st}
                            onClick={() => setStage(st)}
                            className={`py-2 px-3 text-xs font-semibold rounded-lg capitalize border transition-all ${
                              stage === st
                                ? st === "completed"
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                  : st === "working"
                                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                  : "bg-amber-500 text-white border-amber-500 shadow-sm"
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Description textarea */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Problem Solving Description{" "}
                        {stage === "completed" && <span className="text-red-500">* (Required)</span>}
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={
                          stage === "completed"
                            ? "Explain how the issue was resolved and what actions were taken in detail..."
                            : "Enter current status, analysis findings, or work progress notes..."
                        }
                        className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        required={stage === "completed"}
                      />
                    </div>

                    {/* Attachments upload */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Attach Evidence / Photos (Optional)
                      </label>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 text-slate-500"
                      />
                      {updateFiles.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {updateFiles.map((f, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded border border-slate-200"
                            >
                              {f.name}
                              <button
                                type="button"
                                onClick={() => removeSelectedFile(i)}
                                className="ml-1.5 text-slate-400 hover:text-red-600"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`w-full py-2.5 px-4 text-xs font-bold rounded-lg text-white shadow transition-colors flex items-center justify-center ${
                        stage === "completed" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {submitting ? "Saving..." : stage === "completed" ? "Mark Ticket as Completed" : "Submit Update"}
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>

      {/* ── Confirmation Modal for Completed ────────────────────── */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="font-bold text-slate-800 text-base">Complete Ticket Confirmation</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This ticket will be marked as <b>Completed</b> and moved to the <b>Completion Register</b>.
              The official Grievance Redressal Slip will be generated automatically.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCompleteConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitUpdate}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow"
              >
                {submitting ? "Completing..." : "Yes, Confirm & Complete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Re-open Modal ───────────────────────────────────────── */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <RotateCcw className="w-6 h-6" />
              <h3 className="font-bold text-slate-800 text-base">Re-open Ticket</h3>
            </div>
            <p className="text-xs text-slate-600">
              Please state the reason for re-opening this ticket and select the target stage:
            </p>
            <div className="space-y-3">
              <div className="flex space-x-2">
                {["analysis", "working"].map((st) => (
                  <button
                    type="button"
                    key={st}
                    onClick={() => setReopenStage(st)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded border capitalize ${
                      reopenStage === st
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Reason for re-opening this ticket..."
                className="w-full text-xs p-2.5 rounded border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReopen}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow"
              >
                {submitting ? "Re-opening..." : "Re-open Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Grievance Redressal Slip Modal ─────────────────────── */}
      {showSlipModal && (
        <TicketSlipModal
          ticket={ticket}
          updates={data?.updates || []}
          attachments={data?.attachments || []}
          isOpen={showSlipModal}
          onClose={() => setShowSlipModal(false)}
        />
      )}
    </>
  );
};

export default TicketDetailDrawer;
