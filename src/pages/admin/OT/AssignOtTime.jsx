import React, { useState, useEffect } from "react";
import {
  Search,
  CheckCircle,
  Calendar,
  Clock,
  User,
  MapPin,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import supabase from "../../../SupabaseClient";
import { useNotification } from "../../../contexts/NotificationContext";
import { sendOTNotification } from "../../../utils/whatsappService";

const AssignOtTime = () => {
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [rmoList, setRmoList] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [ipdSearchTerm, setIpdSearchTerm] = useState("");
  const [showIpdDropdown, setShowIpdDropdown] = useState(false);
  const [availableIpdPatients, setAvailableIpdPatients] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedPatientDetails, setSelectedPatientDetails] = useState(null);
  const { showNotification } = useNotification();

  // New state for process modal
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [selectedOtRecord, setSelectedOtRecord] = useState(null);
  const [processForm, setProcessForm] = useState({
    status: "",
    remark: "",
  });

  // New state for update OT date modal
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedUpdateRecord, setSelectedUpdateRecord] = useState(null);
  const [updateForm, setUpdateForm] = useState({
    ot_date: "",
    ot_time: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const [formData, setFormData] = useState({
    ipd_number: "",
    ot_date: "",
    ot_time: "",
    ot_description: "",
    doctor: "",
    rmo: "",
  });

  // Fetch functions remain the same...
  const fetchPendingData = async () => {
    const { data, error } = await supabase
      .from("ot_information")
      .select("*")
      .not("planned2", "is", null)
      .is("actual2", null)
      .order("planned2", { ascending: true });

    if (error) {
      console.error("Error fetching pending data:", error);
    } else {
      const formattedData = (data || []).map((item) => ({
        ...item,
        planned2Formatted: item.planned2
          ? `${new Date(item.planned2).toLocaleDateString("en-GB")} ${new Date(item.planned2).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`
          : "N/A",
      }));
      setPendingData(formattedData);
    }
  };

  const fetchHistoryData = async () => {
    const { data, error } = await supabase
      .from("ot_information")
      .select("*")
      .not("planned2", "is", null)
      .not("actual2", "is", null)
      .order("actual2", { ascending: false });

    if (error) {
      console.error("Error fetching history data:", error);
    } else {
      const formattedData = (data || []).map((item) => ({
        ...item,
        planned2Formatted: item.planned2
          ? `${new Date(item.planned2).toLocaleDateString("en-GB")} ${new Date(item.planned2).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`
          : "N/A",
        actual2Formatted: item.actual2
          ? `${new Date(item.actual2).toLocaleDateString("en-GB")} ${new Date(item.actual2).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`
          : "N/A",
      }));
      setHistoryData(formattedData);
    }
  };

  const fetchRmoList = async () => {
    const { data, error } = await supabase
      .from("all_staff")
      .select("name")
      .in("designation", ["rmo", "RMO", "Rmo"])
      .order("name");

    console.log(data);

    if (error) {
      console.error("Error fetching RMO list:", error);
    } else {
      setRmoList(data.map((item) => item.name));
    }
  };

  const fetchAvailableIpdPatients = async () => {
    const { data, error } = await supabase
      .from("ot_information")
      .select(
        "id, ipd_number, patient_name, patient_location, ward_type, room, bed_no, ot_number, planned1",
      )
      .not("planned1", "is", null)
      .is("actual1", null)
      .order("patient_name");

    if (error) {
      console.error("Error fetching IPD patients:", error);
    } else {
      const uniquePatients = [];
      const seenIpdNumbers = new Set();

      data.forEach((patient) => {
        if (patient.ipd_number && !seenIpdNumbers.has(patient.ipd_number)) {
          seenIpdNumbers.add(patient.ipd_number);
          uniquePatients.push({
            id: patient.id,
            ipd_number: patient.ipd_number,
            patient_name: patient.patient_name || "Unknown",
            location: patient.patient_location || "Not specified",
            ward_type: patient.ward_type,
            room: patient.room,
            bed_no: patient.bed_no,
            ot_number: patient.ot_number,
            planned1: patient.planned1,
          });
        }
      });

      setAvailableIpdPatients(uniquePatients);
    }
  };

  const fetchDoctorFromIpdAdmission = async (ipdNumber) => {
    try {
      const { data, error } = await supabase
        .from("ipd_admissions")
        .select("consultant_dr")
        .eq("ipd_number", ipdNumber)
        .single();

      if (error) {
        console.error("Error fetching doctor from ipd_admission:", error);
        return null;
      }

      return data?.consultant_dr || "";
    } catch (error) {
      console.error("Error in fetchDoctorFromIpdAdmission:", error);
      return null;
    }
  };

  // const createNurseAssignTasks = async (patientData, otDate) => {
  //   try {
  //     const tasks = [
  //       {
  //         timestamp: new Date().toISOString(),
  //         Ipd_number: patientData.ipd_number,
  //         patient_name: patientData.patient_name,
  //         patient_location: patientData.patient_location,
  //         ward_type: patientData.ward_type,
  //         room: patientData.room,
  //         bed_no: patientData.bed_no,
  //         shift: 'OT Shift',
  //         assign_nurse: 'OT Staff',
  //         reminder: 'Yes',
  //         start_date: otDate,
  //         task: 'Received in OT',
  //         planned1: new Date().toISOString(),
  //         actual1: null,
  //         staff: 'OT Staff'
  //       },
  //       {
  //         timestamp: new Date().toISOString(),
  //         Ipd_number: patientData.ipd_number,
  //         patient_name: patientData.patient_name,
  //         patient_location: patientData.patient_location,
  //         ward_type: patientData.ward_type,
  //         room: patientData.room,
  //         bed_no: patientData.bed_no,
  //         shift: 'OT Shift',
  //         assign_nurse: 'OT Staff',
  //         reminder: 'Yes',
  //         start_date: otDate,
  //         task: 'After OT Inform To Ward',
  //         planned1: new Date().toISOString(),
  //         actual1: null,
  //         staff: 'OT Staff'
  //       }
  //     ];

  //     const { error: taskError } = await supabase
  //       .from('nurse_assign_task')
  //       .insert(tasks);

  //     if (taskError) throw taskError;

  //     console.log('Successfully created 2 tasks in nurse_assign_task table');
  //     return true;
  //   } catch (error) {
  //     console.error('Error creating nurse assign tasks:', error);
  //     return false;
  //   }
  // };

  useEffect(() => {
    fetchPendingData();
    fetchHistoryData();
    fetchRmoList();
    fetchAvailableIpdPatients();
  }, []);

  // Open update OT date modal
  const handleUpdateClick = (record) => {
    setSelectedUpdateRecord(record);
    setUpdateForm({
      ot_date: record.ot_date || "",
      ot_time: record.ot_time || "",
    });
    setShowUpdateModal(true);
  };

  // Submit updated OT date/time
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!updateForm.ot_date || !updateForm.ot_time) {
      showNotification("Please select both date and time", "error");
      return;
    }
    try {
      setIsUpdating(true);
      const { error } = await supabase
        .from("ot_information")
        .update({
          ot_date: updateForm.ot_date,
          ot_time: updateForm.ot_time,
        })
        .eq("id", selectedUpdateRecord.id);

      if (error) throw error;

      showNotification("OT date updated successfully!", "success");
      setShowUpdateModal(false);
      setSelectedUpdateRecord(null);
      fetchPendingData();
      fetchHistoryData();
    } catch (error) {
      console.error("Error updating OT date:", error);
      showNotification("Error updating OT date", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  // Open process modal
  const handleProcessClick = (record) => {
    setSelectedOtRecord(record);
    setProcessForm({
      status: "",
      remark: "",
    });
    setShowProcessModal(true);
  };

  // Submit process form
  const handleProcessSubmit = async (e) => {
    e.preventDefault();

    if (!processForm.status) {
      showNotification("Please select a status", "error");
      return;
    }

    try {
      // Update ot_information table
      const updateData = {
        status: processForm.status,
        remark: processForm.remark || null,
        actual2: new Date()
          .toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false,
          })
          .replace(",", ""),
      };

      // if (processForm.status === 'Complete') {
      //   updateData.actual2 = new Date().toISOString();
      // }

      const { error } = await supabase
        .from("ot_information")
        .update(updateData)
        .eq("id", selectedOtRecord.id);

      if (error) throw error;

      // Refresh data
      fetchPendingData();
      fetchHistoryData();

      // Close modal
      setShowProcessModal(false);
      setSelectedOtRecord(null);

      showNotification(
        `Status updated to "${processForm.status}" successfully!`,
        "success",
      );
    } catch (error) {
      console.error("Error updating status:", error);
      showNotification("Error updating status", "error");
    }
  };

  const handleIpdSelect = async (ipdNumber) => {
    setFormData({
      ...formData,
      ipd_number: ipdNumber,
    });

    // Fetch doctor from ipd_admission table
    const doctorName = await fetchDoctorFromIpdAdmission(ipdNumber);
    setSelectedDoctor(doctorName || "");

    // Fetch extra patient details (age, gender) from ipd_admissions
    try {
      const { data: admData } = await supabase
        .from("ipd_admissions")
        .select("patient_name, age, gender")
        .eq("ipd_number", ipdNumber)
        .single();

      // Also grab patient_name from ot_information as fallback
      const selectedPatient = availableIpdPatients.find(
        (p) => p.ipd_number === ipdNumber,
      );

      setSelectedPatientDetails({
        name: admData?.patient_name || selectedPatient?.patient_name || "N/A",
        age: admData?.age || "N/A",
        gender: admData?.gender || "N/A",
        location: selectedPatient?.location || "N/A",
      });
    } catch {
      const selectedPatient = availableIpdPatients.find(
        (p) => p.ipd_number === ipdNumber,
      );
      setSelectedPatientDetails({
        name: selectedPatient?.patient_name || "N/A",
        age: "N/A",
        gender: "N/A",
        location: selectedPatient?.location || "N/A",
      });
    }

    setShowIpdDropdown(false);
    setIpdSearchTerm("");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleProcessFormChange = (e) => {
    const { name, value } = e.target;
    setProcessForm({
      ...processForm,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (
      !formData.ipd_number ||
      !formData.ot_date ||
      !formData.ot_time ||
      !formData.rmo
    ) {
      showNotification("Please fill in all required fields", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: existingRecords, error: fetchError } = await supabase
        .from("ot_information")
        .select("*")
        .eq("ipd_number", formData.ipd_number)
        .not("planned1", "is", null)
        .is("actual1", null)
        .limit(1);

      if (fetchError) throw fetchError;

      if (!existingRecords || existingRecords.length === 0) {
        showNotification(
          "No matching IPD record found for OT assignment",
          "error",
        );
        setIsSubmitting(false);
        return;
      }

      const existingRecord = existingRecords[0];

      // Use doctor name from ipd_admission table if available, otherwise use form input
      const doctorToUse = selectedDoctor || formData.doctor;

      const { error: updateError } = await supabase
        .from("ot_information")
        .update({
          actual1: new Date().toISOString(),
          rmo: formData.rmo,
          doctor: doctorToUse,
          ot_date: formData.ot_date,
          ot_time: formData.ot_time,
          ot_description: formData.ot_description,
          planned2: new Date().toISOString(),
        })
        .eq("id", existingRecord.id);

      if (updateError) throw updateError;

      // Fetch full patient data for WhatsApp notification
      const { data: fullPatientData, error: patientError } = await supabase
        .from("patient_admission")
        .select("*")
        .eq("ipd_number", existingRecord.ipd_number)
        .single();

      if (patientError) {
        console.error("Error fetching patient data:", patientError);
      } else {
        // Send WhatsApp notification
        const otData = {
          ...existingRecord,
          doctor: doctorToUse,
          rmo: formData.rmo,
          ot_date: formData.ot_date,
          ot_time: formData.ot_time,
          ot_description: formData.ot_description,
        };
        await sendOTNotification(otData, fullPatientData);
      }

      const patientData = {
        ipd_number: existingRecord.ipd_number,
        patient_name: existingRecord.patient_name,
        patient_location: existingRecord.patient_location,
        ward_type: existingRecord.ward_type,
        room: existingRecord.room,
        bed_no: existingRecord.bed_no,
      };

      // const tasksCreated = await createNurseAssignTasks(
      //   patientData,
      //   formData.ot_date
      // );

      // if (!tasksCreated) {
      //   showNotification('OT time assigned but failed to create nurse tasks. Please check console for details.', 'warning');
      // }

      setFormData({
        ipd_number: "",
        ot_date: "",
        ot_time: "",
        ot_description: "",
        doctor: "",
        rmo: "",
      });
      setSelectedDoctor("");
      setSelectedPatientDetails(null);
      setShowForm(false);
      setIpdSearchTerm("");
      setShowIpdDropdown(false);

      fetchPendingData();
      fetchHistoryData();
      fetchAvailableIpdPatients();

      // showNotification(tasksCreated
      //   ? 'OT time assigned successfully and nurse tasks created!'
      //   : 'OT time assigned but nurse tasks creation failed!',
      //   tasksCreated ? 'success' : 'error'
      // );
    } catch (error) {
      console.error("Error assigning OT time:", error);
      showNotification(`Error assigning OT time: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredIpdPatients = availableIpdPatients.filter((patient) => {
    const searchLower = ipdSearchTerm.toLowerCase();
    return (
      patient.ipd_number.toLowerCase().includes(searchLower) ||
      patient.patient_name.toLowerCase().includes(searchLower)
    );
  });

  // Mobile Card Component for Pending Tasks
  const MobilePendingCard = ({ item }) => {
    const isExpanded = expandedCard === item.id;

    return (
      <div className="p-4 mb-3 bg-white border border-green-200 rounded-lg shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-green-600">
                {item.ot_number || "N/A"}
              </span>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  item.status === "Complete"
                    ? "bg-green-100 text-green-800"
                    : item.status === "Cancel"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {item.status || "Pending"}
              </span>
            </div>
            <h3 className="mb-1 text-sm font-medium text-gray-900">
              {item.patient_name}
            </h3>
            <p className="text-xs text-gray-600">IPD: {item.ipd_number}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => handleProcessClick(item)}
              className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
            >
              Process
            </button>
            <button
              onClick={() => handleUpdateClick(item)}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
            >
              Update
            </button>
            <button
              onClick={() => setExpandedCard(isExpanded ? null : item.id)}
              className="text-gray-500"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">OT Date</span>
            </div>
            <p className="text-sm font-medium">{item.ot_date || "N/A"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">OT Time</span>
            </div>
            <p className="text-sm font-medium">{item.ot_time || "N/A"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <User className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">RMO</span>
            </div>
            <p className="text-sm font-medium">{item.rmo || "N/A"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <User className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">Doctor</span>
            </div>
            <p className="text-sm font-medium">{item.doctor || "N/A"}</p>
          </div>
          <div className="col-span-2">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">Planned Time</span>
            </div>
            <p className="text-sm font-medium text-gray-700">
              {item.planned2Formatted}
            </p>
          </div>
        </div>

        {isExpanded && (
          <div className="pt-3 mt-3 border-t">
            <div className="mb-3">
              <div className="flex items-center gap-1 mb-1">
                <MapPin className="w-3 h-3 text-green-600" />
                <span className="text-xs text-gray-500">Location</span>
              </div>
              <p className="text-sm">{item.patient_location || "N/A"}</p>
            </div>
            {item.remark && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <FileText className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-gray-500">Remark</span>
                </div>
                <p className="text-sm text-gray-700">{item.remark}</p>
              </div>
            )}
            {item.ot_description && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <FileText className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-gray-500">Description</span>
                </div>
                <p className="text-sm text-gray-700">{item.ot_description}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Mobile Card Component for History
  const MobileHistoryCard = ({ item }) => {
    const isExpanded = expandedCard === item.id;

    return (
      <div className="p-4 mb-3 bg-white border border-green-200 rounded-lg shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-green-600">
                {item.ot_number || "N/A"}
              </span>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  item.status === "Complete"
                    ? "bg-green-100 text-green-800"
                    : item.status === "Cancel"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800"
                }`}
              >
                {item.status || "N/A"}
              </span>
            </div>
            <h3 className="mb-1 text-sm font-medium text-gray-900">
              {item.patient_name}
            </h3>
            <p className="text-xs text-gray-600">IPD: {item.ipd_number}</p>
          </div>
          <button
            onClick={() => setExpandedCard(isExpanded ? null : item.id)}
            className="text-gray-500"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">OT Date</span>
            </div>
            <p className="text-sm font-medium">{item.ot_date || "N/A"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">OT Time</span>
            </div>
            <p className="text-sm font-medium">{item.ot_time || "N/A"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <User className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">RMO</span>
            </div>
            <p className="text-sm font-medium">{item.rmo || "N/A"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <User className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">Doctor</span>
            </div>
            <p className="text-sm font-medium">{item.doctor || "N/A"}</p>
          </div>
        </div>

        {isExpanded && (
          <div className="pt-3 mt-3 space-y-3 border-t">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <MapPin className="w-3 h-3 text-green-600" />
                <span className="text-xs text-gray-500">Location</span>
              </div>
              <p className="text-sm">{item.patient_location || "N/A"}</p>
            </div>
            {item.remark && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <FileText className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-gray-500">Remark</span>
                </div>
                <p className="text-sm text-gray-700">{item.remark}</p>
              </div>
            )}

            {item.ot_description && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <FileText className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-gray-500">Description</span>
                </div>
                <p className="text-sm text-gray-700">{item.ot_description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-gray-500">Planned On</span>
                </div>
                <p className="text-xs font-medium text-gray-700">
                  {item.planned2Formatted}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-gray-500">Completed On</span>
                </div>
                <p className="text-xs font-medium text-green-700">
                  {item.actual2Formatted}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen p-3 md:p-5 bg-gray-50">
      {/* Header - Fixed Height */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-xl font-bold text-green-600 md:text-2xl">
              OT Tasks Management
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage OT tasks and assignments
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-sm text-sm md:text-base w-full sm:w-auto"
          >
            Assign OT Time
          </button>
        </div>

        {/* Tabs Navigation - Fixed Height */}
        <div className="flex p-1 mt-6 bg-gray-100 rounded-lg">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex-1 py-2.5 px-4 font-medium text-sm md:text-base rounded-lg transition-colors ${
              activeTab === "pending"
                ? "bg-green-600 text-white"
                : "bg-transparent text-gray-600 hover:text-green-600"
            }`}
          >
            <div className="flex flex-col items-center">
              <span>
                Pending <span className=" mt-0.5">{pendingData.length}</span>
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2.5 px-4 font-medium text-sm md:text-base rounded-lg transition-colors ${
              activeTab === "history"
                ? "bg-green-600 text-white"
                : "bg-transparent text-gray-600 hover:text-green-600"
            }`}
          >
            <div className="flex flex-col items-center">
              <span>
                History <span className=" mt-0.5">{historyData.length}</span>
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Content Area - Scrollable */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Mobile Card View - Scrollable Area */}
        <div className="h-full pb-4 overflow-y-auto md:hidden">
          {activeTab === "pending" ? (
            pendingData.length > 0 ? (
              <div className="px-1 space-y-3">
                {pendingData.map((item) => (
                  <MobilePendingCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8">
                <CheckCircle className="w-16 h-16 mb-4 text-green-400" />
                <h3 className="mb-2 text-base font-medium text-green-600">
                  No pending OT tasks
                </h3>
                <p className="text-sm text-center text-green-500">
                  All OT tasks are completed!
                </p>
              </div>
            )
          ) : historyData.length > 0 ? (
            <div className="px-1 space-y-3">
              {historyData.map((item) => (
                <MobileHistoryCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <Calendar className="w-16 h-16 mb-4 text-green-400" />
              <h3 className="mb-2 text-base font-medium text-green-600">
                No OT history
              </h3>
              <p className="text-sm text-center text-green-500">
                Complete some OT tasks to see history
              </p>
            </div>
          )}
        </div>

        {/* Desktop Table View - Scrollable Area */}
        <div className="hidden h-full overflow-hidden md:block">
          {/* Pending Tasks Table */}
          {activeTab === "pending" && (
            <div className="flex flex-col h-full border border-green-200 rounded-lg bg-green-50">
              {/* <div className="flex-shrink-0 p-5">
                <h2 className="text-lg font-semibold text-green-700">Pending OT Tasks</h2>
              </div> */}
              <div className="flex-1 min-h-0 overflow-auto">
                {pendingData.length > 0 ? (
                  <table className="min-w-full bg-white">
                    <thead className="sticky top-0 z-10">
                      <tr className="text-white bg-green-600">
                        <th className="sticky left-0 px-4 py-3 font-medium text-left bg-green-600 whitespace-nowrap">
                          Action
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          Status
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          Planned Time
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          OT Number
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          IPD Number
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          Patient Name
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          Location
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          OT Date
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          OT Time
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          RMO
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          Doctor
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          Remark
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingData.map((item, index) => (
                        <tr
                          key={item.id}
                          className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-green-50"}`}
                        >
                          <td className="sticky left-0 px-4 py-3 bg-white whitespace-nowrap">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleProcessClick(item)}
                                className="px-4 py-1.5 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors whitespace-nowrap"
                              >
                                Process
                              </button>
                              <button
                                onClick={() => handleUpdateClick(item)}
                                className="px-4 py-1.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
                              >
                                Update
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                item.status === "Complete"
                                  ? "bg-green-100 text-green-800"
                                  : item.status === "Cancel"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {item.status || "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
                            {item.planned2Formatted}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.ot_number || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.ipd_number || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.patient_name || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.patient_location || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.ot_date || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.ot_time || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.rmo || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.doctor || "N/A"}
                          </td>
                          <td
                            className="px-4 py-3 whitespace-nowrap"
                            title={item.remark}
                          >
                            {item.remark || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-8">
                    <CheckCircle className="w-16 h-16 mb-4 text-green-400" />
                    <h3 className="mb-2 text-lg font-medium text-green-600">
                      No pending OT tasks
                    </h3>
                    <p className="text-green-500">
                      All OT tasks are completed!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History Table */}
          {activeTab === "history" && (
            <div className="flex flex-col h-full border border-green-200 rounded-lg bg-green-50">
              {/* <div className="flex-shrink-0 p-5">
                <h2 className="text-lg font-semibold text-green-700">OT History</h2>
              </div> */}
              <div className="flex-1 min-h-0 overflow-auto">
                {historyData.length > 0 ? (
                  <table className="min-w-full bg-white">
                    <thead className="sticky top-0 z-10">
                      <tr className="text-white bg-green-600">
                        <th className="sticky left-0 px-4 py-3 font-medium text-left bg-green-600 whitespace-nowrap">
                          Status
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          Planned Time
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          Actual Time
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          OT Number
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          IPD Number
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          Patient Name
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          Location
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          OT Date
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          OT Time
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          RMO
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          Doctor
                        </th>
                        <th className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          Remark
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.map((item, index) => (
                        <tr
                          key={item.id}
                          className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-green-50"}`}
                        >
                          <td className="sticky left-0 px-4 py-3 bg-white whitespace-nowrap">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                item.status === "Complete"
                                  ? "bg-green-100 text-green-800"
                                  : item.status === "Cancel"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {item.status || "N/A"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
                            {item.planned2Formatted}
                          </td>
                          <td className="px-4 py-3 font-medium text-green-700 whitespace-nowrap">
                            {item.actual2Formatted}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.ot_number || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.ipd_number || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.patient_name || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.patient_location || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.ot_date || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.ot_time || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.rmo || "N/A"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {item.doctor || "N/A"}
                          </td>
                          <td
                            className="px-4 py-3 whitespace-nowrap"
                            title={item.remark}
                          >
                            {item.remark || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-8">
                    <Calendar className="w-16 h-16 mb-4 text-green-400" />
                    <h3 className="mb-2 text-lg font-medium text-green-600">
                      No OT history available
                    </h3>
                    <p className="text-green-500">
                      Complete some OT tasks to see history here
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign OT Time Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 bg-black/50 md:items-center md:p-4">
          <div className="bg-white p-4 md:p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-green-600">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-green-600 md:text-xl">
                Assign OT Time
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setIpdSearchTerm("");
                  setShowIpdDropdown(false);
                  setSelectedDoctor("");
                  setSelectedPatientDetails(null);
                }}
                className="text-2xl text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* IPD Number Search Field */}
              <div className="relative mb-4">
                <label className="block mb-2 text-sm font-medium text-green-600">
                  IPD Number *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={ipdSearchTerm || formData.ipd_number}
                    onChange={(e) => {
                      setIpdSearchTerm(e.target.value);
                      if (!showIpdDropdown) setShowIpdDropdown(true);
                    }}
                    onFocus={() => setShowIpdDropdown(true)}
                    placeholder="Search IPD number..."
                    className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-green-600 outline-none text-sm"
                  />
                  <Search className="absolute w-4 h-4 text-gray-500 transform -translate-y-1/2 right-3 top-1/2" />
                </div>

                {showIpdDropdown && filteredIpdPatients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 overflow-y-auto bg-white border border-green-600 rounded-lg shadow-lg max-h-48">
                    {filteredIpdPatients.map((patient) => (
                      <div
                        key={patient.ipd_number}
                        onClick={() => handleIpdSelect(patient.ipd_number)}
                        className={`p-3 cursor-pointer border-b border-gray-100 transition-colors ${
                          formData.ipd_number === patient.ipd_number
                            ? "bg-green-50"
                            : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="text-sm font-medium text-green-600">
                          {patient.ipd_number}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          {patient.patient_name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-2 text-xs italic text-gray-500">
                  {availableIpdPatients.length === 0
                    ? "No available IPD patients"
                    : `${availableIpdPatients.length} IPD patient(s) available`}
                </p>

                {/* Patient details card shown after IPD selection */}
                {selectedPatientDetails && formData.ipd_number && (
                  <div className="p-3 mt-3 border border-green-200 rounded-lg bg-green-50">
                    <p className="mb-2 text-xs font-semibold tracking-wide text-green-700 uppercase">
                      Patient Details
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs text-gray-500">Name</p>
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {selectedPatientDetails.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Age</p>
                        <p className="text-sm font-medium text-gray-800">
                          {selectedPatientDetails.age}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Gender</p>
                        <p className="text-sm font-medium text-gray-800">
                          {selectedPatientDetails.gender}
                        </p>
                      </div>
                    </div>
                    {selectedPatientDetails.location &&
                      selectedPatientDetails.location !== "N/A" && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500">Location</p>
                          <p className="text-sm font-medium text-gray-800">
                            {selectedPatientDetails.location}
                          </p>
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 gap-3 mb-4 md:grid-cols-2 md:gap-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-green-600">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="ot_date"
                    value={formData.ot_date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-green-600 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-green-600">
                    Time *
                  </label>
                  <input
                    type="time"
                    name="ot_time"
                    value={formData.ot_time}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-green-600 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block mb-2 text-sm font-medium text-green-600">
                  OT Description
                </label>
                <textarea
                  name="ot_description"
                  value={formData.ot_description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-green-600 outline-none min-h-[80px] resize-y text-sm"
                  placeholder="Enter OT procedure description..."
                />
              </div>

              <div className="grid grid-cols-1 gap-3 mb-4 md:grid-cols-2 md:gap-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-green-600">
                    Doctor (Auto-filled from IPD)
                  </label>
                  <input
                    type="text"
                    name="doctor"
                    value={selectedDoctor}
                    readOnly
                    className="w-full px-3 py-2.5 rounded-lg border border-green-600 outline-none bg-gray-50 text-sm"
                    placeholder="Auto-filled from IPD record"
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-green-600">
                    RMO *
                  </label>
                  <select
                    name="rmo"
                    value={formData.rmo}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-green-600 outline-none bg-white text-sm"
                  >
                    <option value="">Select RMO</option>
                    {rmoList.map((rmo, index) => (
                      <option key={index} value={rmo}>
                        {rmo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setIpdSearchTerm("");
                    setShowIpdDropdown(false);
                    setSelectedDoctor("");
                    setSelectedPatientDetails(null);
                  }}
                  disabled={isSubmitting}
                  className={`flex-1 py-3 rounded-lg font-medium text-sm transition-colors ${
                    isSubmitting
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-gray-600 text-white hover:bg-gray-700"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.ipd_number || isSubmitting}
                  className={`flex-1 py-3 rounded-lg font-medium text-sm transition-colors ${
                    formData.ipd_number && !isSubmitting
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isSubmitting ? "Assigning..." : "Assign OT"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Status Modal */}
      {showProcessModal && selectedOtRecord && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 bg-black/50 md:items-center md:p-4">
          <div className="bg-white p-4 md:p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto border-2 border-green-600">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-green-600 md:text-xl">
                Process OT Task
              </h2>
              <button
                onClick={() => {
                  setShowProcessModal(false);
                  setSelectedOtRecord(null);
                }}
                className="text-2xl text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-3 mb-6 rounded-lg bg-green-50">
              <h3 className="mb-2 font-medium text-green-700">
                Patient Information
              </h3>
              <p className="text-sm">
                <span className="font-medium">IPD:</span>{" "}
                {selectedOtRecord.ipd_number}
              </p>
              <p className="text-sm">
                <span className="font-medium">Patient:</span>{" "}
                {selectedOtRecord.patient_name}
              </p>
              <p className="text-sm">
                <span className="font-medium">OT Date:</span>{" "}
                {selectedOtRecord.ot_date}
              </p>
              <p className="text-sm">
                <span className="font-medium">OT Time:</span>{" "}
                {selectedOtRecord.ot_time}
              </p>
            </div>

            <form onSubmit={handleProcessSubmit}>
              <div className="mb-4">
                <label className="block mb-2 text-sm font-medium text-green-600">
                  Status *
                </label>
                <select
                  name="status"
                  value={processForm.status}
                  onChange={handleProcessFormChange}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-green-600 outline-none bg-white text-sm"
                >
                  <option value="">Select Status</option>
                  <option value="Complete">Complete</option>
                  <option value="Cancel">Cancel</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-sm font-medium text-green-600">
                  Remark (Optional)
                </label>
                <textarea
                  name="remark"
                  value={processForm.remark}
                  onChange={handleProcessFormChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-green-600 outline-none min-h-[80px] resize-y text-sm"
                  placeholder="Enter any remarks..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 text-sm font-medium text-white transition-colors bg-green-600 rounded-lg hover:bg-green-700"
                >
                  Update Status
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProcessModal(false);
                    setSelectedOtRecord(null);
                  }}
                  className="flex-1 py-3 text-sm font-medium text-white transition-colors bg-gray-600 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Update OT Date Modal */}
      {showUpdateModal && selectedUpdateRecord && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 bg-black/50 md:items-center md:p-4">
          <div className="bg-white p-4 md:p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto border-2 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-blue-600 md:text-xl">
                Update OT Date
              </h2>
              <button
                onClick={() => {
                  setShowUpdateModal(false);
                  setSelectedUpdateRecord(null);
                }}
                className="text-2xl text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Patient info summary */}
            <div className="p-3 mb-5 border border-blue-100 rounded-lg bg-blue-50">
              <p className="text-sm">
                <span className="font-medium text-blue-700">IPD:</span>{" "}
                {selectedUpdateRecord.ipd_number}
              </p>
              <p className="text-sm">
                <span className="font-medium text-blue-700">Patient:</span>{" "}
                {selectedUpdateRecord.patient_name}
              </p>
              <p className="text-sm">
                <span className="font-medium text-blue-700">
                  Current OT Date:
                </span>{" "}
                {selectedUpdateRecord.ot_date || "N/A"}{" "}
                {selectedUpdateRecord.ot_time || ""}
              </p>
            </div>

            <form onSubmit={handleUpdateSubmit}>
              <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
                <div>
                  <label className="block mb-2 text-sm font-medium text-blue-600">
                    New OT Date *
                  </label>
                  <input
                    type="date"
                    value={updateForm.ot_date}
                    onChange={(e) =>
                      setUpdateForm((prev) => ({
                        ...prev,
                        ot_date: e.target.value,
                      }))
                    }
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-blue-400 outline-none text-sm focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-blue-600">
                    New OT Time *
                  </label>
                  <input
                    type="time"
                    value={updateForm.ot_time}
                    onChange={(e) =>
                      setUpdateForm((prev) => ({
                        ...prev,
                        ot_time: e.target.value,
                      }))
                    }
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-blue-400 outline-none text-sm focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowUpdateModal(false);
                    setSelectedUpdateRecord(null);
                  }}
                  disabled={isUpdating}
                  className="flex-1 py-3 text-sm font-medium text-white transition-colors bg-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-3 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignOtTime;
