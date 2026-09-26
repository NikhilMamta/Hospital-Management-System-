import React, { useState, useEffect, useRef } from "react";
import { X, Check, FileText, Calendar, Search, Filter } from "lucide-react";
import supabase from "../../../SupabaseClient";
import { useNotification } from "../../../contexts/NotificationContext";
import Pagination from "../../../components/Pagination";
import { fetchAllRows } from "../../../utils/supabaseQuery";

// History used to show only the latest 100; pages of 100 keep that first view
const PAGE_SIZE = 100;

// Only the columns the lists read (was select("*"))
const LAB_COLUMNS =
  "id, lab_no, admission_no, patient_name, phone_no, reason_for_visit, category, pathology_tests, radiology_tests, payment_status, planned2, actual2";

// Same conditions as the pending / history queries below
const isPendingRow = (row) =>
  row.payment_status === "Yes" && !!row.planned2 && !row.actual2;
const isHistoryRow = (row) => row.payment_status === "Yes" && !!row.actual2;

// Received samples (payment done, actual2 set)
const historyQuery = (columns, options) =>
  supabase
    .from("lab")
    .select(columns, options)
    .eq("payment_status", "Yes")
    .not("actual2", "is", null);

const ReceiveSample = () => {
  const [pendingSamples, setPendingSamples] = useState([]);
  const [historySamples, setHistorySamples] = useState([]);
  // History is paged on the server (it was cut at the latest 100)
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyStats, setHistoryStats] = useState({
    pathology: 0,
    radiology: 0,
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeTab, setActiveTabState] = useState("pending");

  // Filters
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
    pendingRef.current = pendingSamples;
  }, [pendingSamples]);
  useEffect(() => {
    historyRef.current = historySamples;
  }, [historySamples]);

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

  useEffect(() => {
    loadData();

    // Incrementally update state from a single realtime event
    const handleRealtimeChange = (payload) => {
      const { eventType, new: newRow, old: oldRow } = payload;

      if (eventType === "DELETE") {
        const id = oldRow?.id;
        if (!id) return;
        setPendingSamples((prev) => prev.filter((r) => r.id !== id));
        refreshHistory(); // the row may be on any history page
        return;
      }

      const row = newRow;
      if (!row) return;

      const wasPending = pendingRef.current.some((r) => r.id === row.id);
      const onHistoryPage = historyRef.current.some((r) => r.id === row.id);

      setPendingSamples((prev) => prev.filter((r) => r.id !== row.id));

      if (isPendingRow(row)) {
        setPendingSamples((prev) => [row, ...prev]);
      }

      // History is paged on the server: re-read it when a record moves in or
      // out of it (records reach history from the pending queue) or when it
      // is on the page being shown
      const movedQueue =
        eventType === "INSERT"
          ? isHistoryRow(row)
          : wasPending !== isPendingRow(row);
      if (onHistoryPage || movedQueue) refreshHistory();

      if (row.patient_name) {
        setPatientNames((prev) =>
          prev.includes(row.patient_name)
            ? prev
            : [...prev, row.patient_name].sort(),
        );
      }
    };

    const channel = supabase
      .channel("receive-sample-changes")
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
          .order("actual2", { ascending: false })
          .order("id", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        // Same filters as the pending tab, run on the server
        if (selectedPatient) {
          pageQuery = pageQuery.eq("patient_name", selectedPatient);
        }
        if (selectedDate) {
          pageQuery = pageQuery
            .gte("planned2", `${selectedDate} 00:00:00`)
            .lte("planned2", `${selectedDate} 23:59:59.999`);
        }

        const [pageRes, pathologyRes, radiologyRes] = await Promise.all([
          pageQuery,
          historyQuery("id", { count: "exact", head: true }).eq(
            "category",
            "Pathology",
          ),
          historyQuery("id", { count: "exact", head: true }).eq(
            "category",
            "Radiology",
          ),
        ]);
        const error =
          pageRes.error || pathologyRes.error || radiologyRes.error;
        if (error) throw error;
        if (ignore) return;

        const total = pageRes.count ?? 0;
        // The page can run past the end after rows move out of history
        if (!pageRes.data?.length && historyPage > 0 && total > 0) {
          setHistoryPage(Math.ceil(total / PAGE_SIZE) - 1);
          return;
        }

        setHistorySamples(pageRes.data || []);
        setHistoryTotal(total);
        setHistoryStats({
          pathology: pathologyRes.count ?? 0,
          radiology: radiologyRes.count ?? 0,
        });
      } catch (error) {
        console.error("Failed to load sample history:", error);
        if (!ignore) showNotification("Failed to load sample data.", "error");
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
      if (!silent) setIsInitialLoading(true);

      const [pending, historyNames] = await Promise.all([
        // Load Pending: planned2 is NOT NULL (Scheduled) AND actual2 is NULL (Not Received).
        // Loaded whole (in 1,000-row chunks) so the queue is never cut off.
        fetchAllRows((from, to) =>
          supabase
            .from("lab")
            .select(LAB_COLUMNS)
            .eq("payment_status", "Yes")
            .not("planned2", "is", null)
            .is("actual2", null)
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

      setPendingSamples(pending);

      // Extract unique patient names for filter
      const allRecords = [...pending, ...historyNames];
      const names = [
        ...new Set(allRecords.map((r) => r.patient_name).filter(Boolean)),
      ].sort();
      setPatientNames(names);
    } catch (error) {
      console.error("Failed to load data:", error);
      showNotification("Failed to load sample data.", "error");
    } finally {
      setLoading(false);
      setIsInitialLoading(false);
    }
  };

  const handleReceiveSample = async (record) => {
    try {
      // ISO string is better for consistency, but matching existing pattern
      const currentTimestamp = new Date().toISOString();

      const updateData = {
        receive_sample: "received",
        actual2: currentTimestamp,
        planned3: currentTimestamp, // planning next step immediately?
      };

      const { error } = await supabase
        .from("lab")
        .update(updateData)
        .eq("id", record.id);

      if (error) throw error;

      showNotification("Sample received successfully!", "success");
      // The sample moves from pending to history. Patch the queue here and
      // re-read history once (was a full reload on top of the realtime update).
      setPendingSamples((prev) => prev.filter((r) => r.id !== record.id));
      refreshHistory();
    } catch (error) {
      console.error("Failed to receive sample:", error);
      showNotification("Failed to update sample status.", "error");
    }
  };

  // Helper to calculate stats (history part counted on the server; it was
  // counted from the latest 100 only)
  const pendPath = pendingSamples.filter(
    (r) => r.category === "Pathology",
  ).length;
  const pendRad = pendingSamples.filter(
    (r) => r.category === "Radiology",
  ).length;
  const stats = {
    totalPath: pendPath + historyStats.pathology,
    totalRad: pendRad + historyStats.radiology,
    pendPath,
    pendRad,
    compPath: historyStats.pathology,
    compRad: historyStats.radiology,
  };

  // Filter Logic (pending queue; history is filtered on the server)
  const filterRecords = (records) => {
    return records.filter((record) => {
      const matchesPatient = selectedPatient
        ? record.patient_name === selectedPatient
        : true;

      // Date matching on planned2
      let matchesDate = true;
      if (selectedDate) {
        // Try to parse planned2. It might be nullable or various formats.
        if (!record.planned2) matchesDate = false;
        else {
          const recordDate = new Date(record.planned2).toDateString();
          const filterDate = new Date(selectedDate).toDateString();
          matchesDate = recordDate === filterDate;
        }
      }
      return matchesPatient && matchesDate;
    });
  };

  const filteredPending = filterRecords(pendingSamples);
  const filteredHistory = historySamples; // filtered and paged on the server

  // Date formatter
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isInitialLoading || !historyReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Fixed Section: Header, Stats, Tabs & Filters */}
      <div className="flex-none bg-white border-b border-gray-200 shrink-0">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 justify-between items-start sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl lg:text-3xl">
                Receive Sample
              </h1>
              <p className="hidden mt-1 text-sm text-gray-500 sm:block">
                Manage incoming lab samples collection
              </p>
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3 mb-4 md:grid-cols-3 lg:grid-cols-6 pt-2">
            {/* Total Path */}
            <div className="p-3 bg-white rounded-lg border border-green-200 shadow-sm sm:p-4">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-600 uppercase truncate">
                  Total Path
                </span>
                <span className="text-lg font-bold text-green-600 mt-1 sm:text-l">
                  {stats.totalPath}
                </span>
              </div>
            </div>
            {/* Total Rad */}
            <div className="p-3 bg-white rounded-lg border border-purple-200 shadow-sm sm:p-4">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-600 uppercase truncate">
                  Total Rad
                </span>
                <span className="text-lg font-bold text-purple-600 mt-1 sm:text-l">
                  {stats.totalRad}
                </span>
              </div>
            </div>
            {/* Comp Path */}
            <div className="p-3 bg-white rounded-lg border border-green-200 shadow-sm sm:p-4">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-600 uppercase truncate">
                  Comp Path
                </span>
                <span className="text-lg font-bold text-green-600 mt-1 sm:text-l">
                  {stats.compPath}
                </span>
              </div>
            </div>
            {/* Comp Rad */}
            <div className="p-3 bg-white rounded-lg border border-teal-200 shadow-sm sm:p-4">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-600 uppercase truncate">
                  Comp Rad
                </span>
                <span className="text-lg font-bold text-teal-600 mt-1 sm:text-l">
                  {stats.compRad}
                </span>
              </div>
            </div>
            {/* Pend Path */}
            <div className="p-3 bg-white rounded-lg border border-orange-200 shadow-sm sm:p-4">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-600 uppercase truncate">
                  Pend Path
                </span>
                <span className="text-lg font-bold text-orange-600 mt-1 sm:text-l">
                  {stats.pendPath}
                </span>
              </div>
            </div>
            {/* Pend Rad */}
            <div className="p-3 bg-white rounded-lg border border-red-200 shadow-sm sm:p-4">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-600 uppercase truncate">
                  Pend Rad
                </span>
                <span className="text-lg font-bold text-red-600 mt-1 sm:text-l">
                  {stats.pendRad}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs & Filters */}
          <div className="border-b border-gray-200 mb-0">
            {/* Desktop Layout */}
            <div className="hidden lg:flex lg:items-center lg:justify-between pb-0">
              <nav className="flex gap-4 -mb-[1px]">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`px-6 py-3 text-base font-medium border-b-2 transition-colors ${
                    activeTab === "pending"
                      ? "border-green-500 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Pending ({filteredPending.length})
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-6 py-3 text-base font-medium border-b-2 transition-colors ${
                    activeTab === "history"
                      ? "border-green-500 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  History ({historyTotal})
                </button>
              </nav>

              <div className="flex gap-3 items-center">
                <select
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm min-w-[180px]"
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
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
                {(selectedPatient || selectedDate) && (
                  <button
                    onClick={() => {
                      setSelectedPatient("");
                      setSelectedDate("");
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Layout */}
            <div className="lg:hidden flex flex-col gap-2 sm:gap-3 pb-2 sm:pb-3">
              <nav className="flex gap-2 sm:gap-4 -mb-[1px]">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium border-b-2 transition-colors ${
                    activeTab === "pending"
                      ? "border-green-500 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Pending ({filteredPending.length})
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium border-b-2 transition-colors ${
                    activeTab === "history"
                      ? "border-green-500 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  History ({historyTotal})
                </button>
              </nav>
              <div className="flex flex-wrap gap-2">
                <select
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="flex-1 min-w-[140px] px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs sm:text-sm"
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
                  className="flex-1 min-w-[140px] px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs sm:text-sm"
                />
                {(selectedPatient || selectedDate) && (
                  <button
                    onClick={() => {
                      setSelectedPatient("");
                      setSelectedDate("");
                    }}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-hidden p-3 md:p-4">
        {/* Content */}
        {activeTab === "pending" && (
          <div className="h-full flex flex-col">
            {/* Desktop Table */}
            <div className="hidden flex-1 overflow-hidden bg-white rounded-lg border border-gray-200 shadow-sm md:flex flex-col">
              <div className="overflow-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Action
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Lab No
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Patient Name
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase min-w-[200px]">
                        Reason For Visit
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Category
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Tests
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Planned
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPending.length > 0 ? (
                      filteredPending.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <button
                              onClick={() => handleReceiveSample(record)}
                              className="px-3 py-1.5 text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700"
                            >
                              Receive
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">
                            {record.lab_no || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.patient_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.phone_no || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-[250px] whitespace-normal break-words">
                            {record.reason_for_visit || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.category}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="max-w-[200px] whitespace-normal break-words">
                              {record.category === "Pathology"
                                ? Array.isArray(record.pathology_tests) &&
                                  record.pathology_tests.length > 0
                                  ? record.pathology_tests.join(", ")
                                  : record.pathology_tests || "No tests"
                                : Array.isArray(record.radiology_tests) &&
                                    record.radiology_tests.length > 0
                                  ? record.radiology_tests.join(", ")
                                  : record.radiology_tests || "No tests"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {formatDate(record.planned2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="8"
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          <FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                          <p className="text-lg font-medium text-gray-900">
                            No pending samples
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile List */}
            <div className="space-y-3 md:hidden h-full overflow-auto pb-8">
              {filteredPending.length > 0 ? (
                filteredPending.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-xs font-medium text-green-600 mb-1">
                          Lab No: {record.lab_no || "-"}
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {record.patient_name}
                        </h3>
                      </div>
                      <button
                        onClick={() => handleReceiveSample(record)}
                        className="flex-shrink-0 px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg shadow-sm"
                      >
                        Receive
                      </button>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Admission No:</span>
                        <span className="font-medium text-gray-900">
                          {record.admission_no || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Category:</span>
                        <span className="font-medium text-gray-900">
                          {record.category}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Planned:</span>
                        <span className="font-medium text-gray-900">
                          {formatDate(record.planned2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
                  <p className="text-gray-500">No pending samples</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="h-full flex flex-col">
            {/* Desktop Table */}
            <div className="hidden flex-1 overflow-hidden bg-white rounded-lg border border-gray-200 shadow-sm md:flex flex-col">
              <div className="overflow-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Lab No
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Patient Name
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase min-w-[200px]">
                        Reason For Visit
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Category
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Tests
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Planned
                      </th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                        Received
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredHistory.length > 0 ? (
                      filteredHistory.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">
                            {record.lab_no || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.patient_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.phone_no || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-[250px] whitespace-normal break-words">
                            {record.reason_for_visit || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.category}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="max-w-[200px] whitespace-normal break-words">
                              {record.category === "Pathology"
                                ? Array.isArray(record.pathology_tests) &&
                                  record.pathology_tests.length > 0
                                  ? record.pathology_tests.join(", ")
                                  : record.pathology_tests || "No tests"
                                : Array.isArray(record.radiology_tests) &&
                                    record.radiology_tests.length > 0
                                  ? record.radiology_tests.join(", ")
                                  : record.radiology_tests || "No tests"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {formatDate(record.planned2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {formatDate(record.actual2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="8"
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
              <Pagination
                page={historyPage}
                pageSize={PAGE_SIZE}
                total={historyTotal}
                onPageChange={setHistoryPage}
                disabled={historyLoading}
                label="samples"
              />
            </div>

            {/* Mobile List */}
            <div className="space-y-3 md:hidden h-full overflow-auto pb-8">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-xs font-medium text-green-600 mb-1">
                          Lab No: {record.lab_no || "-"}
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {record.patient_name}
                        </h3>
                      </div>
                      <div className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                        Received
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Category:</span>
                        <span className="font-medium text-gray-900">
                          {record.category}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Planned:</span>
                        <span className="font-medium text-gray-900">
                          {formatDate(record.planned2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Received:</span>
                        <span className="font-medium text-gray-900">
                          {formatDate(record.actual2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
                  <p className="text-gray-500">No history records</p>
                </div>
              )}
              <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                <Pagination
                  page={historyPage}
                  pageSize={PAGE_SIZE}
                  total={historyTotal}
                  onPageChange={setHistoryPage}
                  disabled={historyLoading}
                  label="samples"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiveSample;
