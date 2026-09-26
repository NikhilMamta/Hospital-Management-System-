import React, { useState, useMemo, useEffect } from "react";
import { Eye, FileText, X, Download, CheckCircle, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useNotification } from "../../../contexts/NotificationContext";
import {
  getStorePendingIndents,
  getStoreHistoryPage,
  getStoreHistoryCount,
  getStoreFilterOptions,
  normalizeStoreWard,
  STORE_HISTORY_PAGE_SIZE,
  updateIndentStatus,
} from "../../../api/pharmacy";
import useRealtimeQuery from "../../../hooks/useRealtimeQuery";
import useDebounce from "../../../hooks/useDebounce";
import Pagination from "../../../components/Pagination";
import {
  normalizeDepartmentalPharmacyIndent,
  normalizePatientPharmacyIndent,
} from "../../../utils/pharmacyIndentUtils";

// New or edited indents (no planned2 yet) have not reached the store.
const reachedStore = (payload) =>
  payload.eventType === "DELETE" || Boolean(payload.new?.planned2);

const StoreMedicinePage = () => {
  const queryClient = useQueryClient();
  const wardFilters = [
    "ICU",
    "Private Ward",
    "PICU",
    "NICU",
    "Emergency",
    "HDU",
    "General Ward(5th floor)",
  ];

  const [activeTab, setActiveTab] = useState("pending");
  const [viewModal, setViewModal] = useState(false);
  const [slipModal, setSlipModal] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedWard, setSelectedWard] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [indentTypeFilter, setIndentTypeFilter] = useState("all");
  const [historyPage, setHistoryPage] = useState(0);
  const { showNotification } = useNotification();

  // Same ward groups as the server-side filter in api/pharmacy.js
  const normalizeWardFilter = normalizeStoreWard;

  // --- Queries ---
  // Pending and history used to be split here from one list that stopped at
  // the newest 1,000 indents, which hid older pending ones. Pending is a small
  // queue read whole; history is paged on the server.
  const { data: rawPending = { patient: [], departmental: [] }, isLoading: isInitialLoading } = useQuery({
    queryKey: ['pharmacy', 'store', 'pending'],
    queryFn: getStorePendingIndents
  });

  const isHistoryTab = activeTab === "history";
  const debouncedSearch = useDebounce(searchTerm, 400);
  const historyFilters = useMemo(() => ({
    search: debouncedSearch,
    patient: selectedPatient,
    ward: selectedWard,
    indentType: indentTypeFilter,
    date: selectedDate,
  }), [debouncedSearch, selectedPatient, selectedWard, indentTypeFilter, selectedDate]);

  const { data: historyData, isLoading: isLoadingHistory, isFetching: isFetchingHistory } = useQuery({
    queryKey: ['pharmacy', 'store', 'history', historyPage, historyFilters],
    queryFn: () => getStoreHistoryPage({ page: historyPage, filters: historyFilters }),
    enabled: isHistoryTab,
    placeholderData: keepPreviousData,
  });

  // The History tab label needs the total while the Pending tab is open too
  const { data: historyCount = 0 } = useQuery({
    queryKey: ['pharmacy', 'store', 'history-count', historyFilters],
    queryFn: () => getStoreHistoryCount(historyFilters),
    enabled: !isHistoryTab,
    placeholderData: keepPreviousData,
  });

  const historyTotal = isHistoryTab && historyData ? historyData.total : historyCount;
  const historyPageCount = Math.max(1, Math.ceil(historyTotal / STORE_HISTORY_PAGE_SIZE));

  // A new search, filter or tab starts again from the first page
  useEffect(() => {
    setHistoryPage(0);
  }, [historyFilters, activeTab]);

  // If rows disappear, don't stay on an empty page
  useEffect(() => {
    if (historyPage > 0 && historyPage >= historyPageCount) setHistoryPage(historyPageCount - 1);
  }, [historyPage, historyPageCount]);

  // Every patient and ward the filters can offer. It takes ~13 requests, so it
  // loads once the History tab or a dropdown is used, and is cached for a
  // while instead of reloading on each change.
  const [wantFilterOptions, setWantFilterOptions] = useState(false);
  const loadFilterOptions = () => setWantFilterOptions(true);
  const { data: filterOptions = { titles: [], wards: [] } } = useQuery({
    queryKey: ['pharmacy', 'store-filter-options'],
    queryFn: getStoreFilterOptions,
    enabled: isHistoryTab || wantFilterOptions,
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Real-time: patient indents are in `pharmacy`, ward indents in
  // departmental_pharmacy_indent (the old array form only heard the second).
  useRealtimeQuery('pharmacy', ['pharmacy', 'store'], { filter: reachedStore });
  useRealtimeQuery('departmental_pharmacy_indent', ['pharmacy', 'store'], { filter: reachedStore });

  // --- Derived Data ---
  const pendingIndents = useMemo(() => [
    ...rawPending.patient.map(normalizePatientPharmacyIndent),
    ...rawPending.departmental.map(normalizeDepartmentalPharmacyIndent),
  ], [rawPending]);

  // One page: patient indents first, then departmental ones (as before)
  const historyIndents = useMemo(() => [
    ...(historyData?.patient || []).map(normalizePatientPharmacyIndent),
    ...(historyData?.departmental || []).map(normalizeDepartmentalPharmacyIndent),
  ], [historyData]);

  const normalizedData = useMemo(() => [...pendingIndents, ...historyIndents], [pendingIndents, historyIndents]);

  const patientNames = useMemo(() => {
    const loaded = normalizedData.map(i => i.displayTitle || i.patientName).filter(Boolean);
    return [...new Set([...filterOptions.titles, ...loaded])].sort();
  }, [normalizedData, filterOptions]);

  const wardLocations = useMemo(() => {
    const loaded = normalizedData.map(i => normalizeWardFilter(i.location || i.wardLocation)).filter(Boolean);
    const unique = [...new Set([...filterOptions.wards, ...loaded])];
    const filters = ["ICU", "Private Ward", "PICU", "NICU", "Emergency", "HDU", "General Ward(5th floor)"];
    return [...filters, ...unique.filter(w => !filters.includes(w))].filter(Boolean);
  }, [normalizedData, filterOptions]);

  const loading = isInitialLoading || (isHistoryTab && isLoadingHistory);

  // --- Mutations ---
  const confirmMutation = useMutation({
    mutationFn: async (indent) => {
      const actual2 = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata", hour12: false }).replace(",", "");
      return await updateIndentStatus({
        table: indent.sourceTable,
        id: indent.sourceId,
        status: indent.status,
        updateData: { actual2 }
      });
    },
    onSuccess: (_, indent) => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'store'] });
      showNotification(`Indent ${indent.indentNumber || indent.id} confirmed successfully!`, "success");
    },
    onError: (error) => showNotification(`Error confirming indent: ${error.message}`, "error")
  });

  const handleConfirm = (indent) => confirmMutation.mutate(indent);

  const handleView = (indent) => {
    setSelectedIndent(indent);
    setViewModal(true);
  };

  const handleViewSlip = (indent) => {
    setSelectedIndent(indent);
    setSlipModal(true);
  };

  const downloadSlip = (indent) => {
    if (!indent.slipImage) return;
    const link = document.createElement("a");
    link.download = `Medicine_Slip_${indent.indentNumber || indent.id}.png`;
    link.href = indent.slipImage;
    link.click();
  };

  // --- Filter Helper ---
  const applyFilters = (indents) => {
    return indents.filter((indent) => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const indentNo = indent.indentNumber || `IND-${indent.id}`;
        const normalizedWard = normalizeWardFilter(indent.location || indent.wardLocation);
        const matchesSearch =
          indentNo.toLowerCase().includes(searchLower) ||
          (indent.admissionNumber && indent.admissionNumber.toLowerCase().includes(searchLower)) ||
          ((indent.displayTitle || indent.patientName) && (indent.displayTitle || indent.patientName).toLowerCase().includes(searchLower)) ||
          (indent.uhidNumber && indent.uhidNumber.toLowerCase().includes(searchLower)) ||
          ((indent.requestedBy || indent.staffName) && (indent.requestedBy || indent.staffName).toLowerCase().includes(searchLower)) ||
          ((indent.remarks || indent.diagnosis) && (indent.remarks || indent.diagnosis).toLowerCase().includes(searchLower)) ||
          ((indent.location || indent.wardLocation) && (indent.location || indent.wardLocation).toLowerCase().includes(searchLower)) ||
          normalizedWard.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }
      if (selectedPatient && (indent.displayTitle || indent.patientName) !== selectedPatient) return false;
      const normalizedWard = normalizeWardFilter(indent.location || indent.wardLocation);
      if (selectedWard && normalizedWard !== selectedWard) return false;
      if (indentTypeFilter !== "all" && indent.indentType !== indentTypeFilter) return false;
      if (selectedDate && indent.planned2) {
        const planned2Date = new Date(indent.planned2).toISOString().split("T")[0];
        if (planned2Date !== selectedDate) return false;
      }
      return true;
    });
  };

  const filteredPendingIndents = applyFilters(pendingIndents);
  // History filters run on the server (see historyFilters)
  const filteredHistoryIndents = historyIndents;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex-none px-3 sm:px-4 py-3 sm:py-4">
        {/* Header */}
        <div className="mb-3 sm:mb-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">Store - Medicine</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1 hidden sm:block">Manage and dispense approved medicine requests</p>
        </div>

        {/* Tabs and Filters */}
        <div className="border-b border-gray-200">
          <div className="hidden lg:flex lg:items-center lg:justify-between pb-0">
            <nav className="flex gap-4 -mb-[1px]">
              <button onClick={() => setActiveTab("pending")} className={`px-6 py-3 text-base font-medium border-b-2 transition-colors ${activeTab === "pending" ? "border-green-500 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                Pending ({filteredPendingIndents.length})
              </button>
              <button onClick={() => setActiveTab("history")} className={`px-6 py-3 text-base font-medium border-b-2 transition-colors ${activeTab === "history" ? "border-green-500 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                History ({historyTotal})
              </button>
            </nav>

            <div className="flex gap-3 items-center">
              <div className="relative">
                <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm min-w-[200px]" />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                   <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </div>
              </div>
              <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)} onFocus={loadFilterOptions} onMouseDown={loadFilterOptions} className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[180px]">
                <option value="">All Indents</option>
                {patientNames.map((n, i) => <option key={i} value={n}>{n}</option>)}
              </select>
              <select value={indentTypeFilter} onChange={(e) => setIndentTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[160px]">
                <option value="all">All Types</option>
                <option value="patient">Patient</option>
                <option value="departmental">Departmental</option>
              </select>
              <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)} onFocus={loadFilterOptions} onMouseDown={loadFilterOptions} className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[180px]">
                <option value="">All Wards</option>
                {wardLocations.map((w, i) => <option key={i} value={w}>{w}</option>)}
              </select>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              {(selectedPatient || selectedWard || selectedDate || searchTerm || indentTypeFilter !== "all") && (
                <button onClick={() => { setSelectedPatient(""); setSelectedWard(""); setSelectedDate(""); setSearchTerm(""); setIndentTypeFilter("all"); }} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium">Clear</button>
              )}
            </div>
          </div>

          <div className="lg:hidden flex flex-col gap-2 pb-2">
            <nav className="flex gap-2 -mb-[1px]">
              <button onClick={() => setActiveTab("pending")} className={`flex-1 py-2 text-sm font-medium border-b-2 ${activeTab === "pending" ? "border-green-500 text-green-600" : "text-gray-500"}`}>Pending ({filteredPendingIndents.length})</button>
              <button onClick={() => setActiveTab("history")} className={`flex-1 py-2 text-sm font-medium border-b-2 ${activeTab === "history" ? "border-green-500 text-green-600" : "text-gray-500"}`}>History ({historyTotal})</button>
            </nav>
            <div className="flex flex-wrap gap-2">
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 min-w-[150px] px-3 py-1.5 border rounded-lg text-xs" />
              <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)} onFocus={loadFilterOptions} onMouseDown={loadFilterOptions} className="flex-1 min-w-[120px] px-2 py-1.5 border rounded-lg text-xs">
                <option value="">All Indents</option>
                {patientNames.map((n, i) => <option key={i} value={n}>{n}</option>)}
              </select>
              <button onClick={() => { setSearchTerm(""); setSelectedPatient(""); setSelectedWard(""); setSelectedDate(""); setIndentTypeFilter("all"); }} className="px-3 py-1.5 bg-gray-200 rounded-lg text-xs">Clear</button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-4">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading data...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "pending" ? (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full hidden md:table">
                  <thead className="bg-green-600 text-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Indent No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Ward/Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Items</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Planned</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredPendingIndents.map((indent) => (
                      <tr key={indent.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-green-700">{indent.indentNumber || `IND-${indent.id}`}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium">{indent.displayTitle || indent.patientName}</div>
                          <div className="text-xs text-gray-500">{indent.location || indent.wardLocation}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">{indent.medicines?.length || 0} Items</span>
                        </td>
                        <td className="px-4 py-3 text-sm">{indent.planned2 ? new Date(indent.planned2).toLocaleString("en-GB", { hour:"2-digit", minute:"2-digit", day:"2-digit", month:"short" }) : "-"}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2">
                             <button onClick={() => handleView(indent)} className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"><Eye className="w-4 h-4" /></button>
                             {indent.slipImage && <button onClick={() => handleViewSlip(indent)} className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg"><FileText className="w-4 h-4" /></button>}
                             <button onClick={() => handleConfirm(indent)} className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5"/> Confirm</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredPendingIndents.length === 0 && <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500 italic">No pending requests found</td></tr>}
                  </tbody>
                </table>
                {/* Mobile View Placeholder */}
                <div className="md:hidden space-y-3 p-2">
                  {filteredPendingIndents.map(indent => (
                    <div key={indent.id} className="bg-white border rounded-lg p-3 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                         <span className="text-sm font-bold text-green-700">{indent.indentNumber || `IND-${indent.id}`}</span>
                         <span className="text-xs bg-green-100 px-2 py-0.5 rounded-full">{indent.medicines?.length || 0} Items</span>
                      </div>
                      <div className="text-sm font-medium mb-1">{indent.displayTitle || indent.patientName}</div>
                      <div className="text-xs text-gray-500 mb-2">{indent.location || indent.wardLocation}</div>
                      <div className="flex gap-2 pt-2 border-t mt-2">
                         <button onClick={() => handleView(indent)} className="flex-1 py-1.5 bg-green-500 text-white rounded text-xs">View</button>
                         <button onClick={() => handleConfirm(indent)} className="flex-1 py-1.5 bg-green-600 text-white rounded text-xs">Confirm</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full hidden md:table">
                  <thead className="bg-green-600 text-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Indent No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Confirmed At</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm">
                    {filteredHistoryIndents.map((indent) => (
                      <tr key={indent.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-green-700">{indent.indentNumber || `IND-${indent.id}`}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{indent.displayTitle || indent.patientName}</div>
                          <div className="text-xs text-gray-500">{indent.location || indent.wardLocation}</div>
                        </td>
                        <td className="px-4 py-3">{indent.actual2 ? new Date(indent.actual2).toLocaleString("en-GB", { hour:"2-digit", minute:"2-digit", day:"2-digit", month:"short" }) : "-"}</td>
                        <td className="px-4 py-3 flex gap-2">
                           <button onClick={() => handleView(indent)} className="p-2 bg-green-500 text-white rounded-lg"><Eye className="w-4 h-4" /></button>
                           {indent.slipImage && <button onClick={() => handleViewSlip(indent)} className="p-2 bg-purple-500 text-white rounded-lg"><FileText className="w-4 h-4" /></button>}
                        </td>
                      </tr>
                    ))}
                    {filteredHistoryIndents.length === 0 && <tr><td colSpan="4" className="px-6 py-12 text-center text-gray-500 italic">No history found</td></tr>}
                  </tbody>
                </table>
                 <div className="md:hidden space-y-3 p-2">
                  {filteredHistoryIndents.map(indent => (
                    <div key={indent.id} className="bg-white border rounded-lg p-3 shadow-sm">
                      <div className="text-sm font-bold text-green-700 mb-1">{indent.indentNumber || `IND-${indent.id}`}</div>
                      <div className="text-sm font-medium">{indent.displayTitle || indent.patientName}</div>
                      <div className="text-xs text-gray-700 mt-1">Confirmed: {indent.actual2 ? new Date(indent.actual2).toLocaleString() : "-"}</div>
                      <button onClick={() => handleView(indent)} className="w-full mt-2 py-1.5 bg-green-500 text-white rounded text-xs">View Details</button>
                    </div>
                  ))}
                </div>
                <Pagination
                  page={historyPage}
                  pageSize={STORE_HISTORY_PAGE_SIZE}
                  total={historyTotal}
                  onPageChange={setHistoryPage}
                  disabled={isFetchingHistory}
                  label="indents"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals - Simplified for rewrite clarity */}
      {viewModal && selectedIndent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 bg-green-600 text-white flex justify-between items-center flex-none">
              <h2 className="font-bold">Indent Details - {selectedIndent.indentNumber}</h2>
              <button onClick={() => setViewModal(false)}><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div><div className="text-gray-500">Patient</div><div className="font-bold">{selectedIndent.displayTitle || selectedIndent.patientName}</div></div>
                 <div><div className="text-gray-500">Location</div><div className="font-bold">{selectedIndent.location || selectedIndent.wardLocation}</div></div>
                 <div><div className="text-gray-500">Staff</div><div className="font-bold">{selectedIndent.requestedBy || selectedIndent.staffName}</div></div>
                 <div><div className="text-gray-500">Status</div><div className="text-green-600 font-bold uppercase">{selectedIndent.status}</div></div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-bold mb-2">Medicines</h3>
                <div className="bg-gray-50 rounded p-2">
                  {selectedIndent.medicines?.map((m, i) => (
                    <div key={i} className="flex justify-between py-1 border-b last:border-0">
                      <span>{m.name}</span>
                      <span className="font-bold">x{m.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 flex-none">
               {!selectedIndent.actual2 && <button onClick={() => { setViewModal(false); handleConfirm(selectedIndent); }} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Confirm Dispensing</button>}
               <button onClick={() => setViewModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}

      {slipModal && selectedIndent?.slipImage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-purple-600 text-white flex justify-between items-center">
              <h2 className="font-bold">Medicine Slip</h2>
              <button onClick={() => setSlipModal(false)}><X className="w-6 h-6"/></button>
            </div>
            <div className="p-4 bg-gray-100 max-h-[70vh] overflow-auto">
              <img src={selectedIndent.slipImage} alt="Slip" className="w-full mix-blend-multiply" />
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
               <button onClick={() => downloadSlip(selectedIndent)} className="px-4 py-2 bg-purple-600 text-white rounded flex items-center gap-2"><Download className="w-4 h-4"/> Download</button>
               <button onClick={() => setSlipModal(false)} className="px-4 py-2 bg-gray-200 rounded">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreMedicinePage;
