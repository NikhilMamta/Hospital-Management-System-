import React, { useState, useEffect, useRef, useMemo } from "react";
import supabase from "../SupabaseClient";

const Roster = () => {
  const wards = [
    "Male General Ward",
    "Female General Ward",
    "ICU",
    "HDU",
    "Private Ward",
    "NICU",
    "PICU",
  ];

  const shifts = [
    { id: "A", name: "Shift A", time: "8:00 AM - 2:00 PM" },
    { id: "B", name: "Shift B", time: "2:00 PM - 8:00 PM" },
    { id: "C", name: "Shift C", time: "8:00 PM - 8:00 AM" },
  ];

  // Refs for scroll handling
  const tableContainerRef = useRef(null);
  const scrollIntervalRef = useRef(null);
  const lastDragPosRef = useRef({ x: 0, y: 0 });

  // State management
  const [staffData, setStaffData] = useState({
    nurses: [],
    rmos: [],
    otStaff: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(new Set());
  const [assignments, setAssignments] = useState({});
  const [dragData, setDragData] = useState(null);
  const [draggingOver, setDraggingOver] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  // New states
  const [activeTab, setActiveTab] = useState("nurses");
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [showStartDateModal, setShowStartDateModal] = useState(false);
  const [startDate, setStartDate] = useState("");

  // Navigation State
  const [viewMode, setViewMode] = useState("current"); // 'previous', 'current', 'next'
  const [rosterSets, setRosterSets] = useState({
    previous: null,
    current: null,
    next: null,
  });
  const [currentSetDate, setCurrentSetDate] = useState(null);

  // Leave management state
  const [staffOnLeave, setStaffOnLeave] = useState({
    nurses: new Set(),
    rmos: new Set(),
    otStaff: new Set(),
  });
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Toast notification state
  const [toasts, setToasts] = useState([]);

  // Function to show toast
  const showToast = (message, type = "info") => {
    const id = Date.now();
    const newToast = { id, message, type };

    setToasts((prev) => [...prev, newToast]);

    // Auto remove toast after 1 second
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 1000);
  };

  // Function to remove toast
  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Check if staff is on leave (with parameters to avoid stale closures)
  const isStaffOnLeave = (staffId, currentStaffOnLeave = staffOnLeave) => {
    if (!staffId) return false;

    const [type, ...nameParts] = staffId.split("_");
    const name = nameParts.join("_").replace(/_/g, " ");

    const staffTypePlural =
      type === "nurse" ? "nurses" : type === "rmo" ? "rmos" : "otStaff";

    return currentStaffOnLeave[staffTypePlural]?.has(name) || false;
  };

  // Helper function to get consistent today's date string
  const getTodayDateStr = () => {
    return new Date()
      .toLocaleString("en-CA", {
        timeZone: "Asia/Kolkata",
        hour12: false,
      })
      .split(",")[0]
      .trim();
  };

  // Function to fetch leave data from Supabase
  const fetchLeaveData = async () => {
    try {
      setLeaveLoading(true);

      // Get today's date in proper timezone
      const todayStr = getTodayDateStr();

      // Fetch leave records (unconditional as requested)
      const { data: leaveData, error: leaveError } = await supabase
        .from("leave")
        .select("*")
        .order("created_at", { ascending: false });

      if (leaveError) throw leaveError;

      // Initialize empty leave sets
      const newStaffOnLeave = {
        nurses: new Set(),
        rmos: new Set(),
        otStaff: new Set(),
      };

      // Populate leave sets from database
      if (leaveData && leaveData.length > 0) {
        leaveData.forEach((leaveRecord) => {
          const { staff_name, staff_type } = leaveRecord;
          const trimmedName = staff_name ? staff_name.trim() : "";

          if (trimmedName) {
            switch (staff_type) {
              case "nurse":
                newStaffOnLeave.nurses.add(trimmedName);
                break;
              case "rmo":
                newStaffOnLeave.rmos.add(trimmedName);
                break;
              case "ot":
                newStaffOnLeave.otStaff.add(trimmedName);
                break;
            }
          }
        });
      }

      setStaffOnLeave(newStaffOnLeave);
      console.log("Loaded leave data for date:", todayStr, newStaffOnLeave);
      return newStaffOnLeave; // Return the leave data
    } catch (err) {
      console.error("Error fetching leave data:", err);
      showToast("Error loading leave data", "error");
      return {
        nurses: new Set(),
        rmos: new Set(),
        otStaff: new Set(),
      };
    } finally {
      setLeaveLoading(false);
    }
  };

  // Function to parse roster data and convert to assignments format
  const parseRosterData = (
    rosterData,
    currentStaffData,
    currentStaffOnLeave,
  ) => {
    console.log("Parsing roster data with leave data:", currentStaffOnLeave);

    // First, initialize empty assignments structure
    const newAssignments = {};
    wards.forEach((ward) => {
      newAssignments[ward] = {
        "Shift A": [],
        "Shift B": [],
        "Shift C": [],
      };
    });

    // Helper function to check if staff is on leave
    const checkStaffOnLeave = (staffId) => {
      if (!staffId) return false;

      const [type, ...nameParts] = staffId.split("_");
      const name = nameParts.join("_").replace(/_/g, " ");

      const staffTypePlural =
        type === "nurse" ? "nurses" : type === "rmo" ? "rmos" : "otStaff";

      return currentStaffOnLeave[staffTypePlural]?.has(name) || false;
    };

    // Process each shift row from the database
    rosterData.forEach((shiftRow) => {
      const shiftName = shiftRow.shift;

      // For each ward, check if there are staff assigned
      wards.forEach((ward) => {
        let columnName;

        switch (ward) {
          case "Male General Ward":
            columnName = "male_general_ward";
            break;
          case "Female General Ward":
            columnName = "female_general_ward";
            break;
          case "ICU":
            columnName = "icu";
            break;
          case "HDU":
            columnName = "hdu";
            break;
          case "Private Ward":
            columnName = "private_ward";
            break;
          case "NICU":
            columnName = "nicu";
            break;
          case "PICU":
            columnName = "picu";
            break;
          default:
            columnName = ward.toLowerCase().replace(/\s+/g, "_");
        }

        // Get staff data from the database column
        const staffDataJson = shiftRow[columnName];

        if (staffDataJson && staffDataJson.trim() !== "") {
          try {
            // Parse the JSON string
            const staffObj = JSON.parse(staffDataJson);

            // Process nurses - FILTER OUT THOSE ON LEAVE
            if (staffObj.nurse && Array.isArray(staffObj.nurse)) {
              staffObj.nurse.forEach((name) => {
                if (name && name.trim() !== "") {
                  const staffId = `nurse_${name.replace(/\s+/g, "_")}`;

                  // Check if staff is on leave
                  const isOnLeave = checkStaffOnLeave(staffId);

                  if (!isOnLeave) {
                    const exists = newAssignments[ward][shiftName].some(
                      (assignment) => assignment.id === staffId,
                    );

                    if (!exists) {
                      newAssignments[ward][shiftName].push({
                        id: staffId,
                        name: name.trim(),
                        type: "nurse",
                      });
                    }
                  } else {
                    console.log(`Filtered out nurse on leave: ${name}`);
                  }
                }
              });
            }

            // Process RMOs - FILTER OUT THOSE ON LEAVE
            if (staffObj.rmo && Array.isArray(staffObj.rmo)) {
              staffObj.rmo.forEach((name) => {
                if (name && name.trim() !== "") {
                  const staffId = `rmo_${name.replace(/\s+/g, "_")}`;

                  // Check if staff is on leave
                  const isOnLeave = checkStaffOnLeave(staffId);

                  if (!isOnLeave) {
                    const exists = newAssignments[ward][shiftName].some(
                      (assignment) => assignment.id === staffId,
                    );

                    if (!exists) {
                      newAssignments[ward][shiftName].push({
                        id: staffId,
                        name: name.trim(),
                        type: "rmo",
                      });
                    }
                  } else {
                    console.log(`Filtered out RMO on leave: ${name}`);
                  }
                }
              });
            }

            // Process OT staff - FILTER OUT THOSE ON LEAVE
            if (staffObj.ot && Array.isArray(staffObj.ot)) {
              staffObj.ot.forEach((name) => {
                if (name && name.trim() !== "") {
                  const staffId = `ot_${name.replace(/\s+/g, "_")}`;

                  // Check if staff is on leave
                  const isOnLeave = checkStaffOnLeave(staffId);

                  if (!isOnLeave) {
                    const exists = newAssignments[ward][shiftName].some(
                      (assignment) => assignment.id === staffId,
                    );

                    if (!exists) {
                      newAssignments[ward][shiftName].push({
                        id: staffId,
                        name: name.trim(),
                        type: "ot",
                      });
                    }
                  } else {
                    console.log(`Filtered out OT staff on leave: ${name}`);
                  }
                }
              });
            }
          } catch (error) {
            console.log(
              `Error parsing JSON for ${ward} in ${shiftName}:`,
              error,
            );
            // Fallback to old format if JSON parsing fails
            const staffNames = staffDataJson;
            if (staffNames && staffNames.trim() !== "") {
              // Split comma-separated names
              const names = staffNames.split(",").map((name) => name.trim());

              names.forEach((entry) => {
                if (entry && entry.trim() !== "") {
                  let name = entry.trim();
                  let type = "";

                  // Check for type prefix in the name
                  if (name.startsWith("N: ")) {
                    type = "nurse";
                    name = name.substring(3).trim(); // Remove "N: "
                  } else if (name.startsWith("R: ")) {
                    type = "rmo";
                    name = name.substring(3).trim(); // Remove "R: "
                  } else if (name.startsWith("O: ")) {
                    type = "ot";
                    name = name.substring(3).trim(); // Remove "O: "
                  } else {
                    // Fallback: try to determine type from staff lists
                    if (currentStaffData.nurses.includes(name)) {
                      type = "nurse";
                    } else if (currentStaffData.rmos.includes(name)) {
                      type = "rmo";
                    } else if (currentStaffData.otStaff.includes(name)) {
                      type = "ot";
                    }
                  }

                  if (type && name) {
                    const staffId = `${type}_${name.replace(/\s+/g, "_")}`;

                    // Check if staff is on leave
                    const isOnLeave = checkStaffOnLeave(staffId);

                    if (!isOnLeave) {
                      const exists = newAssignments[ward][shiftName].some(
                        (assignment) => assignment.id === staffId,
                      );

                      if (!exists) {
                        newAssignments[ward][shiftName].push({
                          id: staffId,
                          name: name,
                          type: type,
                        });
                      }
                    } else {
                      console.log(
                        `Filtered out ${type} on leave (fallback): ${name}`,
                      );
                    }
                  }
                }
              });
            }
          }
        }
      });
    });

    console.log("Parsed assignments (filtered for leave):", newAssignments);
    return newAssignments;
  };

  // Function to validate assignments before saving (remove staff on leave)
  const validateAssignmentsForLeave = (assignmentsToValidate) => {
    const validatedAssignments = { ...assignmentsToValidate };

    Object.keys(validatedAssignments).forEach((ward) => {
      Object.keys(validatedAssignments[ward]).forEach((shift) => {
        // Filter out any staff who are on leave
        validatedAssignments[ward][shift] = validatedAssignments[ward][
          shift
        ].filter((staff) => !isStaffOnLeave(staff.id));
      });
    });

    return validatedAssignments;
  };

  // Function to fetch the latest roster data
  const fetchLatestRosterData = async (
    currentStaffData,
    currentStaffOnLeave,
  ) => {
    try {
      setLoadingRoster(true);

      console.log("Fetching roster history...");

      // Get enough history to determine Previous/Current/Next
      // Fetching 30 rows (approx 10 sets of 3 shifts) should be sufficient
      const { data: rosterData, error: rosterError } = await supabase
        .from("roster")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(30);

      if (rosterError) {
        console.error("Error fetching roster data:", rosterError);
        throw rosterError;
      }

      if (rosterData && rosterData.length > 0) {
        console.log("Loaded roster history:", rosterData.length, "rows");

        // Group rows by unique timestamp
        const groupedSets = {};
        rosterData.forEach((row) => {
          // Use timestamp as key (string comparison)
          const key = row.timestamp;
          if (!groupedSets[key]) {
            groupedSets[key] = [];
          }
          groupedSets[key].push(row);
        });

        // Convert to array of sets, sorted by timestamp descending
        const sortedSets = Object.values(groupedSets).sort((a, b) => {
          return new Date(b[0].timestamp) - new Date(a[0].timestamp);
        });

        console.log("Found roster sets:", sortedSets.length);

        // LOGIC: Determine Previous / Current / Next
        // We need to check the start_date of the LATEST set (Index 0)

        let nextSet = null;
        let currentSet = null;
        let previousSet = null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (sortedSets.length > 0) {
          const latestSet = sortedSets[0];
          // Check start_date of any row in the set (all should form one update)
          const latestStartDateStr = latestSet[0].start_date;

          let latestIsFuture = false;
          if (latestStartDateStr) {
            const latestStartDate = new Date(latestStartDateStr);
            latestStartDate.setHours(0, 0, 0, 0);
            if (latestStartDate > today) {
              latestIsFuture = true;
            }
          }

          if (latestIsFuture) {
            // Scenario A: Latest is Future
            // Next = Index 0
            // Current = Index 1
            // Previous = Index 2
            nextSet = sortedSets[0] || null;
            currentSet = sortedSets[1] || null;
            previousSet = sortedSets[2] || null;
          } else {
            // Scenario B: Latest is Present/Past (or No Date)
            // Next = null (No future plan)
            // Current = Index 0
            // Previous = Index 1
            nextSet = null;
            currentSet = sortedSets[0] || null;
            previousSet = sortedSets[1] || null;
          }
        }

        setRosterSets({
          next: nextSet,
          current: currentSet,
          previous: previousSet,
        });

        // Default to Current View
        const dataToLoad =
          viewMode === "current"
            ? currentSet
            : viewMode === "previous"
              ? previousSet
              : nextSet;

        if (dataToLoad) {
          const parsedAssignments = parseRosterData(
            dataToLoad,
            currentStaffData,
            currentStaffOnLeave,
          );
          setAssignments(parsedAssignments);
          setLastSaveTime(dataToLoad[0].timestamp);
          setCurrentSetDate(dataToLoad[0].timestamp);
        } else {
          // Clear if the selected view has no data
          const initialAssignments = {};
          wards.forEach((ward) => {
            initialAssignments[ward] = {
              "Shift A": [],
              "Shift B": [],
              "Shift C": [],
            };
          });
          setAssignments(initialAssignments);
          setLastSaveTime(null);
          setCurrentSetDate(null);
        }
      } else {
        console.log("No roster data found, initializing empty assignments");
        const initialAssignments = {};
        wards.forEach((ward) => {
          initialAssignments[ward] = {
            "Shift A": [],
            "Shift B": [],
            "Shift C": [],
          };
        });
        setAssignments(initialAssignments);
        setRosterSets({ previous: null, current: null, next: null });
      }
    } catch (err) {
      console.error("Error in fetchLatestRosterData:", err);
      throw err;
    } finally {
      setLoadingRoster(false);
    }
  };

  // Effect to handle View Mode Switch
  useEffect(() => {
    // When viewMode changes, reload assignments from the stored rosterSets
    // But ONLY if rosterSets is populated (avoid running on initial mount before fetch)
    if (rosterSets.current || rosterSets.previous || rosterSets.next) {
      let set = null;
      if (viewMode === "current") set = rosterSets.current;
      else if (viewMode === "previous") set = rosterSets.previous;
      else if (viewMode === "next") set = rosterSets.next;

      if (set) {
        const parsed = parseRosterData(set, staffData, staffOnLeave);
        setAssignments(parsed);
        setLastSaveTime(set[0].timestamp);
        setCurrentSetDate(set[0].timestamp);
      } else {
        // Initialize empty if no set for this view
        const initialAssignments = {};
        wards.forEach((ward) => {
          initialAssignments[ward] = {
            "Shift A": [],
            "Shift B": [],
            "Shift C": [],
          };
        });
        setAssignments(initialAssignments);
        setLastSaveTime(null);
        setCurrentSetDate(null);
      }
    }
  }, [viewMode, rosterSets, staffData, staffOnLeave]);

  // Fetch staff data and roster data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all staff at once with their designations
        const { data: allStaff, error: fetchError } = await supabase
          .from("all_staff")
          .select("*")
          .order("name");

        if (fetchError) throw fetchError;

        // Filter staff by designation
        const nurses = allStaff
          .filter((staff) => {
            const designation = staff.designation?.toLowerCase().trim();
            return designation === "staff nurse" || designation === "nurse";
          })
          .map((staff) =>
            (staff.name || `${staff.first_name} ${staff.last_name}`).trim(),
          );

        const rmos = allStaff
          .filter((staff) => {
            const designation = staff.designation?.toLowerCase().trim();
            return designation === "rmo";
          })
          .map((staff) =>
            (staff.name || `${staff.first_name} ${staff.last_name}`).trim(),
          );

        const otStaff = allStaff
          .filter((staff) => {
            const designation = staff.designation?.toLowerCase().trim();
            return designation === "ot" || designation === "ot staff";
          })
          .map((staff) =>
            (staff.name || `${staff.first_name} ${staff.last_name}`).trim(),
          );

        const newStaffData = {
          nurses,
          rmos,
          otStaff,
        };

        setStaffData(newStaffData);

        // Fetch leave data BEFORE parsing roster
        const currentStaffOnLeave = await fetchLeaveData();

        // Fetch the latest roster data
        await fetchLatestRosterData(newStaffData, currentStaffOnLeave);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again.");
        showToast("Failed to load data", "error");

        // Fallback to sample data
        const fallbackStaffData = {
          nurses: [
            "Sarah Johnson",
            "Michael Chen",
            "Priya Patel",
            "David Wilson",
          ],
          rmos: ["Dr. Ahmed Khan", "Dr. Sophia Williams", "Dr. Kevin Li"],
          otStaff: ["Alex Turner", "Jessica Moore", "Brian Miller"],
        };

        setStaffData(fallbackStaffData);

        // Initialize empty assignments for fallback
        const initialAssignments = {};
        wards.forEach((ward) => {
          initialAssignments[ward] = {
            "Shift A": [],
            "Shift B": [],
            "Shift C": [],
          };
        });
        setAssignments(initialAssignments);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Initialize start date with today
  useEffect(() => {
    setStartDate(getTodayDateStr());
  }, []);

  // Clean up assignments when leave data changes
  useEffect(() => {
    const cleanupAssignmentsForLeave = () => {
      if (
        !staffData.nurses.length &&
        !staffData.rmos.length &&
        !staffData.otStaff.length
      ) {
        return;
      }

      const newAssignments = { ...assignments };
      let hasChanges = false;

      // Iterate through all assignments
      Object.keys(newAssignments).forEach((ward) => {
        Object.keys(newAssignments[ward]).forEach((shift) => {
          // Filter out staff who are on leave
          const filteredStaff = newAssignments[ward][shift].filter((staff) => {
            return !isStaffOnLeave(staff.id);
          });

          // Check if any staff were removed
          if (filteredStaff.length !== newAssignments[ward][shift].length) {
            hasChanges = true;
            newAssignments[ward][shift] = filteredStaff;
          }
        });
      });

      // Update assignments if any changes were made
      if (hasChanges) {
        console.log("Cleaned up assignments: removed staff on leave");
        setAssignments(newAssignments);
        showToast("Removed staff on leave from assignments", "warning");
      }
    };

    // Run cleanup when leave data changes
    cleanupAssignmentsForLeave();
  }, [staffOnLeave, staffData, assignments]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, []);

  // Handle staff selection
  const handleStaffSelection = (staffId) => {
    const newSelectedStaff = new Set(selectedStaff);

    if (newSelectedStaff.has(staffId)) {
      newSelectedStaff.delete(staffId);
    } else {
      newSelectedStaff.add(staffId);
    }

    setSelectedStaff(newSelectedStaff);
  };

  // Handle select all in active tab
  const handleSelectAllActiveTab = () => {
    const staffList = getAvailableStaff(activeTab);
    const newSelectedStaff = new Set(selectedStaff);

    const categoryPrefix =
      activeTab === "nurses" ? "nurse_" : activeTab === "rmos" ? "rmo_" : "ot_";

    // Toggle selection: if all are selected, deselect all; otherwise select all
    const allStaffInTab = staffList.map(
      (staff) => `${categoryPrefix}${staff.replace(/\s+/g, "_")}`,
    );

    const allSelected = allStaffInTab.every((id) => selectedStaff.has(id));

    if (allSelected) {
      // Deselect all in this tab
      allStaffInTab.forEach((id) => newSelectedStaff.delete(id));
      showToast(`Deselected all ${activeTab}`, "info");
    } else {
      // Select all in this tab
      allStaffInTab.forEach((id) => newSelectedStaff.add(id));
      showToast(`Selected all ${activeTab}`, "info");
    }

    setSelectedStaff(newSelectedStaff);
  };

  // Handle select all staff
  const handleSelectAll = () => {
    const allStaffIds = new Set();

    Object.entries(staffData).forEach(([type, staffList]) => {
      const categoryPrefix =
        type === "nurses" ? "nurse_" : type === "rmos" ? "rmo_" : "ot_";
      staffList.forEach((staff) => {
        const staffId = `${categoryPrefix}${staff.replace(/\s+/g, "_")}`;
        // Only select staff who are not on leave
        if (!isStaffOnLeave(staffId)) {
          allStaffIds.add(staffId);
        }
      });
    });

    setSelectedStaff(allStaffIds);
    showToast("Selected all available staff", "info");
  };

  // Handle deselect all
  const handleDeselectAll = () => {
    setSelectedStaff(new Set());
    showToast("Deselected all staff", "info");
  };

  // Handle adding staff to leave - POST to database
  const handleAddToLeave = async (staffId, staffName, staffType) => {
    try {
      // Get today's date
      const todayStr = getTodayDateStr();

      // Check if staff is already on leave for today
      const { data: existingLeave, error: checkError } = await supabase
        .from("leave")
        .select("*")
        .eq("staff_name", staffName)
        .eq("staff_type", staffType)
        .eq("leave_date", todayStr);

      if (checkError) throw checkError;

      // Only add if not already on leave
      if (!existingLeave || existingLeave.length === 0) {
        // Add to database
        const { error: insertError } = await supabase.from("leave").insert({
          staff_name: staffName,
          staff_type: staffType,
          leave_date: todayStr,
        });

        if (insertError) throw insertError;
      }

      // Update local state
      const newStaffOnLeave = { ...staffOnLeave };
      const staffTypePlural =
        staffType === "nurse"
          ? "nurses"
          : staffType === "rmo"
            ? "rmos"
            : "otStaff";

      const leaveSet = new Set(newStaffOnLeave[staffTypePlural]);
      leaveSet.add(staffName);
      newStaffOnLeave[staffTypePlural] = leaveSet;
      setStaffOnLeave(newStaffOnLeave);

      // Remove from selected staff if selected
      const newSelectedStaff = new Set(selectedStaff);
      newSelectedStaff.delete(staffId);
      setSelectedStaff(newSelectedStaff);

      // Remove from all assignments in the table
      const newAssignments = { ...assignments };
      Object.keys(newAssignments).forEach((ward) => {
        Object.keys(newAssignments[ward]).forEach((shift) => {
          newAssignments[ward][shift] = newAssignments[ward][shift].filter(
            (assignment) => assignment.id !== staffId,
          );
        });
      });
      setAssignments(newAssignments);

      console.log(`Added ${staffName} to leave database`);
      showToast(`Added ${staffName} to leave`, "success");
    } catch (err) {
      console.error("Error adding to leave:", err);
      showToast(
        `Failed to mark ${staffName} as on leave: ${err.message}`,
        "error",
      );
    }
  };

  // Handle removing staff from leave - DELETE from database
  const handleRemoveFromLeave = async (staffName, staffType) => {
    try {
      // Get today's date
      const todayStr = getTodayDateStr();

      // Delete from database (unconditional)
      const { error: deleteError } = await supabase
        .from("leave")
        .delete()
        .eq("staff_name", staffName)
        .eq("staff_type", staffType);

      if (deleteError) throw deleteError;

      // Update local state
      const newStaffOnLeave = { ...staffOnLeave };
      const staffTypePlural =
        staffType === "nurse"
          ? "nurses"
          : staffType === "rmo"
            ? "rmos"
            : "otStaff";

      const leaveSet = new Set(newStaffOnLeave[staffTypePlural]);
      leaveSet.delete(staffName);
      newStaffOnLeave[staffTypePlural] = leaveSet;
      setStaffOnLeave(newStaffOnLeave);

      console.log(`Removed ${staffName} from leave database`);
      showToast(`Removed ${staffName} from leave`, "success");
    } catch (err) {
      console.error("Error removing from leave:", err);
      showToast(
        `Failed to remove ${staffName} from leave: ${err.message}`,
        "error",
      );
    }
  };

  // Handle drop on leave section
  const handleDropOnLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!dragData) return;

    if (dragData.isMultiple) {
      // Add multiple selected staff to leave
      dragData.selectedStaff.forEach((staff) => {
        handleAddToLeave(staff.id, staff.name, staff.type);
      });
      showToast(
        `Added ${dragData.selectedStaff.length} staff to leave`,
        "success",
      );
    } else {
      // Add single staff to leave
      handleAddToLeave(dragData.staffId, dragData.name, dragData.type);
    }
  };

  // Clear all leave - DELETE all from database
  const handleClearAllLeave = async () => {
    if (
      window.confirm("Are you sure you want to clear ALL leave assignments?")
    ) {
      try {
        // Delete all leave records (unconditional)
        const { error: deleteError } = await supabase
          .from("leave")
          .delete()
          .neq("id", 0); // Hack to delete all rows (since delete requires a where clause)

        if (deleteError) throw deleteError;

        // Update local state
        setStaffOnLeave({
          nurses: new Set(),
          rmos: new Set(),
          otStaff: new Set(),
        });

        console.log("Cleared all leave records from database");
        showToast("Cleared all leave records", "success");
      } catch (err) {
        console.error("Error clearing all leave:", err);
        showToast(`Failed to clear all leave: ${err.message}`, "error");
      }
    }
  };

  // Get available staff (excluding those on leave)
  const getAvailableStaff = (category) => {
    const staffList = staffData[category] || [];
    const leaveSet = staffOnLeave[category] || new Set();

    return staffList.filter((staff) => !leaveSet.has(staff));
  };

  // Auto-scroll during drag
  const startAutoScroll = (clientY) => {
    if (!tableContainerRef.current) return;

    const container = tableContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const scrollSpeed = 20;
    const edgeThreshold = 50;

    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
    }

    scrollIntervalRef.current = setInterval(() => {
      if (!container) return;

      const currentClientY = lastDragPosRef.current.y;

      // Check if near bottom edge
      if (currentClientY > containerRect.bottom - edgeThreshold) {
        container.scrollTop += scrollSpeed;
      }
      // Check if near top edge
      else if (currentClientY < containerRect.top + edgeThreshold) {
        container.scrollTop -= scrollSpeed;
      }

      // Check if near right edge
      if (lastDragPosRef.current.x > containerRect.right - edgeThreshold) {
        container.scrollLeft += scrollSpeed;
      }
      // Check if near left edge
      else if (lastDragPosRef.current.x < containerRect.left + edgeThreshold) {
        container.scrollLeft -= scrollSpeed;
      }
    }, 16);
  };

  // Handle drag start
  const handleDragStart = (e, staffId, staffName, staffType) => {
    e.stopPropagation();
    setIsDragging(true);

    const isMultiple = selectedStaff.has(staffId) && selectedStaff.size > 1;
    let dragPayload;

    if (isMultiple) {
      const selectedStaffArray = Array.from(selectedStaff).map((id) => {
        const [type, ...nameParts] = id.split("_");
        const name = nameParts.join("_").replace(/_/g, " ");
        return { id, name, type };
      });

      dragPayload = {
        staffId,
        name: staffName,
        type: staffType,
        isMultiple: true,
        selectedStaff: selectedStaffArray,
      };
    } else {
      dragPayload = {
        staffId,
        name: staffName,
        type: staffType,
        isMultiple: false,
      };
    }

    setDragData(dragPayload);

    // Set data for drag
    e.dataTransfer.setData("text/plain", staffId);
    e.dataTransfer.effectAllowed = "copyMove";

    // Store initial position
    lastDragPosRef.current = { x: e.clientX, y: e.clientY };

    // Start auto-scroll checking
    startAutoScroll(e.clientY);
  };

  // Handle drag over with auto-scroll
  const handleDragOver = (e, ward, shift) => {
    e.preventDefault();
    e.stopPropagation();

    // Update last position for auto-scroll
    lastDragPosRef.current = { x: e.clientX, y: e.clientY };

    setDraggingOver(`${ward}-${shift}`);

    // Update drag position for visual feedback
    setDragPosition({ x: e.clientX, y: e.clientY });
  };

  // Handle drag move for auto-scroll
  const handleDragMove = (e) => {
    if (!isDragging) return;

    lastDragPosRef.current = { x: e.clientX, y: e.clientY };
    setDragPosition({ x: e.clientX, y: e.clientY });
  };

  // Handle drag end
  const handleDragEnd = (e) => {
    e.stopPropagation();
    setIsDragging(false);
    setDragData(null);
    setDraggingOver(null);

    // Clear auto-scroll interval
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  // Handle drop
  const handleDrop = (e, ward, shift) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(null);

    if (!dragData) return;

    const newAssignments = { ...assignments };

    if (dragData.isMultiple) {
      // Assign multiple selected staff
      dragData.selectedStaff.forEach((staff) => {
        // Check if staff is on leave before adding
        if (!isStaffOnLeave(staff.id)) {
          if (!newAssignments[ward][shift].some((a) => a.id === staff.id)) {
            newAssignments[ward][shift].push({
              id: staff.id,
              name: staff.name,
              type: staff.type,
            });
          }
        }
      });
      showToast(
        `Assigned ${dragData.selectedStaff.length} staff to ${ward} - ${shift}`,
        "success",
      );
    } else {
      // Assign single staff - Check if staff is on leave before adding
      if (!isStaffOnLeave(dragData.staffId)) {
        if (
          !newAssignments[ward][shift].some((a) => a.id === dragData.staffId)
        ) {
          newAssignments[ward][shift].push({
            id: dragData.staffId,
            name: dragData.name,
            type: dragData.type,
          });
          showToast(
            `Assigned ${dragData.name} to ${ward} - ${shift}`,
            "success",
          );
        }
      }
    }

    setAssignments(newAssignments);
  };

  // Handle remove assignment
  const handleRemoveAssignment = (staffId, ward, shift) => {
    const newAssignments = { ...assignments };
    const staffToRemove = newAssignments[ward][shift].find(
      (s) => s.id === staffId,
    );

    newAssignments[ward][shift] = newAssignments[ward][shift].filter(
      (assignment) => assignment.id !== staffId,
    );
    setAssignments(newAssignments);

    if (staffToRemove) {
      showToast(
        `Removed ${staffToRemove.name} from ${ward} - ${shift}`,
        "info",
      );
    }
  };

  // Handle clear all assignments
  const handleClearAllAssignments = () => {
    if (window.confirm("Are you sure you want to clear all assignments?")) {
      const clearedAssignments = {};
      wards.forEach((ward) => {
        clearedAssignments[ward] = {
          "Shift A": [],
          "Shift B": [],
          "Shift C": [],
        };
      });
      setAssignments(clearedAssignments);
      showToast("Cleared all assignments", "info");
    }
  };

  // Handle save roster to Supabase - ALWAYS CREATE NEW ROWS
  const proceedWithSave = async () => {
    // Close modal first
    setShowStartDateModal(false);

    try {
      // Show saving toast
      showToast("Saving roster data...", "info");

      // Validate assignments to remove staff on leave
      const validatedAssignments = validateAssignmentsForLeave(assignments);

      // Create a unique timestamp with milliseconds to ensure each save creates new rows
      const now = new Date();
      const timestamp = new Date()
        .toLocaleString("en-CA", {
          timeZone: "Asia/Kolkata",
          hour12: false,
        })
        .replace(",", ""); // Use ISO string with milliseconds

      console.log("Saving roster with timestamp:", timestamp);

      const results = [];
      let insertedCount = 0;

      // Process each shift - ALWAYS INSERT NEW ROWS
      for (const shift of shifts) {
        // Create structured data object for each ward
        const insertData = {
          timestamp: timestamp,
          shift: shift.name,
          start_date: startDate, // Add start_date to the payload
        };

        // Fill ward columns with structured JSON
        wards.forEach((ward) => {
          let columnName;

          switch (ward) {
            case "Male General Ward":
              columnName = "male_general_ward";
              break;
            case "Female General Ward":
              columnName = "female_general_ward";
              break;
            case "ICU":
              columnName = "icu";
              break;
            case "HDU":
              columnName = "hdu";
              break;
            case "Private Ward":
              columnName = "private_ward";
              break;
            case "NICU":
              columnName = "nicu";
              break;
            case "PICU":
              columnName = "picu";
              break;
            default:
              columnName = ward.toLowerCase().replace(/\s+/g, "_");
          }

          // Get staff assigned to this ward and shift (from validated assignments)
          const staffList = validatedAssignments[ward]?.[shift.name] || [];

          // Create structured object {nurse: [], rmo: [], ot: []}
          const structuredData = {
            nurse: [],
            rmo: [],
            ot: [],
          };

          // Categorize staff by type
          staffList.forEach((staff) => {
            switch (staff.type) {
              case "nurse":
                structuredData.nurse.push(staff.name);
                break;
              case "rmo":
                structuredData.rmo.push(staff.name);
                break;
              case "ot":
                structuredData.ot.push(staff.name);
                break;
            }
          });

          // Store as JSON string in the database column
          insertData[columnName] = JSON.stringify(structuredData);
        });

        // ALWAYS INSERT NEW RECORD
        console.log(`Inserting new row for shift: ${shift.name}`, insertData);
        const { data, error } = await supabase
          .from("roster")
          .insert(insertData);

        if (error) {
          console.error(`Error inserting shift ${shift.name}:`, error);
          throw new Error(`Failed to insert ${shift.name}: ${error.message}`);
        }

        results.push({ shift: shift.name, type: "insert", data });
        insertedCount++;
      }

      console.log("Roster saved successfully as new rows!", results);

      // Show success toast
      showToast(
        `Roster saved successfully! (${insertedCount} new rows created)`,
        "success",
      );

      // Update last save time
      setLastSaveTime(timestamp);

      // Refresh leave data
      await fetchLeaveData();

      // Refresh the roster data to show the latest saved data
      await fetchLatestRosterData(staffData, staffOnLeave);
    } catch (err) {
      console.error("Error saving roster:", err);

      // Show error toast
      showToast(
        `Failed to save roster: ${err.message || "Unknown error"}`,
        "error",
      );

      // Fallback: Create backup object
      const backupData = {
        timestamp: new Date().toISOString(),
        assignments: validateAssignmentsForLeave(assignments),
        staffOnLeave: {
          nurses: Array.from(staffOnLeave.nurses),
          rmos: Array.from(staffOnLeave.rmos),
          otStaff: Array.from(staffOnLeave.otStaff),
        },
      };

      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `roster_backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Show backup toast
      showToast("Data has been downloaded as backup JSON file.", "warning");
    }
  };

  // Trigger save flow - open modal
  const handleSaveRoster = () => {
    setShowStartDateModal(true);
  };

  // Calculate statistics
  const nurseSelected = Array.from(selectedStaff).filter((id) =>
    id.startsWith("nurse_"),
  ).length;
  const rmoSelected = Array.from(selectedStaff).filter((id) =>
    id.startsWith("rmo_"),
  ).length;
  const otSelected = Array.from(selectedStaff).filter((id) =>
    id.startsWith("ot_"),
  ).length;

  // Calculate total assignments
  const totalAssignments = useMemo(() => {
    let total = 0;
    Object.values(assignments).forEach((ward) => {
      Object.values(ward).forEach((shift) => {
        total += shift.length;
      });
    });
    return total;
  }, [assignments]);

  // Get staff list for active tab
  const getActiveTabStaff = () => {
    return getAvailableStaff(activeTab);
  };

  // Get selected count for active tab
  const getSelectedCountForActiveTab = () => {
    const prefix =
      activeTab === "nurses" ? "nurse_" : activeTab === "rmos" ? "rmo_" : "ot_";
    return Array.from(selectedStaff).filter((id) => id.startsWith(prefix))
      .length;
  };

  // Get all selected count
  const getAllSelectedCount = () => {
    return selectedStaff.size;
  };

  // Get leave counts
  const leaveCounts = useMemo(
    () => ({
      nurses: staffOnLeave.nurses.size,
      rmos: staffOnLeave.rmos.size,
      otStaff: staffOnLeave.otStaff.size,
      total:
        staffOnLeave.nurses.size +
        staffOnLeave.rmos.size +
        staffOnLeave.otStaff.size,
    }),
    [staffOnLeave],
  );

  // Format last save time
  const formattedLastSaveTime = useMemo(() => {
    if (!lastSaveTime) return "Never";

    const date = new Date(lastSaveTime);
    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [lastSaveTime]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading staff data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && staffData.nurses.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-sm border border-red-200">
          <div className="text-red-500 mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Error Loading Data
          </h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-50 p-3 md:p-4"
      onDragOver={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full mx-auto">
        {/* Header - Compact */}
        <div className="mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 text-center mb-1">
            Hospital Roster Management
          </h1>

          {error && (
            <div className="mt-1 text-center">
              <p className="text-amber-600 text-xs inline-block bg-amber-50 px-2 py-1 rounded">
                ⚠️ Using fallback data
              </p>
            </div>
          )}
          {loadingRoster && (
            <div className="mt-1 text-center">
              <p className="text-blue-600 text-xs inline-block bg-blue-50 px-2 py-1 rounded">
                Loading roster data...
              </p>
            </div>
          )}
          {leaveLoading && (
            <div className="mt-1 text-center">
              <p className="text-amber-600 text-xs inline-block bg-amber-50 px-2 py-1 rounded">
                Loading leave data...
              </p>
            </div>
          )}
        </div>

        {/* Compact Controls & Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 bg-white p-3 rounded-lg shadow-sm">
          {/* Navigation Buttons */}
          <div className="flex bg-gray-100 rounded p-1">
            <button
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${viewMode === "previous" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setViewMode("previous")}
            >
              Previous
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${viewMode === "current" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setViewMode("current")}
            >
              Current
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${viewMode === "next" ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setViewMode("next")}
            >
              Next
            </button>
          </div>

          {/* Action Buttons - ONLY SHOW IN CURRENT MODE */}
          {viewMode === "current" && (
            <div className="flex flex-wrap gap-1">
              <button
                className="px-3 py-1.5 bg-rose-500 text-white rounded text-xs font-medium hover:bg-rose-600 transition-colors"
                onClick={handleClearAllAssignments}
              >
                Clear All
              </button>
              <button
                className="px-3 py-1.5 bg-emerald-500 text-white rounded text-xs font-medium hover:bg-emerald-600 transition-colors"
                onClick={handleSaveRoster}
              >
                Save Roster
              </button>
            </div>
          )}
          {viewMode !== "current" && (
            <div className="px-3 py-1.5 text-xs text-gray-500 italic bg-gray-50 rounded border border-gray-200">
              Read-Only Mode
            </div>
          )}
        </div>

        {/* Main Content - Responsive Layout */}
        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          {/* Left Column - Staff Lists - HIDDEN IN PREVIOUS/NEXT */}
          {viewMode === "current" && (
            <div className="lg:w-1/4 xl:w-1/5">
              <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm h-full">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                  <h2 className="text-base font-semibold text-gray-700">
                    Available Staff
                  </h2>
                  <div className="text-xs text-gray-500">
                    {getSelectedCountForActiveTab()}/
                    {getActiveTabStaff().length} selected
                  </div>
                </div>

                {/* Tab Navigation - Compact */}
                <div className="flex border-b border-gray-200 mb-2">
                  <button
                    className={`flex-1 py-1.5 text-xs font-medium ${activeTab === "nurses" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                    onClick={() => setActiveTab("nurses")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      <span>Nurses ({getAvailableStaff("nurses").length})</span>
                    </div>
                  </button>
                  <button
                    className={`flex-1 py-1.5 text-xs font-medium ${activeTab === "rmos" ? "text-rose-600 border-b-2 border-rose-600" : "text-gray-500 hover:text-gray-700"}`}
                    onClick={() => setActiveTab("rmos")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                      <span>RMO ({getAvailableStaff("rmos").length})</span>
                    </div>
                  </button>
                  <button
                    className={`flex-1 py-1.5 text-xs font-medium ${activeTab === "otStaff" ? "text-emerald-600 border-b-2 border-emerald-600" : "text-gray-500 hover:text-gray-700"}`}
                    onClick={() => setActiveTab("otStaff")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                      <span>OT ({getAvailableStaff("otStaff").length})</span>
                    </div>
                  </button>
                </div>

                {/* Tab Content */}
                <div className="mb-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          activeTab === "nurses"
                            ? "bg-blue-500"
                            : activeTab === "rmos"
                              ? "bg-rose-500"
                              : "bg-emerald-500"
                        }`}
                      ></div>
                      <h3 className="text-xs font-medium text-gray-700">
                        {activeTab === "nurses"
                          ? "Nursing Staff"
                          : activeTab === "rmos"
                            ? "RMO Staff"
                            : "OT Staff"}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleSelectAllActiveTab}
                        className="text-xs text-blue-600 hover:text-blue-800 px-1 py-0.5 hover:bg-blue-50 rounded"
                      >
                        {getSelectedCountForActiveTab() ===
                        getActiveTabStaff().length
                          ? "Deselect"
                          : "Select All"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 max-h-[200px] md:max-h-[300px] overflow-y-auto pr-1">
                    {getActiveTabStaff().map((staff, index) => {
                      const categoryPrefix =
                        activeTab === "nurses"
                          ? "nurse_"
                          : activeTab === "rmos"
                            ? "rmo_"
                            : "ot_";
                      const staffId = `${categoryPrefix}${staff.replace(/\s+/g, "_")}`;
                      const isSelected = selectedStaff.has(staffId);
                      const staffType =
                        activeTab === "nurses"
                          ? "nurse"
                          : activeTab === "rmos"
                            ? "rmo"
                            : "ot";

                      return (
                        <div
                          key={index}
                          className={`flex items-center p-2 rounded cursor-pointer transition-all select-none ${
                            isSelected
                              ? activeTab === "nurses"
                                ? "bg-blue-50 border border-blue-200 shadow-xs"
                                : activeTab === "rmos"
                                  ? "bg-rose-50 border border-rose-200 shadow-xs"
                                  : "bg-emerald-50 border border-emerald-200 shadow-xs"
                              : "bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:shadow-xs"
                          }`}
                          onClick={() => handleStaffSelection(staffId)}
                          draggable="true"
                          onDragStart={(e) =>
                            handleDragStart(e, staffId, staff, staffType)
                          }
                        >
                          <div className="flex items-center flex-1">
                            <div
                              className={`w-3 h-3 rounded mr-2 flex items-center justify-center ${
                                isSelected
                                  ? activeTab === "nurses"
                                    ? "bg-blue-500"
                                    : activeTab === "rmos"
                                      ? "bg-rose-500"
                                      : "bg-emerald-500"
                                  : "border border-gray-300"
                              }`}
                            >
                              {isSelected && (
                                <span className="text-white text-xs">✓</span>
                              )}
                            </div>
                            <span className="text-gray-700 text-xs truncate">
                              {staff}
                            </span>
                          </div>
                          <div className="text-gray-400 text-xs bg-gray-100 px-1 py-0.5 rounded text-nowrap">
                            Drag
                          </div>
                        </div>
                      );
                    })}
                    {getActiveTabStaff().length === 0 && (
                      <div className="text-center py-4 text-gray-400 text-xs italic">
                        No{" "}
                        {activeTab === "nurses"
                          ? "nursing"
                          : activeTab === "rmos"
                            ? "RMO"
                            : "OT"}{" "}
                        staff available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Middle Column - Roster Table */}
          <div
            className={`${viewMode === "current" ? "lg:w-1/2 xl:w-3/5" : "w-full"}`}
          >
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full flex flex-col">
              <div className="p-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-700">
                      Roster Assignments
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Drag staff from left and drop into shift cells below
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Each save creates new database rows
                    </p>
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">{totalAssignments}</span>{" "}
                    assignments
                  </div>
                </div>
              </div>

              <div
                ref={tableContainerRef}
                className="flex-1 overflow-auto"
                style={{ scrollBehavior: "smooth", maxHeight: "60vh" }}
              >
                <div className="min-w-full">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600 bg-gray-50 min-w-[120px] sticky left-0 z-20 border-r border-gray-200 whitespace-nowrap">
                          Ward / Department
                        </th>
                        {shifts.map((shift) => (
                          <th
                            key={shift.id}
                            className="text-center py-2 px-2 text-xs font-semibold text-gray-600 bg-gray-50 min-w-[130px] max-w-[150px]"
                          >
                            <div className="font-medium whitespace-nowrap">
                              {shift.name}
                            </div>
                            <div className="text-xs font-normal text-gray-500 mt-0.5 whitespace-nowrap">
                              {shift.time}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {wards.map((ward) => (
                        <tr
                          key={ward}
                          className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                        >
                          <td className="py-2 px-2 text-xs font-medium text-gray-700 bg-gray-50 sticky left-0 z-10 border-r border-gray-200 whitespace-nowrap min-w-[120px]">
                            <div className="truncate">{ward}</div>
                          </td>
                          {shifts.map((shift) => (
                            <td
                              key={`${ward}-${shift.id}`}
                              className={`py-2 px-2 min-h-[60px] min-w-[130px] max-w-[150px] ${
                                draggingOver === `${ward}-${shift.name}`
                                  ? "bg-blue-50 border-2 border-dashed border-blue-300"
                                  : "bg-white"
                              }`}
                              onDragOver={(e) =>
                                handleDragOver(e, ward, shift.name)
                              }
                              onDragLeave={() => setDraggingOver(null)}
                              onDrop={(e) => handleDrop(e, ward, shift.name)}
                            >
                              <div className="min-h-[50px]">
                                <div className="flex flex-col gap-1">
                                  {assignments[ward]?.[shift.name]?.map(
                                    (assignment, index) => (
                                      <div
                                        key={index}
                                        className={`flex items-center justify-between px-1.5 py-1 rounded text-xs ${
                                          assignment.type === "nurse"
                                            ? "bg-blue-100 text-blue-700 border border-blue-200"
                                            : assignment.type === "rmo"
                                              ? "bg-rose-100 text-rose-700 border border-rose-200"
                                              : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                        }`}
                                      >
                                        <span className="truncate">
                                          {assignment.name}
                                        </span>
                                        {viewMode === "current" && (
                                          <button
                                            className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveAssignment(
                                                assignment.id,
                                                ward,
                                                shift.name,
                                              );
                                            }}
                                          >
                                            ×
                                          </button>
                                        )}
                                      </div>
                                    ),
                                  )}
                                </div>
                                {assignments[ward]?.[shift.name]?.length ===
                                  0 && (
                                  <div className="text-xs text-gray-400 text-center py-3 italic">
                                    Drop here
                                  </div>
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table Footer - Compact Stats */}
              <div className="p-2 border-t border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">
                      {getAvailableStaff("nurses").length +
                        getAvailableStaff("rmos").length +
                        getAvailableStaff("otStaff").length}
                    </span>{" "}
                    staff available
                    <span className="mx-1">•</span>
                    <span className="font-medium">{leaveCounts.total}</span> on
                    leave
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">
                        Nurse ({getAvailableStaff("nurses").length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">
                        RMO ({getAvailableStaff("rmos").length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">
                        OT ({getAvailableStaff("otStaff").length})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Staff on Leave - HIDDEN IN PREVIOUS/NEXT */}
          {viewMode === "current" && (
            <div className="lg:w-1/4 xl:w-1/5">
              <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm h-full">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                  <h2 className="text-base font-semibold text-gray-700">
                    Staff on Leave
                  </h2>
                  {leaveCounts.total > 0 && (
                    <button
                      onClick={handleClearAllLeave}
                      className="text-xs text-rose-600 hover:text-rose-800 px-1.5 py-0.5 hover:bg-rose-50 rounded"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div
                  className={`min-h-[100px] border-2 border-dashed rounded p-2 mb-3 ${
                    draggingOver === "leave-section"
                      ? "bg-amber-50 border-amber-300"
                      : "border-gray-200"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDraggingOver("leave-section");
                  }}
                  onDragLeave={() => setDraggingOver(null)}
                  onDrop={handleDropOnLeave}
                >
                  <div className="text-center">
                    <div className="text-amber-500 mb-1">
                      <svg
                        className="w-6 h-6 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-600 mb-0.5">
                      Drop staff here to mark as on leave
                    </p>
                    <p className="text-xs text-gray-400">
                      They will be hidden from available staff
                    </p>
                  </div>
                </div>

                <div className="space-y-2 max-h-[150px] md:max-h-[250px] overflow-y-auto">
                  {/* Unified Staff on Leave List */}
                  {[
                    ...Array.from(staffOnLeave.nurses).map((name) => ({
                      name,
                      type: "nurse",
                    })),
                    ...Array.from(staffOnLeave.rmos).map((name) => ({
                      name,
                      type: "rmo",
                    })),
                    ...Array.from(staffOnLeave.otStaff).map((name) => ({
                      name,
                      type: "ot",
                    })),
                  ]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((staff, index) => (
                      <div
                        key={`${staff.type}-${index}`}
                        className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded text-xs"
                      >
                        <div className="flex items-center">
                          <div
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              staff.type === "nurse"
                                ? "bg-blue-500"
                                : staff.type === "rmo"
                                  ? "bg-rose-500"
                                  : "bg-emerald-500"
                            }`}
                          ></div>
                          <span className="text-gray-700 line-through truncate">
                            {staff.name}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            handleRemoveFromLeave(staff.name, staff.type)
                          }
                          className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                  {leaveCounts.total === 0 && (
                    <div className="text-center py-3 text-gray-400 text-xs italic">
                      No staff on leave
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-gray-200">
                  <div className="text-center">
                    <div className="text-xs text-gray-600">
                      <span className="font-medium">{leaveCounts.total}</span>{" "}
                      staff on leave
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Drag staff here to mark as absent
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards - Compact Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-white rounded border border-gray-200 p-2 shadow-xs">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <h3 className="text-xs font-medium text-gray-700">
                Nursing Staff
              </h3>
            </div>
            <div className="flex items-baseline">
              <div className="text-lg font-bold text-gray-800">
                {getAvailableStaff("nurses").length}
              </div>
              <div className="ml-1 text-xs text-gray-500">available</div>
            </div>
            <div className="mt-1 text-xs text-gray-600">
              <span className="font-medium">{leaveCounts.nurses}</span> on leave
            </div>
          </div>

          <div className="bg-white rounded border border-gray-200 p-2 shadow-xs">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
              <h3 className="text-xs font-medium text-gray-700">RMO Staff</h3>
            </div>
            <div className="flex items-baseline">
              <div className="text-lg font-bold text-gray-800">
                {getAvailableStaff("rmos").length}
              </div>
              <div className="ml-1 text-xs text-gray-500">available</div>
            </div>
            <div className="mt-1 text-xs text-gray-600">
              <span className="font-medium">{leaveCounts.rmos}</span> on leave
            </div>
          </div>

          <div className="bg-white rounded border border-gray-200 p-2 shadow-xs">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <h3 className="text-xs font-medium text-gray-700">OT Staff</h3>
            </div>
            <div className="flex items-baseline">
              <div className="text-lg font-bold text-gray-800">
                {getAvailableStaff("otStaff").length}
              </div>
              <div className="ml-1 text-xs text-gray-500">available</div>
            </div>
            <div className="mt-1 text-xs text-gray-600">
              <span className="font-medium">{leaveCounts.otStaff}</span> on
              leave
            </div>
          </div>

          <div className="bg-white rounded border border-gray-200 p-2 shadow-xs">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <h3 className="text-xs font-medium text-gray-700">Assignments</h3>
            </div>
            <div className="flex items-baseline">
              <div className="text-lg font-bold text-gray-800">
                {totalAssignments}
              </div>
              <div className="ml-1 text-xs text-gray-500">made</div>
            </div>
            <div className="mt-1 text-xs text-gray-600">
              <span className="font-medium">{leaveCounts.total}</span> on leave
            </div>
          </div>
        </div>

        {/* Toast Notifications */}
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center justify-between p-4 rounded-lg shadow-lg min-w-[300px] max-w-md transform transition-all duration-300 ${
                toast.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : toast.type === "error"
                    ? "bg-red-50 border border-red-200 text-red-800"
                    : toast.type === "warning"
                      ? "bg-amber-50 border border-amber-200 text-amber-800"
                      : "bg-blue-50 border border-blue-200 text-blue-800"
              }`}
            >
              <div className="flex items-center">
                {toast.type === "success" && (
                  <svg
                    className="w-5 h-5 mr-2 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {toast.type === "error" && (
                  <svg
                    className="w-5 h-5 mr-2 text-red-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {toast.type === "warning" && (
                  <svg
                    className="w-5 h-5 mr-2 text-amber-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {toast.type === "info" && (
                  <svg
                    className="w-5 h-5 mr-2 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                <span className="text-sm font-medium">{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-4 text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Drag Instruction */}
        {isDragging && (
          <div
            className="fixed pointer-events-none z-50"
            style={{
              left: dragPosition.x + 15,
              top: dragPosition.y + 15,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="bg-gray-800 text-white px-2 py-1 rounded text-xs shadow-lg flex items-center gap-1">
              {dragData?.isMultiple ? (
                <>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                  <span>Dragging {dragData.selectedStaff.length} staff</span>
                </>
              ) : (
                <>
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      dragData?.type === "nurse"
                        ? "bg-blue-400"
                        : dragData?.type === "rmo"
                          ? "bg-rose-400"
                          : "bg-emerald-400"
                    }`}
                  ></div>
                  <span className="truncate max-w-[100px]">
                    {dragData?.name}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Start Date Selection Modal */}
      {showStartDateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-scale-in">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Select Start Date
            </h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Roster Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-2">
                This date will be associated with the roster assignments.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowStartDateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={proceedWithSave}
                disabled={!startDate}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roster;
