import React, { useState, useEffect, useMemo } from "react";
import {
  Trash2,
  Search,
  AlertTriangle,
  X,
  Shield,
  CheckCircle,
  FileText,
  Clock,
  User,
  RefreshCw,
} from "lucide-react";
import supabase from "../../../SupabaseClient";
import { useNotification } from "../../../contexts/NotificationContext";

const DeletePatient = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deletionResult, setDeletionResult] = useState(null);

  // Audit log state
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAuditLog, setShowAuditLog] = useState(false);

  const { showNotification } = useNotification();

  // Check admin access on mount
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("mis_user"));
    setCurrentUser(user);
    setIsAdmin(user?.role === "admin");
    if (user?.role === "admin") {
      fetchPatients();
      fetchAuditLogs();
    }
  }, []);

  // Fetch all IPD patients
  const fetchPatients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ipd_admissions")
        .select("*")
        .order("timestamp", { ascending: false });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error("Error fetching patients:", error);
      showNotification("Failed to fetch patients", "error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("patient_deletion_log")
        .select("*")
        .order("deleted_at", { ascending: false })
        .limit(50);

      if (error) {
        // Table might not exist yet
        console.warn("Audit log table may not exist yet:", error.message);
        return;
      }
      setAuditLogs(data || []);
    } catch (error) {
      console.warn("Could not fetch audit logs:", error);
    }
  };

  // Filter patients by search
  const filteredPatients = useMemo(() => {
    if (!searchText.trim()) return patients;
    const term = searchText.toLowerCase();
    return patients.filter(
      (p) =>
        (p.patient_name || "").toLowerCase().includes(term) ||
        (p.ipd_number || "").toLowerCase().includes(term) ||
        (p.admission_no || "").toLowerCase().includes(term) ||
        (p.phone_no || "").includes(term)
    );
  }, [patients, searchText]);

  // Open delete confirmation modal
  const handleDeleteClick = (patient) => {
    setSelectedPatient(patient);
    setConfirmName("");
    setDeletionResult(null);
    setShowDeleteModal(true);
  };

  // Execute deletion
  const handleConfirmDelete = async () => {
    if (!selectedPatient) return;

    const patientName = (selectedPatient.patient_name || "").trim();
    if (confirmName.trim().toLowerCase() !== patientName.toLowerCase()) {
      showNotification(
        "Patient name does not match. Please type the exact name to confirm.",
        "error"
      );
      return;
    }

    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc(
        "delete_patient_completely",
        {
          p_ipd_number: selectedPatient.ipd_number,
          p_admission_no: selectedPatient.admission_no || "",
          p_deleted_by: currentUser?.name || currentUser?.username || "admin",
        }
      );

      if (error) throw error;

      setDeletionResult(data);
      showNotification(
        `Patient "${patientName}" and all related records deleted successfully!`,
        "success"
      );

      // Refresh data
      await fetchPatients();
      await fetchAuditLogs();
    } catch (error) {
      console.error("Error deleting patient:", error);
      showNotification(
        `Failed to delete patient: ${error.message}`,
        "error"
      );
    } finally {
      setDeleting(false);
    }
  };

  // Close modal
  const closeModal = () => {
    setShowDeleteModal(false);
    setSelectedPatient(null);
    setConfirmName("");
    setDeletionResult(null);
  };

  // Non-admin view
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-red-200 max-w-md">
          <Shield className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Access Restricted
          </h2>
          <p className="text-gray-600">
            Only administrators can access the Delete Patient feature. Please
            contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center md:gap-4">
          <div>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-lg">
                <Trash2 size={20} className="text-white md:w-6 md:h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
                  Delete Patient
                </h1>
                <p className="hidden text-gray-600 md:block">
                  Permanently delete a patient and all related records
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowAuditLog(!showAuditLog)}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-200 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 md:text-base"
          >
            <FileText size={18} />
            {showAuditLog ? "Hide" : "View"} Audit Log
          </button>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              Danger Zone — Irreversible Action
            </p>
            <p className="text-xs text-red-600 mt-1">
              Deleting a patient will permanently remove all nursing tasks, RMO
              tasks, lab reports, pharmacy records, discharge records, OT
              information, dressing records, and admission data. This action
              cannot be undone.
            </p>
          </div>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="p-3 mb-4 bg-white border border-gray-200 shadow-sm md:mb-6 rounded-xl md:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search
                className="absolute text-gray-400 transform -translate-y-1/2 left-3 top-1/2"
                size={18}
              />
              <input
                type="text"
                placeholder="Search by patient name, IPD number, or admission number..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full py-2 pl-10 pr-4 text-sm border border-gray-300 rounded-lg md:py-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent md:text-base"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 md:justify-start">
            <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <span className="text-xs text-gray-600 md:text-sm">
                <span className="font-bold text-gray-900">
                  {filteredPatients.length}
                </span>
                /
                <span className="font-bold text-gray-900">
                  {patients.length}
                </span>{" "}
                patients
              </span>
            </div>
            <button
              onClick={fetchPatients}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
            >
              <RefreshCw
                size={14}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Patient Table */}
      {!showAuditLog && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-10 h-10 mx-auto border-b-2 border-red-500 rounded-full animate-spin mb-3"></div>
                <p className="text-gray-500 text-sm">Loading patients...</p>
              </div>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <User className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">No patients found</p>
                <p className="text-gray-400 text-sm mt-1">
                  {searchText
                    ? "Try a different search term"
                    : "No patients in the system"}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-100">
                {filteredPatients.map((patient) => (
                  <div key={patient.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm">
                          {patient.patient_name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          IPD: {patient.ipd_number} | Adm:{" "}
                          {patient.admission_no}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteClick(patient)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors border border-red-200"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Ward:</span>{" "}
                        {patient.ward_type || "N/A"}
                      </div>
                      <div>
                        <span className="font-medium">Bed:</span>{" "}
                        {patient.bed_no || "N/A"}
                      </div>
                      <div>
                        <span className="font-medium">Doctor:</span>{" "}
                        {patient.consultant_dr || "N/A"}
                      </div>
                      <div>
                        <span className="font-medium">Phone:</span>{" "}
                        {patient.phone_no || "N/A"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase">
                        Patient Name
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase">
                        IPD Number
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase">
                        Admission No
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase">
                        Ward / Bed
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase">
                        Consultant
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase">
                        Admitted
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-600 text-xs uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPatients.map((patient) => (
                      <tr
                        key={patient.id}
                        className="hover:bg-red-50/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {patient.patient_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {patient.age} / {patient.gender}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-green-700 font-semibold">
                          {patient.ipd_number}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {patient.admission_no}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {patient.ward_type || "N/A"}
                          {patient.bed_no && ` / ${patient.bed_no}`}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {patient.consultant_dr || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {patient.phone_no || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {patient.timestamp
                            ? new Date(patient.timestamp).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteClick(patient)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors border border-red-200"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Audit Log Section */}
      {showAuditLog && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Clock size={16} />
              Deletion Audit Log
            </h3>
          </div>
          {auditLogs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">No deletion records yet</p>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Audit Cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">
                          {log.patient_name}
                        </h4>
                        <p className="text-xs text-gray-500">
                          IPD: {log.ipd_number} | Adm: {log.admission_no}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                        Deleted
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>
                        <span className="font-medium">Deleted by:</span>{" "}
                        {log.deleted_by}
                      </p>
                      <p>
                        <span className="font-medium">Date:</span>{" "}
                        {new Date(log.deleted_at).toLocaleString("en-IN")}
                      </p>
                      {log.deletion_summary?.deleted_records && (
                        <p>
                          <span className="font-medium">Records:</span>{" "}
                          {Object.entries(log.deletion_summary.deleted_records)
                            .filter(([, v]) => v > 0)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ") || "None"}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Audit Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600 text-xs uppercase">
                        Patient Name
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600 text-xs uppercase">
                        IPD Number
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600 text-xs uppercase">
                        Admission No
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600 text-xs uppercase">
                        Deleted By
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600 text-xs uppercase">
                        Deleted At
                      </th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-600 text-xs uppercase">
                        Records Deleted
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">
                          {log.patient_name}
                        </td>
                        <td className="px-4 py-2 font-mono text-green-700">
                          {log.ipd_number}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {log.admission_no}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {log.deleted_by}
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-xs">
                          {new Date(log.deleted_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-2">
                          {log.deletion_summary?.deleted_records ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(
                                log.deletion_summary.deleted_records
                              )
                                .filter(([, v]) => v > 0)
                                .map(([k, v]) => (
                                  <span
                                    key={k}
                                    className="px-1.5 py-0.5 bg-red-50 text-red-700 text-xs rounded font-medium"
                                  >
                                    {k}: {v}
                                  </span>
                                ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Delete Patient
                  </h3>
                  <p className="text-xs text-gray-500">
                    This action is permanent and cannot be undone
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 md:p-6">
              {/* Show deletion result */}
              {deletionResult ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800">
                        Patient deleted successfully
                      </p>
                      <p className="text-sm text-green-600">
                        All related records have been removed.
                      </p>
                    </div>
                  </div>

                  {/* Deletion Summary */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-800 mb-3 text-sm">
                      Deletion Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {deletionResult.deleted_records &&
                        Object.entries(deletionResult.deleted_records).map(
                          ([table, count]) => (
                            <div
                              key={table}
                              className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-200"
                            >
                              <span className="text-xs text-gray-600 truncate">
                                {table.replace(/_/g, " ")}
                              </span>
                              <span
                                className={`text-xs font-bold ${
                                  count > 0
                                    ? "text-red-600"
                                    : "text-gray-400"
                                }`}
                              >
                                {count}
                              </span>
                            </div>
                          )
                        )}
                    </div>
                  </div>

                  <button
                    onClick={closeModal}
                    className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Patient Info */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-800 mb-2 text-sm">
                      Patient Details
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs">Name</span>
                        <p className="font-semibold text-gray-900">
                          {selectedPatient.patient_name}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">
                          IPD Number
                        </span>
                        <p className="font-semibold text-green-700 font-mono">
                          {selectedPatient.ipd_number}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">
                          Admission No
                        </span>
                        <p className="font-medium text-gray-700">
                          {selectedPatient.admission_no || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">
                          Ward / Bed
                        </span>
                        <p className="font-medium text-gray-700">
                          {selectedPatient.ward_type || "N/A"}
                          {selectedPatient.bed_no &&
                            ` / ${selectedPatient.bed_no}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* What will be deleted */}
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h4 className="font-semibold text-red-800 mb-2 text-sm">
                      The following data will be permanently deleted:
                    </h4>
                    <ul className="space-y-1 text-xs text-red-700">
                      <li>• All nursing tasks (nurse_assign_task)</li>
                      <li>• All RMO tasks (rmo_assign_task)</li>
                      <li>• All OT records (ot_information)</li>
                      <li>• All lab reports (lab)</li>
                      <li>• All pharmacy/indent records (pharmacy)</li>
                      <li>• All discharge records</li>
                      <li>• All dressing records</li>
                      <li>• IPD admission record</li>
                      <li>• Patient admission record</li>
                      <li>• Bed will be freed</li>
                    </ul>
                  </div>

                  {/* Confirmation Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type{" "}
                      <span className="font-bold text-red-600">
                        {selectedPatient.patient_name}
                      </span>{" "}
                      to confirm deletion:
                    </label>
                    <input
                      type="text"
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                      placeholder="Type patient name here..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={closeModal}
                      disabled={deleting}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmDelete}
                      disabled={
                        deleting ||
                        confirmName.trim().toLowerCase() !==
                          (selectedPatient.patient_name || "")
                            .trim()
                            .toLowerCase()
                      }
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {deleting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} />
                          Confirm Deletion
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeletePatient;
