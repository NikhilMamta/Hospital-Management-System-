import React, { useState, useEffect, useRef } from "react";
import { X, Eye, FileText, Upload, Check } from "lucide-react";
import supabase from "../../../SupabaseClient";
import { useNotification } from "../../../contexts/NotificationContext";
import Pagination from "../../../components/Pagination";
import { fetchAllRows } from "../../../utils/supabaseQuery";

const PAGE_SIZE = 50;

// Only the columns formatRecord reads (was select("*"))
const LAB_COLUMNS =
  "id, admission_no, patient_name, phone_no, age, gender, bed_no, location, ward_type, room, reason_for_visit, category, priority, radiology_type, radiology_tests, report_url, lab_report_remarks, planned3, actual3, payment_status";

// Format a raw lab record into the component's UI model
const formatRecord = (record) => ({
  id: record.id,
  uniqueNumber: record.admission_no || "N/A",
  patientName: record.patient_name || "N/A",
  phoneNumber: record.phone_no || "N/A",
  age: record.age || "N/A",
  gender: record.gender || "N/A",
  bedNo: record.bed_no || "N/A",
  location: record.location || "N/A",
  wardType: record.ward_type || "N/A",
  room: record.room || "N/A",
  reasonForVisit: record.reason_for_visit || "N/A",
  adviceNo: record.admission_no || "N/A",
  category: record.category,
  priority: record.priority,
  radiologyType: record.radiology_type,
  radiologyTests: record.radiology_tests || [],
  ctscanReport: record.report_url,
  ctscanRemarks: record.lab_report_remarks,
  planned3: record.planned3,
  actual3: record.actual3,
  paymentStatus: record.payment_status,
  ctScanId: record.id,
  admissionNo: record.admission_no,
});

const isRelevantRow = (row) =>
  row.category === "Radiology" && row.radiology_type === "CT-scan";
// Same conditions as the pending / history queries below
const isPendingRow = (row) =>
  isRelevantRow(row) &&
  row.payment_status === "Yes" &&
  !!row.planned3 &&
  !row.actual3;
const isHistoryRow = (row) =>
  isRelevantRow(row) && !!row.planned3 && !!row.actual3;

// Completed CT-Scan records (planned3 and actual3 set)
const historyQuery = (columns, options) =>
  supabase
    .from("lab")
    .select(columns, options)
    .eq("category", "Radiology")
    .eq("radiology_type", "CT-scan")
    .not("planned3", "is", null)
    .not("actual3", "is", null);

