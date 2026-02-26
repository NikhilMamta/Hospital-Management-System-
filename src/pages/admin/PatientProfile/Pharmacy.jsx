import React, { useState, useEffect, useRef } from "react";
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
import supabase from "../../../SupabaseClient";
import { useNotification } from "../../../contexts/NotificationContext";
// import { sendIndentApprovalNotification } from "../../../utils/whatsappService"; // moved to PharmacyIndent.jsx

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

export default function Pharmacy() {
  const { data } = useOutletContext();
  const currentIpdNumber = data?.personalInfo?.ipd || "";

  const [showModal, setShowModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [submittedIndents, setSubmittedIndents] = useState([]); // This stores the list for the table
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();
  const [successData, setSuccessData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // New state from PharmacyIndent.jsx
  const [medicineSearchTerm, setMedicineSearchTerm] = useState("");
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(null);
  const [medicinesList, setMedicinesList] = useState([]);

  // Investigation tests state
  const [investigationTests, setInvestigationTests] = useState({
    Pathology: [],
    "X-ray": [],
    "CT-scan": [],
    USG: [],
  });

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
  const [investigations, setInvestigations] = useState([]); // Added for compatibility if needed
  const [investigationAdvice, setInvestigationAdvice] = useState({
    priority: "Medium",
    adviceCategory: "",
    pathologyTests: [],
    radiologyType: "",
    radiologyTests: [],
    remarks: "",
  });

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

  // Load data from Supabase
  useEffect(() => {
    if (currentIpdNumber) {
      loadData();
      loadMedicinesList();
      loadInvestigationTests();
    }
  }, [currentIpdNumber]);

  // Add effects to update form data when personal info changes
  useEffect(() => {
    const fetchAdmissionDetails = async () => {
      if (currentIpdNumber) {
        try {
          // Fetch admission_no from ipd_admissions table
          const { data: ipdData, error } = await supabase
            .from("ipd_admissions")
            .select("admission_no")
            .eq("ipd_number", currentIpdNumber)
            .single();

          if (data?.personalInfo) {
            setFormData((prev) => ({
              ...prev,
              patientName: data.personalInfo.name || "",
              uhidNumber: "", // User requested not to auto-fill UHID
              ipdNumber: currentIpdNumber || "",
              age: data.personalInfo.age || "",
              gender: data.personalInfo.gender || "",
              wardLocation: data.departmentInfo?.ward || "",
              // New fields population
              consultantName: data.personalInfo.consultantDr || "",
              room: data.departmentInfo?.room || "",
              admissionNumber: ipdData?.admission_no || "",
            }));
          }
        } catch (err) {
          console.error("Error fetching admission details:", err);
        }
      }
    };

    fetchAdmissionDetails();
  }, [data, currentIpdNumber]);

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

  const loadData = async () => {
    try {
      setLoading(true);
      await fetchIndents();
    } catch (error) {
      console.error("Error loading data:", error);
      showNotification("Error loading data", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchIndents = async () => {
    try {
      const { data: indents, error } = await supabase
        .from("pharmacy")
        .select("*")
        .or(
          `ipd_number.eq.${currentIpdNumber},admission_number.eq.${currentIpdNumber}`,
        )
        .order("timestamp", { ascending: false });

      if (error) throw error;

      const formattedIndents = (indents || []).map((indent) => ({
        indentNumber: indent.indent_no,
        patientName: indent.patient_name,
        admissionNo: indent.admission_number || indent.ipd_number || "",
        uhidNumber: indent.uhid_number,
        diagnosis: indent.diagnosis,
        requestTypes: indent.request_types
          ? JSON.parse(indent.request_types)
          : {},
        medicines: indent.medicines ? JSON.parse(indent.medicines) : [],
        investigationAdvice: indent.investigation_advice
          ? JSON.parse(indent.investigation_advice)
          : {},
        submittedAt: indent.timestamp,
        updatedAt: indent.updated_at,
        status: indent.status,
        staffName: indent.staff_name,
        consultantName: indent.consultant_name,
        age: indent.age,
        gender: indent.gender,
        wardLocation: indent.ward_location,
        category: indent.category,
        room: indent.room,
        ipdNumber: indent.ipd_number,
        slip_image: indent.slip_image,
        actual2: indent.actual2,
        plannedTime: indent.planned1
          ? new Date(indent.planned1).toLocaleString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
      }));

      setSubmittedIndents(formattedIndents);
    } catch (error) {
      console.error("Error fetching indents:", error);
      setSubmittedIndents([]);
    }
  };

  const loadMedicinesList = async () => {
    try {
      const { data, error } = await supabase
        .from("medicine")
        .select("medicine_name");

      if (error) {
        console.error("Error loading medicines:", error);
        setMedicinesList([
          "Paracetamol 500mg",
          "Amoxicillin 250mg",
          "Ibuprofen 400mg",
          "Cough Syrup",
          "Vitamin D3",
          "Omeprazole 20mg",
          "Aspirin 75mg",
          "Metformin 500mg",
          "Cetirizine 10mg",
          "Azithromycin 500mg",
        ]);
        return;
      }

      if (data && data.length > 0) {
        const medNames = data
          .map((item) => item.medicine_name)
          .filter((name) => name);
        setMedicinesList(medNames);
      } else {
        setMedicinesList([
          "Paracetamol 500mg",
          "Amoxicillin 250mg",
          "Ibuprofen 400mg",
          "Cough Syrup",
          "Vitamin D3",
          "Omeprazole 20mg",
          "Aspirin 75mg",
          "Metformin 500mg",
          "Cetirizine 10mg",
          "Azithromycin 500mg",
        ]);
      }
    } catch (error) {
      console.error("Error loading medicines list:", error);
    }
  };

  const loadInvestigationTests = async () => {
    try {
      // Load Pathology
      const { data: pathologyData, error: pathologyError } = await supabase
        .from("investigation")
        .select("name, type")
        .eq("type", "Pathology")
        .order("name");

      if (!pathologyError && pathologyData?.length > 0) {
        const tests = pathologyData
          .map((test) => test.name)
          .filter((name) => name);
        setInvestigationTests((prev) => ({ ...prev, Pathology: tests }));
      } else {
        setInvestigationTests((prev) => ({
          ...prev,
          Pathology: staticPathologyTests,
        }));
      }

      // Load X-ray
      const { data: xrayData, error: xrayError } = await supabase
        .from("investigation")
        .select("name, type")
        .eq("type", "X-ray")
        .order("name");

      if (!xrayError && xrayData?.length > 0) {
        const tests = xrayData.map((test) => test.name).filter((name) => name);
        setInvestigationTests((prev) => ({ ...prev, "X-ray": tests }));
      } else {
        const fallbackXray = [
          "X-Ray",
          "Barium Enema",
          "Barium Swallow",
          "Cologram",
          "Nephrostrogram",
          "R.G.P.",
          "Retrograde Urethrogram",
          "Urethogram",
          "X Ray Abdomen Upright",
          "X Ray Cystogram",
          "X Ray Hand Both",
          "X Ray LS Spine Extension Flexion",
          "X Ray Thoracic Spine",
          "X Ray Tibia Fibula AP/Lat (Left/Right)",
          "X-Ray Abdomen Erect/Standing/Upright",
          "X-Ray Abdomen Flat Plate",
          "X-Ray Abdomen KUB",
          "X-Ray Ankle Joint AP And Lat (Left/Right)",
          "X-Ray Chest PA",
          "X-Ray Chest AP",
          "X-Ray Chest Lateral View",
          "X-Ray KUB",
          "X-Ray LS Spine AP/Lat",
          "X-Ray Pelvis AP",
          "X-Ray Skull AP/Lat",
        ];
        setInvestigationTests((prev) => ({ ...prev, "X-ray": fallbackXray }));
      }

      // Load CT-scan (Simplified for brevity, similar specific logic)
      const { data: ctScanData } = await supabase
        .from("investigation")
        .select("name")
        .eq("type", "CT Scan");
      if (ctScanData?.length > 0) {
        setInvestigationTests((prev) => ({
          ...prev,
          "CT-scan": ctScanData.map((t) => t.name),
        }));
      } else {
        const fallbackCT = [
          "CT Scan",
          "CT Brain",
          "CT Chest",
          "CECT Abdomen",
          "HRCT",
        ];
        setInvestigationTests((prev) => ({ ...prev, "CT-scan": fallbackCT }));
      }

      // Load USG
      const { data: usgData } = await supabase
        .from("investigation")
        .select("name")
        .eq("type", "USG");
      if (usgData?.length > 0) {
        setInvestigationTests((prev) => ({
          ...prev,
          USG: usgData.map((t) => t.name),
        }));
      } else {
        const fallbackUSG = [
          "USG",
          "USG Whole Abdomen",
          "USG KUB",
          "TVS",
          "USG Upper Abdomen",
        ];
        setInvestigationTests((prev) => ({ ...prev, USG: fallbackUSG }));
      }
    } catch (error) {
      console.error("Error loading investigation tests:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (type) => {
    // Logic from PharmacyIndent.jsx with explicit exclusivity
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

  const generateIndentNumber = () => {
    const timestamp = Date.now().toString().slice(-9);
    return `IND-${timestamp}`;
  };

  const handleSubmit = async () => {
    // Validation logic from PharmacyIndent.jsx
    if (!formData.diagnosis.trim()) {
      showNotification("Please enter Diagnosis", "error");
      return;
    }

    const hasRequestType = Object.values(requestTypes).some((value) => value);
    if (!hasRequestType) {
      showNotification("Please select at least one Request Type", "error");
      return;
    }

    if (requestTypes.medicineSlip && medicines.length === 0) {
      showNotification("Please add at least one medicine", "error");
      return;
    }

    const incompleteMedicines = medicines.some(
      (med) => !med.name || !med.quantity,
    );
    if (requestTypes.medicineSlip && incompleteMedicines) {
      showNotification("Please fill all medicine details", "error");
      return;
    }

    if (requestTypes.investigation) {
      if (!investigationAdvice.adviceCategory) {
        showNotification(
          "Please select Pathology or Radiology for investigation",
          "error",
        );
        return;
      }
      if (
        investigationAdvice.adviceCategory === "Pathology" &&
        investigationAdvice.pathologyTests.length === 0
      ) {
        showNotification("Please select at least one pathology test", "error");
        return;
      }
      if (investigationAdvice.adviceCategory === "Radiology") {
        if (!investigationAdvice.radiologyType) {
          showNotification("Please select radiology type", "error");
          return;
        }
        if (investigationAdvice.radiologyTests.length === 0) {
          showNotification(
            "Please select at least one radiology test",
            "error",
          );
          return;
        }
      }
    }

    try {
      setLoading(true);

      const pharmacyData = {
        timestamp: new Date()
          .toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false,
          })
          .replace(",", ""),
        // indent_number provided by insert trigger or generated here

        admission_number: formData.admissionNumber || "",
        ipd_number: currentIpdNumber || "",
        staff_name: formData.staffName || "",
        consultant_name: formData.consultantName || "",
        patient_name: formData.patientName,
        uhid_number: formData.uhidNumber || "",
        age: formData.age || "",
        gender: formData.gender || "",
        ward_location: formData.wardLocation || "",
        category: formData.category || "",
        room: formData.room || "",
        diagnosis: formData.diagnosis.trim(),
        request_types: JSON.stringify(requestTypes),
        medicines: JSON.stringify(medicines),
        investigations: JSON.stringify(investigations || []),
        investigation_advice: JSON.stringify(investigationAdvice),
        status: "pending", // PharmacyIndent uses lowercase 'pending'
        planned1: new Date()
          .toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false,
          })
          .replace(",", ""),
      };
      let savedRow;

      if (editMode && selectedIndent) {
        const { data, error } = await supabase
          .from("pharmacy")
          .update(pharmacyData)
          .eq("indent_no", selectedIndent.indentNumber)
          .select()
          .single();

        if (error) throw error;
        savedRow = data;

        showNotification("Indent updated successfully!");
      } else {
        const { data, error } = await supabase
          .from("pharmacy")
          .insert([pharmacyData])
          .select()
          .single();

        if (error) throw error;
        savedRow = data;
        showNotification("Indent created successfully!");

        // notification is now handled in PharmacyIndent.jsx
      }

      await fetchIndents();

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
    } catch (error) {
      console.error("Error saving indent:", error);
      showNotification(`Failed to save indent: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (indentNumber) => {
    if (window.confirm("Are you sure you want to delete this indent?")) {
      try {
        const { error } = await supabase
          .from("pharmacy")
          .delete()
          .eq("indent_no", indentNumber);

        if (error) throw error;

        await fetchIndents();
        showPopup("Indent deleted successfully");
      } catch (error) {
        console.error("Error deleting indent:", error);
        showPopup("Error deleting indent", "error");
      }
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
      // Do not reset patient info
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
  };
  const handleView = (indent) => {
    setSelectedIndent(indent);
    setViewModal(true);
  };

  const handleEdit = (indent) => {
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

  const getFilteredIndents = () => {
    return submittedIndents.filter((indent) => {
      const matchesSearch =
        indent.indentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        indent.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        indent.admissionNo?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === "all" || indent.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  };

  if (!data) return null;

  const filteredIndents = getFilteredIndents();

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 300px)" }}>
      {/* Header Section - FIXED DASHBOARD VIEW */}
      <div className="flex-shrink-0 p-4 text-white bg-green-600 rounded-lg shadow-md">
        {/* Desktop View - Everything inline in one row */}
        <div className="items-center justify-between hidden md:flex">
          {/* Left side: Title and icon */}
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

          {/* Right side: Search and Filter - ALL INLINE */}
          <div className="flex items-center gap-3">
            {/* Create Indent Button */}
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 transition-colors bg-white rounded-lg shadow-sm hover:bg-green-50"
            >
              <Plus className="w-4 h-4" />
              Create Indent
            </button>
            {/* Search Input */}
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

            {/* Status Filter */}
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

        {/* Mobile View - Stacked layout */}
        <div className="md:hidden">
          <div className="flex flex-col gap-3">
            {/* Title Row */}
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

            {/* Search and Filter in same row */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                className="p-1.5 bg-white text-green-600 rounded-lg shadow-sm flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
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

      {/* Mobile Card View - UNCHANGED */}
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
                    className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-3">
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
                      </div>
                      <StatusBadge status={indent.status || "Pending"} />
                    </div>

                    <div className="space-y-3">
                      {/* Diagnosis */}
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">
                          Diagnosis:{" "}
                        </span>
                        <span className="text-gray-600 truncate">
                          {indent.diagnosis}
                        </span>
                      </div>

                      {/* Request Types */}
                      <div className="text-sm">
                        <span className="font-medium text-gray-700">
                          Request Types:{" "}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
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
                      </div>

                      {/* Medicines Count */}
                      {indent.requestTypes.medicineSlip &&
                        indent.medicines.length > 0 && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-700">
                              Medicines:{" "}
                            </span>
                            <span className="text-gray-600">
                              {indent.medicines.length} items
                            </span>
                          </div>
                        )}

                      {/* UHID */}
                      {indent.uhidNumber && (
                        <div className="text-sm">
                          <span className="font-medium text-gray-700">
                            UHID:{" "}
                          </span>
                          <span className="text-gray-600">
                            {indent.uhidNumber}
                          </span>
                        </div>
                      )}

                      {/* Actions - Fixed to stay inside card */}
                      <div className="pt-3 border-t border-gray-100">
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleView(indent)}
                            className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => handleEdit(indent)}
                            className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(indent.indentNumber)}
                            className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-white transition-colors bg-red-600 rounded-md hover:bg-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
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
                      Indent Status
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
                        {indent.actual2 ? (
                          <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                            Complete
                          </span>
                        ) : indent.status?.toLowerCase() === "rejected" ? (
                          <span className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                            Rejected
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleView(indent)}
                            className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(indent)}
                            className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                            title="Edit Indent"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(indent.indentNumber)}
                            className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 text-white bg-green-600">
              <h2 className="text-xl font-bold">
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
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Patient Information */}
              <div className="mb-6">
                <h3 className="pb-2 mb-4 text-lg font-semibold text-gray-800 border-b">
                  Patient Information
                </h3>

                <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-3">
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
                </div>

                <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-3">
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

                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Ward Location
                    </label>
                    <input
                      type="text"
                      name="wardLocation"
                      value={formData.wardLocation}
                      readOnly
                      className="w-full px-3 py-2 text-gray-600 border border-gray-300 rounded-lg cursor-not-allowed bg-gray-50"
                      placeholder="Ward Location"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Staff Name (Nurse)
                    </label>
                    <input
                      type="text"
                      value={formData.staffName}
                      readOnly
                      className="w-full px-3 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-green-600">
                      Auto-filled from login
                    </p>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Enter diagnosis"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Request Type */}
              <div className="mb-6">
                <h3 className="pb-2 mb-4 text-lg font-semibold text-gray-800 border-b">
                  Request Type
                </h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {[
                    { id: "medicineSlip", label: "Medicine Slip" },
                    { id: "investigation", label: "Investigation" },
                    { id: "package", label: "Package" },
                    { id: "nonPackage", label: "Non Package" },
                  ].map((type) => (
                    <label
                      key={type.id}
                      className="flex items-center p-2 transition-colors rounded-lg cursor-pointer hover:bg-gray-50"
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
              </div>

              {/* Medicines Section with Search */}
              {requestTypes.medicineSlip && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="pb-2 text-lg font-semibold text-gray-800 border-b">
                      Medicines
                    </h3>
                  </div>

                  <div className="mb-4 space-y-3">
                    {medicines.map((medicine, index) => (
                      <div
                        key={medicine.id}
                        className="flex items-end gap-3 p-3 border border-gray-100 rounded-lg bg-gray-50"
                      >
                        <div className="flex items-center justify-center w-8 h-10 text-sm font-semibold text-white bg-green-600 rounded">
                          {index + 1}
                        </div>
                        <div className="flex-1 medicine-dropdown-container">
                          <label className="block mb-1 text-sm font-medium text-gray-700">
                            Medicine Name
                          </label>
                          <div className="relative">
                            <div className="flex items-center">
                              <Search className="absolute w-4 h-4 text-gray-400 left-3" />
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
                                placeholder="Search for medicine..."
                                className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                            </div>

                            {/* Medicine dropdown */}
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
                                  {medicinesList.filter(
                                    (med) =>
                                      medicineSearchTerm === "" ||
                                      med
                                        .toLowerCase()
                                        .includes(
                                          medicineSearchTerm.toLowerCase(),
                                        ),
                                  ).length === 0 && (
                                    <div className="px-4 py-3 text-sm text-center text-gray-500">
                                      No medicines found
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="w-32">
                          <label className="block mb-1 text-sm font-medium text-gray-700">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            onWheel={(e) => e.target.blur()}
                            onKeyDown={(e) => {
                              if (
                                e.key === "ArrowUp" ||
                                e.key === "ArrowDown"
                              ) {
                                e.preventDefault();
                              }
                            }}
                            value={medicine.quantity}
                            onChange={(e) =>
                              updateMedicine(
                                medicine.id,
                                "quantity",
                                e.target.value,
                              )
                            }
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="Qty"
                          />
                        </div>
                        <button
                          onClick={() => removeMedicine(medicine.id)}
                          disabled={loading}
                          className="h-10 px-3 py-2 text-red-500 transition-colors bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300"
                          title="Remove Medicine"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addMedicine}
                    disabled={loading}
                    className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300"
                  >
                    <Plus className="w-4 h-4" />
                    Add Medicine
                  </button>
                </div>
              )}

              {/* Investigation Advice Section */}
              {requestTypes.investigation && (
                <div className="mb-6">
                  <h3 className="pb-2 mb-4 text-lg font-semibold text-gray-800 border-b">
                    Investigation Advice
                  </h3>

                  <div className="p-4 space-y-4 border border-green-200 rounded-lg bg-green-50">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="block mb-1 text-sm font-medium text-gray-700">
                          Priority *
                        </label>
                        <select
                          name="priority"
                          value={investigationAdvice.priority}
                          onChange={handleInvestigationAdviceChange}
                          disabled={loading}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>

                      <div>
                        <label className="block mb-1 text-sm font-medium text-gray-700">
                          Pathology & Radiology *
                        </label>
                        <select
                          name="adviceCategory"
                          value={investigationAdvice.adviceCategory}
                          onChange={handleInvestigationAdviceChange}
                          disabled={loading}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">Select Category</option>
                          <option value="Pathology">Pathology</option>
                          <option value="Radiology">Radiology</option>
                        </select>
                      </div>
                    </div>

                    {/* Pathology Tests */}
                    {investigationAdvice.adviceCategory === "Pathology" && (
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">
                          Select Pathology Tests * (
                          {investigationAdvice.pathologyTests.length} selected)
                        </label>
                        <div className="p-4 overflow-y-auto bg-white border border-gray-300 rounded-lg max-h-60">
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                            {(investigationTests.Pathology || []).map(
                              (test) => (
                                <label
                                  key={test}
                                  className="flex items-start gap-2 p-1 rounded cursor-pointer hover:bg-gray-50"
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
                                    disabled={loading}
                                    className="mt-1 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                  />
                                  <span className="text-sm text-gray-700">
                                    {test}
                                  </span>
                                </label>
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Radiology Section */}
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
                            disabled={loading}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="">Select Type</option>
                            <option value="X-ray">X-ray</option>
                            <option value="CT-scan">CT Scan</option>
                            <option value="USG">USG</option>
                          </select>
                        </div>

                        {investigationAdvice.radiologyType && (
                          <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700">
                              Select {investigationAdvice.radiologyType} Tests *
                              ({investigationAdvice.radiologyTests.length}{" "}
                              selected)
                            </label>
                            <div className="p-4 overflow-y-auto bg-white border border-gray-300 rounded-lg max-h-60">
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {getRadiologyTests().map((test) => (
                                  <label
                                    key={test}
                                    className="flex items-start gap-2 p-1 rounded cursor-pointer hover:bg-gray-50"
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
                                      disabled={loading}
                                      className="mt-1 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {test}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Remarks */}
                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Remarks
                      </label>
                      <textarea
                        name="remarks"
                        value={investigationAdvice.remarks}
                        onChange={handleInvestigationAdviceChange}
                        rows="3"
                        placeholder="Add any additional notes or instructions..."
                        disabled={loading}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Medicine Summary Section */}
              {requestTypes.medicineSlip && summaryData.length > 0 && (
                <div className="mb-6">
                  <h3 className="pb-2 mb-4 text-lg font-semibold text-gray-800 border-b">
                    Medicine Summary
                  </h3>
                  <div className="overflow-hidden border border-green-200 rounded-lg bg-green-50">
                    <table className="min-w-full">
                      <thead className="text-white bg-green-600">
                        <tr>
                          <th className="px-4 py-3 text-sm font-semibold text-left">
                            Sr No
                          </th>
                          <th className="px-4 py-3 text-sm font-semibold text-left">
                            Medicine Name
                          </th>
                          <th className="px-4 py-3 text-sm font-semibold text-left">
                            Quantity
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-green-200">
                        {summaryData.map((item) => (
                          <tr key={item.srNo}>
                            <td className="px-4 py-3 text-sm">{item.srNo}</td>
                            <td className="px-4 py-3 text-sm font-medium">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {item.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-green-100">
                        <tr>
                          <td
                            colSpan="2"
                            className="px-4 py-3 text-sm font-bold text-gray-800"
                          >
                            Total Items: {summaryData.length}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-800">
                            Total Qty: {totalQuantity}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t">
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                    setEditMode(false);
                  }}
                  disabled={loading}
                  className="px-6 py-2 font-medium text-gray-700 transition-colors bg-gray-200 rounded-lg hover:bg-gray-300 disabled:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2 font-medium text-white transition-colors bg-green-600 rounded-lg shadow-sm hover:bg-green-700 disabled:bg-green-300"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-b-2 border-white rounded-full animate-spin"></div>
                      {editMode ? "Updating..." : "Submitting..."}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editMode ? "Update Indent" : "Submit Indent"}
                    </>
                  )}
                </button>
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
                {/* <button
                  onClick={() => {
                    setSuccessModal(false);
                    resetForm();
                    setShowModal(true);
                  }}
                  className="flex-1 px-4 py-2 font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Create New
                </button> */}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {/* View Modal */}
      {viewModal && selectedIndent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
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
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
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
                    <p className="text-gray-500">Category</p>
                    <p className="font-medium text-gray-900">
                      {selectedIndent.category}
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

                        {/* Pathology Tests */}
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

                        {/* Radiology Tests */}
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

                        {/* Remarks */}
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

              {/* Timestamp and Footer */}
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
    </div>
  );
}
