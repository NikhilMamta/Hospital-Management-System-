import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Pill,
  Plus,
  X,
  Eye,
  Edit,
  Trash2,
  Search,
  CheckCircle,
  Save,
  Check,
  AlertCircle,
} from "lucide-react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotification } from "../../../contexts/NotificationContext";
import supabase from "../../../SupabaseClient";
import { sendIndentApprovalNotification } from "../../../utils/whatsappService";
import { 
  getPatientPharmacyIndents, 
  getMedicines, 
  getInvestigations, 
  getCategories,
  createPharmacyIndent,
  updatePharmacyIndent,
  deletePharmacyIndent
} from "../../../api/pharmacy";
import { normalizePatientPharmacyIndent } from "../../../utils/pharmacyIndentUtils";
import useRealtimeQuery from "../../../hooks/useRealtimeQuery";

const StatusBadge = ({ status }) => {
  const getColors = () => {
    if (status === "Completed" || status === "Approved & Dispensed")
      return "bg-green-100 text-green-700";
    if (status === "Pending" || status === "Pending Approval")
      return "bg-yellow-100 text-yellow-700";
    if (status === "In Progress") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${getColors()}`}
    >
      {status}
    </span>
  );
};

const isApprovedIndent = (status) =>
  typeof status === "string" && status.toLowerCase().includes("approved");

// Stepper component
const FormStepper = ({ currentStep }) => {
  const steps = [
    { id: 1, name: "Info" },
    { id: 2, name: "Type" },
    { id: 3, name: "Details" },
    { id: 4, name: "Review" },
  ];

  return (
    <div className="flex justify-between mb-6">
      {steps.map((step) => (
        <div key={step.id} className="flex flex-col items-center flex-1">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium mb-1 transition-colors
              ${
                currentStep === step.id
                  ? "bg-green-600 text-white"
                  : currentStep > step.id
                    ? "bg-green-100 text-green-600 border-2 border-green-600"
                    : "bg-gray-100 text-gray-400"
              }`}
          >
            {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
          </div>
          <span
            className={`text-xs ${
              currentStep === step.id
                ? "text-green-600 font-medium"
                : "text-gray-500"
            }`}
          >
            {step.name}
          </span>
        </div>
      ))}
    </div>
  );
};

