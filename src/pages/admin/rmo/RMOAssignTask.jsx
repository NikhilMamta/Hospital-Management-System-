import React, { useState, useEffect, useRef } from "react";
import {
  BedDouble,
  Save,
  Trash2,
  Plus,
  User,
  X,
  CheckSquare,
  ClipboardList,
  Users,
  Clock,
  Calendar,
  Bell,
  Search,
  ChevronDown,
} from "lucide-react";
import supabase from "../../../SupabaseClient";
import { useNotification } from "../../../contexts/NotificationContext";

const RMOAssignTask = () => {
  const [showBedModal, setShowBedModal] = useState(false);
  const [bedFilterType, setBedFilterType] = useState("All");
  const [occupiedBeds, setOccupiedBeds] = useState([]);
  const [rmos, setRmos] = useState([]);
  const { showNotification } = useNotification();
  const [predefinedTasks, setPredefinedTasks] = useState([]);

  // State for new task input in dropdown
  const [newTaskValue, setNewTaskValue] = useState("");
  const [showCustomTaskInput, setShowCustomTaskInput] = useState(false);
  const [currentTaskContext, setCurrentTaskContext] = useState({
    shiftKey: null,
    taskId: null,
  });

  // Loading states
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingBeds, setLoadingBeds] = useState(false);

  // Form State for patient details
  const [patientDetails, setPatientDetails] = useState({
    ipdNumber: "",
    patientName: "",
    patientLocation: "",
    wardType: "",
    room: "",
    bedNo: "",
  });

  // State for each shift
  const [shifts, setShifts] = useState({
    shiftA: {
      assignRmo: "",
      reminder: "No",
      startDate: "",
      tasks: [{ id: 1, taskName: "" }],
    },
    shiftB: {
      assignRmo: "",
      reminder: "No",
      startDate: "",
      tasks: [{ id: 1, taskName: "" }],
    },
    shiftC: {
      assignRmo: "",
      reminder: "No",
      startDate: "",
      tasks: [{ id: 1, taskName: "" }],
    },
  });

  // Separate state for dropdown visibility and search for each shift
  const [dropdownStates, setDropdownStates] = useState({
    shiftA: { showRmoDropdown: false, rmoSearch: "" },
    shiftB: { showRmoDropdown: false, rmoSearch: "" },
    shiftC: { showRmoDropdown: false, rmoSearch: "" },
  });

  const [activeShift, setActiveShift] = useState("shiftA");
  const [loadingRmos, setLoadingRmos] = useState(false);
  const [savingNewTask, setSavingNewTask] = useState(false);

  // Separate refs for each shift's dropdown
  const shiftARef = useRef(null);
  const shiftBRef = useRef(null);
  const shiftCRef = useRef(null);

  // Load predefined tasks from Supabase on component mount
  useEffect(() => {
    const loadTasksFromSupabase = async () => {
      try {
        setLoadingTasks(true);
        console.log("Loading RMO tasks from Supabase...");

        const { data, error } = await supabase
          .from("master")
          .select("rmo_task")
          .not("rmo_task", "is", null)
          .neq("rmo_task", "")
          .order("created_at", { ascending: false });

        console.log("Supabase response for RMO tasks:", data);

        if (error) {
          console.error("Supabase error:", error);
          throw error;
        }

        if (data && data.length > 0) {
          const taskNames = data
            .map((item) => item.rmo_task)
            .filter((task) => task && task.trim() !== "");

          const uniqueTasks = [...new Set(taskNames)].sort();

          setPredefinedTasks(uniqueTasks);
          console.log("Loaded RMO tasks:", uniqueTasks);
        } else {
          console.log("No RMO tasks found in database");
          setPredefinedTasks([]);
        }
      } catch (error) {
        console.error("Error loading RMO tasks from Supabase:", error);
        setPredefinedTasks([]);
      } finally {
        setLoadingTasks(false);
      }
    };

    loadTasksFromSupabase();
  }, []);

  // Function to handle adding new task to Supabase
  const handleAddNewTask = async () => {
    if (!newTaskValue.trim()) return;

    const taskName = newTaskValue.trim();

    // Check if task already exists
    if (predefinedTasks.includes(taskName)) {
      showNotification("This task already exists in the list!", "info");
      return;
    }

    try {
      setSavingNewTask(true);

      const { data, error } = await supabase
        .from("master")
        .insert([
          {
            rmo_task: taskName,
            created_at: new Date()
              .toLocaleString("en-CA", {
                timeZone: "Asia/Kolkata",
                hour12: false,
              })
              .replace(",", ""),
          },
        ])
        .select();

      if (error) throw error;

      setPredefinedTasks((prev) => [taskName, ...prev].sort());

      // If we have a context (shiftKey and taskId), update the specific task
      if (currentTaskContext.shiftKey && currentTaskContext.taskId) {
        setShifts({
          ...shifts,
          [currentTaskContext.shiftKey]: {
            ...shifts[currentTaskContext.shiftKey],
            tasks: shifts[currentTaskContext.shiftKey].tasks.map((task) =>
              task.id === currentTaskContext.taskId
                ? { ...task, taskName: taskName }
                : task,
            ),
          },
        });
      }

      setNewTaskValue("");
      setShowCustomTaskInput(false);
      setCurrentTaskContext({ shiftKey: null, taskId: null });

      showNotification("New RMO task added successfully!", "success");
    } catch (error) {
      console.error("Error saving new RMO task to Supabase:", error);
      showNotification("Error saving new RMO task to database", "error");
    } finally {
      setSavingNewTask(false);
    }
  };

  // Function to open add task modal
  const openAddTaskModal = (shiftKey, taskId, taskIndex) => {
    setCurrentTaskContext({ shiftKey, taskId });
    setNewTaskValue("");
    setShowCustomTaskInput(true);
  };

  // Load RMOs from all_staff table
  useEffect(() => {
    const loadRmos = async () => {
      try {
        setLoadingRmos(true);
        const { data, error } = await supabase
          .from("all_staff")
          .select("name")
          .in("designation", ["RMO", "rmo"])
          .order("name");

        if (error) throw error;

        if (data && data.length > 0) {
          setRmos(data.map((staff) => staff.name));
        } else {
          setRmos([]);
        }
      } catch (error) {
        console.error("Error loading RMOs:", error);
        showNotification("Error loading RMO data", "error");
        setRmos([]);
      } finally {
        setLoadingRmos(false);
      }
    };

    loadRmos();
  }, []);

  // Load Occupied Beds with patient data
  useEffect(() => {
    const loadOccupiedBeds = async () => {
      try {
        setLoadingBeds(true);

        const { data: occupiedBedsData, error: bedsError } = await supabase
          .from("all_floor_bed")
          .select("*")
          .eq("status", "Occupied")
          .order("floor", { ascending: true });

        if (bedsError) throw bedsError;

        if (!occupiedBedsData || occupiedBedsData.length === 0) {
          setOccupiedBeds([]);
          return;
        }

        const { data: ipdAdmissions, error: ipdError } = await supabase
          .from("ipd_admissions")
          .select("*")
          .order("timestamp", { ascending: false });

        if (ipdError) throw ipdError;

        const combinedData = occupiedBedsData.map((bed) => {
          const matchingAdmission = ipdAdmissions?.find(
            (admission) =>
              admission.bed_no === bed.bed &&
              admission.floor === bed.floor &&
              (admission.ward_type === bed.ward ||
                admission.location_status === bed.ward) &&
              (admission.room === bed.room || admission.room_no === bed.room),
          );

          if (matchingAdmission) {
            return {
              bedId: bed.id,
              bedNo: bed.bed,
              floor: bed.floor,
              ward: bed.ward,
              serialNo: bed.serial_no,
              status: bed.status,
              ipdNumber: matchingAdmission.ipd_number,
              patientName: matchingAdmission.patient_name,
              patientLocation:
                matchingAdmission.bed_location ||
                matchingAdmission.location_status,
              wardType: matchingAdmission.ward_type,
              room: matchingAdmission.room || matchingAdmission.room_no,
              admissionNo: matchingAdmission.admission_no,
              department: matchingAdmission.department,
              consultantDr: matchingAdmission.consultant_dr,
            };
          }

          return {
            bedId: bed.id,
            bedNo: bed.bed,
            floor: bed.floor,
            ward: bed.ward,
            room: bed.room,
            serialNo: bed.serial_no,
            status: bed.status,
            ipdNumber: "",
            patientName: "Unknown Patient",
            patientLocation: `${bed.ward} - ${bed.room}`,
            wardType: bed.ward,
          };
        });

        setOccupiedBeds(combinedData);
      } catch (error) {
        console.error("Error loading occupied beds:", error);
        showNotification("Error loading occupied beds data", "error");
      } finally {
        setLoadingBeds(false);
      }
    };

    loadOccupiedBeds();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside all shift dropdowns
      const isOutsideAllDropdowns =
        shiftARef.current &&
        !shiftARef.current.contains(event.target) &&
        shiftBRef.current &&
        !shiftBRef.current.contains(event.target) &&
        shiftCRef.current &&
        !shiftCRef.current.contains(event.target);

      if (isOutsideAllDropdowns) {
        setDropdownStates({
          shiftA: { ...dropdownStates.shiftA, showRmoDropdown: false },
          shiftB: { ...dropdownStates.shiftB, showRmoDropdown: false },
          shiftC: { ...dropdownStates.shiftC, showRmoDropdown: false },
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownStates]);

  // Get the appropriate ref based on shift
  const getShiftRef = (shiftKey) => {
    switch (shiftKey) {
      case "shiftA":
        return shiftARef;
      case "shiftB":
        return shiftBRef;
      case "shiftC":
        return shiftCRef;
      default:
        return shiftARef;
    }
  };

  // Filter RMOs based on search for specific shift
  const getFilteredRmos = (shiftKey) => {
    const searchTerm = dropdownStates[shiftKey].rmoSearch.toLowerCase();
    return rmos.filter((rmo) => rmo.toLowerCase().includes(searchTerm));
  };

  // Handle dropdown state changes
  const handleDropdownStateChange = (shiftKey, field, value) => {
    setDropdownStates((prev) => ({
      ...prev,
      [shiftKey]: {
        ...prev[shiftKey],
        [field]: value,
      },
    }));
  };

  const handlePatientDetailsChange = (e) => {
    setPatientDetails({ ...patientDetails, [e.target.name]: e.target.value });
  };

  const handleShiftChange = (shift, field, value) => {
    setShifts({
      ...shifts,
      [shift]: {
        ...shifts[shift],
        [field]: value,
      },
    });

    if (field === "assignRmo") {
      // Only close the dropdown for this specific shift
      handleDropdownStateChange(shift, "showRmoDropdown", false);
    }
  };

  const handleTaskChange = (shift, taskId, value) => {
    setShifts({
      ...shifts,
      [shift]: {
        ...shifts[shift],
        tasks: shifts[shift].tasks.map((task) =>
          task.id === taskId ? { ...task, taskName: value } : task,
        ),
      },
    });
  };

  const addTaskRow = (shift) => {
    if (shifts[shift].tasks.length < 15) {
      setShifts({
        ...shifts,
        [shift]: {
          ...shifts[shift],
          tasks: [
            ...shifts[shift].tasks,
            { id: Date.now() + Math.random(), taskName: "" },
          ],
        },
      });
    }
  };

  const removeTaskRow = (shift, taskId) => {
    if (shifts[shift].tasks.length > 1) {
      setShifts({
        ...shifts,
        [shift]: {
          ...shifts[shift],
          tasks: shifts[shift].tasks.filter((task) => task.id !== taskId),
        },
      });
    }
  };

  const selectBed = (bed) => {
    setPatientDetails({
      ipdNumber: bed.ipdNumber || "",
      patientName: bed.patientName || "",
      patientLocation: bed.patientLocation || `${bed.ward} - ${bed.room}`,
      wardType: bed.wardType || bed.ward,
      room: bed.room || "",
      bedNo: bed.bedNo || "",
    });
    setShowBedModal(false);
  };

  const generateTaskNo = async () => {
    try {
      const { data, error } = await supabase
        .from("rmo_assign_task")
        .select("task_no")
        .order("id", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const lastTaskNo = data[0].task_no;
        const lastNum = parseInt(lastTaskNo.replace("TASK-", "")) || 0;
        return `TASK-${String(lastNum + 1).padStart(4, "0")}`;
      }
      return "TASK-0001";
    } catch (error) {
      console.error("Error generating task number:", error);
      return `TASK-${Date.now().toString().slice(-4)}`;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate patient details
    if (!patientDetails.ipdNumber) {
      showNotification("Please select a patient bed first", "info");
      return;
    }

    // Validate shifts
    const errors = [];
    Object.entries(shifts).forEach(([shiftKey, shiftData]) => {
      if (shiftData.assignRmo && !shiftData.startDate) {
        errors.push(`Start date is required for ${shiftKey.toUpperCase()}`);
      }
      if (
        shiftData.assignRmo &&
        shiftData.tasks.some((t) => !t.taskName.trim())
      ) {
        errors.push(
          `All tasks must be specified for ${shiftKey.toUpperCase()}`,
        );
      }
    });

    if (errors.length > 0) {
      showNotification(errors.join(", "), "error");
      return;
    }

    try {
      // Generate a single task number for all tasks in this assignment
      const baseTaskNo = await generateTaskNo();

      // Get the base number for incrementing
      const baseNum = parseInt(baseTaskNo.replace("TASK-", "")) || 0;

      // Counter for task numbering
      let taskCounter = 0;

      // Save each task as separate row
      for (const [shiftKey, shiftData] of Object.entries(shifts)) {
        if (!shiftData.assignRmo) continue; // Skip empty shifts

        const validTasks = shiftData.tasks
          .filter((task) => task.taskName.trim())
          .map((task) => task.taskName.trim());

        if (validTasks.length === 0) continue;

        // Insert each task as a separate row
        for (let i = 0; i < validTasks.length; i++) {
          taskCounter++;
          const taskNo = `TASK-${String(baseNum + taskCounter).padStart(4, "0")}`;

          const { error } = await supabase.from("rmo_assign_task").insert([
            {
              ipd_number: patientDetails.ipdNumber,
              patient_name: patientDetails.patientName,
              patient_location: patientDetails.patientLocation,
              ward_type: patientDetails.wardType,
              room: patientDetails.room,
              bed_no: patientDetails.bedNo,
              shift: shiftKey.replace("shift", "Shift-"), // Convert to Shift-A format
              assign_rmo: shiftData.assignRmo,
              reminder: shiftData.reminder,
              start_date: shiftData.startDate,
              task: validTasks[i], // Store as single task string
              timestamp: new Date()
                .toLocaleString("en-CA", {
                  timeZone: "Asia/Kolkata",
                  hour12: false,
                })
                .replace(",", ""),
              planned1: new Date()
                .toLocaleString("en-CA", {
                  timeZone: "Asia/Kolkata",
                  hour12: false,
                })
                .replace(",", ""),
            },
          ]);

          if (error) throw error;
        }
      }

      showNotification("RMO tasks assigned successfully!", "success");

      // Reset form
      setPatientDetails({
        ipdNumber: "",
        patientName: "",
        patientLocation: "",
        wardType: "",
        room: "",
        bedNo: "",
      });

      setShifts({
        shiftA: {
          assignRmo: "",
          reminder: "No",
          startDate: "",
          tasks: [{ id: 1, taskName: "" }],
        },
        shiftB: {
          assignRmo: "",
          reminder: "No",
          startDate: "",
          tasks: [{ id: 1, taskName: "" }],
        },
        shiftC: {
          assignRmo: "",
          reminder: "No",
          startDate: "",
          tasks: [{ id: 1, taskName: "" }],
        },
      });
    } catch (error) {
      console.error("Error saving RMO tasks:", error);
      showNotification("Error saving RMO tasks to database", "error");
    }
  };

  // Filter beds for modal
  const filteredBeds = occupiedBeds.filter((bed) => {
    if (bedFilterType === "All") return true;
    return bed.ward === bedFilterType || bed.wardType === bedFilterType;
  });

  const shiftConfig = {
    shiftA: {
      label: "Shift A",
      color: "from-green-50 to-green-100",
      border: "border-green-200",
    },
    shiftB: {
      label: "Shift B",
      color: "from-green-50 to-emerald-100",
      border: "border-green-200",
    },
    shiftC: {
      label: "Shift C",
      color: "from-purple-50 to-purple-100",
      border: "border-purple-200",
    },
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header - Updated for RMO */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
            <ClipboardList className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
            Assign RMO Tasks
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Assign RMO tasks for different shifts
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
          <div className="p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-indigo-50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                RMO Task Assignment Form
              </h2>
              <button
                type="button"
                onClick={() => setShowBedModal(true)}
                className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors duration-200 shadow-sm text-sm sm:text-base w-full sm:w-auto"
              >
                <BedDouble className="w-5 h-5" />
                Select Occupied Bed
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {/* Patient Details Section */}
            <div className="bg-green-50 p-5 rounded-xl border border-green-100">
              <h3 className="text-sm font-medium text-green-800 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" />
                PATIENT DETAILS
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.keys(patientDetails).map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">
                      {field.replace(/([A-Z])/g, " $1")}
                    </label>
                    <input
                      type="text"
                      name={field}
                      value={patientDetails[field]}
                      onChange={handlePatientDetailsChange}
                      readOnly
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-700 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Shift Tabs */}
            <div className="border-b border-gray-200 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex space-x-1 min-w-max sm:min-w-0">
                {Object.entries(shiftConfig).map(([shiftKey, config]) => (
                  <button
                    key={shiftKey}
                    type="button"
                    onClick={() => setActiveShift(shiftKey)}
                    className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-all ${
                      activeShift === shiftKey
                        ? `bg-gradient-to-r ${config.color} text-gray-800 border-t border-l border-r ${config.border}`
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Shift Form */}
            {Object.entries(shiftConfig).map(([shiftKey, config]) => (
              <div
                key={shiftKey}
                className={`p-5 rounded-xl border ${config.border} ${activeShift === shiftKey ? "block" : "hidden"}`}
              >
                <div
                  className={`bg-gradient-to-r ${config.color} p-4 rounded-lg mb-6`}
                >
                  <h3 className="text-sm font-medium text-gray-800 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {config.label} DETAILS
                  </h3>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="relative" ref={getShiftRef(shiftKey)}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assign RMO
                      </label>
                      {loadingRmos ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                          Loading RMOs...
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <input
                              type="text"
                              value={shifts[shiftKey].assignRmo}
                              onChange={(e) =>
                                handleShiftChange(
                                  shiftKey,
                                  "assignRmo",
                                  e.target.value,
                                )
                              }
                              onFocus={() => {
                                // Close other dropdowns first
                                Object.keys(dropdownStates).forEach((key) => {
                                  if (key !== shiftKey) {
                                    handleDropdownStateChange(
                                      key,
                                      "showRmoDropdown",
                                      false,
                                    );
                                  }
                                });
                                handleDropdownStateChange(
                                  shiftKey,
                                  "showRmoDropdown",
                                  true,
                                );
                              }}
                              placeholder="Search or select RMO"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent pr-10"
                            />
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>

                          {dropdownStates[shiftKey].showRmoDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              <div className="sticky top-0 bg-white p-2 border-b">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <input
                                    type="text"
                                    value={dropdownStates[shiftKey].rmoSearch}
                                    onChange={(e) =>
                                      handleDropdownStateChange(
                                        shiftKey,
                                        "rmoSearch",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Search RMOs..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    autoFocus
                                  />
                                </div>
                              </div>
                              <div className="py-1">
                                {getFilteredRmos(shiftKey).length > 0 ? (
                                  getFilteredRmos(shiftKey).map(
                                    (rmo, index) => (
                                      <div
                                        key={`${rmo}-${index}`}
                                        className="px-3 py-2 text-sm hover:bg-green-50 cursor-pointer"
                                        onClick={() => {
                                          handleShiftChange(
                                            shiftKey,
                                            "assignRmo",
                                            rmo,
                                          );
                                          handleDropdownStateChange(
                                            shiftKey,
                                            "showRmoDropdown",
                                            false,
                                          );
                                          handleDropdownStateChange(
                                            shiftKey,
                                            "rmoSearch",
                                            "",
                                          );
                                        }}
                                      >
                                        {rmo}
                                      </div>
                                    ),
                                  )
                                ) : (
                                  <div className="px-3 py-2 text-sm text-gray-500">
                                    No RMOs found
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reminder
                      </label>
                      <select
                        value={shifts[shiftKey].reminder}
                        onChange={(e) =>
                          handleShiftChange(
                            shiftKey,
                            "reminder",
                            e.target.value,
                          )
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={shifts[shiftKey].startDate}
                        onChange={(e) =>
                          handleShiftChange(
                            shiftKey,
                            "startDate",
                            e.target.value,
                          )
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Tasks Section */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tasks for {config.label}
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <p className="text-xs text-gray-500">
                          Add tasks for the selected patient
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addTaskRow(shiftKey)}
                        disabled={shifts[shiftKey].tasks.length >= 15}
                        className="inline-flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 transition disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        Add Task
                      </button>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-60 overflow-y-auto space-y-3">
                      {shifts[shiftKey].tasks.map((task, taskIndex) => (
                        <div
                          key={taskIndex}
                          className="flex gap-3 items-center"
                        >
                          <span className="text-gray-500 text-sm font-medium w-6">
                            {taskIndex + 1}.
                          </span>
                          <div className="flex-1">
                            <div className="relative">
                              <select
                                value={task.taskName}
                                onChange={(e) => {
                                  if (e.target.value === "__custom__") {
                                    openAddTaskModal(
                                      shiftKey,
                                      task.id,
                                      taskIndex,
                                    );
                                  } else {
                                    handleTaskChange(
                                      shiftKey,
                                      task.id,
                                      e.target.value,
                                    );
                                  }
                                }}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none pr-10"
                              >
                                <option value="">Select a task...</option>
                                <optgroup label="Predefined RMO Tasks">
                                  {loadingTasks ? (
                                    <option value="" disabled>
                                      Loading RMO tasks...
                                    </option>
                                  ) : predefinedTasks.length > 0 ? (
                                    predefinedTasks.map((taskOption, index) => (
                                      <option
                                        key={`${taskOption}-${index}`}
                                        value={taskOption}
                                      >
                                        {taskOption}
                                      </option>
                                    ))
                                  ) : (
                                    <option value="" disabled>
                                      No RMO tasks available
                                    </option>
                                  )}
                                </optgroup>
                                <optgroup label="Add New">
                                  <option
                                    value="__custom__"
                                    className="text-purple-600 font-medium"
                                  >
                                    Add Custom RMO Task
                                  </option>
                                </optgroup>
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M19 9l-7 7-7-7"
                                  ></path>
                                </svg>
                              </div>
                            </div>
                          </div>
                          {shifts[shiftKey].tasks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTaskRow(shiftKey, task.id)}
                              className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition shrink-0"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-xs text-gray-500">
                        Select RMO tasks from dropdown or add custom tasks
                      </p>
                      <p className="text-xs text-gray-500">
                        {shifts[shiftKey].tasks.length} of 15 tasks
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 shadow-sm"
              >
                <Save className="w-5 h-5" />
                Save All Shifts Assignment
              </button>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bed Selection Modal */}
      {showBedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-indigo-50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <BedDouble className="w-6 h-6 text-green-600" />
                Select Occupied Bed
              </h2>
              <button
                onClick={() => setShowBedModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="p-3 sm:p-4 bg-white border-b border-gray-200">
              <div className="flex overflow-x-auto pb-2 sm:pb-0 sm:flex-wrap gap-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[
                  "All",
                  "General Male Ward",
                  "General Female Ward",
                  "ICU",
                  "Private Ward",
                  "PICU",
                  "NICU",
                  "Emergency",
                  "HDU",
                  "General Ward(5th floor)",
                ].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setBedFilterType(filter)}
                    className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                      bedFilterType === filter
                        ? "bg-green-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Beds Grid */}
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              {loadingBeds ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">Loading occupied beds...</p>
                </div>
              ) : filteredBeds.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <BedDouble className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-400">
                    No occupied beds found
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Only beds with status "Occupied" are shown
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {filteredBeds.map((bed, idx) => (
                    <div
                      key={idx}
                      onClick={() => selectBed(bed)}
                      className="bg-white border-2 border-red-100 rounded-xl p-3 sm:p-4 cursor-pointer hover:border-green-500 hover:shadow-lg transition group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-bl-lg font-medium">
                        Occupied
                      </div>
                      <div className="flex justify-center mb-2 sm:mb-3 text-red-400 group-hover:text-green-500 transition-colors">
                        <BedDouble className="w-6 h-6 sm:w-8 sm:h-8" />
                      </div>
                      <h4 className="font-bold text-gray-800 text-center mb-0.5 sm:mb-1 text-base sm:text-lg">
                        Bed {bed.bedNo}
                      </h4>
                      <p className="text-xs sm:text-sm text-center text-gray-600 font-medium mb-0.5 sm:mb-1 truncate px-1">
                        {bed.patientName}
                      </p>
                      <p className="text-[10px] sm:text-xs text-center text-gray-500 truncate px-1">
                        {bed.ward} - {bed.room}
                      </p>
                      {bed.ipdNumber && (
                        <p className="text-[10px] sm:text-xs text-center text-gray-400 mt-1.5 sm:mt-2">
                          IPD: {bed.ipdNumber}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {filteredBeds.length} occupied bed
                  {filteredBeds.length !== 1 ? "s" : ""} found
                </span>
                <button
                  onClick={() => setShowBedModal(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Task Input Modal */}
      {showCustomTaskInput && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-green-100">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-600" />
                Add New RMO Task
              </h2>
              <button
                onClick={() => {
                  setShowCustomTaskInput(false);
                  setCurrentTaskContext({ shiftKey: null, taskId: null });
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition"
                disabled={savingNewTask}
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter new RMO task name
                </label>
                <input
                  type="text"
                  value={newTaskValue}
                  onChange={(e) => setNewTaskValue(e.target.value)}
                  placeholder="e.g., Patient Assessment, Medication Review, etc."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === "Enter" && handleAddNewTask()}
                  autoFocus
                  disabled={savingNewTask}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleAddNewTask}
                  disabled={!newTaskValue.trim() || savingNewTask}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingNewTask ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    "Add & Select"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomTaskInput(false);
                    setCurrentTaskContext({ shiftKey: null, taskId: null });
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors duration-200"
                  disabled={savingNewTask}
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">
                This RMO task will be saved to Supabase and available for future
                use
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RMOAssignTask;
