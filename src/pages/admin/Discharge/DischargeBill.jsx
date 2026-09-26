import React, { useState, useEffect, useRef } from "react";
import { FileText, X, Clock, CheckCircle, Image, Upload } from "lucide-react";
import supabase from "../../../SupabaseClient";
import useRealtimeTable from "../../../hooks/useRealtimeTable";
import { useNotification } from "../../../contexts/NotificationContext";
import Pagination from "../../../components/Pagination";
import { fetchAllRows } from "../../../utils/supabaseQuery";

const HISTORY_PAGE_SIZE = 50;

// Columns shown in the tables, cards and bill form (was select("*"))
const BILL_COLUMNS =
  "id, admission_no, patient_name, category, department, consultant_name, staff_name, planned5, actual5, delay5, rmo_status, rmo_name, summary_report_image, work_file, concern_dept, concern_authority_work_file, bill_status, bill_image";

const pendingFilter = (query) =>
  query.not("planned5", "is", null).is("actual5", null);
const historyFilter = (query) =>
  query.not("planned5", "is", null).not("actual5", "is", null);

const DischargeBill = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingRecords, setPendingRecords] = useState([]);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyPage, setHistoryPage] = useState(0);
  // Badge counts for both tabs (only the open tab's rows are loaded)
  const [counts, setCounts] = useState({ pending: 0, history: 0 });
  const loadRequestRef = useRef(0);
  const [showBillModal, setShowBillModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [billStatus, setBillStatus] = useState("");
  const [billImageFile, setBillImageFile] = useState(null);
  const [billImagePreview, setBillImagePreview] = useState("");
  const { showNotification } = useNotification();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewImageModal, setViewImageModal] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);

  const loadPendingRecords = async () => {
    // Fetch pending records (planned5 is not null and actual5 is null).
    // In 1,000-row chunks so the queue can never be cut silently.
    const pendingData = await fetchAllRows((from, to) =>
      pendingFilter(supabase.from("discharge").select(BILL_COLUMNS))
        .order("planned5", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );

    return pendingData.map((record) => ({
      ...record,
      planned5Date: record.planned5
        ? new Date(record.planned5).toLocaleDateString("en-GB")
        : "N/A",
      planned5Time: record.planned5
        ? new Date(record.planned5).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "N/A",
    }));
  };

  const loadHistoryRecords = async (page) => {
    // Fetch history records (both planned5 and actual5 are not null), one page
    // at a time: the whole list would be cut at 1,000 rows.
    const from = page * HISTORY_PAGE_SIZE;
    const {
      data: historyData,
      error: historyError,
      count,
    } = await historyFilter(
      supabase.from("discharge").select(BILL_COLUMNS, { count: "exact" }),
    )
      .order("actual5", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + HISTORY_PAGE_SIZE - 1);

    if (historyError) throw historyError;
    const formattedHistory = (historyData || []).map((record) => ({
      ...record,
      planned5Date: record.planned5
        ? new Date(record.planned5).toLocaleDateString("en-GB")
        : "N/A",
      planned5Time: record.planned5
        ? new Date(record.planned5).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "N/A",
      actual5Date: record.actual5
        ? new Date(record.actual5).toLocaleDateString("en-GB")
        : "N/A",
      actual5Time: record.actual5
        ? new Date(record.actual5).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "N/A",
    }));
    return { rows: formattedHistory, total: count ?? 0 };
  };

  const countRecords = async (filter) => {
    const { count, error } = await filter(
      supabase.from("discharge").select("id", { count: "exact", head: true }),
    );
    if (error) throw error;
    return count ?? 0;
  };

  // Loads only the open tab; the other tab's badge comes from a count query
  const loadData = async () => {
    const requestId = ++loadRequestRef.current;
    try {
      setIsLoading(true);

      if (activeTab === "pending") {
        const [rows, historyCount] = await Promise.all([
          loadPendingRecords(),
          countRecords(historyFilter),
        ]);
        // Ignore a slower answer for a tab/page the user has already left
        if (requestId !== loadRequestRef.current) return;
        setPendingRecords(rows);
        setCounts({ pending: rows.length, history: historyCount });
      } else {
        const [history, pendingCount] = await Promise.all([
          loadHistoryRecords(historyPage),
          countRecords(pendingFilter),
        ]);
        if (requestId !== loadRequestRef.current) return;
        setHistoryRecords(history.rows);
        setCounts({ pending: pendingCount, history: history.total });
      }
    } catch (error) {
      console.error("Error loading data from Supabase:", error);
      showNotification("Failed to load data", "error");
    } finally {
      if (requestId === loadRequestRef.current) setIsLoading(false);
    }
  };

  // Real-time sync: refresh when discharge table changes (replaces aggressive polling)
  useRealtimeTable("discharge", loadData);

  // Load the open tab (and history page) on mount and when they change
  useEffect(() => {
    loadData();
  }, [activeTab, historyPage]);

  // If rows disappear, don't stay on an empty history page
  const historyTotalPages = Math.max(
    1,
    Math.ceil(counts.history / HISTORY_PAGE_SIZE),
  );
  useEffect(() => {
    if (historyPage > 0 && historyPage >= historyTotalPages) {
      setHistoryPage(historyTotalPages - 1);
    }
  }, [historyPage, historyTotalPages]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setHistoryPage(0);
  };

  const handleOpenBillModal = (record) => {
    setSelectedRecord(record);
    setBillStatus("");
    setBillImageFile(null);
    setBillImagePreview("");
    setShowBillModal(true);
  };

  const handleCloseBillModal = () => {
    setShowBillModal(false);
    setSelectedRecord(null);
    setBillStatus("");
    setBillImageFile(null);
    setBillImagePreview("");
  };

  const handleBillImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification("Image size should be less than 5MB", "error");
        return;
      }

      // Store the file object for later upload
      setBillImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setBillImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToStorage = async (file) => {
    try {
      // Generate a unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `bill_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `bill_images/${fileName}`;

      // Upload image to Supabase Storage
      const { data, error } = await supabase.storage
        .from("discharge-documents") // Make sure this bucket exists
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("discharge-documents").getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image to storage:", error);
      throw new Error("Failed to upload image");
    }
  };

  const handleSubmitBill = async () => {
    if (!billStatus) {
      showNotification("Please select Bill Status", "error");
      return;
    }

    try {
      setIsSubmitting(true);

      let billImageUrl = null;

      // Only upload image if provided (now optional)
      if (billImageFile) {
        billImageUrl = await uploadImageToStorage(billImageFile);
      }

      // Step 2: Update the record in Supabase database
      const { error } = await supabase
        .from("discharge")
        .update({
          actual5: new Date()
            .toLocaleString("en-CA", {
              timeZone: "Asia/Kolkata",
              hour12: false,
            })
            .replace(",", ""),
          bill_status: billStatus,
          bill_image: billImageUrl, // This will be null if no image was uploaded
        })
        .eq("admission_no", selectedRecord.admission_no);

      if (error) throw error;
      const { error: updateError } = await supabase
        .from("ipd_admissions")
        .update({
          actual1: new Date()
            .toLocaleString("en-CA", {
              timeZone: "Asia/Kolkata",
              hour12: false,
            })
            .replace(",", ""),
        })
        .eq("admission_no", selectedRecord.admission_no);

      if (updateError) throw updateError;

      handleCloseBillModal();
      showNotification("Discharge Bill added successfully!", "success");
      await loadData();
    } catch (error) {
      console.error("Error updating Discharge Bill data:", error);
      showNotification(
        error.message || "Failed to save. Please try again.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateDelay = (plannedDate) => {
    if (!plannedDate) return "On Time";

    const planned = new Date(plannedDate);
    const actual = new Date();
    const diffHours = Math.floor((actual - planned) / (1000 * 60 * 60));

    if (diffHours <= 0) return "On Time";
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} delay`;
  };

  const openImageViewer = (imageUrl) => {
    setViewingImage(imageUrl);
    setViewImageModal(true);
  };

  return (
    <div className="p-2 space-y-3 md:p-6 md:space-y-4 bg-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-2 justify-between items-start sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-3xl">
            Discharge Bill
          </h1>
          <p className="hidden mt-1 text-sm text-gray-600 sm:block">
            Process discharge bills after authority approval
          </p>
        </div>
      </div>
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => switchTab("pending")}
          className={`px-3 py-1.5 font-medium text-xs md:text-sm transition-colors relative ${
            activeTab === "pending"
              ? "text-green-600 border-b-2 border-green-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
            Pending
            {counts.pending > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-600 rounded-full">
                {counts.pending}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => switchTab("history")}
          className={`px-3 py-1.5 font-medium text-xs md:text-sm transition-colors relative ${
            activeTab === "history"
              ? "text-green-600 border-b-2 border-green-600"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
            History
            {counts.history > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-600 rounded-full">
                {counts.history}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* === PENDING SECTION === */}
      {activeTab === "pending" && (
        <div>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-green-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Action
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Admission No
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Patient Name
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Category
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Department
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Consultant
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Staff Name
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Planned Bill
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    RMO Name
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Summary Report
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Work File
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Concern Dept
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Authority
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingRecords.length > 0 ? (
                  pendingRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-green-50">
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <button
                          onClick={() => handleOpenBillModal(record)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
                          disabled={isSubmitting}
                        >
                          Add Bill
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">
                        {record.admission_no}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {record.patient_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.category || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.department}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.consultant_name || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.staff_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.planned5Date} {record.planned5Time}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.rmo_status}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.rmo_name}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {record.summary_report_image ? (
                          <button
                            onClick={() =>
                              openImageViewer(record.summary_report_image)
                            }
                            className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 bg-green-50 rounded hover:bg-green-100"
                            disabled={isSubmitting}
                          >
                            <Image className="w-3 h-3" />
                            View
                          </button>
                        ) : (
                          <span className="text-gray-500">No image</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            record.work_file === "Yes"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {record.work_file || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            record.concern_dept === "Yes"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {record.concern_dept || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.concern_authority_work_file}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="13"
                      className="px-4 py-12 text-center text-gray-500"
                    >
                      <Clock className="mx-auto mb-4 w-12 h-12 text-gray-300" />
                      <p className="text-lg font-medium">No pending bills</p>
                      <p>Records will appear here after authority approval</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - Pending */}
          <div className="space-y-2 md:hidden">
            {pendingRecords.length > 0 ? (
              pendingRecords.map((record) => (
                <div
                  key={record.id}
                  className="p-3 bg-white rounded-lg border shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-xs font-medium text-green-600">
                        {record.admission_no}
                      </div>
                      <div className="text-sm font-semibold">
                        {record.patient_name}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Category: {record.category || "N/A"}
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded-full">
                      Pending
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px] my-2">
                    <div>
                      <span className="text-gray-600">Dept:</span>{" "}
                      <strong>{record.department}</strong>
                    </div>
                    <div>
                      <span className="text-gray-600">Consultant:</span>{" "}
                      {record.consultant_name || "N/A"}
                    </div>
                    <div>
                      <span className="text-gray-600">Staff:</span>{" "}
                      {record.staff_name}
                    </div>
                    <div>
                      <span className="text-gray-600">Planned Bill:</span>{" "}
                      {record.planned5Date} {record.planned5Time}
                    </div>
                    <div>
                      <span className="text-gray-600">RMO:</span>{" "}
                      {record.rmo_name}
                    </div>
                    <div>
                      <span className="text-gray-600">Authority:</span>{" "}
                      <span
                        className={
                          record.concern_dept === "Yes"
                            ? "text-green-700"
                            : "text-red-700"
                        }
                      >
                        {record.concern_dept}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenBillModal(record)}
                    className="w-full mt-2 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
                    disabled={isSubmitting}
                  >
                    Add Bill Information
                  </button>

                  {record.summary_report_image && (
                    <div className="mt-2 text-right">
                      <button
                        onClick={() =>
                          openImageViewer(record.summary_report_image)
                        }
                        className="text-[10px] text-green-600 underline"
                        disabled={isSubmitting}
                      >
                        View Summary Report →
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-6 text-center bg-white rounded-lg border">
                <Clock className="mx-auto mb-3 w-10 h-10 text-gray-300" />
                <p className="text-sm font-medium">No pending bills</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === HISTORY SECTION === */}
      {activeTab === "history" && (
        <div>
          {/* Desktop History Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-green-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Admission No
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Patient Name
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Category
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Department
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Consultant
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Staff Name
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Planned Bill Date
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Actual Bill Date
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    RMO Name
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Summary Report
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Work File
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Concern dept
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Authority
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Bill Status
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase whitespace-nowrap">
                    Bill Image
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {historyRecords.length > 0 ? (
                  historyRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-green-50">
                      <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">
                        {record.admission_no}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {record.patient_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.category || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {record.department}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {record.consultant_name || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {record.staff_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.planned5Date} {record.planned5Time}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.actual5Date} {record.actual5Time}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {record.rmo_status}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {record.rmo_name}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {record.summary_report_image ? (
                          <button
                            onClick={() =>
                              openImageViewer(record.summary_report_image)
                            }
                            className="flex items-center gap-1 text-xs text-green-600"
                          >
                            <Image className="w-4 h-4" /> View
                          </button>
                        ) : (
                          "No image"
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            record.work_file === "Yes"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {record.work_file || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            record.concern_dept === "Yes"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {record.concern_dept || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {record.concern_authority_work_file}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            record.bill_status === "Yes"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {record.bill_status || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {record.bill_image ? (
                          <button
                            onClick={() => openImageViewer(record.bill_image)}
                            className="flex items-center gap-1 text-xs text-green-600"
                          >
                            <Image className="w-4 h-4" /> View
                          </button>
                        ) : (
                          "No image"
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="15"
                      className="py-12 text-center text-gray-500"
                    >
                      <CheckCircle className="mx-auto mb-4 w-12 h-12 text-gray-300" />
                      <p>No completed bills yet</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile History Cards */}
          <div className="space-y-2 md:hidden">
            {historyRecords.map((record) => (
              <div key={record.id} className="p-3 bg-white rounded-lg border">
                <div className="flex justify-between">
                  <div>
                    <div className="text-xs font-medium text-green-600">
                      {record.admission_no}
                    </div>
                    <div className="text-sm font-semibold">
                      {record.patient_name}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Category: {record.category || "N/A"}
                    </div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                      record.delay5 === "On Time" || !record.delay5
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {record.delay5 || "N/A"}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                  <div>
                    Dept: <strong>{record.department}</strong>
                  </div>
                  <div>Consultant: {record.consultant_name || "N/A"}</div>
                  <div>Staff: {record.staff_name}</div>
                  <div>
                    Planned Bill: {record.planned5Date} {record.planned5Time}
                  </div>
                  <div>
                    Actual Bill: {record.actual5Date} {record.actual5Time}
                  </div>
                  <div>
                    Authority:{" "}
                    <strong
                      className={
                        record.concern_dept === "Yes"
                          ? "text-green-700"
                          : "text-red-700"
                      }
                    >
                      {record.concern_dept}
                    </strong>
                  </div>
                  <div>
                    Bill Status:{" "}
                    <strong
                      className={
                        record.bill_status === "Yes"
                          ? "text-green-700"
                          : "text-red-700"
                      }
                    >
                      {record.bill_status}
                    </strong>
                  </div>
                </div>
                {record.bill_image && (
                  <div className="mt-2 text-right">
                    <button
                      onClick={() => openImageViewer(record.bill_image)}
                      className="text-[10px] text-green-600 underline"
                    >
                      View Bill Image →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {counts.history > 0 && (
            <Pagination
              page={historyPage}
              pageSize={HISTORY_PAGE_SIZE}
              total={counts.history}
              onPageChange={setHistoryPage}
              disabled={isLoading}
              label="bills"
            />
          )}
        </div>
      )}

      {/* Bill Entry Modal */}
      {showBillModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="relative max-w-2xl w-full bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <h3 className="text-xl font-semibold text-gray-900">
                Add Discharge Bill
              </h3>
              <button
                onClick={handleCloseBillModal}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Pre-filled Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admission No
                  </label>
                  <input
                    type="text"
                    value={selectedRecord.admission_no}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Name
                  </label>
                  <input
                    type="text"
                    value={selectedRecord.patient_name}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={selectedRecord.category || "N/A"}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={selectedRecord.department}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Consultant
                  </label>
                  <input
                    type="text"
                    value={selectedRecord.consultant_name || "N/A"}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>
              </div>

              {/* Bill Status Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bill Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={billStatus}
                  onChange={(e) => setBillStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  disabled={isSubmitting}
                >
                  <option value="">Select Bill Status</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              {/* Bill Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bill Image
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-green-400 transition-colors">
                  <div className="space-y-1 text-center">
                    {billImagePreview ? (
                      <div className="relative">
                        {billImageFile?.type === "application/pdf" ||
                        billImagePreview?.startsWith("data:application/pdf") ? (
                          <iframe
                            src={billImagePreview}
                            title="Bill Preview"
                            className="w-full h-48 rounded-lg"
                          />
                        ) : (
                          <img
                            src={billImagePreview}
                            className="mx-auto h-48 rounded-lg"
                          />
                        )}
                        <button
                          onClick={() => {
                            setBillImageFile(null);
                            setBillImagePreview("");
                          }}
                          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                          disabled={isSubmitting}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600">
                          <label className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500">
                            <span>Upload a file</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={handleBillImageUpload}
                              className="sr-only"
                              disabled={isSubmitting}
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          PNG, JPG, GIF, PDF up to 5MB
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCloseBillModal}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitBill}
                  disabled={isSubmitting}
                  className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium ${
                    isSubmitting
                      ? "bg-green-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {isSubmitting ? "Uploading Image..." : "Submit Bill"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewImageModal && viewingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
          <div className="relative max-w-4xl w-full bg-white rounded-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold">Image Viewer</h3>
              <button
                onClick={() => {
                  setViewImageModal(false);
                  setViewingImage(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 max-h-[80vh] overflow-auto">
              {viewingImage && viewingImage.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={viewingImage}
                  title="Document"
                  className="w-full h-[80vh] rounded"
                />
              ) : (
                <img
                  src={viewingImage}
                  alt="Document"
                  className="w-full rounded"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DischargeBill;
