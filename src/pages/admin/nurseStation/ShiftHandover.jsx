import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Users,
  ArrowRight,
  Search,
  ChevronDown,
  ClipboardList,
  Clock,
  AlertCircle,
  CheckCircle,
  User,
  RefreshCw,
  Bed,
  Layers,
  ShieldCheck,
} from "lucide-react";
import supabase from "../../../SupabaseClient";
import { useNotification } from "../../../contexts/NotificationContext";

const ShiftHandover = () => {
  const { showNotification } = useNotification();

  // Nurses list
  const [nurses, setNurses] = useState([]);
  const [loadingNurses, setLoadingNurses] = useState(true);

  // From Nurse
  const [fromNurse, setFromNurse] = useState("");
  const [fromNurseSearch, setFromNurseSearch] = useState("");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const fromRef = useRef(null);

  // To Nurse
  const [toNurse, setToNurse] = useState("");
  const [toNurseSearch, setToNurseSearch] = useState("");
  const [showToDropdown, setShowToDropdown] = useState(false);
  const toRef = useRef(null);

  // Shift
  const [selectedShift, setSelectedShift] = useState("");

  // Data
  const [rawRecords, setRawRecords] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [handoverSuccess, setHandoverSuccess] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Patient selection
  const [selectedPatientId, setSelectedPatientId] = useState(""); // This will be Ipd_number

  // Load nurses from all_staff
  useEffect(() => {
    const loadNurses = async () => {
      try {
        setLoadingNurses(true);
        const { data, error } = await supabase
          .from("all_staff")
          .select("name")
          .ilike("designation", "%nurse%")
          .order("name");

        if (error) throw error;

        if (data && data.length > 0) {
          setNurses(
            data.map((s) => s.name).filter((n) => n && n.trim() !== ""),
          );
        } else {
          setNurses([]);
        }
      } catch (error) {
        console.error("Error loading nurses:", error);
        showNotification("Error loading nurse data", "error");
        setNurses([]);
      } finally {
        setLoadingNurses(false);
      }
    };
    loadNurses();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (fromRef.current && !fromRef.current.contains(e.target)) {
        setShowFromDropdown(false);
      }
      if (toRef.current && !toRef.current.contains(e.target)) {
        setShowToDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch all tasks (regardless of status) when fromNurse + shift are selected
  const fetchShiftData = useCallback(async () => {
    if (!fromNurse || !selectedShift) {
      setRawRecords([]);
      return;
    }

    try {
      setLoadingData(true);
      setHandoverSuccess(false);

      const normalizedFromNurse = fromNurse.trim();
      const normalizedShift = selectedShift.trim();

      // We fetch ALL tasks for this nurse in this shift
      // This allows us to see patients who have 0 pending tasks
      const { data, error } = await supabase
        .from("nurse_assign_task")
        .select("*")
        .ilike("assign_nurse", `%${normalizedFromNurse}%`)
        .ilike("shift", normalizedShift)
        .order("timestamp", { ascending: false });

      if (error) throw error;
      setRawRecords(data || []);
    } catch (error) {
      console.error("Error fetching shift data:", error);
      showNotification("Error loading shift records", "error");
      setRawRecords([]);
    } finally {
      setLoadingData(false);
    }
  }, [fromNurse, selectedShift]);

  useEffect(() => {
    fetchShiftData();
  }, [fetchShiftData]);

  // Derived patient data
  const patientMap = useMemo(() => {
    const map = new Map();
    rawRecords.forEach((record) => {
      const key = record.Ipd_number || `unknown-${record.id}`;
      if (!map.has(key)) {
        map.set(key, {
          ipdNumber: record.Ipd_number,
          patientName: record.patient_name,
          bedNo: record.bed_no,
          ward: record.ward_type,
          room: record.room,
          location: record.patient_location,
          tasks: [],
          pendingCount: 0,
        });
      }
      map.get(key).tasks.push(record);
      if (!record.actual1) {
        map.get(key).pendingCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => 
      (a.patientName || "").localeCompare(b.patientName || "")
    );
  }, [rawRecords]);

  const selectedPatient = useMemo(() => {
    return patientMap.find(p => p.ipdNumber === selectedPatientId);
  }, [patientMap, selectedPatientId]);

  // Handle Handover
  const handleHandover = async () => {
    if (!fromNurse || !selectedShift || !selectedPatientId || !toNurse) {
      showNotification("Please complete all selections", "error");
      return;
    }

    if (fromNurse === toNurse) {
      showNotification("Cannot handover to the same nurse", "error");
      return;
    }

    try {
      setProcessing(true);

      const normalizedFromNurse = fromNurse.trim();
      const normalizedToNurse = toNurse.trim();
      const pendingTasks = selectedPatient.tasks.filter(t => !t.actual1);

      // Workflow 1: If pending tasks exist, reassign them
      if (pendingTasks.length > 0) {
        const taskIds = pendingTasks.map(t => t.id);
        const { error } = await supabase
          .from("nurse_assign_task")
          .update({
            assign_nurse: normalizedToNurse,
            delegated_from: normalizedFromNurse,
          })
          .in("id", taskIds);

        if (error) throw error;
      }

      // Workflow 2: If no pending tasks exist, OR we want to ensure profile access
      // we create a specialized "Monitoring" task record for the new nurse
      if (pendingTasks.length === 0) {
        // Find latest record to copy details
        const latest = selectedPatient.tasks[0];
        const now = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata", hour12: false }).replace(",", "");

        const { error: insertError } = await supabase
          .from("nurse_assign_task")
          .insert([{
            timestamp: now,
            planned1: now,
            actual1: null, // Pending status
            Ipd_number: latest.Ipd_number,
            patient_name: latest.patient_name,
            patient_location: latest.patient_location,
            ward_type: latest.ward_type,
            room: latest.room,
            bed_no: latest.bed_no,
            shift: selectedShift,
            assign_nurse: normalizedToNurse,
            delegated_from: normalizedFromNurse,
            task: "Shift Handover - Monitoring & Observation",
            reminder: "No",
            start_date: new Date().toISOString().split("T")[0],
          }]);

        if (insertError) throw insertError;
      }

      showNotification(`Handover of ${selectedPatient.patientName} to ${toNurse} successful`, "success");
      setHandoverSuccess(true);
      
      // Clear data and refresh
      setTimeout(() => {
        setSelectedPatientId("");
        setToNurse("");
        setToNurseSearch("");
        fetchShiftData();
        setHandoverSuccess(false);
      }, 3000);

    } catch (error) {
      console.error("Error during handover:", error);
      showNotification("Handover failed. Please try again.", "error");
    } finally {
      setProcessing(false);
    }
  };

  // Filtered nurse lists
  const filteredFromNurses = nurses.filter((n) =>
    n.toLowerCase().includes(fromNurseSearch.toLowerCase()),
  );
  const filteredToNurses = nurses
    .filter((n) => n !== fromNurse)
    .filter((n) => n.toLowerCase().includes(toNurseSearch.toLowerCase()));

  const shifts = [
    { id: "Shift A", label: "Shift A", time: "8:00 AM – 2:00 PM", color: "blue" },
    { id: "Shift B", label: "Shift B", time: "2:00 PM – 8:00 PM", color: "green" },
    { id: "Shift C", label: "Shift C", time: "8:00 PM – 8:00 AM", color: "purple" },
  ];

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-gray-50 text-gray-800">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-green-600 rounded-xl shadow-lg shadow-green-200">
               <Layers className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Shift Handover</h1>
              <p className="text-gray-500 font-medium">Delegate patients and grant profile access between shifts</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Controls */}
          <div className="lg:col-span-4 space-y-6">
            {/* Step 1: Shift & Nurse Selection */}
            <div className="p-6 bg-white border border-gray-200 shadow-sm rounded-2xl overflow-visible">
              <h2 className="flex items-center gap-2 mb-6 text-lg font-bold text-gray-800 border-b pb-4">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                Assignment Scope
              </h2>
              
              <div className="space-y-6">
                {/* From Nurse */}
                <div className="relative" ref={fromRef}>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Handing Over From
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={fromNurse || fromNurseSearch}
                      onChange={(e) => {
                        setFromNurseSearch(e.target.value);
                        setFromNurse("");
                        setSelectedPatientId("");
                      }}
                      onFocus={() => setShowFromDropdown(true)}
                      placeholder="Search nurse..."
                      className="w-full bg-gray-50 border-0 ring-1 ring-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 transition-all pr-10"
                    />
                    <ChevronDown className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 right-3 top-1/2 cursor-pointer" />
                  </div>

                  {showFromDropdown && (
                    <div className="absolute z-[99] w-full mt-2 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60">
                       {filteredFromNurses.length > 0 ? (
                        filteredFromNurses.map((nurse, i) => (
                          <div
                            key={`from-${nurse}-${i}`}
                            className={`px-4 py-3 text-sm cursor-pointer hover:bg-green-50 transition-colors ${
                              fromNurse === nurse ? "bg-green-50 text-green-700 font-bold" : "text-gray-700"
                            }`}
                            onClick={() => {
                              setFromNurse(nurse.trim());
                              setFromNurseSearch("");
                              setShowFromDropdown(false);
                            }}
                          >
                            {nurse}
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-400">No nurses found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Shift Selector */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Current Shift
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {shifts.map((shift) => (
                      <button
                        key={shift.id}
                        type="button"
                        onClick={() => {
                          setSelectedShift(shift.id);
                          setSelectedPatientId("");
                        }}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                          selectedShift === shift.id
                            ? "border-green-500 bg-green-50 text-green-700 shadow-md ring-2 ring-green-100"
                            : "border-gray-100 bg-white text-gray-600 hover:border-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                           <Clock className={`w-4 h-4 ${selectedShift === shift.id ? "text-green-600" : "text-gray-400"}`} />
                           <span className="font-semibold text-sm">{shift.label}</span>
                        </div>
                        <span className="text-[10px] font-medium opacity-60">{shift.time}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Replacement Nurse */}
            {selectedPatientId && (
              <div className="p-6 bg-white border border-gray-200 shadow-sm rounded-2xl animate-fade-in">
                <h2 className="flex items-center gap-2 mb-6 text-lg font-bold text-gray-800 border-b pb-4">
                  <User className="w-5 h-5 text-blue-600" />
                  Replacement
                </h2>
                
                <div className="space-y-6">
                  <div className="relative" ref={toRef}>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Handing Over To
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={toNurse || toNurseSearch}
                        onChange={(e) => {
                          setToNurseSearch(e.target.value);
                          setToNurse("");
                        }}
                        onFocus={() => setShowToDropdown(true)}
                        placeholder="Search replacement..."
                        className="w-full bg-gray-50 border-0 ring-1 ring-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 transition-all pr-10"
                      />
                      <ChevronDown className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 right-3 top-1/2 cursor-pointer" />
                    </div>

                    {showToDropdown && (
                      <div className="absolute z-[99] w-full mt-2 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-2xl max-h-60">
                        {filteredToNurses.length > 0 ? (
                          filteredToNurses.map((nurse, i) => (
                            <div
                              key={`to-${nurse}-${i}`}
                              className={`px-4 py-3 text-sm cursor-pointer hover:bg-blue-50 transition-colors ${
                                toNurse === nurse ? "bg-blue-50 text-blue-700 font-bold" : "text-gray-700"
                              }`}
                              onClick={() => {
                                setToNurse(nurse.trim());
                                setToNurseSearch("");
                                setShowToDropdown(false);
                              }}
                            >
                              {nurse}
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-gray-400">No nurses found</div>
                        )}
                      </div>
                    )}
                  </div>

                  {toNurse && (
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                      <p className="text-xs text-blue-700 font-medium text-center">
                        Handing over {selectedPatient?.patientName} to <strong>{toNurse}</strong>
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleHandover}
                    disabled={processing || !toNurse}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 text-white rounded-xl font-bold shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    {processing ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Complete Handover
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Patient List */}
          <div className="lg:col-span-8">
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl h-full flex flex-col min-h-[600px] overflow-hidden">
               <div className="p-6 border-b bg-gray-50/50 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Patients List</h2>
                    <p className="text-sm text-gray-500">All patients assigned for {fromNurse || '...'} / {selectedShift || '...'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mr-2">Total: {patientMap.length}</span>
                    <button 
                      onClick={fetchShiftData}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-green-600 transition-all"
                    >
                      <RefreshCw className={`w-5 h-5 ${loadingData ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
                  {!fromNurse || !selectedShift ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                      <div className="p-6 bg-gray-50 rounded-full">
                        <User className="w-12 h-12 opacity-20" />
                      </div>
                      <p className="text-sm font-medium">Please select a nurse and shift to view patients</p>
                    </div>
                  ) : loadingData ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-4">
                      <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-gray-500 animate-pulse">Scanning occupancy records...</p>
                    </div>
                  ) : patientMap.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                      <ClipboardList className="w-16 h-16 opacity-10" />
                      <p className="text-lg font-medium">No records found for this shift</p>
                      <p className="text-sm text-center max-w-xs">Verify if patient tasks were assigned to {fromNurse} for {selectedShift}.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {patientMap.map((patient) => (
                        <div
                          key={patient.ipdNumber}
                          onClick={() => setSelectedPatientId(patient.ipdNumber)}
                          className={`relative p-5 rounded-2xl border-2 transition-all cursor-pointer group ${
                            selectedPatientId === patient.ipdNumber
                              ? "border-green-500 bg-green-50 ring-4 ring-green-100 shadow-md"
                              : "border-gray-100 bg-white hover:border-green-200 hover:bg-green-50/10"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${selectedPatientId === patient.ipdNumber ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-green-100 group-hover:text-green-600'} transition-all`}>
                                <Bed className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-bold text-gray-900 group-hover:text-green-700 transition-colors">
                                  {patient.patientName}
                                </h3>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">IPD: {patient.ipdNumber}</p>
                              </div>
                            </div>
                            
                            {patient.pendingCount > 0 ? (
                              <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-full border border-orange-200 animate-pulse">
                                {patient.pendingCount} Pending
                              </span>
                            ) : (
                              <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full border border-green-200">
                                Completed
                              </span>
                            )}
                          </div>

                          <div className="flex gap-4 text-xs font-semibold text-gray-500">
                             <div className="flex items-center gap-1">
                                <span className="opacity-60">Bed:</span>
                                <span>{patient.bedNo}</span>
                             </div>
                             <div className="flex items-center gap-1">
                                <span className="opacity-60">Ward:</span>
                                <span>{patient.ward}</span>
                             </div>
                          </div>

                          {selectedPatientId === patient.ipdNumber && (
                            <div className="absolute -right-2 -top-2 bg-green-500 text-white p-1 rounded-full shadow-lg border-2 border-white">
                              <CheckCircle className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
               </div>

               {/* Footer / Summary Action */}
               {handoverSuccess && (
                  <div className="p-4 bg-green-50 border-t border-green-100 flex items-center justify-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-bold text-green-800 tracking-tight">Handover successfully recorded in the digital log</span>
                  </div>
               )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e2e2;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e0;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ShiftHandover;
