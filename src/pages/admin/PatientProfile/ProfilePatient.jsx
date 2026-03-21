import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Eye, Trash2, Edit, Filter, Search, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import supabase from "../../../SupabaseClient"; // Adjust the path to your supabase client
import PatientCard from "../../../components/PatientCard";

// Main Component
export default function PatientProfile() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [wardFilter, setWardFilter] = useState("All Patients");
  const [patientsData, setPatientsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [doctorTab, setDoctorTab] = useState("active");
  const [dischargedAdmissions, setDischargedAdmissions] = useState(new Set());

  const location = useLocation();
  const normalizeKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const getShiftTimeRange = () => {
    const now = new Date();
    const hour = now.getHours();

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];

    if (hour >= 8 && hour < 14) {
      // Shift A
      return {
        shift: "A",
        start: `${today} 08:00:00`,
        end: `${today} 14:00:00`,
      };
    }

    if (hour >= 14 && hour < 20) {
      // Shift B
      return {
        shift: "B",
        start: `${today} 14:00:00`,
        end: `${today} 20:00:00`,
      };
    }

    // Shift C (Night shift)
    if (hour >= 20) {
      return {
        shift: "C",
        start: `${today} 20:00:00`,
        end: `${today} 23:59:59`,
      };
    }

    // Between 12 AM – 8 AM (belongs to previous night shift)
    return {
      shift: "C",
      start: `${yesterday} 20:00:00`,
      end: `${today} 08:00:00`,
    };
  };
  const currentUser = JSON.parse(localStorage.getItem("mis_user"));
  const userRole = currentUser?.role?.toLowerCase();
  const userName = currentUser?.name?.trim();

  // Load discharge mapping from Supabase so we only treat patients as "discharged" if they exist in the discharge table.
  const fetchDischargedAdmissions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("discharge")
        .select("admission_no");

      if (error) throw error;

      const set = new Set(
        (data || []).map((d) => normalizeKey(d.admission_no)).filter(Boolean),
      );
      setDischargedAdmissions(set);
    } catch (err) {
      console.error("Error fetching discharge records:", err);
      setDischargedAdmissions(new Set());
    }
  }, []);

  // Load patients from Supabase
  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      setIsRefreshing(true);

      const { start, end } = getShiftTimeRange();
      console.log("Current Shift Time Range:", start, end);
      let ipdNumbers = [];
      let shouldFilter = false;

      // ============================
      // NURSE / OT / OT STAFF
      // ============================
      if (["nurse", "ot", "ot staff"].includes(userRole)) {
        shouldFilter = true;

        console.log("username", userName);

        const { data, error } = await supabase
          .from("nurse_assign_task")
          .select("Ipd_number")
          .ilike("assign_nurse", `%${userName.trim()}%`)
          .not("Ipd_number", "is", null); // include all assigned patients until discharge

        console.log("Nurse Assign Task Data:", data);
        if (!error && data) {
          ipdNumbers = Array.from(
            new Set(
              data
                .map((t) => t.Ipd_number)
                .filter((num) => num)
                .map((num) => String(num).trim()),
            ),
          );
        }
      }

      // ============================
      // RMO
      // ============================
      else if (userRole === "rmo") {
        shouldFilter = true;

        const { data, error } = await supabase
          .from("rmo_assign_task")
          .select("ipd_number")
          .eq("assign_rmo", userName)
          .gte("planned1", start)
          .lte("planned1", end);

        if (!error && data) {
          ipdNumbers = data.map((t) => t.ipd_number);
        }
      }
      // ============================
      // DRESSING STAFF
      // ============================
      // else if (userRole === 'dressing staff') {
      //     shouldFilter = true;

      //     const { data, error } = await supabase
      //         .from('dressing')   // 👈 your table name
      //         .select('ipd_number')
      //         .eq('assign_staff', userName)   // 👈 column holding staff name
      //         .gte('planned1', start)
      //         .lte('planned1', end);

      //     if (!error && data) {
      //         ipdNumbers = data.map(t => t.ipd_number);
      //     }
      // }

      // ============================
      // FETCH PATIENTS
      // ============================
      let query = supabase
        .from("ipd_admissions")
        .select("*")
        .order("timestamp", { ascending: false });

      if (userRole === "doctor") {
        if (doctorTab === "active" || doctorTab === "discharged") {
          // Only assigned to this doctor
          query = query.eq("consultant_dr", userName);
        }
      }
      if (shouldFilter) {
        if (ipdNumbers.length > 0) {
          query = query.in("ipd_number", ipdNumbers);
        } else {
          query = query.eq("id", -1); // no patients
        }
      }

      const { data, error } = await query;

      if (!error) {
        setPatientsData(data || []);
      } else {
        console.error(error);
        setPatientsData([]);
      }
    } catch (err) {
      console.error("fetchPatients error:", err);
      setPatientsData([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, [doctorTab, userRole, userName]);

  useEffect(() => {
    fetchDischargedAdmissions();
    fetchPatients();
  }, [fetchDischargedAdmissions, fetchPatients, location.key]);

  const wardFilters = [
    "All Patients",
    "ICU",
    "Private Ward",
    "PICU",
    "NICU",
    "Emergency",
    "HDU",
    "General Ward(5th floor)",
  ];

  // Get unique ward types from data for dynamic filters
  const dynamicWardFilters = Array.from(
    new Set(patientsData.map((p) => p.ward_type).filter(Boolean)),
  ).sort();

  // Combine static and dynamic filters
  const allWardFilters = [
    ...wardFilters,
    ...dynamicWardFilters.filter((w) => !wardFilters.includes(w)),
  ];

  const filteredPatients = patientsData.filter((patient) => {
    const patientName = patient.patient_name || "";
    const admissionNo = patient.admission_no || "";
    const ipdNo = patient.ipd_number || "";
    const consultantDr = patient.consultant_dr || "";
    const bedLocation =
      patient.bed_location || patient.location_status || patient.ward || "";
    const patCategory = patient.pat_category || "";
    const wardType = patient.ward_type || "";
    const department = patient.department || "";

    const matchesSearch =
      patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admissionNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ipdNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consultantDr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      department.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesWard =
      wardFilter === "All Patients" ||
      bedLocation === wardFilter ||
      wardType === wardFilter;
    const matchesCategory =
      filterCategory === "All" || patCategory === filterCategory;

    let matchesStatus = true;

    // ✅ Doctor tab logic (use discharge table rather than actual1)
    const isDischarged =
      dischargedAdmissions.has(normalizeKey(admissionNo)) ||
      dischargedAdmissions.has(normalizeKey(ipdNo));

    if (userRole === "doctor") {
      if (doctorTab === "active") {
        matchesStatus = !isDischarged;
      } else if (doctorTab === "discharged") {
        matchesStatus = isDischarged;
      }
      // doctorTab === 'all' → no status filter
    } else {
      // Existing status filter for other roles (use discharge table)
      matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Active" && !isDischarged) ||
        (statusFilter === "Discharged" && isDischarged);
    }

    return matchesSearch && matchesWard && matchesCategory && matchesStatus;
  });

  const handleViewDetails = (patient) => {
    navigate(`/admin/patient-profile/${patient.id}`, { state: { patient } });
  };

  const handleEdit = async (patientId) => {
    // Find the patient to edit
    const patient = patientsData.find((p) => p.id === patientId);
    if (patient) {
      alert(
        `Edit functionality for patient: ${patient.patient_name}\nID: ${patientId}`,
      );
      // You can implement an edit modal here
    }
  };

  const handleDelete = async (patientId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this patient record? This action cannot be undone.",
      )
    ) {
      try {
        const { error } = await supabase
          .from("ipd_admissions")
          .delete()
          .eq("id", patientId);

        if (error) {
          console.error("Error deleting patient:", error);
          alert("Failed to delete patient record.");
          return;
        }

        // Refresh the list
        await fetchPatients();
        alert("Patient record deleted successfully!");
      } catch (error) {
        console.error("Error deleting patient:", error);
        alert("Failed to delete patient record.");
      }
    }
  };

  // Check if any filter is active
  const hasActiveFilters =
    wardFilter !== "All Patients" || filterCategory !== "All";

  const handleManualRefresh = () => {
    if (!isRefreshing) {
      fetchDischargedAdmissions();
      fetchPatients();
    }
  };

  if (loading && patientsData.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto border-b-2 border-green-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading patient data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header with Quick Actions */}
        <div className="flex-shrink-0 p-4 lg:p-6 bg-gray-50">
          <div className="max-w-full mx-auto">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">
                  Patient Profiles
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Total Patients: {patientsData.length} | Showing:{" "}
                  {filteredPatients.length}
                  {lastUpdated && (
                    <span className="ml-2 text-gray-500">
                      Last updated: {lastUpdated}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 lg:min-w-[350px]">
                  <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
                  <input
                    type="text"
                    placeholder="Search by name, IPD No, doctor, or department..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full py-2 pl-10 pr-4 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 transition-colors bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {hasActiveFilters && (
                    <span className="px-1.5 py-0.5 text-xs font-semibold text-white bg-green-600 rounded-full">
                      ●
                    </span>
                  )}
                </button>
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 px-4 py-2 text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  <span className="text-sm">
                    {isRefreshing ? "Refreshing..." : "Refresh"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-8 px-4 mb-4 border-b lg:px-6">
          {["All", "Active", "Discharged"].map((status) => {
            const key = status.toLowerCase(); // 'all' | 'active' | 'discharged'

            const isActive =
              userRole === "doctor"
                ? doctorTab === key
                : statusFilter === status;

            return (
              <button
                key={status}
                onClick={() => {
                  if (userRole === "doctor") {
                    setDoctorTab(key);
                  } else {
                    setStatusFilter(status);
                  }
                }}
                className={`pb-2 text-sm font-semibold transition-all relative
                    ${
                      isActive
                        ? "text-green-600"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
              >
                {status}

                {/* Underline */}
                {isActive && (
                  <span className="absolute left-0 bottom-0 w-full h-[2px] bg-green-600 rounded-full"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Ward Filter Buttons */}
        {showFilters && (
          <div className="flex-shrink-0 px-4 pb-4 lg:px-6 bg-gray-50">
            <div className="max-w-full mx-auto">
              <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="flex flex-col gap-4 mb-4 lg:flex-row lg:items-center lg:justify-between">
                  <h3 className="text-sm font-semibold tracking-wide text-gray-700 uppercase">
                    Filter by Ward/Location
                  </h3>
                  <button
                    onClick={() => {
                      setWardFilter("All Patients");
                      setFilterCategory("All");
                    }}
                    className="text-xs text-green-600 transition-colors hover:text-green-700"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap justify-start gap-2 p-1 overflow-y-auto max-h-40">
                  {allWardFilters.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setWardFilter(filter)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        wardFilter === filter
                          ? "bg-green-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                {/* Patient Category Filter */}
                <div className="pt-4 mt-6 border-t">
                  <h3 className="mb-3 text-sm font-semibold tracking-wide text-gray-700 uppercase">
                    Patient Category
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "All",
                      "General",
                      "Private",
                      "VIP",
                      "Insurance",
                      "Corporate",
                      "Ayushman",
                      "GJAY",
                    ].map((category) => (
                      <button
                        key={category}
                        onClick={() => setFilterCategory(category)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                          filterCategory === category
                            ? "bg-blue-600 text-white shadow-md"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Patients Grid - Scrollable */}
        <div className="flex-1 px-4 pb-4 overflow-y-auto lg:px-6 lg:pb-6">
          <div className="max-w-full mx-auto">
            {isRefreshing && patientsData.length > 0 && (
              <div className="mb-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 rounded-lg bg-blue-50">
                  <div className="w-3 h-3 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                  Updating patient data...
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <PatientCard
                    key={patient.id}
                    patient={patient}
                    onViewDetails={handleViewDetails}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))
              ) : (
                <div className="py-12 text-center bg-white rounded-lg shadow-md col-span-full">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="w-12 h-12 text-gray-400" />
                    <p className="mb-2 text-lg text-gray-500">
                      No patients found
                    </p>
                    <p className="text-sm text-gray-400">
                      No patients match your search criteria
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={() => {
                          setWardFilter("All Patients");
                          setFilterCategory("All");
                          setSearchTerm("");
                        }}
                        className="mt-4 text-sm text-green-600 hover:text-green-700"
                      >
                        Clear filters to see all patients
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Show total count */}
            {filteredPatients.length > 0 && (
              <div className="mt-6 text-sm text-center text-gray-500">
                Showing {filteredPatients.length} of {patientsData.length}{" "}
                patients
                {wardFilter !== "All Patients" && ` in ${wardFilter}`}
                {lastUpdated && ` • Last updated: ${lastUpdated}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
