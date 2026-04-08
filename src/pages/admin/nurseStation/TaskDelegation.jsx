import React, { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import supabase from "../../../SupabaseClient";
import { useNotification } from "../../../contexts/NotificationContext";

const TaskDelegation = () => {
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

  // Pending tasks
  const [pendingTasks, setPendingTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Delegation
  const [delegating, setDelegating] = useState(false);
  const [delegationSuccess, setDelegationSuccess] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");


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

  // Fetch pending tasks when fromNurse + shift are selected
  const fetchPendingTasks = useCallback(async () => {
    if (!fromNurse || !selectedShift) {
      setPendingTasks([]);
      return;
    }

    try {
      setLoadingTasks(true);
      setDelegationSuccess(false);

      const normalizedFromNurse = fromNurse.trim();
      const normalizedShift = selectedShift.trim();

      const { data, error } = await supabase
        .from("nurse_assign_task")
        .select("*")
        .ilike("assign_nurse", `%${normalizedFromNurse}%`)
        .ilike("shift", normalizedShift)
        .is("actual1", null)
        .order("timestamp", { ascending: false });

      if (error) throw error;

      setPendingTasks(data || []);

      // Step 2: Extract unique patients
      const uniquePatients = [
        ...new Set((data || []).map((t) => t.patient_name)),
      ].filter(Boolean);

      setPatients(uniquePatients);

    } catch (error) {
      console.error("Error fetching pending tasks:", error);
      showNotification("Error loading pending tasks", "error");
      setPendingTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [fromNurse, selectedShift]);

  useEffect(() => {
    fetchPendingTasks();
  }, [fetchPendingTasks]);

  // Handle delegation
  const handleDelegate = async () => {
    if (!fromNurse) {
      showNotification("Please select the nurse to delegate from", "error");
      return;
    }
    if (!selectedShift) {
      showNotification("Please select a shift", "error");
      return;
    }
    // Step 6: Validation
    if (!selectedPatient) {
      showNotification("Please select a patient", "error");
      return;
    }
    if (!toNurse) {
      showNotification("Please select the nurse to delegate to", "error");
      return;
    }
    if (fromNurse === toNurse) {
      showNotification("Cannot delegate to the same nurse", "error");
      return;
    }

    const tasksToDelegate = pendingTasks.filter(
      (t) => t.patient_name === selectedPatient,
    );
    if (tasksToDelegate.length === 0) {
      showNotification("No pending tasks for this patient to delegate", "info");
      return;
    }


    try {
      setDelegating(true);

      const normalizedFromNurse = fromNurse.trim();
      const normalizedToNurse = toNurse.trim();

      // Step 5: Fix delegation logic (Patient-specific)
      const taskIds = pendingTasks
        .filter((t) => t.patient_name === selectedPatient)
        .map((t) => t.id);


      const { error } = await supabase
        .from("nurse_assign_task")
        .update({
          assign_nurse: normalizedToNurse,
          delegated_from: normalizedFromNurse,
        })
        .in("id", taskIds);

      if (error) throw error;

      showNotification(
        `Successfully delegated ${taskIds.length} task(s) from ${fromNurse} to ${toNurse}`,
        "success",
      );

      setDelegationSuccess(true);
      setPendingTasks([]);

      // Reset form after a short delay
      setTimeout(() => {
        setFromNurse("");
        setFromNurseSearch("");
        setToNurse("");
        setToNurseSearch("");
        setSelectedShift("");
        setSelectedPatient("");
        setDelegationSuccess(false);
      }, 3000);

    } catch (error) {
      console.error("Error delegating tasks:", error);
      showNotification("Error delegating tasks. Please try again.", "error");
    } finally {
      setDelegating(false);
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
    {
      id: "Shift A",
      label: "Shift A",
      time: "8:00 AM – 2:00 PM",
      color: "blue",
    },
    {
      id: "Shift B",
      label: "Shift B",
      time: "2:00 PM – 8:00 PM",
      color: "green",
    },
    {
      id: "Shift C",
      label: "Shift C",
      time: "8:00 PM – 8:00 AM",
      color: "purple",
    },
  ];

  // Step indicators
  const getStepStatus = (step) => {
    if (step === 1) return fromNurse ? "completed" : "pending";
    if (step === 2) return selectedShift ? "completed" : "pending";
    if (step === 3) return toNurse ? "completed" : "pending";
    return "pending";
  };


  // Step 4: Filter Tasks
  const filteredTasks = selectedPatient
    ? pendingTasks.filter((t) => t.patient_name === selectedPatient)
    : [];


  return (
    <div className="min-h-screen p-4 sm:p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-800">
            <Users className="w-8 h-8 text-green-600" />
            Task Delegation
          </h1>
          <p className="mt-1 text-gray-600">
            Delegate pending shift tasks from one nurse to another
          </p>
        </div>

        {/* ✅ Step Flow Indicator */}
        <div className="flex items-center gap-2 p-3 mb-6 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg">
          <span
            className={
              getStepStatus(1) === "completed"
                ? "text-green-600 font-medium"
                : "text-gray-500"
            }
          >
            1. Select Nurse
          </span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span
            className={
              getStepStatus(2) === "completed"
                ? "text-green-600 font-medium"
                : "text-gray-500"
            }
          >
            2. Select Shift
          </span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span
            className={
              getStepStatus(3) === "completed"
                ? "text-green-600 font-medium"
                : "text-gray-500"
            }
          >
            3. Replace Nurse
          </span>
        </div>

        <div className="overflow-visible bg-white border border-gray-200 shadow-lg rounded-xl">
          {/* Top Banner */}
          <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
              <ClipboardList className="w-5 h-5 text-green-600" />
              Delegation Form
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Follow the steps below to reassign tasks to another nurse
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Row 1: From Nurse + Shift - Section wrapper */}
            <div className="relative z-10 p-4 border border-gray-200 rounded-lg bg-gray-50 animate-fade-in">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* From Nurse */}
                <div className="relative" ref={fromRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <User className="inline w-4 h-4 mr-1 text-red-500" />
                    From Nurse (on leave)
                  </label>
                  {loadingNurses ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
                      <div className="w-4 h-4 border-b-2 border-green-600 rounded-full animate-spin" />
                      Loading nurses...
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <input
                          type="text"
                          value={fromNurse || fromNurseSearch}
                          onChange={(e) => {
                            setFromNurseSearch(e.target.value);
                            setFromNurse("");
                            setToNurse("");
                            setToNurseSearch("");
                          }}
                          onFocus={() => setShowFromDropdown(true)}
                          placeholder="Search or select nurse..."
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent pr-10"
                        />
                        <ChevronDown className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 right-3 top-1/2" />
                      </div>

                      {showFromDropdown && (
                        <div className="absolute z-[9999] w-full mt-1 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-xl max-h-60">
                          <div className="sticky top-0 p-2 bg-white border-b">
                            <div className="relative">
                              <Search className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
                              <input
                                type="text"
                                value={fromNurseSearch}
                                onChange={(e) =>
                                  setFromNurseSearch(e.target.value)
                                }
                                placeholder="Search nurses..."
                                className="w-full py-2 pr-3 text-sm border border-gray-300 rounded-lg pl-9 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="py-1">
                            {filteredFromNurses.length > 0 ? (
                              filteredFromNurses.map((nurse, i) => (
                                <div
                                  key={`from-${nurse}-${i}`}
                                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-green-50 ${
                                    fromNurse === nurse ? "bg-green-100" : ""
                                  }`}
                                  onClick={() => {
                                    const cleaned = nurse.trim();
                                    setFromNurse(cleaned);
                                    setFromNurseSearch("");
                                    setShowFromDropdown(false);
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{nurse}</span>
                                    {fromNurse === nurse && (
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-sm text-gray-400">
                                No nurses found
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Selected nurse chip */}
                      {fromNurse && (
                        <div className="inline-block px-2 py-1 mt-2 text-xs text-green-700 border border-green-200 rounded-md bg-green-50">
                          Selected: {fromNurse}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Shift Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <Clock className="inline w-4 h-4 mr-1 text-blue-500" />
                    Shift
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {shifts.map((shift) => (
                      <button
                        key={shift.id}
                        type="button"
                        onClick={() => {
                          setSelectedShift(shift.id);
                          setDelegationSuccess(false);
                        }}
                        className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          selectedShift === shift.id
                            ? "bg-green-100 border-green-400 text-green-800 ring-2 ring-green-200"
                            : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <div>{shift.label}</div>
                        <div className="text-xs opacity-70 mt-0.5">
                          {shift.time}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Micro feedback */}
                  {selectedShift && (
                    <p className="mt-2 text-xs text-gray-500">
                      Selected: {selectedShift}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Patient Dropdown UI */}
            {fromNurse && selectedShift && patients.length > 0 && (
              <div className="p-4 border rounded-lg bg-gray-50 border-gray-200 animate-fade-in shadow-sm">
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Select Patient
                </label>

                <select
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white transition-all shadow-sm"
                >
                  <option value="">Select Patient</option>
                  {patients.map((p, i) => (
                    <option key={i} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}


            {/* Pending Tasks Preview - Section wrapper with animation */}
            {fromNurse && selectedShift && (
              <div className="relative z-10 p-4 border border-gray-200 rounded-lg bg-gray-50 animate-fade-in">
                <div className="flex items-center justify-between px-5 py-3 mb-4 -mx-4 -mt-4 border-b border-yellow-200 rounded-t-lg bg-yellow-50">
                  <div>
                    <p className="text-sm font-semibold text-yellow-800">
                      Pending Tasks
                    </p>
                    <p className="text-xs text-yellow-700">
                      {fromNurse} • {selectedShift}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs font-bold text-yellow-900 bg-yellow-200 rounded-full">
                      {filteredTasks.length}
                    </span>

                    <button
                      type="button"
                      onClick={fetchPendingTasks}
                      className="p-1 text-yellow-700 hover:text-yellow-900"
                      title="Refresh"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {loadingTasks ? (
                  <div className="flex items-center justify-center py-10 text-sm text-gray-500">
                    <div className="w-5 h-5 mr-2 border-b-2 border-green-600 rounded-full animate-spin" />
                    Loading tasks...
                  </div>
                ) : pendingTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <ClipboardList className="w-10 h-10 mb-2" />
                    <p className="text-sm text-gray-500">No pending tasks 🎉</p>
                    <p className="mt-1 text-xs text-gray-400">
                      This nurse has completed all assigned tasks for this shift
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="mt-1 mb-3 text-xs text-gray-500">
                      Showing {filteredTasks.length} latest pending task
                      {filteredTasks.length !== 1 ? "s" : ""}
                    </p>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-gray-600 uppercase bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left">#</th>
                            <th className="px-4 py-3 text-left">Patient</th>
                            <th className="px-4 py-3 text-left">IPD No.</th>
                            <th className="px-4 py-3 text-left">Bed</th>
                            <th className="px-4 py-3 text-left">Task</th>
                            <th className="px-4 py-3 text-left">Start Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredTasks.map((task, idx) => (

                            <tr key={task.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-500">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-800">
                                {task.patient_name || "N/A"}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {task.Ipd_number || "N/A"}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {task.bed_no || "N/A"}
                              </td>
                              <td className="px-4 py-3 text-gray-700">
                                {typeof task.task === "string"
                                  ? task.task
                                  : Array.isArray(task.task)
                                    ? task.task.join(", ")
                                    : "N/A"}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {task.start_date || "N/A"}
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

            {/* To Nurse - Section wrapper with animation */}
            {fromNurse && selectedShift && filteredTasks.length > 0 && (

              <div className="relative z-10 p-4 border border-gray-200 rounded-lg bg-gray-50 animate-fade-in">
                <div className="relative" ref={toRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <User className="inline w-4 h-4 mr-1 text-green-500" />
                    To Nurse (replacement)
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
                      placeholder="Search or select replacement nurse..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent pr-10 max-w-md"
                    />
                    <ChevronDown className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 right-3 top-1/2" />
                  </div>

                  {showToDropdown && (
                    <div className="absolute z-[9999] w-full max-w-md mt-1 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-xl max-h-60">
                      <div className="sticky top-0 p-2 bg-white border-b">
                        <div className="relative">
                          <Search className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
                          <input
                            type="text"
                            value={toNurseSearch}
                            onChange={(e) => setToNurseSearch(e.target.value)}
                            placeholder="Search nurses..."
                            className="w-full py-2 pr-3 text-sm border border-gray-300 rounded-lg pl-9 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="py-1">
                        {filteredToNurses.length > 0 ? (
                          filteredToNurses.map((nurse, i) => (
                            <div
                              key={`to-${nurse}-${i}`}
                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-green-50 ${
                                toNurse === nurse ? "bg-green-100" : ""
                              }`}
                              onClick={() => {
                                const cleaned = nurse.trim();
                                setToNurse(cleaned);
                                setToNurseSearch("");
                                setShowToDropdown(false);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span>{nurse}</span>
                                {toNurse === nurse && (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-400">
                            No nurses found
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Micro feedback */}
                  {toNurse && (
                    <p className="mt-2 text-xs text-gray-500">
                      Tasks will be reassigned to {toNurse}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Delegation Summary & Button - Enhanced with preview */}
            {fromNurse &&
              selectedShift &&
              toNurse &&
              pendingTasks.length > 0 && (
                <div className="relative z-10 p-5 border border-green-200 shadow-sm bg-green-50 rounded-xl animate-fade-in">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                      <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                        <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-medium">
                          {fromNurse}
                        </span>
                        <ArrowRight className="w-5 h-5 text-gray-400" />
                        <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium">
                          {toNurse}
                        </span>
                        <span className="text-gray-500">
                          ({filteredTasks.length} task
                          {filteredTasks.length !== 1 ? "s" : ""} •{" "}
                          {selectedShift})
                        </span>
                      </div>


                      <button
                        type="button"
                        onClick={handleDelegate}
                        disabled={delegating}
                        className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                      >
                        {delegating ? (
                          <>
                            <div className="w-4 h-4 border-b-2 border-white rounded-full animate-spin" />
                            Delegating...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5" />
                            Delegate Tasks
                          </>
                        )}
                      </button>
                    </div>

                    {/* Preview before action */}
                    <p className="pt-2 mt-2 text-xs text-center text-gray-600 border-t border-green-200">
                      You are about to move{" "}
                      <strong>{filteredTasks.length}</strong> task
                      {filteredTasks.length !== 1 ? "s" : ""} from{" "}
                      <strong>{fromNurse}</strong> to <strong>{toNurse}</strong>
                    </p>

                  </div>
                </div>
              )}

            {/* Success Message */}
            {delegationSuccess && (
              <div className="flex items-center gap-3 p-5 border border-green-300 bg-green-50 rounded-xl animate-fade-in">
                <CheckCircle className="flex-shrink-0 w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">
                    Delegation Successful!
                  </p>
                  <p className="text-sm text-green-600">
                    All pending tasks have been transferred. The form will reset
                    shortly.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add animation styles */}
      <style>{`
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
        .animate-fade-in {
          animation: fadeIn 0.25s ease;
        }
      `}</style>
    </div>
  );
};

export default TaskDelegation;
