import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Edit,
  Search,
  BedDouble,
  Phone,
  Stethoscope,
  UserSquare,
  Building,
  Calendar,
  ChevronDown,
  ChevronUp,
  Bell,
} from "lucide-react";
import supabase from "../../../SupabaseClient";

const PatientAdmissionSystem = () => {
  const [showModal, setShowModal] = useState(false);
  const [patients, setPatients] = useState([]);
  const [ipdPatients, setIpdPatients] = useState([]);
  const [editingPatient, setEditingPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [admissionSearchTerm, setAdmissionSearchTerm] = useState("");
  const [showAdmissionDropdown, setShowAdmissionDropdown] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New state for notification popup
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState("success"); // 'success' or 'error'

  // State for dynamic dropdowns
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [filteredDoctorOptions, setFilteredDoctorOptions] = useState([]);
  const [filteredDepartmentOptions, setFilteredDepartmentOptions] = useState(
    [],
  );

  // Bed data states
  const [allBedData, setAllBedData] = useState([]); // All beds from DB

  // Dropdown visibility states
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);

  // Search terms for dropdowns
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");

  const [formData, setFormData] = useState({
    registrationNumber: "",
    patientName: "",
    fatherHusband: "",
    age: "",
    gender: "",
    dob: "",
    phoneNumber: "",
    mobileNumber: "",
    emailId: "",
    houseStreet: "",
    areaColony: "",
    landmark: "",
    state: "",
    city: "",
    pincode: "",
    country: "India",
    department: "",
    referByDr: "",
    consultantDr: "",
    patCategory: "",
    patientCase: "",
    medicalSurgical: "",
    healthCardNo: "",
    admissionPurpose: "",
    locationStatus: "",
    floor: "",
    ward: "",
    room: "",
    bedNo: "",
    bedLocation: "",
    wardType: "",
    bedTariff: "",
    kinName: "",
    kinRelation: "",
    kinMobile: "",
    advanceAmount: "",
    drVisitTariff: "",
    packageName: "",
    pkgAmount: "",
    expTariff: "",
    otherServices: "",
    vipDetails: "",
    religion: "",
    maritalStatus: "",
    attempt: "",
    remarks: "",
  });

  const [dropdownData] = useState({
    locationStatus: ["General Ward", "ICU", "Emergency", "Private Room"],
    patCategories: ["General", "Insurance", "Corporate", "VIP"],
    patientCases: ["Emergency", "Routine", "Follow-up", "Surgery"],
    otherServices: ["Ambulance", "Lab Tests", "X-Ray", "MRI", "CT Scan"],
    drVisitTariffs: ["Standard", "Premium", "VIP"],
  });

  const [showBedModal, setShowBedModal] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState(null);
  const [bedFilterTab, setBedFilterTab] = useState("All");

  // Refs for dropdowns
  const departmentDropdownRef = useRef(null);
  const doctorDropdownRef = useRef(null);
  const departmentInputRef = useRef(null);
  const doctorInputRef = useRef(null);

  // Auto-hide notification after 3 seconds
  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  const showNotificationPopup = (message, type = "success") => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close department dropdown
      if (
        departmentDropdownRef.current &&
        !departmentDropdownRef.current.contains(event.target) &&
        departmentInputRef.current &&
        !departmentInputRef.current.contains(event.target)
      ) {
        setShowDepartmentDropdown(false);
      }

      // Close doctor dropdown
      if (
        doctorDropdownRef.current &&
        !doctorDropdownRef.current.contains(event.target) &&
        doctorInputRef.current &&
        !doctorInputRef.current.contains(event.target)
      ) {
        setShowDoctorDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Load departments from master table
  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("master")
        .select("department")
        .not("department", "is", null)
        .order("department");

      if (error) {
        console.error("Error loading departments:", error);
        showNotificationPopup("Failed to load departments", "error");
        return [];
      }

      // Transform data and remove duplicates
      const options = data
        .map((item) => item.department)
        .filter(
          (value, index, self) =>
            value && value.trim() !== "" && self.indexOf(value) === index,
        );

      setDepartmentOptions(options);
      setFilteredDepartmentOptions(options);
      return options;
    } catch (error) {
      console.error("Error loading departments:", error);
      showNotificationPopup("Failed to load departments", "error");
      return [];
    }
  };

  // Load doctors from doctors table
  const loadDoctors = async (searchQuery = "") => {
    try {
      let query = supabase
        .from("doctors")
        .select("id, name")
        .not("name", "is", null)
        .order("name");

      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error loading doctors:", error);
        showNotificationPopup("Failed to load doctors", "error");
        return [];
      }

      // Transform data and remove duplicates
      const options = data
        .map((doctor) => doctor.name)
        .filter(
          (value, index, self) =>
            value && value.trim() !== "" && self.indexOf(value) === index,
        );

      setDoctorOptions(options);
      setFilteredDoctorOptions(options);
      return options;
    } catch (error) {
      console.error("Error loading doctors:", error);
      showNotificationPopup("Failed to load doctors", "error");
      return [];
    }
  };

  // Load all bed data from all_floor_bed table
  const loadBedData = async () => {
    try {
      const { data, error } = await supabase
        .from("all_floor_bed")
        .select("*")
        .order("floor", { ascending: true })
        .order("ward", { ascending: true })
        .order("room", { ascending: true })
        .order("bed", { ascending: true });

      if (error) {
        console.error("Error loading bed data:", error);
        showNotificationPopup("Failed to load bed data", "error");
        return;
      }

      if (data) {
        // Store all bed data
        setAllBedData(data);
      }
    } catch (error) {
      console.error("Failed to load bed data:", error);
      showNotificationPopup("Failed to load bed data", "error");
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Filter doctors based on search
  const filterDoctors = (searchTerm) => {
    setDoctorSearch(searchTerm);
    if (!searchTerm) {
      setFilteredDoctorOptions(doctorOptions);
    } else {
      const filtered = doctorOptions.filter((doctor) =>
        doctor.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      setFilteredDoctorOptions(filtered);
    }
  };

  // Filter departments based on search
  const filterDepartments = (searchTerm) => {
    setDepartmentSearch(searchTerm);
    if (!searchTerm) {
      setFilteredDepartmentOptions(departmentOptions);
    } else {
      const filtered = departmentOptions.filter((dept) =>
        dept.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      setFilteredDepartmentOptions(filtered);
    }
  };

  // Handle department selection
  const handleDepartmentSelect = (department) => {
    setFormData((prev) => ({ ...prev, department }));
    setDepartmentSearch("");
    setShowDepartmentDropdown(false);
  };

  // Handle doctor selection
  const handleDoctorSelect = (doctor) => {
    setFormData((prev) => ({ ...prev, consultantDr: doctor }));
    setDoctorSearch("");
    setShowDoctorDropdown(false);
  };

  // Clear department field
  const clearDepartment = () => {
    setFormData((prev) => ({ ...prev, department: "" }));
    setDepartmentSearch("");
    setShowDepartmentDropdown(true);
    setTimeout(() => {
      departmentInputRef.current?.focus();
    }, 0);
  };

  // Clear doctor field
  const clearDoctor = () => {
    setFormData((prev) => ({ ...prev, consultantDr: "" }));
    setDoctorSearch("");
    setShowDoctorDropdown(true);
    setTimeout(() => {
      doctorInputRef.current?.focus();
    }, 0);
  };

  // Toggle department dropdown
  const toggleDepartmentDropdown = () => {
    if (formData.department) {
      clearDepartment();
    } else {
      setShowDepartmentDropdown(!showDepartmentDropdown);
      if (!showDepartmentDropdown) {
        setTimeout(() => {
          departmentInputRef.current?.focus();
        }, 0);
      }
    }
  };

  // Toggle doctor dropdown
  const toggleDoctorDropdown = () => {
    if (formData.consultantDr) {
      clearDoctor();
    } else {
      setShowDoctorDropdown(!showDoctorDropdown);
      if (!showDoctorDropdown) {
        setTimeout(() => {
          doctorInputRef.current?.focus();
        }, 0);
      }
    }
  };

  // Load IPD patients and data from Supabase
  useEffect(() => {
    loadData();
    loadBedData();

    const setupRealtimeSubscription = () => {
      const channel = supabase
        .channel("ipd_admission_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ipd_admissions",
          },
          () => {
            loadData();
          },
        )
        .subscribe();

      // Listen to bed status changes so availability updates in real-time
      const bedChannel = supabase
        .channel("bed_status_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "all_floor_bed",
          },
          () => {
            loadBedData();
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(bedChannel);
      };
    };

    const cleanup = setupRealtimeSubscription();

    return () => {
      cleanup();
    };
  }, []);

  // Load dropdown data when modal opens
  useEffect(() => {
    if (showModal) {
      loadDepartments();
      loadDoctors();
    }
  }, [showModal]);

  // Load all data from Supabase
  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load IPD admission records
      const { data: ipdRecords, error: ipdError } = await supabase
        .from("ipd_admissions")
        .select("*")
        .order("timestamp", { ascending: false });

      if (ipdError) {
        console.error("Error loading IPD records:", ipdError);
        showNotificationPopup("Failed to load IPD records", "error");
      } else {
        setPatients(ipdRecords || []);
      }

      // Load patients eligible for IPD admission (department='IPD' and status='assigned')
      const { data: patientAdmissionData, error: patientError } = await supabase
        .from("patient_admission")
        .select("*")
        .eq("department", "IPD")
        .eq("status", "assigned")
        .is("actual2", null)
        .not("planned2", "is", null)
        .order("timestamp", { ascending: false });

      if (patientError) {
        console.error("Error loading patient admission data:", patientError);
        showNotificationPopup("Failed to load patient data", "error");
      } else {
        if (ipdRecords && patientAdmissionData) {
          const admittedAdmissionNumbers = ipdRecords.map(
            (p) => p.admission_no,
          );
          const eligiblePatients = patientAdmissionData.filter(
            (p) => !admittedAdmissionNumbers.includes(p.admission_no),
          );
          setIpdPatients(eligiblePatients);
        } else if (patientAdmissionData) {
          setIpdPatients(patientAdmissionData);
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      showNotificationPopup("Failed to load data", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate IPD number based on latest record
  const generateIpdNumber = async () => {
    try {
      const { data, error } = await supabase
        .from("ipd_admissions")
        .select("ipd_number")
        .order("timestamp", { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching IPD number:", error);
        return "IPD-001";
      }

      if (data && data.length > 0) {
        const lastIpdNo = data[0].ipd_number;
        if (lastIpdNo && lastIpdNo.startsWith("IPD-")) {
          const lastNumber = parseInt(lastIpdNo.replace("IPD-", ""), 10);
          if (!isNaN(lastNumber)) {
            return `IPD-${String(lastNumber + 1).padStart(3, "0")}`;
          }
        }
      }

      return "IPD-001";
    } catch (error) {
      console.error("Error generating IPD number:", error);
      return "IPD-001";
    }
  };

  const handleRegistrationChange = (admissionNo) => {
    setFormData((prev) => ({ ...prev, registrationNumber: admissionNo }));
    setAdmissionSearchTerm(admissionNo);
    setShowAdmissionDropdown(false);

    if (admissionNo) {
      const selectedPatient = ipdPatients.find(
        (p) => p.admission_no === admissionNo,
      );
      if (selectedPatient) {
        setFormData((prev) => ({
          ...prev,
          patientName: selectedPatient.patient_name || "",
          phoneNumber: selectedPatient.phone_no || "",
          mobileNumber: selectedPatient.whatsapp_no || "",
          fatherHusband: selectedPatient.father_husband_name || "",
          age: selectedPatient.age || "",
          gender: selectedPatient.gender || "",
          dob: selectedPatient.date_of_birth || "",
          admissionPurpose: selectedPatient.reason_for_visit || "",
        }));
      }
    }
  };

  // Handle form submission to Supabase
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsSaving(true);

      const ipdNumber = editingPatient
        ? editingPatient.ipd_number
        : await generateIpdNumber();

      const patientData = {
        ipd_number: ipdNumber,
        admission_no: formData.registrationNumber,
        patient_name: formData.patientName.trim(),
        father_husband_name: formData.fatherHusband.trim(),
        age: formData.age,
        gender: formData.gender,
        date_of_birth: formData.dob,
        phone_no: formData.phoneNumber.trim(),
        whatsapp_no: formData.mobileNumber.trim(),
        email_id: formData.emailId.trim(),
        house_no_street: formData.houseStreet.trim(),
        area_colony: formData.areaColony.trim(),
        landmark: formData.landmark.trim(),
        state: formData.state.trim(),
        city: formData.city.trim(),
        pincode: formData.pincode,
        country: formData.country,
        department: formData.department,
        refer_by_dr: formData.referByDr.trim(),
        consultant_dr: formData.consultantDr,
        pat_category: formData.patCategory,
        patient_case: formData.patientCase,
        medical_surgical: formData.medicalSurgical,
        health_card_no: formData.healthCardNo.trim(),
        adm_purpose: formData.admissionPurpose.trim(),
        location_status: formData.locationStatus,
        floor: formData.floor,
        // ward: formData.ward,  // This should match ward_type
        room: formData.room,
        bed_no: formData.bedNo,
        bed_location: formData.bedLocation,
        ward_type: formData.wardType, // This is the ward_type field
        bed_tariff: formData.bedTariff,
        kin_name: formData.kinName.trim(),
        kin_relation: formData.kinRelation.trim(),
        kin_mobile_no: formData.kinMobile.trim(),
        advance_amount: formData.advanceAmount,
        dr_visit_tariff: formData.drVisitTariff,
        package_name: formData.packageName.trim(),
        pkg_amount: formData.pkgAmount,
        exp_tariff: formData.expTariff.trim(),
        other_services: formData.otherServices,
        vip_details: formData.vipDetails.trim(),
        religion: formData.religion,
        marital_status: formData.maritalStatus,
        attempt: formData.attempt,
        remarks: formData.remarks.trim(),
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
        status: "active",
      };

      let result;

      // FIRST: Save to ipd_admissions
      if (editingPatient) {
        const { data, error } = await supabase
          .from("ipd_admissions")
          .update(patientData)
          .eq("id", editingPatient.id)
          .select();

        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from("ipd_admissions")
          .insert(patientData)
          .select();

        if (error) throw error;
        result = data;
      }

      if (result && result.length > 0) {
        // Mark the current bed as Occupied
        await supabase
          .from("all_floor_bed")
          .update({ status: "Occupied" })
          .eq("floor", patientData.floor)
          .eq("ward", patientData.ward_type)
          .eq("room", patientData.room)
          .eq("bed", patientData.bed_no);

        // Update patient_admission table for new admissions
        if (!editingPatient && result && result.length > 0) {
          await supabase
            .from("patient_admission")
            .update({
              actual2: new Date()
                .toLocaleString("en-CA", {
                  timeZone: "Asia/Kolkata",
                  hour12: false,
                })
                .replace(",", ""),
            })
            .eq("admission_no", formData.registrationNumber);
        }

        // Show success notification
        showNotificationPopup(
          `Patient ${editingPatient ? "updated" : "admitted"} successfully! IPD Number: ${patientData.ipd_number}`,
          "success",
        );

        await loadData();
        handleReset();
        setShowModal(false);
        setEditingPatient(null);
        setSelectedBedId(null);
      }
    } catch (error) {
      console.error("Error saving patient:", error);
      showNotificationPopup(
        `Failed to ${editingPatient ? "update" : "admit"} patient: ${error.message}`,
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setAdmissionSearchTerm("");
    setShowAdmissionDropdown(false);
    setFormData({
      registrationNumber: "",
      patientName: "",
      fatherHusband: "",
      age: "",
      gender: "",
      dob: "",
      phoneNumber: "",
      mobileNumber: "",
      emailId: "",
      houseStreet: "",
      areaColony: "",
      landmark: "",
      state: "",
      city: "",
      pincode: "",
      country: "India",
      department: "",
      referByDr: "",
      consultantDr: "",
      patCategory: "",
      patientCase: "",
      medicalSurgical: "",
      healthCardNo: "",
      admissionPurpose: "",
      locationStatus: "",
      floor: "",
      ward: "",
      room: "",
      bedNo: "",
      bedLocation: "",
      wardType: "",
      bedTariff: "",
      kinName: "",
      kinRelation: "",
      kinMobile: "",
      advanceAmount: "",
      drVisitTariff: "",
      packageName: "",
      pkgAmount: "",
      expTariff: "",
      otherServices: "",
      vipDetails: "",
      religion: "",
      maritalStatus: "",
      attempt: "",
      remarks: "",
    });
    setDepartmentSearch("");
    setDoctorSearch("");
    setShowDepartmentDropdown(false);
    setShowDoctorDropdown(false);
    setSelectedBedId(null);
  };

  const handleEdit = (patient) => {
    setEditingPatient(patient);
    setAdmissionSearchTerm(patient.admission_no || "");
    setFormData({
      registrationNumber: patient.admission_no || "",
      patientName: patient.patient_name || "",
      fatherHusband: patient.father_husband_name || "",
      age: patient.age || "",
      gender: patient.gender || "",
      dob: patient.date_of_birth || "",
      phoneNumber: patient.phone_no || "",
      mobileNumber: patient.whatsapp_no || "",
      emailId: patient.email_id || "",
      houseStreet: patient.house_no_street || "",
      areaColony: patient.area_colony || "",
      landmark: patient.landmark || "",
      state: patient.state || "",
      city: patient.city || "",
      pincode: patient.pincode || "",
      country: patient.country || "India",
      department: patient.department || "",
      referByDr: patient.refer_by_dr || "",
      consultantDr: patient.consultant_dr || "",
      patCategory: patient.pat_category || "",
      patientCase: patient.patient_case || "",
      medicalSurgical: patient.medical_surgical || "",
      healthCardNo: patient.health_card_no || "",
      admissionPurpose: patient.adm_purpose || "",
      locationStatus: patient.location_status || "",
      floor: patient.floor || "",
      ward: patient.ward || "",
      room: patient.room || "",
      bedNo: patient.bed_no || "",
      bedLocation: patient.bed_location || "",
      wardType: patient.ward_type || "",
      bedTariff: patient.bed_tariff || "",
      kinName: patient.kin_name || "",
      kinRelation: patient.kin_relation || "",
      kinMobile: patient.kin_mobile_no || "",
      advanceAmount: patient.advance_amount || "",
      drVisitTariff: patient.dr_visit_tariff || "",
      packageName: patient.package_name || "",
      pkgAmount: patient.pkg_amount || "",
      expTariff: patient.exp_tariff || "",
      otherServices: patient.other_services || "",
      vipDetails: patient.vip_details || "",
      religion: patient.religion || "",
      maritalStatus: patient.marital_status || "",
      attempt: patient.attempt || "",
      remarks: patient.remarks || "",
    });
    setShowModal(true);
  };

  // Select bed and auto-populate all related fields
  const selectBed = (bed) => {
    if (bed.status === null) {
      setFormData((prev) => ({
        ...prev,
        bedNo: bed.bed,
        floor: bed.floor,
        ward: bed.ward,
        room: bed.room,
        bedLocation: `${bed.floor} - ${bed.ward}`,
        wardType: bed.ward,
        locationStatus: bed.ward,
      }));
      setSelectedBedId(bed.id);
      setShowBedModal(false);
    }
  };

  // Filter patients for table display
  const filteredPatients = patients.filter(
    (patient) =>
      patient.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.admission_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.ipd_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.phone_no?.includes(searchTerm) ||
      patient.whatsapp_no?.includes(searchTerm),
  );

  const NoDataComponent = () => (
    <div className="px-4 py-8 text-center text-gray-500">
      {isLoading
        ? "Loading IPD patient records..."
        : 'No IPD patient records found. Click "Patient Admission" to create one.'}
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-gray-50 p-2 md:p-6">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-xl">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-700">Loading data...</p>
            </div>
          </div>
        )}

        {/* Notification Popup */}
        {showNotification && (
          <div
            className={`fixed top-4 right-4 z-50 max-w-md animate-slide-in ${
              notificationType === "success"
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            } border rounded-lg shadow-lg`}
          >
            <div className="p-4">
              <div className="flex items-start">
                <div
                  className={`flex-shrink-0 p-1 rounded-full ${
                    notificationType === "success"
                      ? "bg-green-100 text-green-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  <Bell className="w-5 h-5" />
                </div>
                <div className="ml-3">
                  <p
                    className={`text-sm font-medium ${
                      notificationType === "success"
                        ? "text-green-800"
                        : "text-red-800"
                    }`}
                  >
                    {notificationMessage}
                  </p>
                </div>
                <button
                  onClick={() => setShowNotification(false)}
                  className={`ml-4 flex-shrink-0 ${
                    notificationType === "success"
                      ? "text-green-400 hover:text-green-600"
                      : "text-red-400 hover:text-red-600"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Progress bar */}
            <div
              className={`h-1 w-full ${
                notificationType === "success" ? "bg-green-200" : "bg-red-200"
              }`}
            >
              <div
                className={`h-full ${
                  notificationType === "success" ? "bg-green-500" : "bg-red-500"
                } animate-progress`}
              ></div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                IPD Patient Admission
              </h1>
              <button
                onClick={() => {
                  setEditingPatient(null);
                  handleReset();
                  setShowModal(true);
                }}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all shadow-md hover:shadow-lg whitespace-nowrap w-full md:w-auto disabled:bg-gray-400"
              >
                <Plus className="w-5 h-5" />
                Patient Admission
              </button>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search by name, phone, admission no..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
                <div className="relative w-full md:w-64">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Patient Table Container */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Desktop Table View with Fixed Header */}
            <div className="hidden md:block overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 whitespace-nowrap ">
                    <tr>
                      <th className="px-4 py-3  text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-4 py-3  text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        IPD Number
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Admission No
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Patient Name
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                        Phone Number
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                        Father/Husband
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                        WhatsApp No
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                        Admission Purpose
                      </th>
                      <th className="px-10 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                        Date of Birth
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                        Age
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                        Gender
                      </th>
                      <th className="px-12 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                        Bed No
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {isLoading ? (
                      <tr>
                        <td colSpan="12" className="px-6 py-8 text-center">
                          <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-4"></div>
                            <p className="text-gray-700">Loading patients...</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredPatients.length === 0 ? (
                      <tr>
                        <td colSpan="12">
                          <NoDataComponent />
                        </td>
                      </tr>
                    ) : (
                      filteredPatients.map((patient) => (
                        <tr
                          key={patient.id}
                          className="hover:bg-gray-50 transition-colors border-b border-gray-100"
                        >
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleEdit(patient)}
                              disabled={isLoading}
                              className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {patient.planned1
                              ? new Date(patient.planned1).toLocaleString(
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
                          <td className="px-4 py-3 text-sm font-semibold text-green-600">
                            {patient.ipd_number}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                            {patient.admission_no}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {patient.patient_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 hidden md:table-cell">
                            {patient.phone_no || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 hidden lg:table-cell">
                            {patient.father_husband_name || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 hidden lg:table-cell">
                            {patient.whatsapp_no || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 hidden lg:table-cell">
                            {patient.adm_purpose || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 hidden md:table-cell">
                            {patient.date_of_birth || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 hidden lg:table-cell">
                            {patient.age || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 hidden lg:table-cell">
                            {patient.gender || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-600 hidden lg:table-cell">
                            {patient.bed_no || "Not Assigned"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden p-4 space-y-4 bg-green-50">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-700">Loading patients...</p>
                </div>
              ) : filteredPatients.length === 0 ? (
                <NoDataComponent />
              ) : (
                filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="bg-white rounded-xl shadow-lg border border-gray-200/80 overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="p-4 bg-white border-b border-gray-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold text-green-700">
                            {patient.patient_name}
                          </h3>
                          <p className="text-sm font-semibold text-purple-600">
                            {patient.ipd_number}
                          </p>
                          <p className="text-sm text-gray-600">
                            Adm No: {patient.admission_no}
                          </p>
                          <p className="text-sm font-semibold text-green-600 mt-1">
                            Bed: {patient.bed_no || "Not Assigned"}
                          </p>
                        </div>
                        <button
                          onClick={() => handleEdit(patient)}
                          disabled={isLoading}
                          className="flex-shrink-0 flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      </div>
                    </div>

                    {/* Location Info */}
                    <div className="p-4 bg-white">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 bg-green-100 text-green-700 p-2.5 rounded-full">
                          <BedDouble className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">
                            Location
                          </span>
                          <p className="text-base font-semibold text-green-700">
                            {patient.bed_no || "Not Assigned"}
                          </p>
                          <p className="text-sm text-gray-700">
                            {patient.floor} - {patient.ward} / {patient.room}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Other Details */}
                    <div className="p-4 border-t border-gray-200 bg-green-50/80">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                        <div className="flex items-start gap-2">
                          <UserSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-xs font-medium text-gray-500">
                              Admission No.
                            </span>
                            <p className="text-sm font-semibold text-green-600">
                              {patient.admission_no}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-xs font-medium text-gray-500">
                              Mobile
                            </span>
                            <p className="text-sm font-semibold text-gray-800">
                              {patient.whatsapp_no || "-"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Stethoscope className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-xs font-medium text-gray-500">
                              Consultant
                            </span>
                            <p className="text-sm font-semibold text-gray-800">
                              {patient.consultant_dr || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Building className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-xs font-medium text-gray-500">
                              Department
                            </span>
                            <p className="text-sm font-semibold text-gray-800">
                              {patient.department}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Patient Admission Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-full md:max-h-[90vh] overflow-y-auto my-4 md:my-8">
                {/* Modal Header */}
                <div className="bg-green-700 text-white p-4 md:p-6 sticky top-0 z-10 rounded-t-xl">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold">
                        {editingPatient
                          ? "Edit IPD Patient"
                          : "IPD Patient Admission"}
                      </h2>
                      <p className="text-green-100 text-sm mt-1">
                        {editingPatient
                          ? "Update IPD patient information"
                          : "Register IPD patients from department selection"}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setEditingPatient(null);
                        handleReset();
                      }}
                      disabled={isSaving}
                      className="text-white hover:text-gray-300 transition-colors disabled:opacity-50"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="p-4 md:p-8">
                  {/* Registration & Basic Info */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-green-200">
                      Registration & Basic Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Admission No. (From IPD)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            name="registrationNumber"
                            autoComplete="off"
                            value={
                              editingPatient
                                ? formData.registrationNumber
                                : admissionSearchTerm
                            }
                            onChange={(e) => {
                              if (!editingPatient) {
                                setAdmissionSearchTerm(e.target.value);
                                setShowAdmissionDropdown(true);
                              }
                            }}
                            onFocus={() =>
                              !editingPatient && setShowAdmissionDropdown(true)
                            }
                            placeholder="Search admission number or patient name..."
                            disabled={editingPatient !== null || isSaving}
                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                          />
                          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        </div>
                        {showAdmissionDropdown &&
                          !editingPatient &&
                          ipdPatients.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {ipdPatients
                                .filter((patient) => {
                                  const searchLower =
                                    admissionSearchTerm.toLowerCase();
                                  return (
                                    patient.admission_no
                                      .toLowerCase()
                                      .includes(searchLower) ||
                                    patient.patient_name
                                      .toLowerCase()
                                      .includes(searchLower)
                                  );
                                })
                                .map((patient) => (
                                  <div
                                    key={patient.id}
                                    onClick={() =>
                                      handleRegistrationChange(
                                        patient.admission_no,
                                      )
                                    }
                                    className="px-3 py-2 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                  >
                                    <div className="font-semibold text-green-600">
                                      {patient.admission_no}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {patient.patient_name}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        <p className="text-xs text-gray-500 mt-1">
                          {editingPatient
                            ? "Admission number cannot be changed for existing IPD records"
                            : ipdPatients.length === 0
                              ? "No available IPD patients. All patients have been admitted."
                              : "Type to search and select from available IPD patients"}
                        </p>
                      </div>

                      {editingPatient && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            IPD Number
                          </label>
                          <input
                            type="text"
                            value={editingPatient.ipd_number}
                            disabled
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 font-bold"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Patient Name
                        </label>
                        <input
                          type="text"
                          name="patientName"
                          value={formData.patientName}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Father / Husband Name
                        </label>
                        <input
                          type="text"
                          name="fatherHusband"
                          value={formData.fatherHusband}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Age
                        </label>
                        <input
                          type="number"
                          name="age"
                          value={formData.age}
                          onChange={handleInputChange}
                          min="0"
                          max="150"
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Gender
                        </label>
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          DOB
                        </label>
                        <input
                          type="date"
                          name="dob"
                          value={formData.dob}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-green-200">
                      Contact Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone No.
                        </label>
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mobile No.
                        </label>
                        <input
                          type="tel"
                          name="mobileNumber"
                          value={formData.mobileNumber}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email ID
                        </label>
                        <input
                          type="email"
                          name="emailId"
                          value={formData.emailId}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address Information */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-green-200">
                      Address Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          House No. Street
                        </label>
                        <input
                          type="text"
                          name="houseStreet"
                          value={formData.houseStreet}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Area / Colony
                        </label>
                        <input
                          type="text"
                          name="areaColony"
                          value={formData.areaColony}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Landmark
                        </label>
                        <input
                          type="text"
                          name="landmark"
                          value={formData.landmark}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          State
                        </label>
                        <input
                          type="text"
                          name="state"
                          value={formData.state}
                          onChange={handleInputChange}
                          placeholder="Enter state"
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          placeholder="Enter city"
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Pincode
                        </label>
                        <input
                          type="text"
                          name="pincode"
                          value={formData.pincode}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Country
                        </label>
                        <input
                          type="text"
                          name="country"
                          value={formData.country}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Medical Information */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-green-200">
                      Medical Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {/* Department Dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Department
                        </label>
                        <div className="relative" ref={departmentDropdownRef}>
                          <div className="flex items-center">
                            <input
                              ref={departmentInputRef}
                              type="text"
                              value={departmentSearch || formData.department}
                              onChange={(e) => {
                                const value = e.target.value;
                                setDepartmentSearch(value);
                                filterDepartments(value);
                                if (!showDepartmentDropdown) {
                                  setShowDepartmentDropdown(true);
                                }
                              }}
                              onFocus={() => {
                                if (!showDepartmentDropdown) {
                                  setShowDepartmentDropdown(true);
                                }
                              }}
                              placeholder="Search or select department..."
                              disabled={isSaving}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                            />
                            <button
                              type="button"
                              onClick={toggleDepartmentDropdown}
                              disabled={isSaving}
                              className="absolute right-2 p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            >
                              {formData.department ? (
                                <X className="w-4 h-4" />
                              ) : showDepartmentDropdown ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          {showDepartmentDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {filteredDepartmentOptions.length === 0 ? (
                                <div className="px-3 py-2 text-gray-500 text-sm">
                                  No departments found
                                </div>
                              ) : (
                                filteredDepartmentOptions.map((dept, index) => (
                                  <div
                                    key={index}
                                    onClick={() => handleDepartmentSelect(dept)}
                                    className="px-3 py-2 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                  >
                                    <div className="font-medium text-gray-800">
                                      {dept}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Refer By Dr.
                        </label>
                        <input
                          type="text"
                          name="referByDr"
                          value={formData.referByDr}
                          onChange={handleInputChange}
                          placeholder="Enter referring doctor name"
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      {/* Consultant Doctor Dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Consultant Dr.
                        </label>
                        <div className="relative" ref={doctorDropdownRef}>
                          <div className="flex items-center">
                            <input
                              ref={doctorInputRef}
                              type="text"
                              value={doctorSearch || formData.consultantDr}
                              onChange={(e) => {
                                const value = e.target.value;
                                setDoctorSearch(value);
                                filterDoctors(value);
                                if (!showDoctorDropdown) {
                                  setShowDoctorDropdown(true);
                                }
                              }}
                              onFocus={() => {
                                if (!showDoctorDropdown) {
                                  setShowDoctorDropdown(true);
                                }
                              }}
                              placeholder="Search or select doctor..."
                              disabled={isSaving}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                            />
                            <button
                              type="button"
                              onClick={toggleDoctorDropdown}
                              disabled={isSaving}
                              className="absolute right-2 p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            >
                              {formData.consultantDr ? (
                                <X className="w-4 h-4" />
                              ) : showDoctorDropdown ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          {showDoctorDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {filteredDoctorOptions.length === 0 ? (
                                <div className="px-3 py-2 text-gray-500 text-sm">
                                  {doctorSearch
                                    ? "No doctors found"
                                    : "Type to search doctors"}
                                </div>
                              ) : (
                                filteredDoctorOptions.map((doctor, index) => (
                                  <div
                                    key={index}
                                    onClick={() => handleDoctorSelect(doctor)}
                                    className="px-3 py-2 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                  >
                                    <div className="font-medium text-gray-800">
                                      {doctor}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Pat. Category
                        </label>
                        <select
                          name="patCategory"
                          value={formData.patCategory}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        >
                          <option value="">Select Category</option>
                          {dropdownData.patCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Patient Case
                        </label>
                        <select
                          name="patientCase"
                          value={formData.patientCase}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        >
                          <option value="">Select Case</option>
                          {dropdownData.patientCases.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Medical / Surgical
                        </label>
                        <select
                          name="medicalSurgical"
                          value={formData.medicalSurgical}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        >
                          <option value="">Select Type</option>
                          <option value="Medical">Medical</option>
                          <option value="Surgical">Surgical</option>
                          <option value="Non-Surgical">Non-Surgical</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Health Card No.
                        </label>
                        <input
                          type="text"
                          name="healthCardNo"
                          value={formData.healthCardNo}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Adm. Purpose
                        </label>
                        <input
                          type="text"
                          name="admissionPurpose"
                          value={formData.admissionPurpose}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Location & Bed Details */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-green-200">
                      Location & Bed Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Floor
                        </label>
                        <input
                          type="text"
                          name="floor"
                          value={formData.floor}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ward
                        </label>
                        <input
                          type="text"
                          name="ward"
                          value={formData.ward}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Room
                        </label>
                        <input
                          type="text"
                          name="room"
                          value={formData.room}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bed No.
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            name="bedNo"
                            value={formData.bedNo}
                            onChange={handleInputChange}
                            disabled={isSaving}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                            readOnly
                            placeholder="Select bed from bed selector"
                          />
                          <button
                            type="button"
                            onClick={() => setShowBedModal(true)}
                            disabled={isSaving}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:bg-gray-400"
                          >
                            Select Bed
                          </button>
                        </div>
                        {formData.bedNo && (
                          <p className="text-xs text-green-600 mt-1">
                            Selected: {formData.bedNo}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bed Location
                        </label>
                        <input
                          type="text"
                          name="bedLocation"
                          value={formData.bedLocation}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ward Type
                        </label>
                        <input
                          type="text"
                          name="wardType"
                          value={formData.wardType}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bed Tariff
                        </label>
                        <select
                          name="bedTariff"
                          value={formData.bedTariff}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        >
                          <option value="">Select Tariff</option>
                          <option value="Standard">Standard</option>
                          <option value="Premium">Premium</option>
                          <option value="VIP">VIP</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Kin Information */}
                  {/* <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-green-200">
                      Kin Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kin's Name
                        </label>
                        <input
                          type="text"
                          name="kinName"
                          value={formData.kinName}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kin's Relation
                        </label>
                        <input
                          type="text"
                          name="kinRelation"
                          value={formData.kinRelation}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kin's Mobile No.
                        </label>
                        <input
                          type="tel"
                          name="kinMobile"
                          value={formData.kinMobile}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div> */}

                  {/* Financial Information */}
                  {/* <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-green-200">
                      Financial Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Advance Amount
                        </label>
                        <input
                          type="number"
                          name="advanceAmount"
                          value={formData.advanceAmount}
                          onChange={handleInputChange}
                          step="0.01"
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Dr. Visit Tariff
                        </label>
                        <select
                          name="drVisitTariff"
                          value={formData.drVisitTariff}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        >
                          <option value="">Select Tariff</option>
                          {dropdownData.drVisitTariffs.map((tariff) => (
                            <option key={tariff} value={tariff}>
                              {tariff}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Package Name
                        </label>
                        <input
                          type="text"
                          name="packageName"
                          value={formData.packageName}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Pkg Amount
                        </label>
                        <input
                          type="number"
                          name="pkgAmount"
                          value={formData.pkgAmount}
                          onChange={handleInputChange}
                          step="0.01"
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Exp. Tariff
                        </label>
                        <input
                          type="text"
                          name="expTariff"
                          value={formData.expTariff}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div> */}

                  {/* Additional Information */}
                  {/* <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-green-200">
                      Additional Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Other Services
                        </label>
                        <select
                          name="otherServices"
                          value={formData.otherServices}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        >
                          <option value="">Select Service</option>
                          {dropdownData.otherServices.map((service) => (
                            <option key={service} value={service}>
                              {service}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          VIP Details
                        </label>
                        <input
                          type="text"
                          name="vipDetails"
                          value={formData.vipDetails}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Religion
                        </label>
                        <input
                          type="text"
                          name="religion"
                          value={formData.religion}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Marital Status
                        </label>
                        <select
                          name="maritalStatus"
                          value={formData.maritalStatus}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        >
                          <option value="">Select Status</option>
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Divorced">Divorced</option>
                          <option value="Widowed">Widowed</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Attempt
                        </label>
                        <input
                          type="number"
                          name="attempt"
                          value={formData.attempt}
                          onChange={handleInputChange}
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                        />
                      </div>

                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Remarks
                        </label>
                        <textarea
                          name="remarks"
                          value={formData.remarks}
                          onChange={handleInputChange}
                          rows="3"
                          placeholder="Enter any additional remarks..."
                          disabled={isSaving}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div> */}

                  {/* Form Buttons */}
                  <div className="flex flex-col md:flex-row flex-wrap gap-3 justify-center pt-6 border-t border-gray-200">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-medium shadow-sm hover:shadow-md w-full md:w-auto flex items-center justify-center gap-2 disabled:bg-gray-400"
                    >
                      {isSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          {editingPatient ? "Updating..." : "Saving..."}
                        </>
                      ) : editingPatient ? (
                        "Update"
                      ) : (
                        "Save"
                      )}
                    </button>
                    <button
                      type="reset"
                      onClick={handleReset}
                      disabled={isSaving}
                      className="px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all font-medium shadow-sm hover:shadow-md w-full md:w-auto disabled:bg-gray-400"
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Bed Selection Modal - Shows ALL beds */}
          {showBedModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-start md:items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-full md:max-h-[90vh] overflow-hidden flex flex-col">
                <div className="bg-gray-50 p-4 md:px-6 md:py-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-lg md:text-xl font-semibold text-gray-800">
                    Select Available Bed
                  </h2>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded"></div>
                      <span className="text-sm text-gray-600">Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span className="text-sm text-gray-600">Occupied</span>
                    </div>
                    <button
                      onClick={() => setShowBedModal(false)}
                      disabled={isSaving}
                      className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                <div className="p-4 md:p-6 overflow-y-auto flex-1">
                  {/* Bed Filtering Tabs */}
                  <div className="flex flex-wrap gap-3 mb-8 p-3 bg-blue-50/50 rounded-xl border border-blue-100 items-center">
                    {[
                      "All",
                      "Male General Ward",
                      "Female General Ward",
                      "ICU",
                      "Private Ward",
                      "PICU",
                      "NICU",
                      "HDU",
                    ].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setBedFilterTab(tab)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 transform active:scale-95 ${
                          bedFilterTab === tab
                            ? "bg-green-600 text-white shadow-lg shadow-green-200"
                            : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 shadow-sm"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Filter Section */}
                  {/* <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Available Beds: {allBedData.filter(bed => bed.status === null).length} / {allBedData.length}
                        </label>
                        <p className="text-sm text-gray-600">
                          Select an available bed (green) to assign to this patient
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Selection:
                        </label>
                        <div className="text-sm">
                          {formData.bedNo ? (
                            <>
                              <p><span className="font-semibold">Bed:</span> {formData.bedNo}</p>
                              <p><span className="font-semibold">Location:</span> {formData.floor} / {formData.ward} / {formData.room}</p>
                            </>
                          ) : (
                            <p className="text-gray-500">No bed selected</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              bedNo: '',
                              floor: '',
                              ward: '',
                              room: '',
                              bedLocation: '',
                              wardType: ''
                            }));
                            setSelectedBedId(null);
                          }}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                        >
                          Clear Bed Selection
                        </button>
                      </div>
                    </div>
                  </div> */}

                  {/* Beds Grid - Show ALL beds */}
                  {allBedData.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500 mb-4">
                        No beds found in the database
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowBedModal(false)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Go Back
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {allBedData
                        .filter(
                          (bed) =>
                            bedFilterTab === "All" || bed.ward === bedFilterTab,
                        )
                        .map((bed) => (
                          <div
                            key={bed.id}
                            onClick={() =>
                              bed.status === null && selectBed(bed)
                            }
                            className={`p-4 rounded-lg border-2 transition-all ${
                              bed.status === null
                                ? selectedBedId === bed.id
                                  ? "border-green-600 bg-green-50 shadow-lg transform scale-105"
                                  : "border-green-500 bg-green-50 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
                                : "border-red-500 bg-red-50 opacity-70 cursor-not-allowed"
                            } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div className="font-semibold text-gray-900 mb-1 flex items-center justify-between">
                              <span>{bed.bed}</span>
                              {bed.status === null ? (
                                <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-1 rounded">
                                  Available
                                </span>
                              ) : (
                                <span className="text-xs font-medium bg-red-100 text-red-800 px-2 py-1 rounded">
                                  Occupied
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              <div className="flex items-center gap-1 mb-1">
                                <span className="font-medium">Floor:</span>
                                <span>{bed.floor}</span>
                              </div>
                              <div className="flex items-center gap-1 mb-1">
                                <span className="font-medium">Ward:</span>
                                <span>{bed.ward}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Room:</span>
                                <span>{bed.room}</span>
                              </div>
                            </div>
                            {bed.status === null && (
                              <div className="text-xs text-green-600 font-medium mt-2">
                                Click to select this bed
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Bed Selection Footer */}
                <div className="bg-gray-50 p-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <div>
                      {selectedBedId ? (
                        <p className="text-sm text-green-600 font-medium">
                          Bed selected:{" "}
                          <span className="font-bold">{formData.bedNo}</span>
                        </p>
                      ) : (
                        <p className="text-sm text-gray-600">
                          Click on an available bed (green) to select it
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowBedModal(false)}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                      {selectedBedId && (
                        <button
                          type="button"
                          onClick={() => setShowBedModal(false)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                          Confirm Selection
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <style>{`
          @keyframes slide-in {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          @keyframes progress {
            from {
              width: 100%;
            }
            to {
              width: 0%;
            }
          }
          
          .animate-slide-in {
            animation: slide-in 0.3s ease-out;
          }
          
          .animate-progress {
            animation: progress 3s linear forwards;
          }
        `}</style>
        </div>
      </div>
    </>
  );
};

export default PatientAdmissionSystem;