const CTScan = () => {
  const [activeTab, setActiveTabState] = useState("pending");
  const [pendingRecords, setPendingRecords] = useState([]);
  const [historyRecords, setHistoryRecords] = useState([]);
  // History is paged on the server (loading it whole was cut at 1,000 rows)
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyStats, setHistoryStats] = useState({ total: 0, high: 0 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [modalError, setModalError] = useState("");
  const [reportPreview, setReportPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedPatient, setSelectedPatientState] = useState("");
  const [selectedDate, setSelectedDateState] = useState("");
  const [patientNames, setPatientNames] = useState([]);
  const { showNotification } = useNotification();

  // A new tab or filter starts the history list again at page 0
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    setHistoryPage(0);
  };
  const setSelectedPatient = (name) => {
    setSelectedPatientState(name);
    setHistoryPage(0);
  };
  const setSelectedDate = (date) => {
    setSelectedDateState(date);
    setHistoryPage(0);
  };

  // Latest lists for the realtime handler (it is created once, on mount)
  const pendingRef = useRef([]);
  const historyRef = useRef([]);
  useEffect(() => {
    pendingRef.current = pendingRecords;
  }, [pendingRecords]);
  useEffect(() => {
    historyRef.current = historyRecords;
  }, [historyRecords]);

  // Re-reads the history page and counts once; a save and its own realtime
  // event (or a burst of events) arrive within this window and share one fetch.
  const historyTimer = useRef(null);
  const refreshHistory = () => {
    clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(
      () => setHistoryVersion((v) => v + 1),
      1000,
    );
  };

  const [formData, setFormData] = useState({
    reportImage: null,
    remarks: "",
  });

  useEffect(() => {
    loadData();

    // Incrementally update state from a single realtime event
    const handleRealtimeChange = (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;

      if (eventType === "DELETE") {
        const id = oldRow?.id;
        if (!id) return;
        setPendingRecords((prev) => prev.filter((r) => r.id !== id));
        refreshHistory(); // the row may be on any history page
        return;
      }

      // INSERT or UPDATE
      const row = newRow;
      if (!row) return;

      const wasPending = pendingRef.current.some((r) => r.id === row.id);
      const onHistoryPage = historyRef.current.some((r) => r.id === row.id);

      // Remove first, then re-add if it still belongs (handles pending → history)
      setPendingRecords((prev) => prev.filter((r) => r.id !== row.id));
      if (isPendingRow(row)) {
        setPendingRecords((prev) => [formatRecord(row), ...prev]);
      }

      // History is paged on the server: re-read it when this row is (or was)
      // part of it, instead of patching one page
      if (
        onHistoryPage ||
        isHistoryRow(row) ||
        (isPendingRow(row) && !wasPending)
      ) {
        refreshHistory();
      }

      if (!isRelevantRow(row)) return;

      // Add patient name if new
      if (row.patient_name) {
        setPatientNames((prev) =>
          prev.includes(row.patient_name)
            ? prev
            : [...prev, row.patient_name].sort(),
        );
      }
    };

    const channel = supabase
      .channel("ctscan-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lab",
        },
        (payload) => {
          handleRealtimeChange(payload);
        },
      )
      .subscribe();

    return () => {
      clearTimeout(historyTimer.current);
      supabase.removeChannel(channel);
    };
  }, []);

  // History page + the history-wide counts used by the stat cards
  useEffect(() => {
    let ignore = false;

    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const from = historyPage * PAGE_SIZE;
        let pageQuery = historyQuery(LAB_COLUMNS, { count: "exact" })
          .order("actual3", { ascending: false })
          .order("id", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        // Same filters as the pending tab, run on the server
        if (selectedPatient) {
          pageQuery = pageQuery.eq("patient_name", selectedPatient);
        }
        if (selectedDate) {
          pageQuery = pageQuery
            .gte("planned3", `${selectedDate} 00:00:00`)
            .lte("planned3", `${selectedDate} 23:59:59.999`);
        }

        const [pageRes, totalRes, highRes] = await Promise.all([
          pageQuery,
          historyQuery("id", { count: "exact", head: true }),
          historyQuery("id", { count: "exact", head: true }).eq(
            "priority",
            "High",
          ),
        ]);
        const error = pageRes.error || totalRes.error || highRes.error;
        if (error) throw error;
        if (ignore) return;

        const total = pageRes.count ?? 0;
        // The page can run past the end after rows move out of history
        if (!pageRes.data?.length && historyPage > 0 && total > 0) {
          setHistoryPage(Math.ceil(total / PAGE_SIZE) - 1);
          return;
        }

        setHistoryRecords((pageRes.data || []).map(formatRecord));
        setHistoryTotal(total);
        setHistoryStats({
          total: totalRes.count ?? 0,
          high: highRes.count ?? 0,
        });
      } catch (error) {
        console.error("Failed to load history:", error);
        if (!ignore) setModalError("Failed to load data. Please try again.");
      } finally {
        if (!ignore) {
          setHistoryLoading(false);
          setHistoryReady(true);
        }
      }
    };

    loadHistory();
    return () => {
      ignore = true;
    };
  }, [historyPage, selectedPatient, selectedDate, historyVersion]);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setInitialLoading(true);

      const [pendingData, historyNames] = await Promise.all([
        // Pending CT-Scan records
        // Conditions: category = 'Radiology', radiology_type = 'CT-scan', planned3 IS NOT NULL, actual3 IS NULL, payment_status = 'Yes'
        // The queue is short, so it is loaded whole (in 1,000-row chunks, never cut off).
        fetchAllRows((from, to) =>
          supabase
            .from("lab")
            .select(LAB_COLUMNS)
            .eq("category", "Radiology")
            .eq("radiology_type", "CT-scan")
            .eq("payment_status", "Yes")
            .not("planned3", "is", null)
            .is("actual3", null)
            .order("timestamp", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to),
        ),
        // The patient filter lists everyone in pending + all of history,
        // so only the name column of history is read here
        fetchAllRows((from, to) =>
          historyQuery("patient_name").order("id").range(from, to),
        ),
      ]);

      const formattedPending = pendingData.map(formatRecord);
      setPendingRecords(formattedPending);

      // Extract unique patient names for filter
      const allRecords = [
        ...formattedPending,
        ...historyNames.map(formatRecord),
      ];
      const names = [...new Set(allRecords.map((r) => r.patientName))].sort();
      setPatientNames(names);
    } catch (error) {
      console.error("Failed to load data:", error);
      setModalError("Failed to load data. Please try again.");
    } finally {
      setInitialLoading(false);
    }
  };

  // Refresh button: pending queue + current history page
  const handleRefresh = () => {
    loadData(true);
    setHistoryVersion((v) => v + 1);
  };

  const handleActionClick = (record) => {
    setSelectedRecord(record);
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleReportChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setModalError("File size should be less than 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          reportImage: reader.result,
        }));
        setReportPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!formData.reportImage) {
      setModalError("Please upload report image");
      return;
    }

    if (!formData.remarks.trim()) {
      setModalError("Please enter remarks");
      return;
    }

    try {
      setLoading(true);

      // Extract raw base64 data and mime type
      const [meta, base64Data] = formData.reportImage.split(",");
      const mimeType = meta.split(":")[1].split(";")[0];

      const binaryData = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(binaryData.length);
      const uint8Array = new Uint8Array(arrayBuffer);

      for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i);
      }

      const blob = new Blob([uint8Array], { type: mimeType });

      // Determine extension based on mime type
      const fileExt = mimeType === "application/pdf" ? "pdf" : "jpg";
      const fileName = `ctscan_${selectedRecord.id}_${Date.now()}.${fileExt}`;

      // Upload report to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("ctscan_reports")
        .upload(fileName, blob, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("ctscan_reports").getPublicUrl(fileName);

      // Update lab record with CT-Scan info
      const { error: updateError } = await supabase
        .from("lab")
        .update({
          report_url: publicUrl,
          lab_report_remarks: formData.remarks,
          actual3: new Date()
            .toLocaleString("en-CA", {
              timeZone: "Asia/Kolkata",
              hour12: false,
            })
            .replace(",", ""),
          planned4: new Date()
            .toLocaleString("en-CA", {
              timeZone: "Asia/Kolkata",
              hour12: false,
            })
            .replace(",", ""),
        })
        .eq("id", selectedRecord.id);

      if (updateError) throw updateError;

      // The record leaves the pending queue and joins history. Patch the queue
      // here and re-read history once, instead of a full reload that the
      // realtime event for this same update would repeat.
      setPendingRecords((prev) =>
        prev.filter((r) => r.id !== selectedRecord.id),
      );
      refreshHistory();

      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Failed to save CT-Scan report:", error);
      setModalError("Failed to save report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      reportImage: null,
      remarks: "",
    });
    setReportPreview(null);
    setModalError("");
    setSelectedRecord(null);
  };

  const handleViewClick = (record) => {
    setViewingRecord(record);
    setShowViewModal(true);
  };

  const handleViewReport = (reportUrl) => {
    if (!reportUrl) {
      showNotification("No CT-Scan report available", "info");
      return;
    }

    // Check if it's a PDF
    const isPdf = reportUrl.toLowerCase().includes(".pdf");

    if (isPdf) {
      window.open(reportUrl, "_blank");
    } else {
      const newWindow = window.open();
      newWindow.document.write(`
        <html>
          <head><title>CT-Scan Report</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
            <img src="${reportUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
          </body>
        </html>
      `);
    }
  };

  // Filter Logic
  const applyFilters = (records) => {
    return records.filter((record) => {
      const matchesPatient = selectedPatient
        ? record.patientName === selectedPatient
        : true;
      // Date Matching on Planned3
      let matchesDate = true;
      if (selectedDate) {
        if (!record.planned3) {
          matchesDate = false;
        } else {
          const recordDate = new Date(record.planned3).toLocaleDateString(
            "en-CA",
          );
          const filterDate = selectedDate;
          matchesDate = recordDate === filterDate;
        }
      }
      return matchesPatient && matchesDate;
    });
  };

  const filteredPendingRecords = applyFilters(pendingRecords);
  const filteredHistoryRecords = historyRecords; // filtered and paged on the server

  // Calculate statistics (history part counted on the server)
  const totalRecords = pendingRecords.length + historyStats.total;
  const completedRecords = historyStats.total;
  const pendingCount = pendingRecords.length;
  const highPriorityCount =
    pendingRecords.filter((r) => r.priority === "High").length +
    historyStats.high;

  if (initialLoading || !historyReady) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-600">Loading CT-Scan data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Fixed Section: Header, Stats, and Filters */}
      <div className="flex-none bg-white border-b border-gray-200 shrink-0 shadow-sm z-10">
        <div className="px-4 py-2 sm:px-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl lg:text-3xl">
                CT-Scan Management
              </h1>
              <p className="hidden mt-0.5 text-xs text-gray-600 sm:block">
                Process CT-Scan reports and manage records
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className="px-4 py-1.5 text-xs font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-all shadow-sm active:scale-95"
            >
              REFRESH
            </button>
          </div>
        </div>

        {/* Statistics Cards - Condensed Grid */}
        <div className="px-3 sm:px-4 py-2">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
            {[
              {
                label: "Total CT",
                val: totalRecords,
                color: "text-green-600",
                bg: "bg-green-50",
                border: "border-green-100",
              },
              {
                label: "Completed",
                val: completedRecords,
                color: "text-green-600",
                bg: "bg-green-50",
                border: "border-green-100",
              },
              {
                label: "Pending",
                val: pendingCount,
                color: "text-orange-600",
                bg: "bg-orange-50",
                border: "border-orange-100",
              },
              {
                label: "High Priority",
                val: highPriorityCount,
                color: "text-red-600",
                bg: "bg-red-50",
                border: "border-red-100",
              },
            ].map((s, idx) => (
              <div
                key={idx}
                className={`p-2 ${s.bg} rounded-lg border ${s.border} shadow-sm`}
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-500 uppercase leading-tight">
                    {s.label}
                  </span>
                  <span
                    className={`text-base font-black ${s.color} mt-0.5 leading-none`}
                  >
                    {s.val}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Combined Tabs & Filters */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pb-2 transition-all">
            <nav className="flex gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar border-b lg:border-none">
              {["pending", "history"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-bold whitespace-nowrap transition-all border-b-2 ${
                    activeTab === tab
                      ? "border-green-600 text-green-700 bg-green-50/50"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {tab.toUpperCase()} (
                  {tab === "pending"
                    ? filteredPendingRecords.length
                    : historyTotal}
                  )
                </button>
              ))}
            </nav>

            <div className="flex flex-wrap lg:flex-nowrap gap-2 w-full lg:w-auto">
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="flex-1 lg:w-48 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-green-500 outline-none"
              >
                <option value="">All Patients</option>
                {patientNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 lg:w-40 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-green-500 outline-none"
              />

              {(selectedPatient || selectedDate) && (
                <button
                  onClick={() => {
                    setSelectedPatient("");
                    setSelectedDate("");
                  }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-xs font-bold transition-colors"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-hidden p-3 md:p-4">
        <div className="h-full flex flex-col">
          {/* Pending Section */}
          {activeTab === "pending" && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Desktop Table - Scrollable Container */}
              <div className="hidden md:block flex-1 overflow-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 border-separate border-tools">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                        Action
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                        Admission No
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                        Patient Name
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                        Phone Number
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50 min-w-[300px]">
                        Reason For Visit
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                        Age
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                        Bed No.
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                        Location
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                        Ward Type
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                        Room
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                        Priority
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                        Category
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                        Tests
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                        Planned
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPendingRecords.length > 0 ? (
                      filteredPendingRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <button
                              onClick={() => handleActionClick(record)}
                              className="px-3 py-1.5 text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700"
                            >
                              Process
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">
                            {record.admissionNo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.patientName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.phoneNumber}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-[350px] whitespace-normal break-words text-center">
                            {record.reasonForVisit}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.age}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.bedNo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.location}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.wardType}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.room}
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                record.priority === "High"
                                  ? "bg-red-100 text-red-700"
                                  : record.priority === "Medium"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"
                              }`}
                            >
                              {record.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.radiologyType}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.radiologyTests?.map((test, index) => (
                              <div key={index}>{test}</div>
                            ))}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.planned3
                              ? new Date(record.planned3).toLocaleString(
                                  "en-GB",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "2-digit",
                                    month: "short",
                                  },
                                )
                              : "-"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="14"
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          <FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                          <p className="text-lg font-medium text-gray-900">
                            No pending CT-Scan records
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            CT-Scan records with payment status will appear here
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View - Scrollable Container */}
              <div className="md:hidden flex-1 overflow-auto space-y-3">
                {filteredPendingRecords.length > 0 ? (
                  filteredPendingRecords.map((record) => (
                    <div
                      key={record.id}
                      className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-xs font-medium text-green-600 mb-1">
                            Admission No: {record.admissionNo}
                          </div>
                          <h3 className="text-sm font-semibold text-gray-900">
                            {record.patientName}
                          </h3>
                        </div>
                        <button
                          onClick={() => handleActionClick(record)}
                          className="flex-shrink-0 px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg shadow-sm"
                        >
                          Process
                        </button>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Phone:</span>
                          <span className="font-medium text-gray-900">
                            {record.phoneNumber}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Age:</span>
                          <span className="font-medium text-gray-900">
                            {record.age}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bed/Room:</span>
                          <span className="font-medium text-gray-900">
                            {record.bedNo} / {record.room}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Priority:</span>
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              record.priority === "High"
                                ? "bg-red-100 text-red-700"
                                : record.priority === "Medium"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {record.priority}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Planned:</span>
                          <span className="font-medium text-gray-900">
                            {record.planned3
                              ? new Date(record.planned3).toLocaleString(
                                  "en-GB",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "2-digit",
                                    month: "short",
                                  },
                                )
                              : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
                    <FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                    <p className="text-sm font-medium text-gray-900">
                      No pending CT-Scan records
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      CT-Scan records with payment status will appear here
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History Section */}
          {activeTab === "history" && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Desktop Table - Scrollable Container */}
              <div className="hidden md:block flex-1 overflow-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 border-separate border-tools">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Admission No
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Patient Name
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Phone Number
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50 min-w-[300px]">
                        Reason For Visit
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Age
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Bed No.
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Location
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Ward Type
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Room
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Priority
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Category
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Tests
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Planned
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Completed
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50">
                        Report
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase bg-gray-50 min-w-[300px]">
                        Remarks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredHistoryRecords.length > 0 ? (
                      filteredHistoryRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">
                            {record.admissionNo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.patientName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.phoneNumber}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-[350px] whitespace-normal break-words text-center">
                            {record.reasonForVisit}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.age}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.bedNo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.location}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.wardType}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.room}
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                record.priority === "High"
                                  ? "bg-red-100 text-red-700"
                                  : record.priority === "Medium"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"
                              }`}
                            >
                              {record.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.radiologyType}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.radiologyTests?.map((test, index) => (
                              <div key={index}>{test}</div>
                            ))}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.planned3
                              ? new Date(record.planned3).toLocaleString(
                                  "en-GB",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "2-digit",
                                    month: "short",
                                  },
                                )
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.actual3
                              ? new Date(record.actual3).toLocaleString(
                                  "en-GB",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "2-digit",
                                    month: "short",
                                  },
                                )
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <button
                              onClick={() => handleViewClick(record)}
                              className="flex gap-1 items-center px-3 py-1.5 text-green-600 bg-green-50 rounded-lg shadow-sm hover:bg-green-100"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-[350px] whitespace-normal break-words text-center">
                            {record.ctscanRemarks}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="16"
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          <FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                          <p className="text-lg font-medium text-gray-900">
                            No history records
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View - Scrollable Container */}
              <div className="md:hidden flex-1 overflow-auto space-y-3">
                {filteredHistoryRecords.length > 0 ? (
                  filteredHistoryRecords.map((record) => (
                    <div
                      key={record.id}
                      className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-xs font-medium text-green-600 mb-1">
                            Admission No: {record.admissionNo}
                          </div>
                          <h3 className="text-sm font-semibold text-gray-900">
                            {record.patientName}
                          </h3>
                        </div>
                        <button
                          onClick={() => handleViewClick(record)}
                          className="flex-shrink-0 px-3 py-1.5 text-xs text-green-600 bg-green-50 rounded-lg"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Phone:</span>
                          <span className="font-medium text-gray-900">
                            {record.phoneNumber}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Age:</span>
                          <span className="font-medium text-gray-900">
                            {record.age}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Planned:</span>
                          <span className="font-medium text-gray-900">
                            {record.planned3
                              ? new Date(record.planned3).toLocaleString(
                                  "en-GB",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "2-digit",
                                    month: "short",
                                  },
                                )
                              : "-"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Completed:</span>
                          <span className="font-medium text-gray-900">
                            {record.actual3
                              ? new Date(record.actual3).toLocaleString(
                                  "en-GB",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "2-digit",
                                    month: "short",
                                  },
                                )
                              : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Remarks:</span>
                          <div className="font-medium text-gray-900 mt-1 line-clamp-2">
                            {record.ctscanRemarks}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
                    <FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                    <p className="text-sm font-medium text-gray-900">
                      No history records
                    </p>
                  </div>
                )}
              </div>

              <div className="shrink-0 mt-3 overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                <Pagination
                  page={historyPage}
                  pageSize={PAGE_SIZE}
                  total={historyTotal}
                  onPageChange={setHistoryPage}
                  disabled={historyLoading}
                  label="records"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Process Modal */}
      {showModal && selectedRecord && (
        <div className="overflow-y-auto fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
            <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-white border-b border-gray-200 md:p-6">
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">
                Process CT-Scan Report
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-1 text-gray-400 rounded-full hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 md:p-6">
              {/* Pre-filled Patient Info */}
              <div className="p-4 mb-6 bg-green-50 rounded-lg border border-green-200">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  Patient Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                  <div>
                    <span className="text-gray-600">Admission No:</span>
                    <div className="font-medium text-green-600">
                      {selectedRecord.admissionNo}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <div className="font-medium text-gray-900">
                      {selectedRecord.patientName}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <div className="font-medium text-gray-900">
                      {selectedRecord.phoneNumber}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Age:</span>
                    <div className="font-medium text-gray-900">
                      {selectedRecord.age}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Bed No:</span>
                    <div className="font-medium text-gray-900">
                      {selectedRecord.bedNo}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Location:</span>
                    <div className="font-medium text-gray-900">
                      {selectedRecord.location}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Ward Type:</span>
                    <div className="font-medium text-gray-900">
                      {selectedRecord.wardType}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Room:</span>
                    <div className="font-medium text-gray-900">
                      {selectedRecord.room}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Category:</span>
                    <div className="font-medium text-gray-900">
                      {selectedRecord.radiologyType}
                    </div>
                  </div>
                </div>
              </div>

              {/* Report Form */}
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Upload Report *
                  </label>
                  <div className="mt-1">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleReportChange}
                      className="hidden"
                      id="report-upload"
                    />
                    <label
                      htmlFor="report-upload"
                      className="flex flex-col items-center justify-center px-4 py-6 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors"
                    >
                      {reportPreview ? (
                        <div className="text-center w-full">
                          {reportPreview.startsWith("data:application/pdf") ? (
                            <div className="flex flex-col items-center justify-center h-40 bg-gray-100 rounded-lg mb-2">
                              <FileText className="w-12 h-12 text-red-500 mb-2" />
                              <span className="text-sm font-medium text-gray-700">
                                PDF Report Selected
                              </span>
                            </div>
                          ) : (
                            <img
                              src={reportPreview}
                              alt="Report preview"
                              className="max-h-40 mx-auto mb-2 rounded object-contain"
                            />
                          )}
                          <p className="text-sm text-green-600 font-medium flex items-center justify-center gap-1">
                            <Check className="w-4 h-4" />
                            Report uploaded successfully
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Click to change file
                          </p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="mx-auto w-12 h-12 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">
                            Click to upload CT-Scan report
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            PNG, JPG, PDF up to 5MB
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Remarks *
                  </label>
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleInputChange}
                    rows="4"
                    placeholder="Enter remarks about the CT-Scan report..."
                    className="px-3 py-2 w-full bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {modalError && (
                <div className="p-3 mt-4 text-sm text-red-700 bg-red-100 rounded-lg">
                  {modalError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 justify-end mt-6 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-6 py-2 w-full font-medium text-gray-700 bg-gray-100 rounded-lg transition-colors hover:bg-gray-200 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-2 w-full font-medium text-white bg-green-600 rounded-lg transition-colors hover:bg-green-700 disabled:opacity-50 sm:w-auto"
                >
                  {loading ? "Processing..." : "Save Report"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showViewModal && viewingRecord && (
        <div className="overflow-y-auto fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
            <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-white border-b border-gray-200 md:p-6">
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">
                CT-Scan Report Details
              </h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-1 text-gray-400 rounded-full hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-6">
              {/* Patient Information */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  Patient Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                  <div>
                    <span className="text-gray-600">Admission No:</span>
                    <div className="font-medium text-green-600">
                      {viewingRecord.admissionNo}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <div className="font-medium text-gray-900">
                      {viewingRecord.patientName}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <div className="font-medium text-gray-900">
                      {viewingRecord.phoneNumber}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Age:</span>
                    <div className="font-medium text-gray-900">
                      {viewingRecord.age}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Gender:</span>
                    <div className="font-medium text-gray-900">
                      {viewingRecord.gender}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Bed No:</span>
                    <div className="font-medium text-gray-900">
                      {viewingRecord.bedNo}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Room:</span>
                    <div className="font-medium text-gray-900">
                      {viewingRecord.room}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Category:</span>
                    <div className="font-medium text-gray-900">
                      {viewingRecord.radiologyType}
                    </div>
                  </div>
                </div>
              </div>

              {/* Report Image */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  CT-Scan Report
                </h3>
                <div className="p-2 border rounded-lg">
                  {viewingRecord.ctscanReport ? (
                    viewingRecord.ctscanReport
                      .toLowerCase()
                      .includes(".pdf") ? (
                      <div className="relative group">
                        <iframe
                          src={viewingRecord.ctscanReport}
                          className="w-full h-96 rounded border border-gray-200"
                          title="CT-Scan Report PDF"
                        />
                        <button
                          onClick={() =>
                            handleViewReport(viewingRecord.ctscanReport)
                          }
                          className="absolute top-2 right-2 p-2 bg-green-600 text-white rounded hover:bg-green-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Open in Full Screen"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer group relative"
                        onClick={() =>
                          handleViewReport(viewingRecord.ctscanReport)
                        }
                      >
                        <img
                          src={viewingRecord.ctscanReport}
                          alt="CT-Scan Report"
                          className="w-full h-auto rounded"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                            Click to expand
                          </span>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center h-40 bg-gray-50 text-gray-500 text-sm">
                      No report image available
                    </div>
                  )}
                </div>
              </div>

              {/* Remarks */}
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                  Remarks
                </h3>
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                  {viewingRecord.ctscanRemarks || "No remarks added"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CTScan;