// Medicine Chip Component
const MedicineChip = ({ medicine, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-green-700 bg-green-100 border border-green-200 rounded-full">
    {medicine.name} ({medicine.quantity})
    <button
      onClick={onRemove}
      className="ml-1 hover:text-green-900 focus:outline-none"
    >
      <X className="w-3 h-3" />
    </button>
  </span>
);

export default function Pharmacy() {
  const { data } = useOutletContext();
  const currentIpdNumber = data?.personalInfo?.ipd || "";

  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const { showNotification } = useNotification();
  const [successData, setSuccessData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [formStep, setFormStep] = useState(1);
  const [medicineSearchTerm, setMedicineSearchTerm] = useState("");
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(null);

  // Metadata Queries
  const { data: medicinesList = [] } = useQuery({ queryKey: ["pharmacy", "medicines"], queryFn: getMedicines });
  const { data: categories = [] } = useQuery({ queryKey: ["pharmacy", "categories"], queryFn: getCategories });
  const { data: investigationTests = { Pathology: [], "X-ray": [], "CT-scan": [], USG: [] } } = useQuery({ 
    queryKey: ["pharmacy", "investigations"], 
    queryFn: getInvestigations 
  });

  // Main Indents Query
  const { data: rawIndents = [], isLoading: isLoadingIndents } = useQuery({
    queryKey: ["pharmacy", "indents", "patient", currentIpdNumber],
    queryFn: () => getPatientPharmacyIndents(currentIpdNumber),
    enabled: !!currentIpdNumber,
  });

  const submittedIndents = useMemo(() => {
    return rawIndents.map(normalizePatientPharmacyIndent);
  }, [rawIndents]);

  // Real-time synchronization
  useRealtimeQuery("pharmacy", ["pharmacy", "indents", "patient", currentIpdNumber]);

  // User name from local storage
  const getCurrentUser = () => {
    try {
      const storedUser = localStorage.getItem("mis_user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        return user.name || "";
      }
    } catch (error) {
      console.error("Error parsing user from localStorage:", error);
    }
    return "";
  };

  // User role from local storage (used to decide whether to fire WhatsApp notifications)
  const getCurrentUserRole = () => {
    try {
      const storedUser = localStorage.getItem("mis_user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        return (user.role || "").toLowerCase();
      }
    } catch (error) {
      console.error("Error parsing user from localStorage:", error);
    }
    return "";
  };
  const isNurse = getCurrentUserRole() === "nurse";

  const [formData, setFormData] = useState({
    admissionNumber: "",
    staffName: getCurrentUser(),
    consultantName: "",
    patientName: "",
    uhidNumber: "",
    age: "",
    gender: "",
    wardLocation: "",
    category: "",
    room: "",
    diagnosis: "",
  });

  const [requestTypes, setRequestTypes] = useState({
    medicineSlip: false,
    investigation: false,
    package: false,
    nonPackage: false,
  });

  const [medicines, setMedicines] = useState([]);
  const [investigations, setInvestigations] = useState([]);
  const [investigationAdvice, setInvestigationAdvice] = useState({
    priority: "Medium",
    adviceCategory: "",
    pathologyTests: [],
    radiologyType: "",
    radiologyTests: [],
    remarks: "",
  });

  // Validation errors
  const [errors, setErrors] = useState({});

  // Static pathology tests as fallback
  const staticPathologyTests = [
    "LFT",
    "RFT",
    "Lipid Profile",
    "CBC",
    "HBA1C",
    "Electrolyte",
    "PT/INR",
    "Blood Group",
    "ESR",
    "CRP",
    "Sugar",
    "Urine R/M",
    "Viral Marker",
    "Malaria",
    "Dengue",
    "Widal",
    "Troponin-I",
    "Troponin-T",
    "SGOT",
    "SGPT",
    "Serum Urea",
    "Serum Creatinine",
    "CT-BT",
    "ABG",
    "Urine C/S",
    "Thyroid Profile",
    "UPT",
    "HB",
    "PPD",
    "Sickling",
    "Peripheral Smear",
    "ASO Titre",
    "DS-DNA",
    "Serum Amylase",
    "TSH",
    "D-Dimer",
    "Serum Lipase",
    "SR Cortisol",
    "Serum Magnesium",
    "Serum Calcium",
    "Urine Culture & Sensitivity",
    "Blood Culture & Sensitivity",
    "Pus Culture & Sensitivity",
    "Pleural Fluid R/M",
    "Pleural Fluid Culture & Sensitivity",
    "Pleural Fluid ADA",
    "Vitamin D3",
    "Vitamin B12",
    "HIV",
    "HBsAg",
    "HCV",
    "VDRL",
    "Ascitic Fluid R/M",
    "Ascitic Culture & Sensitivity",
    "Ascitic Fluid ADA",
    "Urine Sugar Ketone",
    "Serum Platelets",
    "Serum Potassium",
    "Serum Sodium",
    "Sputum R/M",
    "Sputum AFB",
    "Sputum C/S",
    "CBNAAT",
    "CKMB",
    "Cardiac SOB",
    "Pro-BNP",
    "Serum Uric Acid",
    "Platelet Count",
    "TB Gold",
    "PCT",
    "COVID IGG Antibodies",
    "ANA Profile",
    "Stool R/M",
    "eGFR",
    "24 Hour Urine Protein Ratio",
    "IGF-1",
    "PTH",
    "Serum FSH",
    "Serum LH",
    "Serum Prolactin",
    "APTT",
    "HB %",
    "Biopsy Small",
    "Biopsy Medium",
    "Biopsy Large",
    "Serum Homocysteine",
  ];


  // Add effects to update form data when personal info changes
  useEffect(() => {
    const fetchAdmissionDetails = async () => {
      if (currentIpdNumber) {
        try {
          // ✅ FIX: Fetch admission_no AND pat_category from ipd_admissions table
          const { data: ipdData, error } = await supabase
            .from("ipd_admissions")
            .select("admission_no, pat_category")
            .eq("ipd_number", currentIpdNumber)
            .single();
          console.log("IPD NUMBER:", currentIpdNumber);
          console.log("IPD DATA:", ipdData);

          if (data?.personalInfo) {
            setFormData((prev) => ({
              ...prev,
              patientName: data.personalInfo.name || "",
              uhidNumber: "", // User requested not to auto-fill UHID
              ipdNumber: currentIpdNumber || "",
              age: data.personalInfo.age || "",
              gender: data.personalInfo.gender || "",
              wardLocation:
                data.departmentInfo?.ward_type ||
                data.departmentInfo?.ward ||
                "",
              consultantName: data.personalInfo.consultantDr || "",
              room: data.departmentInfo?.room || "",
              admissionNumber: ipdData?.admission_no || "",
              category: ipdData?.pat_category?.trim() || "", // ✅ ADD THIS - Category from IPD admissions
            }));
          }
        } catch (err) {
          console.error("Error fetching admission details:", err);
        }
      }
    };

    fetchAdmissionDetails();
  }, [data, currentIpdNumber]);

  // Filtering
  const filteredIndents = useMemo(() => {
    return submittedIndents.filter((indent) => {
      const matchesSearch =
        !searchTerm ||
        indent.indentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        indent.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        indent.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "pending" && (indent.status === "pending" || indent.status === "pending approval")) ||
        (filterStatus === "completed" && (indent.status === "completed" || indent.status === "approved & dispensed")) ||
        (filterStatus === "approved" && indent.status.toLowerCase().includes("approved"));

      return matchesSearch && matchesStatus;
    });
  }, [submittedIndents, searchTerm, filterStatus]);

  // Add delay close for medicine dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showMedicineDropdown &&
        !event.target.closest(".medicine-dropdown-container")
      ) {
        setShowMedicineDropdown(null);
        setMedicineSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMedicineDropdown]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleCheckboxChange = (type) => {
    if (type === "medicineSlip") {
      setRequestTypes((prev) => ({
        ...prev,
        medicineSlip: !prev.medicineSlip,
        investigation: false,
      }));
      if (!requestTypes.medicineSlip) {
        setInvestigations([]);
        setInvestigationAdvice({
          priority: "Medium",
          adviceCategory: "",
          pathologyTests: [],
          radiologyType: "",
          radiologyTests: [],
          remarks: "",
        });
      }
    } else if (type === "investigation") {
      setRequestTypes((prev) => ({
        ...prev,
        investigation: !prev.investigation,
        medicineSlip: false,
      }));
      if (!requestTypes.investigation) {
        setMedicines([]);
      }
    } else if (type === "package") {
      setRequestTypes((prev) => ({
        ...prev,
        package: !prev.package,
        nonPackage: false,
      }));
    } else if (type === "nonPackage") {
      setRequestTypes((prev) => ({
        ...prev,
        nonPackage: !prev.nonPackage,
        package: false,
      }));
    }
  };

  const addMedicine = () => {
    const newMedicine = {
      id: Date.now(),
      name: "",
      quantity: "",
    };
    setMedicines([...medicines, newMedicine]);
  };

  const removeMedicine = (id) => {
    setMedicines(medicines.filter((med) => med.id !== id));
  };

  const updateMedicine = (id, field, value) => {
    setMedicines(
      medicines.map((med) =>
        med.id === id ? { ...med, [field]: value } : med,
      ),
    );
  };

  const handleInvestigationAdviceChange = (e) => {
    const { name, value } = e.target;
    setInvestigationAdvice((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "adviceCategory" && {
        pathologyTests: [],
        radiologyType: "",
        radiologyTests: [],
      }),
      ...(name === "radiologyType" && { radiologyTests: [] }),
    }));
  };

  const handleAdviceCheckboxChange = (testName, category) => {
    setInvestigationAdvice((prev) => {
      const currentTests =
        category === "pathology" ? prev.pathologyTests : prev.radiologyTests;
      const newTests = currentTests.includes(testName)
        ? currentTests.filter((t) => t !== testName)
        : [...currentTests, testName];

      return {
        ...prev,
        [category === "pathology" ? "pathologyTests" : "radiologyTests"]:
          newTests,
      };
    });
  };

  const getRadiologyTests = () => {
    switch (investigationAdvice.radiologyType) {
      case "X-ray":
        return investigationTests["X-ray"];
      case "CT-scan":
        return investigationTests["CT-scan"];
      case "USG":
        return investigationTests.USG;
      default:
        return [];
    }
  };

  // Validation for each step
  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.diagnosis?.trim()) {
        newErrors.diagnosis = "Diagnosis is required";
      }
    } else if (step === 2) {
      const hasRequestType = Object.values(requestTypes).some((value) => value);
      if (!hasRequestType) {
        newErrors.requestType = "Please select at least one request type";
      }
    } else if (step === 3) {
      if (requestTypes.medicineSlip) {
        if (medicines.length === 0) {
          newErrors.medicines = "Please add at least one medicine";
        }
        const incompleteMedicines = medicines.some(
          (med) => !med.name || !med.quantity,
        );
        if (incompleteMedicines) {
          newErrors.medicines = "Please fill all medicine details";
        }
      }
      if (requestTypes.investigation) {
        if (!investigationAdvice.adviceCategory) {
          newErrors.adviceCategory = "Please select Pathology or Radiology";
        }
        if (
          investigationAdvice.adviceCategory === "Pathology" &&
          investigationAdvice.pathologyTests.length === 0
        ) {
          newErrors.pathologyTests =
            "Please select at least one pathology test";
        }
        if (investigationAdvice.adviceCategory === "Radiology") {
          if (!investigationAdvice.radiologyType) {
            newErrors.radiologyType = "Please select radiology type";
          }
          if (investigationAdvice.radiologyTests.length === 0) {
            newErrors.radiologyTests =
              "Please select at least one radiology test";
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(formStep)) {
      setFormStep(formStep + 1);
    }
  };

  const handleBack = () => {
    setFormStep(formStep - 1);
  };

  // Mutations
  const submitMutation = useMutation({
    mutationFn: async () => {
      const currentTimestamp = new Date()
        .toLocaleString("en-CA", { timeZone: "Asia/Kolkata", hour12: false })
        .replace(",", "");

      // INDENT_NO is now generated by the backend trigger for new records.
      // For edits, we pass the existing indent number in the payload.

      const pharmacyData = {
        timestamp: currentTimestamp,

        admission_number: formData.admissionNumber || "",
        ipd_number: currentIpdNumber || "",
        staff_name: formData.staffName || "",
        consultant_name: formData.consultantName || "",
        patient_name: formData.patientName,
        uhid_number: formData.uhidNumber || "",
        age: formData.age || "",
        gender: formData.gender || "",
        ward_location: formData.wardLocation || "",
        category: formData.category?.trim() || "",
        room: formData.room || "",
        diagnosis: formData.diagnosis.trim(),
        request_types: JSON.stringify(requestTypes),
        medicines: JSON.stringify(medicines),
        investigations: JSON.stringify(investigations || []),
        investigation_advice: JSON.stringify(investigationAdvice),
        status: "pending",
        planned1: currentTimestamp,
      };

      if (editMode && selectedIndent) {
        return await updatePharmacyIndent({ id: selectedIndent.sourceId, updateData: pharmacyData });
      } else {
        return await createPharmacyIndent(pharmacyData);
      }
    },
    onSuccess: (savedRow) => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy", "indents", "patient", currentIpdNumber] });
      showNotification(editMode ? "Indent updated successfully!" : "Indent created successfully!");

      const currentRole = getCurrentUserRole();
      if (!editMode || currentRole === "nurse") {
        sendIndentApprovalNotification(savedRow, medicines, requestTypes).catch(err => 
          console.error("[WhatsApp] Notification error:", err)
        );
      }

      const totalMedicines = requestTypes.medicineSlip
        ? medicines.reduce((sum, med) => sum + parseInt(med.quantity || 0), 0)
        : 0;

      setSuccessData({
        indentNumber: savedRow.indent_no,
        patientName: savedRow.patient_name,
        admissionNo: savedRow.admission_number,
        totalMedicines,
      });

      setShowModal(false);
      setEditMode(false);
      setSuccessModal(true);
      resetForm();
    },
    onError: (error) => showNotification(`Failed to save indent: ${error.message}`, "error")
  });

  const deleteMutation = useMutation({
    mutationFn: deletePharmacyIndent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy", "indents", "patient", currentIpdNumber] });
      showNotification("Indent deleted successfully");
    },
    onError: (error) => showNotification(`Error deleting indent: ${error.message}`, "error")
  });
  
  const loading = isLoadingIndents || submitMutation.isPending || deleteMutation.isPending;

  const handleSubmit = () => {
    if (validateStep(3)) {
      submitMutation.mutate();
    }
  };


  const handleDelete = (indent) => {
    if (isNurse) return;
    
    if (isApprovedIndent(indent.status)) {
      showNotification("This indent has been approved and cannot be deleted.", "error");
      return;
    }

    if (window.confirm("Are you sure you want to delete this indent?")) {
      deleteMutation.mutate(indent.sourceId);
    }
  };

  const parseJsonField = (field) => {
    try {
      return field ? JSON.parse(field) : {};
    } catch (error) {
      console.error("Error parsing JSON field:", error);
      return {};
    }
  };

  const getSummaryData = () => {
    if (requestTypes.medicineSlip && medicines.length > 0) {
      const medicineMap = {};
      medicines.forEach((med) => {
        if (med.name && med.quantity) {
          if (medicineMap[med.name]) {
            medicineMap[med.name] += parseInt(med.quantity);
          } else {
            medicineMap[med.name] = parseInt(med.quantity);
          }
        }
      });
      return Object.entries(medicineMap).map(([name, quantity], index) => ({
        srNo: index + 1,
        name,
        quantity,
      }));
    }
    return [];
  };

  const summaryData = getSummaryData();
  const totalQuantity = summaryData.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  const resetForm = () => {
    setFormData((prev) => ({
      ...prev,
      diagnosis: "",
    }));
    setRequestTypes({
      medicineSlip: false,
      investigation: false,
      package: false,
      nonPackage: false,
    });
    setMedicines([]);
    setInvestigationAdvice({
      priority: "Medium",
      adviceCategory: "",
      pathologyTests: [],
      radiologyType: "",
      radiologyTests: [],
      remarks: "",
    });
    setSelectedIndent(null);
    setMedicineSearchTerm("");
    setShowMedicineDropdown(null);
    setFormStep(1);
    setErrors({});
  };

  const handleView = (indent) => {
    setSelectedIndent(indent);
    setViewModal(true);
  };

  const handleEdit = (indent) => {
    if (isApprovedIndent(indent.status)) {
      showNotification(
        "This indent has been approved and cannot be edited.",
        "error",
      );
      return;
    }

    if (
      indent.ipdNumber !== currentIpdNumber &&
      indent.admissionNo !== currentIpdNumber
    ) {
      showNotification(
        "You can only edit indents for the current patient",
        "error",
      );
      return;
    }

    setSelectedIndent(indent);
    setFormData((prev) => ({
      ...prev,
      diagnosis: indent.diagnosis || "",
      staffName: indent.staffName || "",
      category: indent.category || "", // ✅ Preserve category from the indent
    }));
    setRequestTypes({ ...indent.requestTypes });
    setMedicines([...indent.medicines]);
    setInvestigationAdvice(
      indent.investigationAdvice || {
        priority: "Medium",
        adviceCategory: "",
        pathologyTests: [],
        radiologyType: "",
        radiologyTests: [],
        remarks: "",
      },
    );
    setEditMode(true);
    setShowModal(true);
  };

  if (!data) return null;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 300px)" }}>
      {/* Header Section */}
      <div className="flex-shrink-0 p-4 text-white bg-green-600 rounded-lg shadow-md">
        <div className="items-center justify-between hidden md:flex">
          <div className="flex items-center gap-3">
            <Pill className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold md:text-2xl">
                Pharmacy Indents
              </h1>
              <p className="mt-1 text-xs opacity-90">
                {currentIpdNumber && currentIpdNumber !== "N/A"
                  ? `${data.personalInfo.name} - IPD: ${currentIpdNumber}`
                  : data.personalInfo.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Create Indent Button - hidden on mobile */}
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="items-center hidden gap-2 px-4 py-2 text-sm font-medium text-green-600 transition-colors bg-white rounded-lg shadow-sm md:flex hover:bg-green-50"
            >
              <Plus className="w-4 h-4" />
              Create Indent
            </button>
            <div className="relative">
              <Search className="absolute w-4 h-4 text-green-300 transform -translate-y-1/2 left-3 top-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 py-2 pr-3 text-sm text-white placeholder-green-300 border border-green-400 rounded-lg pl-9 bg-white/10 focus:ring-2 focus:ring-white focus:border-transparent"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm text-white border border-green-400 rounded-lg bg-white/10 focus:ring-2 focus:ring-white focus:border-transparent"
            >
              <option value="all" className="text-gray-900">
                All Status
              </option>
              <option value="Pending" className="text-gray-900">
                Pending
              </option>
              <option value="Approved" className="text-gray-900">
                Approved
              </option>
              <option value="Completed" className="text-gray-900">
                Completed
              </option>
            </select>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Pill className="w-8 h-8" />
              <div className="flex-1">
                <h1 className="text-xl font-bold">Pharmacy Indents</h1>
                <p className="mt-1 text-xs opacity-90">
                  {currentIpdNumber && currentIpdNumber !== "N/A"
                    ? `${data.personalInfo.name} - IPD: ${currentIpdNumber}`
                    : data.personalInfo.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute w-3 h-3 text-green-300 transform -translate-y-1/2 left-3 top-1/2" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white/10 border border-green-400 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent placeholder-green-300 text-white text-xs"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2 py-1.5 bg-white/10 border border-green-400 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent text-white text-xs min-w-16"
              >
                <option value="all" className="text-gray-900">
                  All
                </option>
                <option value="Pending" className="text-gray-900">
                  Pending
                </option>
                <option value="Approved" className="text-gray-900">
                  Approved
                </option>
                <option value="Completed" className="text-gray-900">
                  Completed
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Card View - with improved status visibility */}
      <div className="flex-1 min-h-0 mt-2 md:hidden">
        <div className="h-full overflow-hidden bg-white border border-gray-200 rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block w-8 h-8 mb-4 border-b-2 border-green-600 rounded-full animate-spin"></div>
                <p className="text-gray-600">Loading pharmacy indents...</p>
              </div>
            </div>
          ) : filteredIndents.length > 0 ? (
            <div className="h-full p-4 overflow-y-auto">
              <div className="space-y-4">
                {filteredIndents.map((indent) => (
                  <div
                    key={indent.indentNumber}
                    className={`p-4 bg-white border rounded-lg shadow-sm transition-all hover:shadow-md ${
                      indent.status === "Pending"
                        ? "border-l-4 border-l-yellow-400"
                        : indent.status === "Approved"
                          ? "border-l-4 border-l-green-400"
                          : "border-l-4 border-l-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-bold text-green-600">
                          {indent.indentNumber}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-gray-900">
                          {indent.patientName}
                        </p>
                        <p className="text-xs text-gray-500">
                          IPD: {indent.admissionNo || indent.ipdNumber}
                        </p>
                        {indent.category && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Category: {indent.category}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={indent.status || "Pending"} />
                    </div>

                    {/* Quick insights */}
                    <div className="flex justify-between mb-2 text-xs text-gray-500">
                      <span>🕒 {indent.plannedTime || "Not scheduled"}</span>
                      {indent.requestTypes?.medicineSlip && (
                        <span>💊 {indent.medicines?.length || 0} meds</span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">
                          Diagnosis:{" "}
                        </span>
                        <span className="text-gray-600 line-clamp-1">
                          {indent.diagnosis}
                        </span>
                      </div>

                      {/* Request Types as chips */}
                      <div className="flex flex-wrap gap-1">
                        {indent.requestTypes.medicineSlip && (
                          <span className="px-2 py-1 text-xs text-green-700 bg-green-100 rounded-full">
                            Medicine
                          </span>
                        )}
                        {indent.requestTypes.investigation && (
                          <span className="px-2 py-1 text-xs text-green-700 bg-green-100 rounded-full">
                            Investigation
                          </span>
                        )}
                        {indent.requestTypes.package && (
                          <span className="px-2 py-1 text-xs text-purple-700 bg-purple-100 rounded-full">
                            Package
                          </span>
                        )}
                        {indent.requestTypes.nonPackage && (
                          <span className="px-2 py-1 text-xs text-orange-700 bg-orange-100 rounded-full">
                            Non-Package
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-3 gap-2 pt-2 mt-2 border-t border-gray-100">
                        <button
                          onClick={() => handleView(indent)}
                          className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700 active:scale-[0.98]"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleEdit(indent)}
                          disabled={isApprovedIndent(indent.status) || loading}
                          className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(indent)}
                          disabled={
                            isNurse ||
                            isApprovedIndent(indent.status) ||
                            loading
                          }
                          className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-white transition-colors bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center">
                <Pill className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">
                  No pharmacy indents found
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {currentIpdNumber && currentIpdNumber !== "N/A"
                    ? `No indents found for IPD: ${currentIpdNumber}`
                    : searchTerm
                      ? "No indents match your search"
                      : "No indents available"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="flex-1 hidden min-h-0 mt-2 md:block">
        <div className="h-full overflow-hidden bg-white border border-gray-200 rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block w-8 h-8 mb-4 border-b-2 border-green-600 rounded-full animate-spin"></div>
                <p className="text-gray-600">Loading pharmacy indents...</p>
                {currentIpdNumber && (
                  <p className="mt-1 text-sm text-gray-500">
                    For IPD: {currentIpdNumber}
                  </p>
                )}
              </div>
            </div>
          ) : filteredIndents.length > 0 ? (
            <div className="h-full overflow-auto" style={{ maxHeight: "100%" }}>
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 z-10 bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">
                      Indent No
                    </th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">
                      Patient
                    </th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">
                      IPD No
                    </th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">
                      Planned Time
                    </th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">
                      Diagnosis
                    </th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">
                      Request Type
                    </th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">
                      Approval
                    </th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-700 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredIndents.map((indent) => (
                    <tr key={indent.indentNumber} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-green-600">
                          {indent.indentNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {indent.patientName}
                        </div>
                        {indent.uhidNumber && (
                          <div className="text-xs text-gray-500">
                            UHID: {indent.uhidNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-700">
                          {indent.admissionNo || indent.ipdNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded-full">
                          {indent.category || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {indent.plannedTime}
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs text-xs text-gray-500 truncate">
                          {indent.diagnosis}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {indent.requestTypes.medicineSlip && (
                            <span className="px-2 py-1 text-xs text-green-700 bg-green-100 rounded">
                              Medicine
                            </span>
                          )}
                          {indent.requestTypes.investigation && (
                            <span className="px-2 py-1 text-xs text-green-700 bg-green-100 rounded">
                              Investigation
                            </span>
                          )}
                          {indent.requestTypes.package && (
                            <span className="px-2 py-1 text-xs text-purple-700 bg-purple-100 rounded">
                              Package
                            </span>
                          )}
                          {indent.requestTypes.nonPackage && (
                            <span className="px-2 py-1 text-xs text-orange-700 bg-orange-100 rounded">
                              Non-Package
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={indent.status || "Pending"} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleView(indent)}
                            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors active:scale-[0.98]"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(indent)}
                            disabled={
                              isApprovedIndent(indent.status) || loading
                            }
                            className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-[0.98]"
                            title="Edit Indent"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(indent)}
                            disabled={
                              isNurse ||
                              isApprovedIndent(indent.status) ||
                              loading
                            }
                            className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-[0.98]"
                            title="Delete Indent"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center">
                <Pill className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">
                  No pharmacy indents found
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {currentIpdNumber && currentIpdNumber !== "N/A"
                    ? `No indents found for IPD: ${currentIpdNumber}`
                    : searchTerm
                      ? "No indents match your search"
                      : "No indents available"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FAB for mobile */}
      <button
        onClick={() => {
          resetForm();
          setShowModal(true);
        }}
        className="fixed z-40 flex items-center justify-center text-white transition-all bg-green-600 rounded-full shadow-lg bottom-6 right-6 w-14 h-14 md:hidden hover:bg-green-700 active:scale-95"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Create/Edit Modal - Converted to Bottom Sheet for mobile */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/30 md:flex md:items-center md:justify-center">
          {/* Mobile Bottom Sheet */}
          <div className="fixed bottom-0 left-0 right-0 w-full max-h-[90vh] bg-white rounded-t-2xl animate-slide-up overflow-y-auto md:relative md:max-w-4xl md:rounded-lg md:animate-none">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 text-white bg-green-600 md:px-6 md:py-4">
              <h2 className="text-lg font-bold md:text-xl">
                {editMode ? "Edit Indent" : "Create New Indent"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                  setEditMode(false);
                }}
                className="p-1 text-white transition-colors rounded-full hover:bg-green-700"
                disabled={loading}
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            {/* Stepper */}
            <div className="px-4 py-4 md:px-6">
              <FormStepper currentStep={formStep} />
            </div>

            <div className="p-4 md:p-6">
              {/* Step 1: Patient Info */}
              {formStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Patient Information
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Patient Name
                      </label>
                      <input
                        type="text"
                        value={formData.patientName}
                        readOnly
                        className="w-full px-3 py-2 text-gray-600 border border-gray-300 rounded-lg cursor-not-allowed bg-gray-50"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block mb-1 text-sm font-medium text-gray-700">
                          Age
                        </label>
                        <input
                          type="text"
                          value={formData.age}
                          readOnly
                          className="w-full px-3 py-2 text-gray-600 border border-gray-300 rounded-lg cursor-not-allowed bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-sm font-medium text-gray-700">
                          Gender
                        </label>
                        <input
                          type="text"
                          value={formData.gender}
                          readOnly
                          className="w-full px-3 py-2 text-gray-600 border border-gray-300 rounded-lg cursor-not-allowed bg-gray-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Category
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Select Category</option>
                        {categories.map((cat) => (
                          <option key={cat.name} value={cat.name}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      {formData.category && (
                        <p className="mt-1 text-xs text-gray-500">
                          Auto-filled from IPD (you can change if needed)
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        UHID Number
                      </label>
                      <input
                        type="text"
                        name="uhidNumber"
                        value={formData.uhidNumber}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        IPD/Admission No
                      </label>
                      <input
                        type="text"
                        value={currentIpdNumber}
                        readOnly
                        className="w-full px-3 py-2 text-gray-600 border border-gray-300 rounded-lg cursor-not-allowed bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Ward / Room
                      </label>
                      <input
                        type="text"
                        value={`${formData.wardLocation} / ${formData.room}`}
                        readOnly
                        className="w-full px-3 py-2 text-gray-600 border border-gray-300 rounded-lg cursor-not-allowed bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Consultant
                      </label>
                      <input
                        type="text"
                        value={formData.consultantName}
                        readOnly
                        className="w-full px-3 py-2 text-gray-600 border border-gray-300 rounded-lg cursor-not-allowed bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Diagnosis <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="diagnosis"
                        value={formData.diagnosis}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                          errors.diagnosis
                            ? "border-red-300 bg-red-50"
                            : "border-gray-300"
                        }`}
                        placeholder="Enter diagnosis"
                      />
                      {errors.diagnosis && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.diagnosis}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Request Type */}
              {formStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Request Type
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "medicineSlip", label: "Medicine Slip" },
                      { id: "investigation", label: "Investigation" },
                      { id: "package", label: "Package" },
                      { id: "nonPackage", label: "Non Package" },
                    ].map((type) => (
                      <label
                        key={type.id}
                        className={`flex items-center p-3 transition-colors border rounded-lg cursor-pointer ${
                          requestTypes[type.id]
                            ? "border-green-500 bg-green-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={requestTypes[type.id]}
                          onChange={() => handleCheckboxChange(type.id)}
                          disabled={loading}
                          className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {type.label}
                        </span>
                      </label>
                    ))}
                  </div>

                  {errors.requestType && (
                    <p className="text-sm text-red-500">{errors.requestType}</p>
                  )}
                </div>
              )}

              {/* Step 3: Details */}
              {formStep === 3 && (
                <div className="space-y-6">
                  {/* Medicines Section */}
                  {requestTypes.medicineSlip && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Medicines
                      </h3>

                      {/* Selected Medicines as Chips */}
                      {medicines.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-3 border border-green-200 rounded-lg bg-green-50">
                          {medicines.map(
                            (medicine) =>
                              medicine.name && (
                                <MedicineChip
                                  key={medicine.id}
                                  medicine={medicine}
                                  onRemove={() => removeMedicine(medicine.id)}
                                />
                              ),
                          )}
                        </div>
                      )}

                      {/* Add Medicine Button */}
                      <button
                        onClick={addMedicine}
                        disabled={loading}
                        className="flex items-center justify-center w-full gap-2 px-4 py-3 text-sm text-green-700 transition-colors border border-green-300 border-dashed rounded-lg hover:bg-green-50 active:scale-[0.98]"
                      >
                        <Plus className="w-4 h-4" />
                        Add Medicine
                      </button>

                      {errors.medicines && (
                        <p className="text-sm text-red-500">
                          {errors.medicines}
                        </p>
                      )}

                      {/* Medicine Input Fields (only when adding) */}
                      {medicines.map((medicine, index) => (
                        <div
                          key={medicine.id}
                          className="p-3 space-y-3 border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500">
                              Medicine #{index + 1}
                            </span>
                            <button
                              onClick={() => removeMedicine(medicine.id)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="medicine-dropdown-container">
                            <label className="block mb-1 text-xs text-gray-500">
                              Medicine Name
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={medicine.name}
                                onChange={(e) =>
                                  updateMedicine(
                                    medicine.id,
                                    "name",
                                    e.target.value,
                                  )
                                }
                                onFocus={() =>
                                  setShowMedicineDropdown(medicine.id)
                                }
                                placeholder="Search medicine..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                              {showMedicineDropdown === medicine.id && (
                                <div className="absolute z-50 w-full mt-1 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-xl max-h-60">
                                  <div className="sticky top-0 p-2 border-b bg-gray-50">
                                    <div className="relative">
                                      <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                                      <input
                                        type="text"
                                        placeholder="Filter medicines..."
                                        className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                        onChange={(e) =>
                                          setMedicineSearchTerm(e.target.value)
                                        }
                                        value={medicineSearchTerm}
                                        autoFocus
                                      />
                                    </div>
                                  </div>
                                  <div className="overflow-y-auto max-h-48">
                                    {medicinesList
                                      .filter(
                                        (med) =>
                                          medicineSearchTerm === "" ||
                                          med
                                            .toLowerCase()
                                            .includes(
                                              medicineSearchTerm.toLowerCase(),
                                            ),
                                      )
                                      .map((med, idx) => (
                                        <div
                                          key={`${med}-${idx}`}
                                          onClick={() => {
                                            updateMedicine(
                                              medicine.id,
                                              "name",
                                              med,
                                            );
                                            setShowMedicineDropdown(null);
                                            setMedicineSearchTerm("");
                                          }}
                                          className="px-4 py-2 text-sm transition-colors border-b border-gray-100 cursor-pointer hover:bg-green-50 last:border-b-0"
                                        >
                                          {med}
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="block mb-1 text-xs text-gray-500">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="1"
                              onWheel={(e) => e.target.blur()}
                              value={medicine.quantity}
                              onChange={(e) =>
                                updateMedicine(
                                  medicine.id,
                                  "quantity",
                                  e.target.value,
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              placeholder="Enter quantity"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Investigation Section */}
                  {requestTypes.investigation && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Investigation Advice
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block mb-1 text-sm font-medium text-gray-700">
                            Priority *
                          </label>
                          <select
                            name="priority"
                            value={investigationAdvice.priority}
                            onChange={handleInvestigationAdviceChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>

                        <div>
                          <label className="block mb-1 text-sm font-medium text-gray-700">
                            Category *
                          </label>
                          <select
                            name="adviceCategory"
                            value={investigationAdvice.adviceCategory}
                            onChange={handleInvestigationAdviceChange}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                              errors.adviceCategory
                                ? "border-red-300 bg-red-50"
                                : "border-gray-300"
                            }`}
                          >
                            <option value="">Select Category</option>
                            <option value="Pathology">Pathology</option>
                            <option value="Radiology">Radiology</option>
                          </select>
                          {errors.adviceCategory && (
                            <p className="mt-1 text-xs text-red-500">
                              {errors.adviceCategory}
                            </p>
                          )}
                        </div>

                        {investigationAdvice.adviceCategory === "Pathology" && (
                          <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700">
                              Select Pathology Tests * (
                              {investigationAdvice.pathologyTests.length}{" "}
                              selected)
                            </label>
                            <div
                              className={`p-3 border rounded-lg max-h-48 overflow-y-auto ${
                                errors.pathologyTests
                                  ? "border-red-300 bg-red-50"
                                  : "border-gray-300"
                              }`}
                            >
                              <div className="space-y-2">
                                {(investigationTests.Pathology || []).map(
                                  (test) => (
                                    <label
                                      key={test}
                                      className="flex items-start gap-2"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={investigationAdvice.pathologyTests.includes(
                                          test,
                                        )}
                                        onChange={() =>
                                          handleAdviceCheckboxChange(
                                            test,
                                            "pathology",
                                          )
                                        }
                                        className="mt-1 text-green-600 rounded"
                                      />
                                      <span className="text-sm">{test}</span>
                                    </label>
                                  ),
                                )}
                              </div>
                            </div>
                            {errors.pathologyTests && (
                              <p className="mt-1 text-xs text-red-500">
                                {errors.pathologyTests}
                              </p>
                            )}
                          </div>
                        )}

                        {investigationAdvice.adviceCategory === "Radiology" && (
                          <>
                            <div>
                              <label className="block mb-1 text-sm font-medium text-gray-700">
                                Radiology Type *
                              </label>
                              <select
                                name="radiologyType"
                                value={investigationAdvice.radiologyType}
                                onChange={handleInvestigationAdviceChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                                  errors.radiologyType
                                    ? "border-red-300 bg-red-50"
                                    : "border-gray-300"
                                }`}
                              >
                                <option value="">Select Type</option>
                                <option value="X-ray">X-ray</option>
                                <option value="CT-scan">CT Scan</option>
                                <option value="USG">USG</option>
                              </select>
                              {errors.radiologyType && (
                                <p className="mt-1 text-xs text-red-500">
                                  {errors.radiologyType}
                                </p>
                              )}
                            </div>

                            {investigationAdvice.radiologyType && (
                              <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700">
                                  Select Tests * (
                                  {investigationAdvice.radiologyTests.length}{" "}
                                  selected)
                                </label>
                                <div
                                  className={`p-3 border rounded-lg max-h-48 overflow-y-auto ${
                                    errors.radiologyTests
                                      ? "border-red-300 bg-red-50"
                                      : "border-gray-300"
                                  }`}
                                >
                                  <div className="space-y-2">
                                    {getRadiologyTests().map((test) => (
                                      <label
                                        key={test}
                                        className="flex items-start gap-2"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={investigationAdvice.radiologyTests.includes(
                                            test,
                                          )}
                                          onChange={() =>
                                            handleAdviceCheckboxChange(
                                              test,
                                              "radiology",
                                            )
                                          }
                                          className="mt-1 text-green-600 rounded"
                                        />
                                        <span className="text-sm">{test}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                {errors.radiologyTests && (
                                  <p className="mt-1 text-xs text-red-500">
                                    {errors.radiologyTests}
                                  </p>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        <div>
                          <label className="block mb-1 text-sm font-medium text-gray-700">
                            Remarks
                          </label>
                          <textarea
                            name="remarks"
                            value={investigationAdvice.remarks}
                            onChange={handleInvestigationAdviceChange}
                            rows="3"
                            placeholder="Add any additional notes..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Review */}
              {formStep === 4 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Review & Submit
                  </h3>

                  {/* Patient Info Summary */}
                  <div className="p-4 space-y-2 border border-green-200 rounded-lg bg-green-50">
                    <h4 className="font-medium text-green-800">
                      Patient Information
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-medium">
                        {formData.patientName}
                      </span>
                      <span className="text-gray-600">Category:</span>
                      <span className="font-medium">{formData.category}</span>
                      <span className="text-gray-600">Diagnosis:</span>
                      <span className="font-medium">{formData.diagnosis}</span>
                      <span className="text-gray-600">IPD:</span>
                      <span className="font-medium">{currentIpdNumber}</span>
                    </div>
                  </div>

                  {/* Request Types Summary */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="mb-2 font-medium">Request Types</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(requestTypes)
                        .filter(([_, value]) => value)
                        .map(([key]) => (
                          <span
                            key={key}
                            className="px-3 py-1 text-xs bg-gray-100 rounded-full"
                          >
                            {key === "medicineSlip" ? "Medicine" : key}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Medicines Summary */}
                  {requestTypes.medicineSlip && summaryData.length > 0 && (
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="mb-2 font-medium">Medicines</h4>
                      <div className="space-y-2">
                        {summaryData.map((item) => (
                          <div
                            key={item.srNo}
                            className="flex justify-between text-sm"
                          >
                            <span>{item.name}</span>
                            <span className="font-medium">
                              Qty: {item.quantity}
                            </span>
                          </div>
                        ))}
                        <div className="pt-2 mt-2 font-medium border-t">
                          Total Items: {summaryData.length} | Total Qty:{" "}
                          {totalQuantity}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Investigation Summary */}
                  {requestTypes.investigation &&
                    investigationAdvice.adviceCategory && (
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <h4 className="mb-2 font-medium">Investigation</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Priority:</span>
                            <span className="font-medium">
                              {investigationAdvice.priority}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Category:</span>
                            <span className="font-medium">
                              {investigationAdvice.adviceCategory}
                            </span>
                          </div>
                          {investigationAdvice.adviceCategory ===
                            "Pathology" && (
                            <div>
                              <span>Tests:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {investigationAdvice.pathologyTests.map(
                                  (test) => (
                                    <span
                                      key={test}
                                      className="px-2 py-1 text-xs bg-gray-100 rounded"
                                    >
                                      {test}
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                          {investigationAdvice.adviceCategory ===
                            "Radiology" && (
                            <>
                              <div className="flex justify-between">
                                <span>Type:</span>
                                <span className="font-medium">
                                  {investigationAdvice.radiologyType}
                                </span>
                              </div>
                              <div>
                                <span>Tests:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {investigationAdvice.radiologyTests.map(
                                    (test) => (
                                      <span
                                        key={test}
                                        className="px-2 py-1 text-xs bg-gray-100 rounded"
                                      >
                                        {test}
                                      </span>
                                    ),
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* Sticky Bottom Action Bar */}
              <div className="sticky bottom-0 left-0 right-0 p-3 mt-6 bg-white border-t">
                <div className="flex gap-2">
                  {formStep > 1 && (
                    <button
                      onClick={handleBack}
                      disabled={loading}
                      className="flex-1 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 active:scale-[0.98] transition-all"
                    >
                      Back
                    </button>
                  )}
                  {formStep < 4 ? (
                    <button
                      onClick={handleNext}
                      disabled={loading}
                      className="flex-1 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 active:scale-[0.98] transition-all"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="flex-1 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 active:scale-[0.98] transition-all disabled:bg-green-300"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-b-2 border-white rounded-full animate-spin"></div>
                          Submitting...
                        </div>
                      ) : editMode ? (
                        "Update Indent"
                      ) : (
                        "Submit Indent"
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successModal && successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
            <div className="flex items-center gap-3 px-6 py-4 text-white bg-green-600 rounded-t-lg">
              <CheckCircle className="w-6 h-6" />
              <h2 className="text-xl font-bold">Success!</h2>
            </div>
            <div className="p-6">
              <p className="mb-6 text-gray-700">
                Your indent has been {editMode ? "updated" : "submitted"}{" "}
                successfully!
              </p>
              <div className="p-4 space-y-3 rounded-lg bg-gray-50">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Indent Number:</span>
                  <span className="text-sm font-bold text-green-600">
                    {successData.indentNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Patient Name:</span>
                  <span className="text-sm font-medium text-gray-800">
                    {successData.patientName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">IPD Number:</span>
                  <span className="text-sm font-medium text-gray-800">
                    {successData.admissionNo}
                  </span>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setSuccessModal(false);
                  }}
                  className="flex-1 px-4 py-2 font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewModal && selectedIndent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 text-white bg-green-600">
              <h2 className="text-xl font-bold">
                Indent Details - {selectedIndent.indentNumber}
              </h2>
              <button
                onClick={() => {
                  setViewModal(false);
                  setSelectedIndent(null);
                }}
                className="p-1 text-white transition-colors rounded-full hover:bg-green-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Patient Information */}
              <div className="mb-6">
                <h3 className="pb-2 mb-4 text-lg font-semibold text-gray-800 border-b">
                  Patient Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                  <div>
                    <p className="text-gray-500">Indent Number</p>
                    <p className="font-medium text-gray-900">
                      {selectedIndent.indentNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Admission/IPD No</p>
                    <p className="font-medium text-gray-900">
                      {selectedIndent.admissionNo}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Patient Name</p>
                    <p className="font-medium text-gray-900">
                      {selectedIndent.patientName}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Category</p>
                    <p className="font-medium text-gray-900">
                      {selectedIndent.category || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">UHID Number</p>
                    <p className="font-medium text-gray-900">
                      {selectedIndent.uhidNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Age / Gender</p>
                    <p className="font-medium text-gray-900">
                      {selectedIndent.age} / {selectedIndent.gender}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Ward / Room</p>
                    <p className="font-medium text-gray-900">
                      {selectedIndent.wardLocation} / {selectedIndent.room}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Staff Name</p>
                    <p className="font-medium text-gray-900">
                      {selectedIndent.staffName}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Consultant</p>
                    <p className="font-medium text-gray-900">
                      {selectedIndent.consultantName}
                    </p>
                  </div>
                  <div className="col-span-full">
                    <p className="text-gray-500">Diagnosis</p>
                    <p className="font-medium text-gray-900">
                      {selectedIndent.diagnosis}
                    </p>
                  </div>
                </div>
              </div>

              {/* Request Types */}
              <div className="mb-6">
                <h3 className="pb-2 mb-4 text-lg font-semibold text-gray-800 border-b">
                  Request Types
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedIndent.requestTypes?.medicineSlip && (
                    <span className="px-3 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg">
                      Medicine Slip
                    </span>
                  )}
                  {selectedIndent.requestTypes?.investigation && (
                    <span className="px-3 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg">
                      Investigation
                    </span>
                  )}
                  {selectedIndent.requestTypes?.package && (
                    <span className="px-3 py-2 text-sm font-medium text-purple-700 bg-purple-100 rounded-lg">
                      Package
                    </span>
                  )}
                  {selectedIndent.requestTypes?.nonPackage && (
                    <span className="px-3 py-2 text-sm font-medium text-orange-700 bg-orange-100 rounded-lg">
                      Non-Package
                    </span>
                  )}
                </div>
              </div>

              {/* Medicines */}
              {selectedIndent.requestTypes?.medicineSlip &&
                selectedIndent.medicines?.length > 0 && (
                  <div className="mb-6">
                    <h3 className="pb-2 mb-4 text-lg font-semibold text-gray-800 border-b">
                      Medicines
                    </h3>
                    <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-green-600">
                          <tr>
                            <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-white uppercase">
                              #
                            </th>
                            <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-white uppercase">
                              Medicine Name
                            </th>
                            <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-white uppercase">
                              Quantity
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {selectedIndent.medicines.map((medicine, index) => (
                            <tr key={index}>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {index + 1}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {medicine.name}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {medicine.quantity}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* Investigation Advice Details */}
              {selectedIndent.requestTypes?.investigation &&
                selectedIndent.investigationAdvice && (
                  <div className="mb-6">
                    <h3 className="pb-2 mb-4 text-lg font-semibold text-gray-800 border-b">
                      Investigation Advice
                    </h3>
                    <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                      <div className="space-y-4 text-sm">
                        <div className="flex items-center justify-between pb-2 border-b border-green-200">
                          <span className="text-gray-600">Priority:</span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              selectedIndent.investigationAdvice.priority ===
                              "High"
                                ? "bg-red-100 text-red-700"
                                : selectedIndent.investigationAdvice
                                      .priority === "Medium"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {selectedIndent.investigationAdvice.priority}
                          </span>
                        </div>

                        <div>
                          <span className="block mb-1 text-gray-600">
                            Category:
                          </span>
                          <div className="font-medium text-gray-900">
                            {selectedIndent.investigationAdvice.adviceCategory}
                          </div>
                        </div>

                        {selectedIndent.investigationAdvice.adviceCategory ===
                          "Pathology" &&
                          selectedIndent.investigationAdvice.pathologyTests
                            ?.length > 0 && (
                            <div>
                              <span className="block mb-1 text-gray-600">
                                Pathology Tests:
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {selectedIndent.investigationAdvice.pathologyTests.map(
                                  (test, index) => (
                                    <span
                                      key={index}
                                      className="px-2 py-1 text-xs text-green-700 bg-white border border-green-200 rounded-full shadow-sm"
                                    >
                                      {test}
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                        {selectedIndent.investigationAdvice.adviceCategory ===
                          "Radiology" && (
                          <>
                            <div>
                              <span className="block mb-1 text-gray-600">
                                Radiology Type:
                              </span>
                              <div className="font-medium text-gray-900">
                                {
                                  selectedIndent.investigationAdvice
                                    .radiologyType
                                }
                              </div>
                            </div>
                            {selectedIndent.investigationAdvice.radiologyTests
                              ?.length > 0 && (
                              <div>
                                <span className="block mb-1 text-gray-600">
                                  Tests:
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {selectedIndent.investigationAdvice.radiologyTests.map(
                                    (test, index) => (
                                      <span
                                        key={index}
                                        className="px-2 py-1 text-xs text-purple-700 bg-white border border-purple-200 rounded-full shadow-sm"
                                      >
                                        {test}
                                      </span>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {selectedIndent.investigationAdvice.remarks && (
                          <div className="pt-2 mt-2 border-t border-green-200">
                            <span className="block mb-1 text-gray-600">
                              Remarks:
                            </span>
                            <div className="p-2 italic text-gray-700 bg-white border border-green-100 rounded">
                              {selectedIndent.investigationAdvice.remarks}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              <div className="flex items-center justify-between pt-6 mt-6 border-t">
                <div className="text-sm text-gray-500">
                  Submitted:{" "}
                  {new Date(
                    selectedIndent.submittedAt || Date.now(),
                  ).toLocaleString()}
                </div>
                <button
                  onClick={() => {
                    setViewModal(false);
                    setSelectedIndent(null);
                  }}
                  className="px-6 py-2 font-medium text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
