import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Eye,
  Trash2,
  Edit,
  Filter,
  Search,
  RefreshCw,
  Layers,
  LayoutDashboard,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotification } from "../../../contexts/NotificationContext";
import PatientCard from "../../../components/PatientCard";
import { fetchIpdPatients, getDischargedAdmissions, deleteIpdPatient } from "../../../api/patientProfile";
import useRealtimeQuery from "../../../hooks/useRealtimeQuery";

// Main Component
export default function PatientProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const location = useLocation();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [wardFilter, setWardFilter] = useState("All Patients");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [doctorTab, setDoctorTab] = useState("active");
  const [compactView, setCompactView] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("mis_user")), []);
  const userRole = currentUser?.role?.toLowerCase();
  const userName = currentUser?.name?.trim();

  const normalizeKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const getShiftTimeRange = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    if (hour >= 8 && hour < 14) {
      return { shift: "A", start: `${today} 08:00:00`, end: `${today} 14:00:00` };
    }
    if (hour >= 14 && hour < 20) {
      return { shift: "B", start: `${today} 14:00:00`, end: `${today} 20:00:00` };
    }
    if (hour >= 20) {
      return { shift: "C", start: `${today} 20:00:00`, end: `${today} 23:59:59` };
    }
    return { shift: "C", start: `${yesterday} 20:00:00`, end: `${today} 08:00:00` };
  }, []);

  // --- Queries ---

  const { data: dischargedAdmissions = new Set(), isLoading: isLoadingDischarge } = useQuery({
    queryKey: ['patients', 'discharged', 'map'],
    queryFn: getDischargedAdmissions,
  });

  const { data: patientsData = [], isLoading: isLoadingPatients, isFetching: isRefreshing } = useQuery({
    queryKey: ['patients', 'ipd', userRole, userName, doctorTab],
    queryFn: () => fetchIpdPatients({
      userRole,
      userName,
      doctorTab,
      shiftRange: getShiftTimeRange()
    }),
  });

  // Real-time updates
  useRealtimeQuery(['public', 'ipd_admissions'], ['patients', 'ipd', userRole, userName, doctorTab]);
  useRealtimeQuery(['public', 'discharge'], ['patients', 'discharged', 'map']);

  // --- Mutations ---

  const deleteMutation = useMutation({
    mutationFn: deleteIpdPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', 'ipd'] });
      showNotification("Patient record deleted successfully!", "success");
    },
    onError: (error) => {
      console.error("Error deleting patient:", error);
      showNotification("Failed to delete patient record.", "error");
    }
  });

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

  const dynamicWardFilters = useMemo(() => 
    Array.from(new Set(patientsData.map((p) => p.ward_type).filter(Boolean))).sort(),
    [patientsData]
  );

  const allWardFilters = useMemo(() => [
    ...wardFilters,
    ...dynamicWardFilters.filter((w) => !wardFilters.includes(w)),
  ], [dynamicWardFilters]);

  const filteredPatients = useMemo(() => {
    return patientsData.filter((patient) => {
      const patientName = patient.patient_name || "";
      const admissionNo = patient.admission_no || "";
      const ipdNo = patient.ipd_number || "";
      const consultantDr = patient.consultant_dr || "";
      const bedLocation = patient.bed_location || patient.location_status || patient.ward || "";
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
      const isDischarged =
        dischargedAdmissions.has(normalizeKey(admissionNo)) ||
        dischargedAdmissions.has(normalizeKey(ipdNo));

      if (userRole === "doctor") {
        if (doctorTab === "active") {
          matchesStatus = !isDischarged;
        } else if (doctorTab === "discharged") {
          matchesStatus = isDischarged;
        }
      } else {
        matchesStatus =
          statusFilter === "All" ||
          (statusFilter === "Active" && !isDischarged) ||
          (statusFilter === "Discharged" && isDischarged);
      }

      return matchesSearch && matchesWard && matchesCategory && matchesStatus;
    });
  }, [patientsData, searchTerm, wardFilter, filterCategory, statusFilter, doctorTab, dischargedAdmissions, userRole]);

  const visiblePatients = filteredPatients.slice(0, visibleCount);

  // Infinite Scroll Hook
  useEffect(() => {
    const container = document.getElementById("scroll-container");
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (
        scrollTop + clientHeight >= scrollHeight - 300 &&
        visibleCount < filteredPatients.length
      ) {
        setVisibleCount((prev) => Math.min(prev + 12, filteredPatients.length));
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [visibleCount, filteredPatients.length]);

  // Reset count when filters change
  useEffect(() => {
    setVisibleCount(12);
  }, [searchTerm, wardFilter, filterCategory, statusFilter, doctorTab]);

  const handleViewDetails = (patient) => {
    navigate(`/admin/patient-profile/${patient.id}`, { state: { patient } });
  };

  const handleEdit = (patientId) => {
    const patient = patientsData.find((p) => p.id === patientId);
    if (patient) {
      alert(`Edit functionality for patient: ${patient.patient_name}\nID: ${patientId}`);
    }
  };

  const handleDelete = (patientId) => {
    if (window.confirm("Are you sure you want to delete this patient record? This action cannot be undone.")) {
      deleteMutation.mutate(patientId);
    }
  };

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['patients'] });
  };

  if (isLoadingPatients && patientsData.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto border-b-2 border-green-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading patient data...</p>
        </div>
      </div>
    );
  }

  const hasActiveFilters = wardFilter !== "All Patients" || filterCategory !== "All";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 p-4 lg:p-6 bg-gray-50">
          <div className="max-w-full mx-auto">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">Patient Profiles</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Total Patients: {patientsData.length} | Showing: {filteredPatients.length}
                </p>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 lg:min-w-[350px]">
                  <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
                  <input
                    type="text"
                    placeholder="Search patients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full py-2 pl-10 pr-4 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Filters</span>
                  {hasActiveFilters && <span className="px-1.5 py-0.5 text-xs font-semibold text-white bg-green-600 rounded-full">●</span>}
                </button>
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline text-sm">{isRefreshing ? "Refreshing..." : "Refresh"}</span>
                </button>
                <button
                  onClick={() => setCompactView(!compactView)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-sm ${
                    compactView ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {compactView ? <Layers className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                  <span className="hidden md:inline">{compactView ? "Normal" : "Compact"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-8 px-4 mb-4 border-b lg:px-6 bg-gray-50">
          {["All", "Active", "Discharged"].map((status) => {
            const key = status.toLowerCase();
            const isActive = userRole === "doctor" ? doctorTab === key : statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => userRole === "doctor" ? setDoctorTab(key) : setStatusFilter(status)}
                className={`pb-2 text-sm font-semibold transition-all relative ${isActive ? "text-green-600" : "text-gray-500 hover:text-gray-700"}`}
              >
                {status}
                {isActive && <span className="absolute left-0 bottom-0 w-full h-[2px] bg-green-600 rounded-full"></span>}
              </button>
            );
          })}
        </div>

        {/* Ward Filter Buttons */}
        {showFilters && (
          <div className="flex-shrink-0 px-4 pb-4 lg:px-6 bg-gray-50 animate-fade-in">
            <div className="max-w-full mx-auto">
              <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="flex flex-col gap-4 mb-4 lg:flex-row lg:items-center lg:justify-between">
                  <h3 className="text-sm font-semibold tracking-wide text-gray-700 uppercase">Filter by Ward/Location</h3>
                  <button
                    onClick={() => { setWardFilter("All Patients"); setFilterCategory("All"); }}
                    className="text-xs text-green-600 hover:text-green-700"
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
                        wardFilter === filter ? "bg-green-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                <div className="pt-4 mt-6 border-t">
                  <h3 className="mb-3 text-sm font-semibold tracking-wide text-gray-700 uppercase">Patient Category</h3>
                  <div className="flex flex-wrap gap-2">
                    {["All", "General", "Private", "VIP", "Insurance", "Corporate", "Ayushman", "GJAY"].map((category) => (
                      <button
                        key={category}
                        onClick={() => setFilterCategory(category)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                          filterCategory === category ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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

        {/* Patients Grid */}
        <div id="scroll-container" className="flex-1 px-4 pb-4 overflow-y-auto lg:px-6 lg:pb-12 bg-gray-50">
          <div className="max-w-full mx-auto">
            {isRefreshing && patientsData.length > 0 && (
              <div className="mb-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 rounded-lg bg-blue-50">
                  <div className="w-3 h-3 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                  Updating patient data...
                </div>
              </div>
            )}

            <div className={`flex flex-col gap-6 ${compactView ? "md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "md:grid md:grid-cols-2 lg:grid-cols-3"}`}>
              {visiblePatients.length > 0 ? (
                visiblePatients.map((patient) => (
                  <div key={patient.id} className="animate-fade-in">
                    <PatientCard
                      patient={patient}
                      onViewDetails={handleViewDetails}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      compactView={compactView}
                    />
                  </div>
                ))
              ) : (
                <div className="py-12 text-center bg-white rounded-lg shadow-md col-span-full border-dashed border-2 border-gray-200">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="w-12 h-12 text-gray-400" />
                    <p className="mb-2 text-lg text-gray-500 font-semibold">No patients found</p>
                    <p className="text-sm text-gray-400">No patients match your current search or filter criteria</p>
                    {hasActiveFilters && (
                      <button
                        onClick={() => { setWardFilter("All Patients"); setFilterCategory("All"); setSearchTerm(""); }}
                        className="mt-4 text-sm text-green-600 hover:text-green-700 font-bold"
                      >
                        Clear filters to see all patients
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pagination Footer */}
            {visiblePatients.length < filteredPatients.length && (
              <div className="py-12 flex flex-col items-center justify-center gap-4">
                <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading more patients...</p>
              </div>
            )}

            {!isLoadingPatients && visiblePatients.length === filteredPatients.length && filteredPatients.length > 0 && (
              <div className="py-12 text-center text-xs font-bold text-gray-300 uppercase tracking-widest">End of list</div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
      `}</style>
    </div>
  );
}
