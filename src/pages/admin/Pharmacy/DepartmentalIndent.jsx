import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Edit,
  Eye,
  Pill,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import supabase from "../../../SupabaseClient";
import { useNotification } from "../../../contexts/NotificationContext";
import { sendDepartmentalIndentApprovalNotification } from "../../../utils/whatsappService";
import { normalizeDepartmentalPharmacyIndent } from "../../../utils/pharmacyIndentUtils";

const defaultRequestTypes = {
  medicineSlip: true,
};

const isApprovedIndent = (status) =>
  typeof status === "string" && status.toLowerCase().includes("approved");

const DepartmentalIndent = () => {
  const { showNotification } = useNotification();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [successData, setSuccessData] = useState(null);
  const [locationRows, setLocationRows] = useState([]);
  const [medicinesList, setMedicinesList] = useState([]);

  const currentUser = useMemo(() => {
    try {
      const storedUser = localStorage.getItem("mis_user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error("Error parsing current user:", error);
      return null;
    }
  }, []);

  const getCurrentUser = () => currentUser?.name || "";

  const initialFormState = () => ({
    requestedBy: getCurrentUser(),
    ward: "",
    remarks: "",
  });

  const [formData, setFormData] = useState(initialFormState);
  const [requestTypes, setRequestTypes] = useState(defaultRequestTypes);
  const [medicines, setMedicines] = useState([]);

  const wardOptions = useMemo(() => {
    const baseWards = [
      ...new Set(locationRows.map((row) => row.ward).filter(Boolean)),
    ];
    return [...new Set([...baseWards, "OT", "OPTHAL"])].sort();
  }, [locationRows]);

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const query = searchTerm.trim().toLowerCase();
        const matchesSearch = query
          ? [
              record.indentNumber,
              record.displayTitle,
              record.location,
              record.requestedBy,
              record.remarks,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(query)
          : true;
        const matchesStatus =
          filterStatus === "all" || record.status === filterStatus;
        return matchesSearch && matchesStatus;
      }),
    [records, searchTerm, filterStatus],
  );

  const getIndianTimestamp = () =>
    new Date()
      .toLocaleString("en-CA", {
        timeZone: "Asia/Kolkata",
        hour12: false,
      })
      .replace(",", "");

  const resetForm = () => {
    setFormData(initialFormState());
    setRequestTypes(defaultRequestTypes);
    setMedicines([]);
    setSelectedIndent(null);
    setEditMode(false);
  };

  const loadDepartmentalIndents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("departmental_pharmacy_indent")
        .select("*")
        .order("timestamp", { ascending: false });

      if (error) throw error;
      setRecords(
        (data || []).map((row) => normalizeDepartmentalPharmacyIndent(row)),
      );
    } catch (error) {
      console.error("Error loading departmental indents:", error);
      showNotification("Failed to load departmental indents", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadMasters = async () => {
    try {
      const [
        { data: floorBedData, error: floorBedError },
        { data: medicineData, error: medicineError },
      ] = await Promise.all([
        supabase.from("all_floor_bed").select("floor, ward, room"),
        supabase
          .from("medicine")
          .select("medicine_name")
          .order("medicine_name")
          .limit(5000),
      ]);

      if (floorBedError) throw floorBedError;
      if (medicineError) throw medicineError;

      setLocationRows(floorBedData || []);
      setMedicinesList(
        (medicineData || []).map((item) => item.medicine_name).filter(Boolean),
      );
    } catch (error) {
      console.error("Error loading departmental masters:", error);
      showNotification("Failed to load departmental masters", "error");
    }
  };

  useEffect(() => {
    loadDepartmentalIndents();
    loadMasters();

    const channel = supabase
      .channel("departmental-pharmacy-indent-page")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "departmental_pharmacy_indent",
        },
        () => {
          loadDepartmentalIndents();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCheckboxChange = (type) => {
    if (type === "medicineSlip") {
      setRequestTypes((prev) => ({
        ...prev,
        medicineSlip: !prev.medicineSlip,
      }));
    }
  };

  const addMedicine = () => {
    setMedicines((prev) => [
      ...prev,
      { id: Date.now(), name: "", quantity: "" },
    ]);
  };

  const updateMedicine = (id, field, value) => {
    setMedicines((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const removeMedicine = (id) => {
    setMedicines((prev) => prev.filter((item) => item.id !== id));
  };

  const validateForm = () => {
    if (!formData.requestedBy.trim()) {
      showNotification("Requested by is required", "error");
      return false;
    }
    if (!formData.ward) {
      showNotification("Please select a ward", "error");
      return false;
    }

    const hasRequestType = Object.values(requestTypes).some(Boolean);
    if (!hasRequestType) {
      showNotification("Please select at least one request type", "error");
      return false;
    }

    if (requestTypes.medicineSlip) {
      if (!medicines.length) {
        showNotification("Please add at least one medicine", "error");
        return false;
      }

      if (medicines.some((item) => !item.name || !item.quantity)) {
        showNotification("Please complete all medicine rows", "error");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const payload = {
        timestamp: getIndianTimestamp(),
        ...(editMode && selectedIndent
          ? { indent_no: selectedIndent.indentNumber }
          : {}),
        requested_by: formData.requestedBy.trim(),
        indent_scope: "departmental",
        ward: formData.ward,
        ward_location: formData.ward,
        remarks: formData.remarks.trim(),
        request_types: JSON.stringify(requestTypes),
        medicines: JSON.stringify(medicines),
        status: "pending",
        planned1: getIndianTimestamp(),
      };

      let savedRow;
      if (editMode && selectedIndent) {
        const { data, error } = await supabase
          .from("departmental_pharmacy_indent")
          .update(payload)
          .eq("id", selectedIndent.sourceId)
          .select()
          .single();

        if (error) throw error;
        savedRow = data;
        showNotification(
          "Departmental indent updated successfully!",
          "success",
        );
      } else {
        const { data, error } = await supabase
          .from("departmental_pharmacy_indent")
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        savedRow = data;
        showNotification(
          "Departmental indent created successfully!",
          "success",
        );
      }

      await sendDepartmentalIndentApprovalNotification(
        savedRow,
        medicines,
        requestTypes,
      ).catch((error) =>
        console.error("[WhatsApp] departmental notification error:", error),
      );

      setSuccessData({
        indentNumber: savedRow.indent_no,
        wardLocation: savedRow.ward_location,
        requestedBy: savedRow.requested_by,
      });
      setShowModal(false);
      setSuccessModal(true);
      resetForm();
      await loadDepartmentalIndents();
    } catch (error) {
      console.error("Error saving departmental indent:", error);
      showNotification(
        `Failed to save departmental indent: ${error.message}`,
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (indent) => {
    if (isApprovedIndent(indent.status)) {
      showNotification("Approved indents cannot be deleted", "error");
      return;
    }

    if (!window.confirm("Delete this departmental indent?")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("departmental_pharmacy_indent")
        .delete()
        .eq("id", indent.sourceId);

      if (error) throw error;
      showNotification("Departmental indent deleted successfully!", "success");
      await loadDepartmentalIndents();
    } catch (error) {
      console.error("Error deleting departmental indent:", error);
      showNotification("Failed to delete departmental indent", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (indent) => {
    if (isApprovedIndent(indent.status)) {
      showNotification("Approved indents cannot be edited", "error");
      return;
    }

    setSelectedIndent(indent);
    setEditMode(true);
    setFormData({
      requestedBy: indent.requestedBy || "",
      ward: indent.ward || "",
      remarks: indent.remarks || "",
    });
    setRequestTypes({ ...defaultRequestTypes, ...indent.requestTypes });
    setMedicines(
      (indent.medicines || []).map((item, index) => ({
        ...item,
        id: item.id || Date.now() + index,
      })),
    );
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const renderRequestTypeBadges = (indent) => (
    <div className="flex flex-wrap gap-1">
      {indent.requestTypes.medicineSlip && (
        <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
          Medicine
        </span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 p-3 sm:p-6 lg:pb-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              Departmental Pharmacy Indents
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Create ward and departmental medicine requests.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-green-100 transition-all hover:bg-green-700 hover:shadow-green-200 active:scale-95 sm:rounded-lg sm:py-2"
          >
            <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
            New Departmental Indent
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search indent, ward, requester..."
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-green-500 focus:outline-none focus:ring-4 focus:ring-green-50/50 transition-all sm:rounded-lg sm:py-2 sm:pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-50/50 transition-all md:w-48 sm:rounded-lg sm:py-2"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card view for mobile/tablet, Table for desktop */}
        <div className="space-y-4 lg:hidden">
          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading...</div>
          ) : filteredRecords.length ? (
            filteredRecords.map((indent) => (
              <div
                key={indent.id}
                className="group relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-green-200 hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-green-700">
                        {indent.indentNumber}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          indent.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : indent.status === "rejected"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {indent.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900">
                      {indent.displayTitle}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">
                        {indent.requestedBy}
                      </span>
                      <span>•</span>
                      <span>
                        {indent.timestamp
                          ? new Date(indent.timestamp).toLocaleString("en-GB", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIndent(indent);
                        setViewModal(true);
                      }}
                      className="rounded-lg bg-green-50 p-2 text-green-600 active:bg-green-100"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="mb-4">{renderRequestTypeBadges(indent)}</div>

                <div className="flex gap-2 pt-3 border-t border-gray-50">
                  <button
                    type="button"
                    onClick={() => handleEdit(indent)}
                    disabled={isApprovedIndent(indent.status)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-50 py-2.5 text-xs font-bold text-amber-700 active:bg-amber-100 disabled:opacity-40 disabled:grayscale"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                  {currentUser?.role !== "nurse" && (
                    <button
                      type="button"
                      onClick={() => handleDelete(indent)}
                      disabled={isApprovedIndent(indent.status)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-50 py-2.5 text-xs font-bold text-red-700 active:bg-red-100 disabled:opacity-40 disabled:grayscale"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center text-gray-400">
              No indents found
            </div>
          )}
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-green-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                    Indent
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                    Ward / Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                    Requested By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                    Request Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                    Created At
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-4 py-10 text-center text-sm text-gray-500"
                    >
                      Loading departmental indents...
                    </td>
                  </tr>
                ) : filteredRecords.length ? (
                  filteredRecords.map((indent) => (
                    <tr key={indent.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-green-700">
                          {indent.indentNumber}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="font-medium">{indent.displayTitle}</div>
                        <div className="text-xs text-gray-500">
                          {indent.location}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {indent.requestedBy || "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        {renderRequestTypeBadges(indent)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            indent.status === "approved"
                              ? "bg-green-100 text-green-700"
                              : indent.status === "rejected"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {indent.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {indent.timestamp
                          ? new Date(indent.timestamp).toLocaleString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "2-digit",
                              month: "short",
                            })
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIndent(indent);
                              setViewModal(true);
                            }}
                            className="rounded-lg bg-green-100 p-2 text-green-700 hover:bg-green-200"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(indent)}
                            disabled={isApprovedIndent(indent.status)}
                            className={`rounded-lg p-2 ${
                              isApprovedIndent(indent.status)
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                            }`}
                            title={
                              isApprovedIndent(indent.status)
                                ? "Approved indents cannot be edited"
                                : "Edit Indent"
                            }
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {currentUser?.role !== "nurse" && (
                            <button
                              type="button"
                              onClick={() => handleDelete(indent)}
                              disabled={isApprovedIndent(indent.status)}
                              className={`rounded-lg p-2 ${
                                isApprovedIndent(indent.status)
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  : "bg-red-100 text-red-700 hover:bg-red-200"
                              }`}
                              title={
                                isApprovedIndent(indent.status)
                                  ? "Approved indents cannot be deleted"
                                  : "Delete Indent"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-10 text-center">
                      <Pill className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                      <div className="text-sm font-medium text-gray-600">
                        No departmental indents found
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {editMode
                  ? "Edit Departmental Indent"
                  : "Create Departmental Indent"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-8">
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-gray-700">
                    Requested By
                  </label>
                  <input
                    type="text"
                    value={formData.requestedBy}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        requestedBy: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-300 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-green-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-green-50/50 sm:rounded-lg sm:py-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-bold text-gray-700">
                    Ward
                  </label>
                  <select
                    value={formData.ward}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        ward: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-300 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-green-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-green-50/50 sm:rounded-lg sm:py-2"
                  >
                    <option value="">Select ward</option>
                    {wardOptions.map((ward) => (
                      <option key={ward} value={ward}>
                        {ward}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-bold text-gray-700">
                    Remarks / Purpose
                  </label>
                  <textarea
                    rows="3"
                    value={formData.remarks}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        remarks: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-300 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-green-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-green-50/50 sm:rounded-lg sm:py-2"
                    placeholder="Optional remarks for this ward request"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Request Types
                </p>
                <div className="flex flex-wrap gap-3">
                  {[["medicineSlip", "Medicine Slip"]].map(([key, label]) => (
                    <label
                      key={key}
                      className="inline-flex items-center gap-2 text-sm text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={requestTypes[key]}
                        onChange={() => handleCheckboxChange(key)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {requestTypes.medicineSlip && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-800">
                      Medicines
                    </h3>
                    <button
                      type="button"
                      onClick={addMedicine}
                      className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Add Medicine
                    </button>
                  </div>
                  <div className="space-y-3">
                    {medicines.map((medicine) => (
                      <div
                        key={medicine.id}
                        className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-green-100 md:grid md:grid-cols-[minmax(0,2fr)_120px_48px] md:items-center md:bg-transparent md:p-0 md:focus-within:ring-0"
                      >
                        <div className="relative group">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-tight text-gray-400 md:hidden">
                            Medicine Name
                          </label>
                          <input
                            type="text"
                            value={medicine.name}
                            onChange={(event) =>
                              updateMedicine(
                                medicine.id,
                                "name",
                                event.target.value,
                              )
                            }
                            placeholder="Type to search medicine..."
                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all outline-none md:py-2"
                          />
                          <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible transition-all">
                            {(medicinesList || [])
                              .filter((m) =>
                                m
                                  .toLowerCase()
                                  .includes(
                                    (medicine.name || "").toLowerCase(),
                                  ),
                              )
                              .map((m) => (
                                <div
                                  key={m}
                                  className="px-3 py-2.5 text-sm hover:bg-green-50 cursor-pointer text-gray-700 md:py-2 focus:bg-green-50 outline-none"
                                  tabIndex="0"
                                  onMouseDown={() =>
                                    updateMedicine(medicine.id, "name", m)
                                  }
                                  onKeyDown={(e) =>
                                    e.key === "Enter" &&
                                    updateMedicine(medicine.id, "name", m)
                                  }
                                >
                                  {m}
                                </div>
                              ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-tight text-gray-400 md:hidden">
                              Quantity
                            </label>
                            <input
                              value={medicine.quantity}
                              onChange={(event) =>
                                updateMedicine(
                                  medicine.id,
                                  "quantity",
                                  event.target.value,
                                )
                              }
                              placeholder="Qty"
                              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-200 md:py-2"
                            />
                          </div>
                          <div className="md:mt-0">
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-tight opacity-0 md:hidden">
                              Action
                            </label>
                            <button
                              type="button"
                              onClick={() => removeMedicine(medicine.id)}
                              className="flex h-[42px] w-[42px] items-center justify-center rounded-lg bg-red-100 text-red-700 hover:bg-red-200 md:h-9 md:w-9"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t bg-gray-50/50 px-5 py-4 sm:flex-row sm:justify-end sm:bg-white sm:px-8">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-xl bg-white border border-gray-200 px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 active:scale-95 sm:flex-none sm:rounded-lg sm:py-2 sm:font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-green-100 transition-all hover:bg-green-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-green-300 sm:flex-none sm:rounded-lg sm:py-2 sm:font-medium sm:shadow-none"
              >
                <Save className="h-4 w-4" />
                {editMode ? "Update Indent" : "Submit Indent"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewModal && selectedIndent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between bg-green-600 px-6 py-4 text-white">
              <h2 className="text-xl font-semibold">
                Departmental Indent - {selectedIndent.indentNumber}
              </h2>
              <button
                type="button"
                onClick={() => setViewModal(false)}
                className="rounded-full p-2 hover:bg-green-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-gray-500">Indent No</p>
                  <p className="font-medium text-gray-800">
                    {selectedIndent.indentNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ward / Location</p>
                  <p className="font-medium text-gray-800">
                    {selectedIndent.location}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Requested By</p>
                  <p className="font-medium text-gray-800">
                    {selectedIndent.requestedBy}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium capitalize text-gray-800">
                    {selectedIndent.status}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Planned</p>
                  <p className="font-medium text-gray-800">
                    {selectedIndent.planned1
                      ? new Date(selectedIndent.planned1).toLocaleString(
                          "en-GB",
                        )
                      : "-"}
                  </p>
                </div>
                <div className="md:col-span-2 lg:col-span-3">
                  <p className="text-sm text-gray-500">Remarks</p>
                  <p className="font-medium text-gray-800">
                    {selectedIndent.remarks || "-"}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm text-gray-500">Request Types</p>
                {renderRequestTypeBadges(selectedIndent)}
              </div>
              {selectedIndent.medicines?.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-gray-500">Medicines</p>
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                            Medicine
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                            Quantity
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedIndent.medicines.map((medicine, index) => (
                          <tr key={medicine.id || index}>
                            <td className="px-4 py-2 text-sm text-gray-700">
                              {medicine.name}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700">
                              {medicine.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {successModal && successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center gap-3 rounded-t-2xl bg-green-600 px-6 py-4 text-white">
              <CheckCircle className="h-6 w-6" />
              <h2 className="text-xl font-semibold">
                Departmental Indent Saved
              </h2>
            </div>
            <div className="space-y-3 p-6">
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                <div className="flex justify-between gap-4">
                  <span>Indent No</span>
                  <span className="font-semibold text-green-700">
                    {successData.indentNumber}
                  </span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span>Location</span>
                  <span className="text-right font-medium">
                    {successData.wardLocation}
                  </span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span>Requested By</span>
                  <span className="font-medium">{successData.requestedBy}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSuccessModal(false)}
                className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentalIndent;
