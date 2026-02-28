import React, { useState, useEffect, useRef } from "react";
import { sendIndentApprovalNotification } from "../../../utils/whatsappService";
import {
  Plus,
  X,
  Save,
  Trash2,
  Pill,
  Eye,
  Edit,
  CheckCircle,
  Search,
  Check,
  AlertCircle,
} from "lucide-react";
import supabase from "../../../SupabaseClient";
import { useNotification } from "../../../contexts/NotificationContext";

const PharmacyIndents = () => {
  const [showModal, setShowModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [indents, setIndents] = useState([]);
  const [otDaysMap, setOtDaysMap] = useState({}); // { ipd_number: daysNumber }
  const [admissionPatients, setAdmissionPatients] = useState([]);
  const [activePatientsData, setactivePatientsData] = useState([]);
  const [medicinesList, setMedicinesList] = useState([]);
  const [investigationTests, setInvestigationTests] = useState({
    Pathology: [],
    "X-ray": [],
    "CT-scan": [],
    USG: [],
  });
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { showNotification } = useNotification();
  const [medicineSearchTerm, setMedicineSearchTerm] = useState("");
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(null);
  const [admissionSearch, setAdmissionSearch] = useState("");
  const [showAdmissionDropdown, setShowAdmissionDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const dropdownRef = useRef(null);
  // Get user name from localStorage
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

  const [formData, setFormData] = useState(() => {
    // Initialize formData with user name from localStorage
    const currentUserName = getCurrentUser();

    return {
      admissionNumber: "",
      staffName: currentUserName, // Auto-filled from localStorage
      consultantName: "",
      patientName: "",
      uhidNumber: "",
      age: "",
      gender: "",
      wardLocation: "",
      category: "",
      room: "",
      diagnosis: "",
    };
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

  // Show popup message (legacy - use showNotification)
  const showPopup = (message, type = "success") => {
    showNotification(message, type);
  };

  //for closing admission dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowAdmissionDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Load data from Supabase
  useEffect(() => {
    loadData();
    loadMedicinesList();
    loadInvestigationTests();
    setupRealtimeSubscription();
  }, []);

  // Add effect to close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close medicine dropdown if click is outside
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

  // Fetch OT completion days for each unique IPD number in the given indents list.
  // Only considers ot_information rows where actual2 IS set (OT completed).
  const loadOtDaysForIndents = async (indentsList) => {
    try {
      const uniqueIpds = [
        ...new Set(
          (indentsList || []).map((i) => i.ipd_number).filter(Boolean),
        ),
      ];
      if (uniqueIpds.length === 0) return;

      const { data, error } = await supabase
        .from("ot_information")
        .select("ipd_number, actual2, status")
        .in("ipd_number", uniqueIpds)
        .not("actual2", "is", null);

      if (error || !data) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const map = {};
      data.forEach((row) => {
        // Skip cancelled OT records — no value should be shown
        if (row.status === "Cancel") return;

        const completedDate = new Date(row.actual2);
        completedDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor(
          (today - completedDate) / (1000 * 60 * 60 * 24),
        );
        // Keep the smallest (earliest) completion gap if multiple rows exist
        if (
          map[row.ipd_number] === undefined ||
          diffDays < map[row.ipd_number]
        ) {
          map[row.ipd_number] = diffDays < 0 ? 0 : diffDays;
        }
      });
      setOtDaysMap(map);
    } catch (err) {
      console.error("Error loading OT days:", err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Load indents from pharmacy table
      const { data: indentsData, error: indentsError } = await supabase
        .from("pharmacy")
        .select("*")
        .order("timestamp", { ascending: false });

      if (indentsError) throw indentsError;
      setIndents(indentsData || []);

      // Load OT completion days for the fetched indents
      await loadOtDaysForIndents(indentsData || []);

      // Load admission patients from ipd_admissions
      const { data: patientsData, error: patientsError } = await supabase
        .from("ipd_admissions")
        .select(
          "admission_no, patient_name, consultant_dr, age, gender, ward_type, floor, room, bed_no, ipd_number",
        )
        .not("planned1", "is", null) // planned1 is not null
        .is("actual1", null)
        .order("admission_no", { ascending: false });

      if (patientsError) throw patientsError;

      const activePatients = admissionPatients.filter(
        (patient) => patient.actual1 === null && patient.status === "Active",
      );
      setactivePatientsData(activePatients || []);
      setAdmissionPatients(patientsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      showPopup("Error loading data from database", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadMedicinesList = async () => {
    try {
      // Try to load medicines from pharmacy_inventory or use fallback
      const { data, error } = await supabase
        .from("medicine")
        .select("medicine_name");

      if (error) {
        console.error("Error loading medicines:", error);
        // Use fallback list
        const fallbackMeds = [
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
        ];
        setMedicinesList(fallbackMeds);
        return;
      }

      if (data && data.length > 0) {
        const medNames = data
          .map((item) => item.medicine_name)
          .filter((name) => name);
        setMedicinesList(medNames);
      } else {
        // Use fallback if no data
        const fallbackMeds = [
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
        ];
        setMedicinesList(fallbackMeds);
      }
    } catch (error) {
      console.error("Error loading medicines list:", error);
    }
  };

  const loadInvestigationTests = async () => {
    try {
      // Load Pathology tests
      const { data: pathologyData, error: pathologyError } = await supabase
        .from("investigation")
        .select("name, type")
        .eq("type", "Pathology")
        .order("name");

      if (pathologyError) {
        console.error("Error loading Pathology tests:", pathologyError);
        setInvestigationTests((prev) => ({
          ...prev,
          Pathology: staticPathologyTests,
        }));
      } else if (pathologyData && pathologyData.length > 0) {
        const pathologyTests = pathologyData
          .map((test) => test.name)
          .filter((name) => name);
        setInvestigationTests((prev) => ({
          ...prev,
          Pathology: pathologyTests,
        }));
      } else {
        setInvestigationTests((prev) => ({
          ...prev,
          Pathology: staticPathologyTests,
        }));
      }

      // Load X-ray tests
      const { data: xrayData, error: xrayError } = await supabase
        .from("investigation")
        .select("name, type")
        .eq("type", "X-ray")
        .order("name");

      if (xrayError) {
        console.error("Error loading X-ray tests:", xrayError);
        // Fallback X-ray tests
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
      } else if (xrayData && xrayData.length > 0) {
        const xrayTests = xrayData
          .map((test) => test.name)
          .filter((name) => name);
        setInvestigationTests((prev) => ({ ...prev, "X-ray": xrayTests }));
      }

      // Load CT-scan tests
      const { data: ctScanData, error: ctScanError } = await supabase
        .from("investigation")
        .select("name, type")
        .eq("type", "CT Scan")
        .order("name");

      if (ctScanError) {
        console.error("Error loading CT-scan tests:", ctScanError);
        // Fallback CT-scan tests
        const fallbackCTScan = [
          "CT Scan",
          "3D CT Ankle",
          "3D CT Face",
          "3D CT Head",
          "CECT Abdomen",
          "CECT Chest",
          "CECT Head",
          "CECT Neck",
          "CT Brain",
          "CT Chest",
          "HRCT Chest",
          "NCCT Head",
          "CT Scan Brain Plain",
          "CT Angiography",
          "CT-Scan - Brain With Contrast",
          "CT-Scan - Brain Without Contrast",
          "HRCT Chest (COVID)",
        ];
        setInvestigationTests((prev) => ({
          ...prev,
          "CT-scan": fallbackCTScan,
        }));
      } else if (ctScanData && ctScanData.length > 0) {
        const ctScanTests = ctScanData
          .map((test) => test.name)
          .filter((name) => name);
        setInvestigationTests((prev) => ({ ...prev, "CT-scan": ctScanTests }));
      }

      // Load USG tests
      const { data: usgData, error: usgError } = await supabase
        .from("investigation")
        .select("name, type")
        .eq("type", "USG")
        .order("name");

      if (usgError) {
        console.error("Error loading USG tests:", usgError);
        // Fallback USG tests
        const fallbackUSG = [
          "USG",
          "USG Whole Abdomen Male",
          "USG Whole Abdomen Female",
          "USG KUB Male",
          "USG KUB Female",
          "USG Pelvis Female",
          "TVS",
          "USG Upper Abdomen",
          "USG Breast",
          "USG Thyroid",
          "USG Scrotum",
          "Fetal Doppler USG",
          "Carotid Doppler",
          "USG OBS",
          "Anomaly Scan",
          "Growth Scan",
          "USG Guided Biopsy",
          "USG Abdomen With Pelvis",
        ];
        setInvestigationTests((prev) => ({ ...prev, USG: fallbackUSG }));
      } else if (usgData && usgData.length > 0) {
        const usgTests = usgData
          .map((test) => test.name)
          .filter((name) => name);
        setInvestigationTests((prev) => ({ ...prev, USG: usgTests }));
      }
    } catch (error) {
      console.error("Error loading investigation tests:", error);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel("pharmacy_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pharmacy",
        },
        () => {
          loadData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAdmissionSelect = (admissionNo) => {
    const selectedPatient = admissionPatients.find(
      (patient) => patient.admission_no === admissionNo,
    );

    if (selectedPatient) {
      setFormData({
        admissionNumber: selectedPatient.admission_no,
        staffName: getCurrentUser(), // Keep the staff name from localStorage
        consultantName: selectedPatient.consultant_dr || "",
        patientName: selectedPatient.patient_name || "",
        uhidNumber: "",
        age: selectedPatient.age || "",
        gender: selectedPatient.gender || "",
        wardLocation: `${selectedPatient.ward_type || ""} - ${selectedPatient.floor || ""}`,
        category: "",
        room: selectedPatient.room || "",
        diagnosis: "",
      });
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
        nonPackage: false, // Unselect nonPackage when package is selected
      }));
    } else if (type === "nonPackage") {
      setRequestTypes((prev) => ({
        ...prev,
        nonPackage: !prev.nonPackage,
        package: false, // Unselect package when nonPackage is selected
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

  const addInvestigation = () => {
    const newInvestigation = {
      id: Date.now(),
      name: "",
      notes: "",
    };
    setInvestigations([...investigations, newInvestigation]);
  };

  const removeInvestigation = (id) => {
    setInvestigations(investigations.filter((inv) => inv.id !== id));
  };

  const updateInvestigation = (id, field, value) => {
    setInvestigations(
      investigations.map((inv) =>
        inv.id === id ? { ...inv, [field]: value } : inv,
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

  // generate a sequential indent number, starting at 15000 for new records
  const generateIndentNumber = async () => {
    try {
      const { data, error } = await supabase
        .from("pharmacy")
        .select("indent_no")
        .order("timestamp", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching last indent number:", error);
        return "IND-15000";
      }

      if (data && data.length > 0) {
        const last = data[0].indent_no;
        if (last && last.startsWith("IND-")) {
          const num = parseInt(last.replace("IND-", ""), 10);
          if (!isNaN(num)) {
            const next = num >= 15000 ? num + 1 : 15000;
            return `IND-${next}`;
          }
        }
      }
      return "IND-15000";
    } catch (err) {
      console.error("Exception generating indent number:", err);
      return "IND-15000";
    }
  };

  const handleSubmit = async () => {
    if (!formData.admissionNumber) {
      showPopup("Please select Admission Number", "error");
      return;
    }

    // Make diagnosis required - entered manually
    if (!formData.diagnosis.trim()) {
      showPopup("Please enter Diagnosis", "error");
      return;
    }

    const hasRequestType = Object.values(requestTypes).some((value) => value);
    if (!hasRequestType) {
      showPopup("Please select at least one Request Type", "error");
      return;
    }

    if (requestTypes.medicineSlip && medicines.length === 0) {
      showPopup("Please add at least one medicine", "error");
      return;
    }

    const incompleteMedicines = medicines.some(
      (med) => !med.name || !med.quantity,
    );
    if (requestTypes.medicineSlip && incompleteMedicines) {
      showPopup("Please fill all medicine details", "error");
      return;
    }

    // Validation for investigation advice
    if (requestTypes.investigation) {
      if (!investigationAdvice.adviceCategory) {
        showPopup(
          "Please select Pathology or Radiology for investigation",
          "error",
        );
        return;
      }

      if (
        investigationAdvice.adviceCategory === "Pathology" &&
        investigationAdvice.pathologyTests.length === 0
      ) {
        showPopup("Please select at least one pathology test", "error");
        return;
      }

      if (investigationAdvice.adviceCategory === "Radiology") {
        if (!investigationAdvice.radiologyType) {
          showPopup("Please select radiology type", "error");
          return;
        }
        if (investigationAdvice.radiologyTests.length === 0) {
          showPopup("Please select at least one radiology test", "error");
          return;
        }
      }
    }

    try {
      setLoading(true);

      // Find the selected patient to get IPD number
      const selectedPatient = admissionPatients.find(
        (patient) => patient.admission_no === formData.admissionNumber,
      );

      const pharmacyData = {
        timestamp: new Date()
          .toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false,
          })
          .replace(",", ""),
        indent_no:
          editMode && selectedIndent
            ? selectedIndent.indent_no
            : await generateIndentNumber(),
        admission_number: formData.admissionNumber,
        ipd_number: selectedPatient?.ipd_number || "",
        staff_name: formData.staffName,
        consultant_name: formData.consultantName,
        patient_name: formData.patientName,
        uhid_number: formData.uhidNumber,
        age: formData.age,
        gender: formData.gender,
        ward_location: formData.wardLocation,
        category: formData.category,
        room: formData.room,
        diagnosis: formData.diagnosis.trim(),
        request_types: JSON.stringify(requestTypes),
        medicines: JSON.stringify(medicines),
        investigations: JSON.stringify(investigations),
        investigation_advice: JSON.stringify(investigationAdvice),
        status: "pending",
        planned1: new Date()
          .toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false,
          })
          .replace(",", ""),
      };

      let insertedData;
      if (editMode && selectedIndent) {
        // Update existing indent
        const { data, error } = await supabase
          .from("pharmacy")
          .update(pharmacyData)
          .eq("id", selectedIndent.id)
          .select()
          .single();

        if (error) throw error;
        insertedData = data;
        showPopup("Indent updated successfully!");
      } else {
        // Create new indent
        const { data, error } = await supabase
          .from("pharmacy")
          .insert([pharmacyData])
          .select()
          .single();

        if (error) throw error;
        insertedData = data;
        showPopup("Indent created successfully!");

        // fire and forget WhatsApp notification for new indents
        sendIndentApprovalNotification(
          insertedData,
          medicines,
          requestTypes,
        ).catch((err) => console.error("[WhatsApp] Notification error:", err));
      }
      console.log(insertedData);

      const totalMedicines = requestTypes.medicineSlip
        ? medicines.reduce((sum, med) => sum + parseInt(med.quantity || 0), 0)
        : 0;

      setSuccessData({
        indentNumber: insertedData.indent_no, // use returned indent_number
        patientName: insertedData.patient_name,
        admissionNo: insertedData.admission_number,
        totalMedicines: totalMedicines,
      });

      setShowModal(false);
      setEditMode(false);
      setSuccessModal(true);
      resetForm();

      // Refresh data
      await loadData();
    } catch (error) {
      console.error("Error saving indent:", error);
      showPopup(`Failed to save indent: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      admissionNumber: "",
      staffName: getCurrentUser(), // Reset with current user name
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
    setRequestTypes({
      medicineSlip: false,
      investigation: false,
      package: false,
      nonPackage: false,
    });
    setMedicines([]);
    setInvestigations([]);
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

  const parseJsonField = (field) => {
    try {
      return field ? JSON.parse(field) : {};
    } catch (error) {
      console.error("Error parsing JSON field:", error);
      return {};
    }
  };

  const handleView = (indent) => {
    setSelectedIndent(indent);
    setViewModal(true);
  };

  const handleEdit = (indent) => {
    setSelectedIndent(indent);
    setFormData({
      admissionNumber: indent.admission_number,
      staffName: indent.staff_name || getCurrentUser(), // Use stored name or current user
      consultantName: indent.consultant_name,
      patientName: indent.patient_name,
      uhidNumber: indent.uhid_number,
      age: indent.age,
      gender: indent.gender,
      wardLocation: indent.ward_location,
      category: indent.category,
      room: indent.room,
      diagnosis: indent.diagnosis,
    });

    // Parse JSON fields
    const requestTypesData = parseJsonField(indent.request_types);
    const medicinesData = parseJsonField(indent.medicines);
    const investigationAdviceData = parseJsonField(indent.investigation_advice);

    setRequestTypes(
      requestTypesData || {
        medicineSlip: false,
        investigation: false,
        package: false,
        nonPackage: false,
      },
    );
    setMedicines(medicinesData || []);
    setInvestigations([]);
    setInvestigationAdvice(
      investigationAdviceData || {
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

  const filteredIndents = indents.filter(
    (indent) =>
      indent.indent_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      indent.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      indent.admission_number
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      indent.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const summaryData = getSummaryData();
  const totalQuantity = summaryData.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Fixed Section: Header and Search */}
      <div className="flex-none bg-white border-b shrink-0">
        <div className="px-4 py-3 mx-auto max-w-7xl sm:px-6">
          {/* Header */}
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-800 sm:text-2xl lg:text-3xl">
                Pharmacy Indents
              </h1>
              <p className="hidden sm:block text-sm text-gray-600 mt-0.5">
                Manage pharmacy requests and medications
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center justify-center w-full gap-2 px-4 py-2 font-medium text-white transition-all bg-green-600 rounded-lg shadow-sm sm:w-auto hover:bg-green-700"
              disabled={loading}
            >
              <Plus className="w-5 h-5" />
              New Indent
            </button>
          </div>

          {/* Search Bar - Condensed */}
          <div className="relative mt-3">
            <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
            <input
              type="text"
              placeholder="Search indents, patients, or diagnosis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2 pr-4 text-sm transition-all border border-gray-200 rounded-lg outline-none pl-9 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 p-3 overflow-hidden md:p-4">
        <div className="flex flex-col h-full mx-auto max-w-7xl">
          {/* Desktop Table */}
          <div className="flex flex-col flex-1 hidden min-h-0 bg-white rounded-lg shadow md:block">
            <div className="flex-1 overflow-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 text-white bg-green-600">
                  <tr>
                    <th className="px-4 py-3 text-sm font-semibold text-left">
                      Indent No
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-left">
                      Admission No
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-left">
                      Patient Name
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-left">
                      IPD No
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-left">
                      Staff Name
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-left">
                      Diagnosis
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-left">
                      Request Type
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-left">
                      Status
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-left">
                      Date
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-left">
                      OT Done
                    </th>
                    <th className="px-4 py-3 text-sm font-semibold text-left">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 mb-4 border-b-2 border-green-600 rounded-full animate-spin"></div>
                          <p className="text-gray-700">Loading indents...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredIndents.length > 0 ? (
                    filteredIndents.map((indent) => {
                      const requestTypesData = parseJsonField(
                        indent.request_types,
                      );
                      return (
                        <tr key={indent.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-green-700">
                            {indent.indent_no}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {indent.admission_number}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {indent.patient_name}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {indent.ipd_number}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {indent.staff_name}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {indent.diagnosis}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <div className="flex flex-wrap gap-1">
                              {requestTypesData?.medicineSlip && (
                                <span className="px-2 py-1 text-xs text-green-700 bg-green-100 rounded">
                                  Medicine
                                </span>
                              )}
                              {requestTypesData?.investigation && (
                                <span className="px-2 py-1 text-xs text-green-700 bg-green-100 rounded">
                                  Investigation
                                </span>
                              )}
                              {requestTypesData?.package && (
                                <span className="px-2 py-1 text-xs text-purple-700 bg-purple-100 rounded">
                                  Package
                                </span>
                              )}
                              {requestTypesData?.nonPackage && (
                                <span className="px-2 py-1 text-xs text-orange-700 bg-orange-100 rounded">
                                  Non-Package
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span
                              className={`px-2 py-1 flex w-fit text-xs font-semibold rounded-full ${
                                indent.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : indent.status === "Approved"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-green-100 text-green-800"
                              }`}
                            >
                              {indent.status === "Approved"
                                ? "Approved"
                                : indent.status.charAt(0).toUpperCase() +
                                  indent.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {indent.planned1
                              ? new Date(indent.planned1).toLocaleString(
                                  "en-GB",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "2-digit",
                                    month: "short",
                                  },
                                )
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {indent.ipd_number &&
                            otDaysMap[indent.ipd_number] !== undefined ? (
                              <span className="px-2 py-1 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full">
                                {otDaysMap[indent.ipd_number] === 0
                                  ? "Today"
                                  : `${otDaysMap[indent.ipd_number]} day${otDaysMap[indent.ipd_number] !== 1 ? "s" : ""}`}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleView(indent)}
                                className="p-2 text-white transition-colors bg-green-500 rounded-lg hover:bg-green-600"
                                title="View Details"
                                disabled={loading}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(indent)}
                                className="p-2 text-white transition-colors bg-green-500 rounded-lg hover:bg-green-600"
                                title="Edit Indent"
                                disabled={loading}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="9" className="px-6 py-12 text-center">
                        <Pill className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="font-medium text-gray-500">
                          No indents created yet
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          Click "New Indent" to create one
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="flex-1 pb-4 space-y-4 overflow-auto md:hidden">
            {loading ? (
              <div className="py-12 text-center bg-white border border-gray-100 shadow-sm rounded-xl">
                <div className="w-10 h-10 mx-auto mb-3 border-b-2 border-green-600 rounded-full animate-spin"></div>
                <p className="font-medium text-gray-500">Loading indents...</p>
              </div>
            ) : filteredIndents.length > 0 ? (
              filteredIndents.map((indent) => {
                const requestTypesData = parseJsonField(indent.request_types);
                return (
                  <div
                    key={indent.id}
                    className="overflow-hidden bg-white border border-gray-100 shadow-sm rounded-xl"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold tracking-tight text-green-700">
                          {indent.indent_no}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                          {indent.admission_number}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-full uppercase tracking-wider ${
                          indent.status === "pending"
                            ? "bg-amber-100 text-amber-700 border border-amber-200"
                            : indent.status === "Approved"
                              ? "bg-blue-100 text-blue-700 border border-blue-200"
                              : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {indent.status}
                      </span>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">
                            Patient
                          </span>
                          <p className="text-sm font-semibold text-gray-800 line-clamp-1">
                            {indent.patient_name}
                          </p>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">
                            IPD No
                          </span>
                          <p className="text-sm font-semibold text-gray-800">
                            {indent.ipd_number}
                          </p>
                        </div>
                        <div className="space-y-0.5 col-span-2">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">
                            Diagnosis
                          </span>
                          <p className="text-sm italic font-medium text-gray-700 line-clamp-1">
                            "{indent.diagnosis}"
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">
                            Date
                          </span>
                          <p className="text-xs font-semibold text-gray-700">
                            {indent.planned1
                              ? new Date(indent.planned1).toLocaleString(
                                  "en-GB",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : "-"}
                          </p>
                        </div>
                        {indent.ipd_number &&
                          otDaysMap[indent.ipd_number] !== undefined && (
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-gray-400 font-bold uppercase">
                                OT Done
                              </span>
                              <p className="text-xs font-semibold text-purple-700">
                                {otDaysMap[indent.ipd_number] === 0
                                  ? "Today"
                                  : `${otDaysMap[indent.ipd_number]} day${otDaysMap[indent.ipd_number] !== 1 ? "s" : ""}`}
                              </p>
                            </div>
                          )}
                        <div className="flex flex-col items-end justify-end space-y-1">
                          <div className="flex flex-wrap justify-end gap-1">
                            {requestTypesData.medicineSlip && (
                              <span className="px-2 py-0.5 bg-sky-50 text-sky-600 text-[10px] font-bold rounded border border-sky-100">
                                MED
                              </span>
                            )}
                            {requestTypesData.investigation && (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded border border-indigo-100">
                                INV
                              </span>
                            )}
                            {requestTypesData.package && (
                              <span className="px-2 py-0.5 bg-fuchsia-50 text-fuchsia-600 text-[10px] font-bold rounded border border-fuchsia-100">
                                PKG
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleView(indent)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-green-50 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          Details
                        </button>
                        {indent.status === "pending" && (
                          <button
                            onClick={() => handleEdit(indent)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center bg-white border border-gray-100 shadow-sm rounded-xl">
                <div className="w-16 h-16 mx-auto mb-3 text-gray-200">
                  <AlertCircle className="w-full h-full" />
                </div>
                <p className="font-medium text-gray-500">
                  No results matching your search
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 text-white bg-green-600">
              <h2 className="text-xl font-bold">
                {editMode ? "Edit Indent" : "Create New Indent"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                  setEditMode(false);
                }}
                className="p-1 text-white rounded-full hover:bg-green-700"
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

                <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2 md:grid-cols-3">
                  <div className="relative">
                    <label className="block mb-1 text-sm font-semibold text-gray-700">
                      Admission Number <span className="text-red-500">*</span>
                    </label>

                    <div ref={dropdownRef} className="relative z-10">
                      <Search className="absolute z-0 w-4 h-4 text-gray-400 left-3 top-3" />
                      <input
                        type="text"
                        value={admissionSearch}
                        onChange={(e) => {
                          setAdmissionSearch(e.target.value);
                          setShowAdmissionDropdown(true);
                        }}
                        onFocus={() => setShowAdmissionDropdown(true)}
                        placeholder="Type Admission Number..."
                        className="w-full px-3 py-2.5 pl-10 pr-3 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-green-500"
                        disabled={editMode || loading}
                      />

                      {/* Dropdown */}
                      {showAdmissionDropdown && (
                        <div className="absolute z-50 w-full mt-1 overflow-y-auto bg-white border rounded-lg shadow-lg max-h-60">
                          {admissionPatients
                            .filter(
                              (p) =>
                                p.admission_no
                                  ?.toLowerCase()
                                  .includes(admissionSearch.toLowerCase()) ||
                                p.patient_name
                                  ?.toLowerCase()
                                  .includes(admissionSearch.toLowerCase()),
                            )
                            .map((patient) => (
                              <div
                                key={patient.admission_no}
                                onMouseDown={() => {
                                  setSelectedPatient(patient);
                                  setAdmissionSearch(
                                    `${patient.admission_no} - ${patient.patient_name}`,
                                  );
                                  setShowAdmissionDropdown(false);
                                  handleAdmissionSelect(patient.admission_no);
                                }}
                                className="px-4 py-2 text-sm cursor-pointer hover:bg-green-50"
                              >
                                <div className="font-medium">
                                  {patient.admission_no}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {patient.patient_name}
                                </div>
                              </div>
                            ))}

                          {activePatientsData.filter((p) =>
                            p.admission_no
                              ?.toLowerCase()
                              .includes(admissionSearch.toLowerCase()),
                          ).length === 0 && (
                            <div className="px-4 py-1 text-sm text-center text-gray-500">
                              No matching admission found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 text-sm font-semibold text-gray-700">
                      Patient Name
                    </label>
                    <input
                      type="text"
                      value={formData.patientName}
                      readOnly
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2 md:col-span-1">
                    <label className="block mb-1 text-sm font-semibold text-gray-700">
                      UHID Number
                    </label>
                    <input
                      type="text"
                      name="uhidNumber"
                      value={formData.uhidNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
                      placeholder="Enter UHID"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 sm:grid-cols-4">
                  <div>
                    <label className="block mb-1 text-sm font-semibold text-gray-700">
                      Age
                    </label>
                    <input
                      type="text"
                      value={formData.age}
                      readOnly
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-sm font-semibold text-gray-700">
                      Gender
                    </label>
                    <input
                      type="text"
                      value={formData.gender}
                      readOnly
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-sm font-semibold text-gray-700">
                      Category
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
                    >
                      <option value="General">General</option>
                      <option value="Critical">Critical</option>
                      <option value="Private">Private</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-sm font-semibold text-gray-700">
                      Room
                    </label>
                    <input
                      type="text"
                      name="room"
                      value={formData.room}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
                      placeholder="Room No"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {/* Updated Staff Name Field - Auto-filled from localStorage */}
                  <div>
                    <label className="block mb-1 text-sm font-semibold text-gray-700">
                      Staff Name
                    </label>
                    <input
                      type="text"
                      value={formData.staffName}
                      readOnly
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                      placeholder="Auto-filled"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-sm font-semibold text-gray-700">
                      Ward Location
                    </label>
                    <input
                      type="text"
                      name="wardLocation"
                      value={formData.wardLocation}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
                      placeholder="Ward name"
                    />
                  </div>

                  <div className="sm:col-span-2 md:col-span-1">
                    <label className="block mb-1 text-sm font-semibold text-gray-700">
                      Diagnosis <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="diagnosis"
                      value={formData.diagnosis}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
                      placeholder="Enter patient diagnosis"
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
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { id: "medicineSlip", label: "Medicine Slip" },
                    { id: "investigation", label: "Investigation" },
                    { id: "package", label: "Package" },
                    { id: "nonPackage", label: "Non Package" },
                  ].map((type) => (
                    <label
                      key={type.id}
                      className={`flex items-center p-3 rounded-lg border transition-all cursor-pointer ${requestTypes[type.id] ? "bg-green-50 border-green-200 shadow-sm" : "bg-white border-gray-200 hover:border-green-200"}`}
                    >
                      <input
                        type="checkbox"
                        checked={requestTypes[type.id]}
                        onChange={() => handleCheckboxChange(type.id)}
                        disabled={loading}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span
                        className={`ml-2 text-sm font-medium ${requestTypes[type.id] ? "text-green-700" : "text-gray-600"}`}
                      >
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
                        className="flex flex-col items-stretch gap-3 p-3 border border-gray-200 rounded-lg sm:p-0 bg-gray-50 sm:bg-transparent sm:rounded-none sm:border-0 sm:flex-row sm:items-end"
                      >
                        <div className="items-center justify-center hidden w-8 h-10 font-semibold text-white bg-green-600 rounded sm:flex shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1 medicine-dropdown-container">
                          <label className="block mb-1 text-sm font-medium text-gray-700">
                            <span className="mr-2 font-bold text-green-600 sm:hidden">
                              #{index + 1}
                            </span>
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
                                className="w-full px-3 py-2 pl-10 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                            </div>

                            {/* Medicine dropdown */}
                            {showMedicineDropdown === medicine.id && (
                              <div className="absolute z-50 w-full mt-1 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-xl max-h-60">
                                <div className="sticky top-0 z-10 p-2 bg-white border-b">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                                    <input
                                      type="text"
                                      placeholder="Type to search medicines..."
                                      className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                      onChange={(e) =>
                                        setMedicineSearchTerm(e.target.value)
                                      }
                                      value={medicineSearchTerm}
                                      autoFocus
                                    />
                                  </div>
                                </div>
                                <div className="divide-y divide-gray-50">
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
                                    .map((med) => (
                                      <div
                                        key={med}
                                        onClick={() => {
                                          updateMedicine(
                                            medicine.id,
                                            "name",
                                            med,
                                          );
                                          setShowMedicineDropdown(null);
                                          setMedicineSearchTerm("");
                                        }}
                                        className="px-4 py-2.5 hover:bg-green-50 cursor-pointer text-sm font-medium text-gray-700 transition-colors"
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
                                    <div className="px-4 py-4 text-sm italic text-center text-gray-500">
                                      No matching medicines found
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1 sm:w-32">
                            <label className="block mb-1 text-sm font-medium text-gray-700">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={medicine.quantity}
                              onWheel={(e) => e.target.blur()}
                              onKeyDown={(e) => {
                                if (
                                  e.key === "ArrowUp" ||
                                  e.key === "ArrowDown"
                                ) {
                                  e.preventDefault();
                                }
                              }}
                              onChange={(e) =>
                                updateMedicine(
                                  medicine.id,
                                  "quantity",
                                  e.target.value,
                                )
                              }
                              disabled={loading}
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              placeholder="0"
                            />
                          </div>
                          <button
                            onClick={() => removeMedicine(medicine.id)}
                            disabled={loading}
                            className="h-10 px-3 py-2 text-red-500 transition-colors border border-red-100 rounded-lg bg-red-50 hover:bg-red-100 shrink-0"
                            title="Remove item"
                          >
                            <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addMedicine}
                    disabled={loading}
                    className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300"
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
                        <div className="p-3 overflow-y-auto bg-white border border-gray-200 rounded-lg max-h-60">
                          <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                            {investigationTests.Pathology.map((test) => (
                              <label
                                key={test}
                                className={`flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors cursor-pointer ${investigationAdvice.pathologyTests.includes(test) ? "bg-green-50/50" : ""}`}
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
                                <span className="text-xs font-medium leading-tight text-gray-700">
                                  {test}
                                </span>
                              </label>
                            ))}
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
                            <div className="p-3 overflow-y-auto bg-white border border-gray-200 rounded-lg max-h-60">
                              <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 sm:grid-cols-3">
                                {getRadiologyTests().map((test) => (
                                  <label
                                    key={test}
                                    className={`flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors cursor-pointer ${investigationAdvice.radiologyTests.includes(test) ? "bg-green-50/50" : ""}`}
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
                                    <span className="text-xs font-medium leading-tight text-gray-700">
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
                  className="px-6 py-2 font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2 font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300"
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
            {/* Success Header */}
            <div className="flex items-center gap-3 px-6 py-4 text-white bg-green-600 rounded-t-lg">
              <CheckCircle className="w-6 h-6" />
              <h2 className="text-xl font-bold">Success!</h2>
            </div>

            {/* Success Body */}
            <div className="p-6">
              <p className="mb-6 text-gray-700">
                Your indent has been submitted successfully!
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
                  <span className="text-sm text-gray-600">Admission No:</span>
                  <span className="text-sm font-medium text-gray-800">
                    {successData.admissionNo}
                  </span>
                </div>
                {successData.totalMedicines > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">
                      Total Medicines:
                    </span>
                    <span className="text-sm font-medium text-gray-800">
                      {successData.totalMedicines}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setSuccessModal(false);
                    const indent = indents.find(
                      (i) => i.indent_no === successData.indentNumber,
                    );
                    if (indent) {
                      handleView(indent);
                    }
                  }}
                  className="flex-1 px-4 py-2 font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  View Details
                </button>
                {/* <button
                  onClick={() => {
                    setSuccessModal(false);
                    resetForm();
                    setShowModal(true);
                  }}
                  className="flex-1 px-4 py-2 font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  Create New Indent
                </button> */}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewModal && selectedIndent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 text-white bg-green-600">
              <h2 className="text-xl font-bold">
                Indent Details - {selectedIndent.indent_no}
              </h2>
              <button
                onClick={() => {
                  setViewModal(false);
                  setSelectedIndent(null);
                }}
                className="p-1 text-white rounded-full hover:bg-green-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6">
              {/* Patient Information */}
              <div className="mb-8">
                <h3 className="flex items-center gap-2 pb-2 mb-4 text-lg font-bold text-gray-800 border-b border-green-100">
                  <div className="w-1.5 h-6 bg-green-600 rounded-full"></div>
                  Patient Information
                </h3>
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                  <div className="p-3 border border-gray-100 rounded-lg bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                      Indent & Adm No
                    </p>
                    <p className="text-sm font-semibold text-gray-800">
                      {selectedIndent.indent_no}{" "}
                      <span className="mx-1 text-gray-400">|</span>{" "}
                      {selectedIndent.admission_number}
                    </p>
                  </div>
                  <div className="p-3 border border-gray-100 rounded-lg bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                      IPD Number
                    </p>
                    <p className="text-sm font-semibold text-gray-800">
                      {selectedIndent.ipd_number}
                    </p>
                  </div>
                  <div className="p-3 border border-gray-100 rounded-lg bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                      Patient Name
                    </p>
                    <p className="text-sm font-semibold text-gray-800">
                      {selectedIndent.patient_name}
                    </p>
                  </div>
                  <div className="p-3 border border-gray-100 rounded-lg bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                      UHID Number
                    </p>
                    <p className="text-sm font-semibold text-gray-800">
                      {selectedIndent.uhid_number || "N/A"}
                    </p>
                  </div>
                  <div className="p-3 border border-gray-100 rounded-lg bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                      Age / Gender
                    </p>
                    <p className="text-sm font-semibold text-gray-800">
                      {selectedIndent.age} / {selectedIndent.gender}
                    </p>
                  </div>
                  <div className="p-3 border border-gray-100 rounded-lg bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                      Category / Ward
                    </p>
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {selectedIndent.category || "General"} -{" "}
                      {selectedIndent.ward_location}
                    </p>
                  </div>
                  <div className="p-3 border border-gray-100 rounded-lg bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                      Staff Name
                    </p>
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {selectedIndent.staff_name}
                    </p>
                  </div>
                  <div className="p-3 border border-gray-100 rounded-lg bg-gray-50 sm:col-span-1 md:col-span-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                      Diagnosis
                    </p>
                    <p className="text-sm italic font-semibold text-gray-800">
                      "{selectedIndent.diagnosis}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Request Types */}
              <div className="mb-8">
                <h3 className="flex items-center gap-2 pb-2 mb-4 text-lg font-bold text-gray-800 border-b border-green-100">
                  <div className="w-1.5 h-6 bg-green-600 rounded-full"></div>
                  Request Types
                </h3>
                <div className="flex flex-wrap gap-2">
                  {parseJsonField(selectedIndent.request_types)
                    ?.medicineSlip && (
                    <span className="px-4 py-1.5 bg-green-50 text-green-700 text-xs rounded-full font-bold border border-green-100 shadow-sm uppercase tracking-wider">
                      Medicine Slip
                    </span>
                  )}
                  {parseJsonField(selectedIndent.request_types)
                    ?.investigation && (
                    <span className="px-4 py-1.5 bg-sky-50 text-sky-700 text-xs rounded-full font-bold border border-sky-100 shadow-sm uppercase tracking-wider">
                      Investigation
                    </span>
                  )}
                  {parseJsonField(selectedIndent.request_types)?.package && (
                    <span className="px-4 py-1.5 bg-purple-50 text-purple-700 text-xs rounded-full font-bold border border-purple-100 shadow-sm uppercase tracking-wider">
                      Package
                    </span>
                  )}
                  {parseJsonField(selectedIndent.request_types)?.nonPackage && (
                    <span className="px-4 py-1.5 bg-orange-50 text-orange-700 text-xs rounded-full font-bold border border-orange-100 shadow-sm uppercase tracking-wider">
                      Non-Package
                    </span>
                  )}
                </div>
              </div>

              {/* Medicines */}
              {parseJsonField(selectedIndent.request_types)?.medicineSlip &&
                parseJsonField(selectedIndent.medicines)?.length > 0 && (
                  <div className="mb-8">
                    <h3 className="flex items-center gap-2 pb-2 mb-4 text-lg font-bold text-gray-800 border-b border-green-100">
                      <div className="w-1.5 h-6 bg-green-600 rounded-full"></div>
                      Medicines List
                    </h3>
                    <div className="overflow-hidden bg-white border border-gray-100 shadow-sm rounded-xl">
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="text-white bg-green-600">
                            <tr>
                              <th className="px-4 py-3 text-left text-[10px] uppercase font-bold tracking-wider">
                                #
                              </th>
                              <th className="px-4 py-3 text-left text-[10px] uppercase font-bold tracking-wider">
                                Medicine Name
                              </th>
                              <th className="px-4 py-3 text-left text-[10px] uppercase font-bold tracking-wider">
                                Qty
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {parseJsonField(selectedIndent.medicines).map(
                              (medicine, index) => (
                                <tr
                                  key={medicine.id || index}
                                  className="transition-colors hover:bg-gray-50"
                                >
                                  <td className="px-4 py-3 font-mono text-sm text-gray-400">
                                    {index + 1}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                                    {medicine.name}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-bold text-green-600">
                                    {medicine.quantity}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

              {/* Investigation Advice Details */}
              {parseJsonField(selectedIndent.request_types)?.investigation &&
                selectedIndent.investigation_advice && (
                  <div className="mb-8">
                    <h3 className="flex items-center gap-2 pb-2 mb-4 text-lg font-bold text-gray-800 border-b border-green-100">
                      <div className="w-1.5 h-6 bg-green-600 rounded-full"></div>
                      Investigation Advice
                    </h3>
                    <div className="p-5 space-y-5 border border-green-100 bg-green-50/50 rounded-xl">
                      {(() => {
                        const adviceData = parseJsonField(
                          selectedIndent.investigation_advice,
                        );
                        return (
                          <>
                            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                                  Priority
                                </p>
                                <span
                                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                    adviceData.priority === "High"
                                      ? "bg-red-100 text-red-700 border-red-200"
                                      : adviceData.priority === "Medium"
                                        ? "bg-amber-100 text-amber-700 border-amber-200"
                                        : "bg-emerald-100 text-emerald-700 border-emerald-200"
                                  }`}
                                >
                                  {adviceData.priority} Priority
                                </span>
                              </div>
                              <div className="sm:text-right">
                                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                                  Category
                                </p>
                                <p className="font-bold text-gray-800">
                                  {adviceData.adviceCategory}
                                </p>
                              </div>
                            </div>

                            {/* Pathology Tests */}
                            {adviceData.adviceCategory === "Pathology" &&
                              adviceData.pathologyTests?.length > 0 && (
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">
                                    Selected Tests (
                                    {adviceData.pathologyTests.length})
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {adviceData.pathologyTests.map(
                                      (test, index) => (
                                        <span
                                          key={index}
                                          className="px-3 py-1 text-[11px] font-medium bg-white text-green-700 rounded-lg border border-green-100 shadow-sm"
                                        >
                                          {test}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Radiology Tests */}
                            {adviceData.adviceCategory === "Radiology" && (
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                                    Radiology Type
                                  </p>
                                  <p className="font-bold text-gray-800">
                                    {adviceData.radiologyType}
                                  </p>
                                </div>
                                {adviceData.radiologyTests?.length > 0 && (
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">
                                      Selected Tests (
                                      {adviceData.radiologyTests.length})
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {adviceData.radiologyTests.map(
                                        (test, index) => (
                                          <span
                                            key={index}
                                            className="px-3 py-1 text-[11px] font-medium bg-white text-sky-700 rounded-lg border border-sky-100 shadow-sm"
                                          >
                                            {test}
                                          </span>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Remarks */}
                            {adviceData.remarks && (
                              <div className="pt-2">
                                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                                  Additional Remarks
                                </p>
                                <div className="p-3 text-sm italic text-gray-700 bg-white border border-green-100 rounded-lg">
                                  "{adviceData.remarks}"
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

              {/* Submission Details */}
              <div className="mb-6">
                <h3 className="flex items-center gap-2 pb-2 mb-4 text-lg font-bold text-gray-800 border-b border-green-100">
                  <div className="w-1.5 h-6 bg-green-600 rounded-full"></div>
                  Submission Info
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border border-gray-100 rounded-lg bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                      Submitted At
                    </p>
                    <p className="text-xs font-semibold text-gray-600">
                      {new Date(selectedIndent.timestamp).toLocaleString(
                        "en-GB",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>
                  <div className="p-3 border border-gray-100 rounded-lg bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                      Current Status
                    </p>
                    <span
                      className={`text-xs font-bold uppercase tracking-widest ${
                        selectedIndent.status === "Approved"
                          ? "text-emerald-600"
                          : selectedIndent.status === "rejected"
                            ? "text-rose-600"
                            : "text-amber-600"
                      }`}
                    >
                      {selectedIndent.status || "pending"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-6 border-t border-gray-100">
                <button
                  onClick={() => {
                    setViewModal(false);
                    setSelectedIndent(null);
                  }}
                  className="w-full px-8 py-3 font-bold text-white transition-all bg-green-600 shadow-sm sm:w-auto hover:bg-green-700 rounded-xl hover:shadow-md active:scale-95"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PharmacyIndents;
