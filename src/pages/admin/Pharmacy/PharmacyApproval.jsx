import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Eye,
  CheckCircle,
  XCircle,
  FileText,
  X,
  Download,
  Edit,
  Save,
  Trash2,
  Plus,
  Search,
  ChevronDown,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import supabase from "../../../SupabaseClient";
import { useNotification } from "../../../contexts/NotificationContext";
import {
  getPendingIndents,
  getHistoryIndents,
  getMedicines,
  getInvestigations,
  updateIndentStatus,
  uploadSlipToStorage
} from "../../../api/pharmacy";
import useRealtimeQuery from "../../../hooks/useRealtimeQuery";
import {
  normalizeDepartmentalPharmacyIndent,
  normalizePatientPharmacyIndent,
  parseJsonField,
} from "../../../utils/pharmacyIndentUtils";

// (drawWrappedText and MedicineDropdown stay same)
const drawWrappedText = (ctx, text, x, y, maxWidth, lineHeight) => {
  if (!text) return;

  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    const width = ctx.measureText(testLine).width;

    if (width > maxWidth && i > 0) {
      ctx.fillText(line, x, currentY);
      line = words[i] + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  ctx.fillText(line, x, currentY);
};

// Custom Medicine Dropdown Component
const MedicineDropdown = ({
  medicine,
  onUpdate,
  index,
  loading,
  medicines,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  const filteredMedicines = (medicines || []).filter((med) =>
    med.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSelect = (medName) => {
    onUpdate(medicine.id, "name", medName);
    setIsOpen(false);
    setSearchTerm("");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={medicine.name}
          onChange={(e) => onUpdate(medicine.id, "name", e.target.value)}
          onClick={() => setIsOpen(true)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Select or type medicine name"
          readOnly={loading}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute text-gray-400 transform -translate-y-1/2 right-2 top-1/2 hover:text-gray-600"
          disabled={loading}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg max-h-60">
          {/* Search Input */}
          <div className="sticky top-0 p-2 bg-white border-b">
            <div className="relative">
              <Search className="absolute w-4 h-4 text-gray-400 transform -translate-y-1/2 left-2 top-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-2 pl-8 pr-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Search medicines..."
                autoFocus
              />
            </div>
          </div>

          {/* Medicine List */}
          <div className="py-1">
            {filteredMedicines.length > 0 ? (
              filteredMedicines.map((medName) => (
                <button
                  key={medName}
                  type="button"
                  onClick={() => handleSelect(medName)}
                  className={`w-full text-left px-4 py-2 hover:bg-green-50 hover:text-green-700 ${
                    medicine.name === medName
                      ? "bg-green-100 text-green-700 font-medium"
                      : "text-gray-700"
                  }`}
                >
                  {medName}
                </button>
              ))
            ) : (
              <div className="px-4 py-2 text-center text-gray-500">
                No medicines found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PharmacyApproval = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending");
  const [viewModal, setViewModal] = useState(false);
  const [slipModal, setSlipModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [statusChanges, setStatusChanges] = useState({});
  const { showNotification } = useNotification();

  // Filter States
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [indentTypeFilter, setIndentTypeFilter] = useState("all");

  // --- Queries ---

  const { data: rawPending = { patient: [], departmental: [] }, isLoading: isLoadingPending } = useQuery({
    queryKey: ['pharmacy', 'approval', 'pending'],
    queryFn: getPendingIndents
  });

  const { data: rawHistory = { patient: [], departmental: [] }, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['pharmacy', 'approval', 'history'],
    queryFn: getHistoryIndents
  });

  const { data: medicines = [] } = useQuery({ queryKey: ['pharmacy', 'medicines'], queryFn: getMedicines });
  const { data: investigations = { Pathology: [], 'X-ray': [], 'CT-scan': [], USG: [] } } = useQuery({ 
    queryKey: ['pharmacy', 'investigations'], 
    queryFn: getInvestigations 
  });

  // Real-time
  useRealtimeQuery(['pharmacy', 'departmental_pharmacy_indent'], ['pharmacy', 'approval', 'pending']);
  useRealtimeQuery(['pharmacy', 'departmental_pharmacy_indent'], ['pharmacy', 'approval', 'history']);

  // --- Derived Data ---

  const pendingIndents = useMemo(() => {
    return [
      ...rawPending.patient.map(normalizePatientPharmacyIndent),
      ...rawPending.departmental.map(normalizeDepartmentalPharmacyIndent),
    ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  }, [rawPending]);

  const historyIndents = useMemo(() => {
    return [
      ...rawHistory.patient.map(normalizePatientPharmacyIndent),
      ...rawHistory.departmental.map(normalizeDepartmentalPharmacyIndent),
    ].sort((a, b) => new Date(b.actual1 || 0) - new Date(a.actual1 || 0));
  }, [rawHistory]);

  const patientNames = useMemo(() => {
    const all = [...pendingIndents, ...historyIndents].map(r => r.displayTitle || r.patientName).filter(Boolean);
    return [...new Set(all)].sort();
  }, [pendingIndents, historyIndents]);

  const loading = isLoadingPending || isLoadingHistory;

  // --- Mutations ---

  const saveStatusMutation = useMutation({
    mutationFn: async (changes) => {
      for (const [id, { status, indentNumber }] of Object.entries(changes)) {
        const indent = pendingIndents.find((p) => String(p.id) === String(id));
        if (!indent) continue;

        const updateData = {
          actual1: new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata", hour12: false }).replace(",", ""),
          planned2: new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata", hour12: false }).replace(",", ""),
        };

        if (status === "Approved") {
          const user = JSON.parse(localStorage.getItem("mis_user"));
          updateData.approved_by = user?.name || "Unknown";
          
          const slipImageBase64 = generateSlipImage(indent);
          if (slipImageBase64) {
            const url = await uploadSlipToStorage(slipImageBase64, indentNumber);
            if (url) updateData.slip_image = url;
          }
        }

        await updateIndentStatus({
          table: indent.sourceTable,
          id: indent.sourceId,
          status,
          updateData
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'approval'] });
      setStatusChanges({});
      showNotification("Status changes saved successfully", "success");
    },
    onError: (error) => showNotification(`Error saving changes: ${error.message}`, "error")
  });

  const handleStatusChange = (indentId, indentNumber, status) => {
    setStatusChanges((prev) => ({ ...prev, [indentId]: { status, indentNumber } }));
  };

  const handleSaveStatusChanges = () => {
    if (Object.keys(statusChanges).length === 0) return showNotification("No changes to save", "warning");
    saveStatusMutation.mutate(statusChanges);
  };

  // Generate slip image (same as before)
  const generateSlipImage = (indent) => {
    const userStr = localStorage.getItem("mis_user");
    const user = JSON.parse(userStr);
    const username = user.name;

    const canvas = document.createElement("canvas");
    canvas.width = 850;
    canvas.height = 1100;
    const ctx = canvas.getContext("2d");

    // Yellow background
    ctx.fillStyle = "#FFEB3B";
    ctx.fillRect(0, 0, 850, 1100);

    // Draw main border
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 830, 1080);

    let y = 10;

    // Header - Hospital Name
    ctx.strokeRect(10, y, 830, 40);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("MAMTA SUPERSPECIALITY HOSPITAL", 425, y + 27);

    // Subheader - Location
    y += 40;
    ctx.strokeRect(10, y, 830, 25);
    ctx.font = "14px Arial";
    ctx.fillText("Dubey Colony Mowa, Raipur (C.G)", 425, y + 17);

    // Row 1: Indent No, Date, Request Type
    y += 25;
    ctx.strokeRect(10, y, 830, 25);
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Indent No:", 20, y + 17);
    ctx.fillStyle = "#FF0000";
    ctx.font = "12px Arial";
    ctx.fillText(indent.indentNumber, 80, y + 17);

    ctx.fillStyle = "#000000";
    ctx.font = "bold 12px Arial";
    ctx.fillText("Date:", 300, y + 17);
    ctx.font = "12px Arial";
    ctx.fillText(new Date().toLocaleDateString("en-GB"), 335, y + 17);

    ctx.font = "bold 12px Arial";
    ctx.fillText("Request Type:", 520, y + 17);
    ctx.fillStyle = "#FF0000";
    ctx.font = "12px Arial";
    let requestTypesList = [];
    if (indent.requestTypes?.medicineSlip) requestTypesList.push("Medicine Slip");
    if (indent.requestTypes?.investigation) requestTypesList.push("Investigation");
    ctx.fillText(requestTypesList.join(", "), 620, y + 17);

    const title =
      indent.indentType === "departmental"
        ? indent.displayTitle || indent.wardLocation || "Departmental Indent"
        : indent.patientName;
    const secondaryLabel =
      indent.indentType === "departmental" ? "Requested By:" : "Age:";
    const secondaryValue =
      indent.indentType === "departmental"
        ? indent.requestedBy || "-"
        : indent.age?.toString() || "-";
    const tertiaryLabel =
      indent.indentType === "departmental" ? "" : "Gender:";
    const tertiaryValue =
      indent.indentType === "departmental"
        ? ""
        : indent.gender || "-";

    // Row 2: Patient Name/Ward, Age-or-requester, Gender-or-room
    y += 25;
    ctx.strokeRect(10, y, 830, 25);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 12px Arial";
    ctx.fillText(
      indent.indentType === "departmental" ? "Ward Name:" : "Patient Name:",
      20,
      y + 17,
    );
    ctx.font = "12px Arial";
    ctx.fillText(String(title || "-").toUpperCase(), 110, y + 17);

    ctx.font = "bold 12px Arial";
    ctx.fillText(secondaryLabel, 480, y + 17);
    ctx.font = "12px Arial";
    ctx.fillText(secondaryValue, 575, y + 17);

    ctx.font = "bold 12px Arial";
    ctx.fillText(tertiaryLabel, 620, y + 17);
    ctx.font = "12px Arial";
    ctx.fillText(tertiaryValue, 675, y + 17);

    // Row 3: UHID/Category, Diagnosis/Remarks, Ward Type
    y += 25;
    ctx.strokeRect(10, y, 830, 25);
    ctx.font = "bold 12px Arial";
    ctx.fillText(
      indent.indentType === "departmental" ? "" : "UHID No:",
      20,
      y + 17,
    );
    ctx.font = "12px Arial";
    ctx.fillText(
      indent.indentType === "departmental"
        ? ""
        : indent.uhidNumber || "-",
      95,
      y + 17,
    );

    ctx.font = "bold 12px Arial";
    ctx.fillText(
      indent.indentType === "departmental" ? "Remarks:" : "Diagnosis:",
      250,
      y + 17,
    );
    ctx.fillStyle = "#FF0000";
    ctx.font = "12px Arial";
    ctx.fillText(
      indent.indentType === "departmental"
        ? indent.remarks || "-"
        : indent.diagnosis || "-",
      325,
      y + 17,
    );

    ctx.fillStyle = "#000000";
    ctx.font = "bold 12px Arial";
    ctx.fillText("Ward Type:", 600, y + 17);
    ctx.font = "12px Arial";
    drawWrappedText(ctx, indent.wardLocation || "-", 670, y + 15, 160, 12);

    // Row 4: Consultant/Floor, Nursing Staff, Category
    y += 25;
    ctx.strokeRect(10, y, 830, 25);
    ctx.font = "bold 12px Arial";
    ctx.fillText(
      indent.indentType === "departmental" ? "" : "Consultant Name:",
      20,
      y + 17,
    );
    ctx.font = "12px Arial";
    ctx.fillText(
      indent.indentType === "departmental"
        ? ""
        : indent.consultantName || "-",
      135,
      y + 17,
    );

    ctx.font = "bold 12px Arial";
    ctx.fillText(indent.indentType === "departmental" ? "Staff:" : "Nursing Staff:", 380, y + 17);
    ctx.font = "12px Arial";
    ctx.fillText(indent.staffName || "-", 470, y + 17);

    if (indent.indentType !== "departmental") {
      ctx.font = "bold 12px Arial";
      ctx.fillText("Category:", 600, y + 17);
      ctx.font = "12px Arial";
      drawWrappedText(ctx, indent.category || "-", 670, y + 15, 160, 12);
    }

    y += 25;

    // Medicine Slip Section
    if (indent.requestTypes.medicineSlip && indent.medicines.length > 0) {
      // Medicine Table Header
      ctx.strokeRect(10, y, 830, 30);
      ctx.fillStyle = "#FFEB3B";
      ctx.fillRect(10, y, 830, 30);

      // Column headers
      ctx.strokeRect(10, y, 80, 30); // Serial Number
      ctx.strokeRect(90, y, 520, 30); // Medicine Name
      ctx.strokeRect(610, y, 230, 30); // Quantity

      ctx.fillStyle = "#000000";
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.fillText("SN", 50, y + 20);
      ctx.fillText("Medicine Name", 350, y + 20);
      ctx.fillText("Quantity", 725, y + 20);

      // Medicine rows
      y += 30;
      const rowHeight = 25;
      indent.medicines.forEach((med, index) => {
        ctx.strokeRect(10, y, 80, rowHeight);
        ctx.strokeRect(90, y, 520, rowHeight);
        ctx.strokeRect(610, y, 230, rowHeight);

        ctx.fillStyle = "#000000";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText((index + 1).toString(), 50, y + 17);
        ctx.textAlign = "left";
        ctx.fillText(med.name.toUpperCase(), 100, y + 17);
        ctx.textAlign = "center";
        ctx.fillText(med.quantity.toString(), 725, y + 17);

        y += rowHeight;
      });

      // Add empty rows to maintain consistent height (total 15 rows)
      const emptyRows = Math.max(0, 15 - indent.medicines.length);
      for (let i = 0; i < emptyRows; i++) {
        ctx.strokeRect(10, y, 80, rowHeight);
        ctx.strokeRect(90, y, 520, rowHeight);
        ctx.strokeRect(610, y, 230, rowHeight);
        y += rowHeight;
      }
    }

    // Investigation Advice Section
    if (indent.requestTypes.investigation && indent.investigationAdvice) {
      // Investigation header
      ctx.strokeRect(10, y, 830, 30);
      ctx.fillStyle = "#FFEB3B";
      ctx.fillRect(10, y, 830, 30);
      ctx.fillStyle = "#000000";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("INVESTIGATION ADVICE", 425, y + 20);

      y += 30;

      // Category and Priority row
      ctx.strokeRect(10, y, 830, 25);
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "left";
      ctx.fillText("Category:", 20, y + 17);
      ctx.font = "12px Arial";
      ctx.fillText(indent.investigationAdvice.adviceCategory, 90, y + 17);

      ctx.font = "bold 12px Arial";
      ctx.fillText("Priority:", 400, y + 17);
      ctx.font = "12px Arial";
      ctx.fillText(indent.investigationAdvice.priority, 460, y + 17);

      y += 25;

      // Pathology Tests
      if (
        indent.investigationAdvice.adviceCategory === "Pathology" &&
        indent.investigationAdvice.pathologyTests?.length > 0
      ) {
        ctx.strokeRect(10, y, 830, 25);
        ctx.font = "bold 12px Arial";
        ctx.fillText("Pathology Tests:", 20, y + 17);
        y += 25;

        // List tests with proper wrapping
        const testsText = indent.investigationAdvice.pathologyTests.join(", ");
        ctx.strokeRect(10, y, 830, 100);
        ctx.font = "11px Arial";

        const words = testsText.split(" ");
        let line = "";
        let lineY = y + 15;
        const maxWidth = 800;

        words.forEach((word) => {
          const testLine = line + word + " ";
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && line !== "") {
            ctx.fillText(line, 20, lineY);
            line = word + " ";
            lineY += 15;
          } else {
            line = testLine;
          }
        });
        ctx.fillText(line, 20, lineY);
        y += 100;
      }

      // Radiology Tests
      if (
        indent.investigationAdvice.adviceCategory === "Radiology" &&
        indent.investigationAdvice.radiologyTests?.length > 0
      ) {
        ctx.strokeRect(10, y, 830, 25);
        ctx.font = "bold 12px Arial";
        ctx.fillText(
          `${indent.investigationAdvice.radiologyType} Tests:`,
          20,
          y + 17,
        );
        y += 25;

        // List tests
        const testsText = indent.investigationAdvice.radiologyTests.join(", ");
        ctx.strokeRect(10, y, 830, 100);
        ctx.font = "11px Arial";

        const words = testsText.split(" ");
        let line = "";
        let lineY = y + 15;
        const maxWidth = 800;

        words.forEach((word) => {
          const testLine = line + word + " ";
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && line !== "") {
            ctx.fillText(line, 20, lineY);
            line = word + " ";
            lineY += 15;
          } else {
            line = testLine;
          }
        });
        ctx.fillText(line, 20, lineY);
        y += 100;
      }

      // Remarks
      if (indent.investigationAdvice.remarks) {
        ctx.strokeRect(10, y, 830, 25);
        ctx.font = "bold 12px Arial";
        ctx.fillText("Remarks:", 20, y + 17);
        y += 25;

        ctx.strokeRect(10, y, 830, 60);
        ctx.font = "11px Arial";
        ctx.fillText(indent.investigationAdvice.remarks, 20, y + 15);
        y += 60;
      }
    }

    // Move to footer position (always at bottom)
    y = 1050;

    // Footer - Prepared By and Approved By
    ctx.strokeRect(10, y, 415, 40);
    ctx.strokeRect(425, y, 415, 40);

    ctx.fillStyle = "#000000";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Prepared By", 20, y + 15);
    ctx.font = "11px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Nikhil Kumar Uranw", 20, y + 32, 390);

    ctx.font = "bold 12px Arial";
    ctx.fillText("Approved By", 435, y + 15);
    ctx.font = "11px Arial";
    ctx.fillText(username || "Pharmacy", 435, y + 32);

    return canvas.toDataURL("image/png");
  };

  const handleView = (indent) => {
    setSelectedIndent(indent);
    setViewModal(true);
  };

  const handleEdit = (indent) => {
    setSelectedIndent(indent);

    // Clone medicines to ensure they have IDs for editing
    const medicinesWithIds = (indent.medicines || []).map((med, index) => ({
      ...med,
      id: med.id || Date.now() + index, // Ensure each medicine has an ID
    }));

    setEditFormData({
      ...indent,
      medicines: medicinesWithIds,
      investigationAdvice: indent.investigationAdvice
        ? { ...indent.investigationAdvice }
        : {
            priority: "Medium",
            adviceCategory: "",
            pathologyTests: [],
            radiologyType: "",
            radiologyTests: [],
            remarks: "",
          },
    });
    setEditModal(true);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addMedicine = () => {
    const newMedicine = {
      id: Date.now(),
      name: "",
      quantity: "",
    };
    setEditFormData((prev) => ({
      ...prev,
      medicines: [...prev.medicines, newMedicine],
    }));
  };

  const removeMedicine = (id) => {
    setEditFormData((prev) => ({
      ...prev,
      medicines: prev.medicines.filter((med) => med.id !== id),
    }));
  };

  const updateMedicine = (id, field, value) => {
    setEditFormData((prev) => ({
      ...prev,
      medicines: prev.medicines.map((med) =>
        med.id === id ? { ...med, [field]: value } : med,
      ),
    }));
  };

  const handleInvestigationAdviceChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      investigationAdvice: {
        ...prev.investigationAdvice,
        [name]: value,
        ...(name === "adviceCategory" && {
          pathologyTests: [],
          radiologyType: "",
          radiologyTests: [],
        }),
        ...(name === "radiologyType" && { radiologyTests: [] }),
      },
    }));
  };

  const handleAdviceCheckboxChange = (testName, category) => {
    setEditFormData((prev) => {
      const currentTests =
        category === "pathology"
          ? prev.investigationAdvice.pathologyTests
          : prev.investigationAdvice.radiologyTests;

      const newTests = currentTests.includes(testName)
        ? currentTests.filter((t) => t !== testName)
        : [...currentTests, testName];

      return {
        ...prev,
        investigationAdvice: {
          ...prev.investigationAdvice,
          [category === "pathology" ? "pathologyTests" : "radiologyTests"]:
            newTests,
        },
      };
    });
  };

  const getRadiologyTests = () => {
    if (!editFormData?.investigationAdvice) return [];
    switch (editFormData.investigationAdvice.radiologyType) {
      case "X-ray":
        return xrayTests;
      case "CT-scan":
        return ctScanTests;
      case "USG":
        return usgTests;
      default:
        return [];
    }
  };

  const handleSaveEdit = async () => {
    if (editFormData.indentType !== "departmental" && !editFormData.diagnosis) {
      showPopup("Please enter Diagnosis", "warning");
      return;
    }

    if (
      editFormData.requestTypes.medicineSlip &&
      editFormData.medicines.length === 0
    ) {
      showPopup("Please add at least one medicine", "warning");
      return;
    }

    const incompleteMedicines = editFormData.medicines.some(
      (med) => !med.name || !med.quantity,
    );
    if (editFormData.requestTypes.medicineSlip && incompleteMedicines) {
      showPopup("Please fill all medicine details", "warning");
      return;
    }

    try {
      setLoading(true);

      const updateData = {
        medicines: JSON.stringify(editFormData.medicines),
        investigation_advice: JSON.stringify(editFormData.investigationAdvice),
      };

      if (editFormData.indentType === "departmental") {
        updateData.remarks = editFormData.remarks || "";
      } else {
        updateData.diagnosis = editFormData.diagnosis;
      }

      const { error } = await supabase
        .from(editFormData.sourceTable)
        .update(updateData)
        .eq("id", editFormData.sourceId);

      if (error) throw error;

      // Refresh data
      await loadData();

      setEditModal(false);
      setEditFormData(null);
      setSelectedIndent(null);

      showPopup("Indent updated successfully!", "success");
    } catch (error) {
      console.error("Error updating indent:", error);
      showPopup(`Failed to update indent: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleViewSlip = (indent) => {
    setSelectedIndent(indent);
    setSlipModal(true);
  };

  const downloadSlip = async (indent) => {
    try {
      let imageUrl = indent.slipImage;

      // If we have a storage URL, try to use it
      if (indent.slipImageUrl) {
        imageUrl = indent.slipImageUrl;
      }

      const link = document.createElement("a");
      link.download = `Pharmacy_Slip_${indent.indentNumber}.png`;
      link.href = imageUrl;
      link.click();

      showPopup("Slip downloaded successfully!", "success");
    } catch (error) {
      console.error("Error downloading slip:", error);
      showPopup("Failed to download slip", "error");
    }
  };

  // Filter Logic
  const applyFilters = (records) => {
    return records.filter((record) => {
      const matchesPatient = selectedPatient
        ? (record.displayTitle || record.patientName) === selectedPatient
        : true;
      const matchesIndentType =
        indentTypeFilter === "all" || record.indentType === indentTypeFilter;
      let matchesDate = true;
      if (selectedDate && record.planned1) {
        const recordDate = new Date(record.planned1).toLocaleDateString();
        const filterDate = new Date(selectedDate).toLocaleDateString();
        matchesDate = recordDate === filterDate;
      }
      return matchesPatient && matchesDate && matchesIndentType;
    });
  };

  const filteredPendingIndents = applyFilters(pendingIndents);
  const filteredHistoryIndents = applyFilters(historyIndents);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Fixed Section: Header, Tabs, and Filters */}
      <div className="flex-none bg-white border-b shrink-0">
        <div className="px-4 py-3 mx-auto max-w-7xl sm:px-6">
          {/* Header */}
          <div className="flex flex-col items-start justify-between gap-3 mb-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-800 sm:text-2xl lg:text-3xl">
                Pharmacy Approval
              </h1>
              <p className="hidden sm:block text-sm text-gray-600 mt-0.5">
                Review and approve pharmacy indent requests
              </p>
            </div>

            {/* Submit Button - Only if changes exist and in pending tab */}
            {activeTab === "pending" &&
              Object.keys(statusChanges).length > 0 && (
                <div className="flex w-full gap-2 sm:w-auto">
                  <button
                    onClick={() => setStatusChanges({})}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white transition-colors bg-gray-500 rounded-lg sm:flex-none hover:bg-gray-600"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveStatusChanges}
                    className="flex items-center justify-center flex-1 gap-2 px-4 py-2 text-sm font-medium text-white transition-colors bg-green-600 rounded-lg sm:flex-none hover:bg-green-700"
                    disabled={loading}
                  >
                    <Save className="w-4 h-4" />
                    {loading ? "Submitting..." : "Submit"}
                  </button>
                </div>
              )}
          </div>

          {/* Tabs and Filters Section - Compact */}
          <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
            <div className="flex w-full gap-4 pb-2 overflow-x-auto border-b border-gray-100 lg:w-auto lg:border-none lg:pb-0">
              <button
                onClick={() => setActiveTab("pending")}
                className={`pb-2 lg:pb-0 px-1 whitespace-nowrap text-sm ${
                  activeTab === "pending"
                    ? "border-b-2 border-green-500 text-green-600 font-bold"
                    : "text-gray-500 hover:text-gray-700 font-medium"
                }`}
              >
                Pending ({filteredPendingIndents.length})
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`pb-2 lg:pb-0 px-1 whitespace-nowrap text-sm ${
                  activeTab === "history"
                    ? "border-b-2 border-green-500 text-green-600 font-bold"
                    : "text-gray-500 hover:text-gray-700 font-medium"
                }`}
              >
                History ({filteredHistoryIndents.length})
              </button>
            </div>

            <div className="flex flex-wrap w-full gap-2 lg:w-auto">
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="flex-1 lg:flex-none px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">All Indents</option>
                {patientNames.map((name, index) => (
                  <option key={index} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={indentTypeFilter}
                onChange={(e) => setIndentTypeFilter(e.target.value)}
                className="flex-1 lg:flex-none px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="all">All Types</option>
                <option value="patient">Patient</option>
                <option value="departmental">Departmental</option>
              </select>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 lg:flex-none px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              />

              {(selectedPatient ||
                selectedDate ||
                indentTypeFilter !== "all") && (
                <button
                  onClick={() => {
                    setSelectedPatient("");
                    setSelectedDate("");
                    setIndentTypeFilter("all");
                  }}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 p-3 overflow-hidden md:p-4">
        <div className="flex flex-col h-full mx-auto max-w-7xl">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center p-4 mb-4 border border-blue-200 rounded-lg bg-blue-50">
              <div className="w-6 h-6 mr-3 border-b-2 border-blue-600 rounded-full animate-spin"></div>
              <span className="font-medium text-blue-800">Loading data...</span>
            </div>
          )}

          {/* Pending Section */}
          {activeTab === "pending" && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Desktop Table - Scrollable Container */}
              <div className="flex-1 hidden overflow-auto bg-white border border-gray-200 rounded-lg shadow-sm md:block">
                <table className="min-w-full border-separate divide-y divide-gray-200 border-spacing-0">
                  <thead className="sticky top-0 z-10 bg-green-600">
                    <tr>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Select
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Status
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Indent No
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Target / Admission
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Indent Title
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        UHID
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Staff Name
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Diagnosis
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Request Type
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Planned
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPendingIndents.length > 0 ? (
                      filteredPendingIndents.map((indent) => (
                        <tr key={indent.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={!!statusChanges[indent.id]}
                              onChange={(e) => {
                                if (!e.target.checked) {
                                  const newChanges = { ...statusChanges };
                                  delete newChanges[indent.id];
                                  setStatusChanges(newChanges);
                                } else {
                                  handleStatusChange(
                                    indent.id,
                                    indent.indentNumber,
                                    "Approved",
                                  );
                                }
                              }}
                              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                              disabled={loading}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={statusChanges[indent.id]?.status || ""}
                              onChange={(e) =>
                                handleStatusChange(
                                  indent.id,
                                  indent.indentNumber,
                                  e.target.value,
                                )
                              }
                              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                              disabled={loading}
                            >
                              <option value="">Select Status</option>
                              <option value="Approved">Approved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-green-700">
                            {indent.indentNumber}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {indent.indentType === "departmental"
                              ? indent.location || "-"
                              : indent.admissionNumber}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="font-medium">
                              {indent.displayTitle || indent.patientName}
                            </div>
                            <div className="mt-1">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  indent.indentType === "departmental"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {indent.indentType === "departmental"
                                  ? "Departmental"
                                  : "Patient"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {indent.uhidNumber}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {indent.staffName}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {indent.indentType === "departmental"
                              ? indent.remarks || "-"
                              : indent.diagnosis}
                          </td>
                          <td className="px-6 py-4 text-sm">
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
                          <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
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
                          <td className="px-6 py-4 text-sm">
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
                                className="p-2 text-white transition-colors rounded-lg bg-amber-500 hover:bg-amber-600"
                                title="Edit Indent"
                                disabled={loading}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="11" className="px-6 py-12 text-center">
                          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p className="font-medium text-gray-500">
                            No pending indents
                          </p>
                          <p className="mt-1 text-sm text-gray-400">
                            All indents have been processed
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View for Pending - Scrollable Container */}
              <div className="flex-1 space-y-4 overflow-auto md:hidden">
                {filteredPendingIndents.length > 0 ? (
                  filteredPendingIndents.map((indent) => (
                    <div
                      key={indent.id}
                      className="p-4 space-y-3 bg-white rounded-lg shadow"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!statusChanges[indent.id]}
                            onChange={(e) => {
                              if (!e.target.checked) {
                                const newChanges = { ...statusChanges };
                                delete newChanges[indent.id];
                                setStatusChanges(newChanges);
                              } else {
                                handleStatusChange(
                                  indent.id,
                                  indent.indentNumber,
                                  "Approved",
                                );
                              }
                            }}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                            disabled={loading}
                          />
                          <div>
                            <span className="font-semibold text-green-700">
                              {indent.indentNumber}
                            </span>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {indent.indentType === "departmental"
                                ? indent.location || "Departmental"
                                : indent.admissionNumber}
                            </p>
                          </div>
                        </div>
                        <select
                          value={statusChanges[indent.id]?.status || ""}
                          onChange={(e) =>
                            handleStatusChange(
                              indent.id,
                              indent.indentNumber,
                              e.target.value,
                            )
                          }
                          className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                          disabled={loading}
                        >
                          <option value="">Status</option>
                          <option value="Approved">Approve</option>
                          <option value="Rejected">Reject</option>
                        </select>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Title:</span>
                          <span className="font-medium text-gray-900">
                            {indent.displayTitle || indent.patientName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Diagnosis:</span>
                          <span className="font-medium text-gray-900 text-right truncate max-w-[150px]">
                            {indent.indentType === "departmental"
                              ? indent.remarks || "-"
                              : indent.diagnosis}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Planned:</span>
                          <span className="font-medium text-gray-900">
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
                          </span>
                        </div>

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

                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleView(indent)}
                          className="flex justify-center flex-1 p-2 text-green-600 transition-colors bg-green-100 rounded-lg hover:bg-green-200"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(indent)}
                          className="flex justify-center flex-1 p-2 transition-colors rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200"
                          title="Edit Indent"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center bg-white rounded-lg shadow">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-gray-500">
                      No pending indents
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* History Section */}
          {activeTab === "history" && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Desktop Table - Scrollable Container */}
              <div className="flex-1 hidden overflow-auto bg-white border border-gray-200 rounded-lg shadow-sm md:block">
                <table className="min-w-full border-separate divide-y divide-gray-200 border-spacing-0">
                  <thead className="sticky top-0 z-10 bg-green-600">
                    <tr>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Indent No
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Target / Admission
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Indent Title
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        UHID
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Staff Name
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Diagnosis
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Request Type
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Status
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Planned
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Actual
                      </th>
                      <th className="px-6 py-3 text-sm font-semibold text-left text-white bg-green-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredHistoryIndents.length > 0 ? (
                      filteredHistoryIndents.map((indent) => (
                        <tr key={indent.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-green-700">
                            {indent.indentNumber}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {indent.indentType === "departmental"
                              ? indent.location || "-"
                              : indent.admissionNumber}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="font-medium">
                              {indent.displayTitle || indent.patientName}
                            </div>
                            <div className="mt-1">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  indent.indentType === "departmental"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {indent.indentType === "departmental"
                                  ? "Departmental"
                                  : "Patient"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {indent.uhidNumber}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {indent.staffName}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {indent.indentType === "departmental"
                              ? indent.remarks || "-"
                              : indent.diagnosis}
                          </td>
                          <td className="px-6 py-4 text-sm">
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
                          <td className="px-6 py-4 text-sm">
                            {indent.status === "approved" ? (
                              <span className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                                Approved
                              </span>
                            ) : (
                              <span className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                                Rejected
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
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
                          <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                            {indent.actual1
                              ? new Date(indent.actual1).toLocaleString(
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
                          <td className="px-6 py-4 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleView(indent)}
                                className="p-2 text-white transition-colors bg-green-500 rounded-lg hover:bg-green-600"
                                title="View Details"
                                disabled={loading}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {indent.status === "approved" &&
                                (indent.slipImage || indent.slipImageUrl) && (
                                  <button
                                    onClick={() => handleViewSlip(indent)}
                                    className="p-2 text-white transition-colors bg-green-500 rounded-lg hover:bg-green-600"
                                    title="View Slip"
                                    disabled={loading}
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="11" className="px-6 py-12 text-center">
                          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p className="font-medium text-gray-500">
                            No history yet
                          </p>
                          <p className="mt-1 text-sm text-gray-400">
                            Approved and rejected indents will appear here
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View for History - Scrollable Container */}
              <div className="flex-1 space-y-4 overflow-auto md:hidden">
                {filteredHistoryIndents.length > 0 ? (
                  filteredHistoryIndents.map((indent) => (
                    <div
                      key={indent.id}
                      className="p-4 space-y-3 bg-white rounded-lg shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-semibold text-green-700">
                            {indent.indentNumber}
                          </span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {indent.admissionNumber}
                          </p>
                        </div>
                        {indent.status === "approved" ? (
                          <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                            Approved
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                            Rejected
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Patient:</span>
                          <span className="font-medium text-gray-900">
                            {indent.patientName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Planned:</span>
                          <span className="font-medium text-gray-900">
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
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Actual:</span>
                          <span className="font-medium text-gray-900">
                            {indent.actual1
                              ? new Date(indent.actual1).toLocaleString(
                                  "en-GB",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "2-digit",
                                    month: "short",
                                  },
                                )
                              : "-"}
                          </span>
                        </div>

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

                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleView(indent)}
                          className="flex justify-center flex-1 p-2 text-green-600 transition-colors bg-green-100 rounded-lg hover:bg-green-200"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {indent.status === "approved" &&
                          (indent.slipImage || indent.slipImageUrl) && (
                            <button
                              onClick={() => handleViewSlip(indent)}
                              className="flex justify-center flex-1 p-2 text-green-600 transition-colors bg-green-100 rounded-lg hover:bg-green-200"
                              title="View Slip"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center bg-white rounded-lg shadow">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-gray-500">No history yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && editFormData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 text-white bg-amber-600">
              <h2 className="text-xl font-bold">
                Edit Indent - {editFormData.indentNumber}
              </h2>
              <button
                onClick={() => {
                  setEditModal(false);
                  setEditFormData(null);
                }}
                className="p-1 text-white rounded-full hover:bg-amber-700"
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
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-gray-500">
                      {editFormData.indentType === "departmental"
                        ? "Location"
                        : "Admission Number"}
                    </p>
                    <p className="font-medium">
                      {editFormData.indentType === "departmental"
                        ? editFormData.location
                        : editFormData.admissionNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">
                      {editFormData.indentType === "departmental"
                        ? "Indent Title"
                        : "Patient Name"}
                    </p>
                    <p className="font-medium">
                      {editFormData.displayTitle || editFormData.patientName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">
                      {editFormData.indentType === "departmental"
                        ? "Requested By"
                        : "UHID Number"}
                    </p>
                    <p className="font-medium">
                      {editFormData.indentType === "departmental"
                        ? editFormData.requestedBy
                        : editFormData.uhidNumber}
                    </p>
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      {editFormData.indentType === "departmental"
                        ? "Remarks"
                        : "Diagnosis"}
                      {editFormData.indentType !== "departmental" && (
                        <span className="text-red-500"> *</span>
                      )}
                    </label>
                    <input
                      type="text"
                      name={
                        editFormData.indentType === "departmental"
                          ? "remarks"
                          : "diagnosis"
                      }
                      value={
                        editFormData.indentType === "departmental"
                          ? editFormData.remarks || ""
                          : editFormData.diagnosis
                      }
                      onChange={handleEditInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={
                        editFormData.indentType === "departmental"
                          ? "Enter remarks"
                          : "Enter diagnosis"
                      }
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Medicines Section */}
              {editFormData.requestTypes.medicineSlip && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="pb-2 text-lg font-semibold text-gray-800 border-b">
                      Medicines
                    </h3>
                  </div>

                  <div className="mb-4 space-y-3">
                    {editFormData.medicines.map((medicine, index) => (
                      <div key={medicine.id} className="flex items-end gap-3">
                        <div className="flex items-center justify-center w-8 h-10 font-semibold text-white bg-green-600 rounded">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <label className="block mb-1 text-sm font-medium text-gray-700">
                            Medicine Name
                          </label>
                          <MedicineDropdown
                            medicine={medicine}
                            onUpdate={updateMedicine}
                            index={index}
                            loading={loading}
                            medicines={medicines}
                          />
                        </div>
                        <div className="w-32">
                          <label className="block mb-1 text-sm font-medium text-gray-700">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={medicine.quantity}
                            onChange={(e) =>
                              updateMedicine(
                                medicine.id,
                                "quantity",
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="0"
                            disabled={loading}
                          />
                        </div>
                        <button
                          onClick={() => removeMedicine(medicine.id)}
                          className="h-10 px-3 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:bg-red-300"
                          disabled={loading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addMedicine}
                    className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300"
                    disabled={loading}
                  >
                    <Plus className="w-4 h-4" />
                    Add Medicine
                  </button>
                </div>
              )}

              {/* Investigation Advice Section */}
              {editFormData.requestTypes.investigation &&
                editFormData.investigationAdvice && (
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
                            value={editFormData.investigationAdvice.priority}
                            onChange={handleInvestigationAdviceChange}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            disabled={loading}
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
                            value={
                              editFormData.investigationAdvice.adviceCategory
                            }
                            onChange={handleInvestigationAdviceChange}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            disabled={loading}
                          >
                            <option value="">Select Category</option>
                            <option value="Pathology">Pathology</option>
                            <option value="Radiology">Radiology</option>
                          </select>
                        </div>
                      </div>

                      {/* Pathology Tests */}
                      {editFormData.investigationAdvice.adviceCategory ===
                        "Pathology" && (
                        <div>
                          <label className="block mb-2 text-sm font-medium text-gray-700">
                            Select Pathology Tests * (
                            {
                              editFormData.investigationAdvice.pathologyTests
                                .length
                            }{" "}
                            selected)
                          </label>
                          <div className="p-4 overflow-y-auto bg-white border border-gray-300 rounded-lg max-h-60">
                            {pathologyTests.length > 0 ? (
                              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                                {pathologyTests.map((test) => (
                                  <label
                                    key={test}
                                    className="flex items-start gap-2 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={editFormData.investigationAdvice.pathologyTests.includes(
                                        test,
                                      )}
                                      onChange={() =>
                                        handleAdviceCheckboxChange(
                                          test,
                                          "pathology",
                                        )
                                      }
                                      className="mt-1 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                      disabled={loading}
                                    />
                                    <span className="text-sm text-gray-700">
                                      {test}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div className="py-8 text-center text-gray-500">
                                <p>Loading pathology tests...</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Radiology Section */}
                      {editFormData.investigationAdvice.adviceCategory ===
                        "Radiology" && (
                        <>
                          <div>
                            <label className="block mb-1 text-sm font-medium text-gray-700">
                              Radiology Type *
                            </label>
                            <select
                              name="radiologyType"
                              value={
                                editFormData.investigationAdvice.radiologyType
                              }
                              onChange={handleInvestigationAdviceChange}
                              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                              disabled={loading}
                            >
                              <option value="">Select Type</option>
                              <option value="X-ray">X-ray</option>
                              <option value="CT-scan">CT Scan</option>
                              <option value="USG">USG</option>
                            </select>
                          </div>

                          {editFormData.investigationAdvice.radiologyType && (
                            <div>
                              <label className="block mb-2 text-sm font-medium text-gray-700">
                                Select{" "}
                                {editFormData.investigationAdvice.radiologyType}{" "}
                                Tests * (
                                {
                                  editFormData.investigationAdvice
                                    .radiologyTests.length
                                }{" "}
                                selected)
                              </label>
                              <div className="p-4 overflow-y-auto bg-white border border-gray-300 rounded-lg max-h-60">
                                {(() => {
                                  const tests = getRadiologyTests();
                                  return tests.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                                      {tests.map((test) => (
                                        <label
                                          key={test}
                                          className="flex items-start gap-2 cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={editFormData.investigationAdvice.radiologyTests.includes(
                                              test,
                                            )}
                                            onChange={() =>
                                              handleAdviceCheckboxChange(
                                                test,
                                                "radiology",
                                              )
                                            }
                                            className="mt-1 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                            disabled={loading}
                                          />
                                          <span className="text-sm text-gray-700">
                                            {test}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="py-8 text-center text-gray-500">
                                      <p>
                                        Loading{" "}
                                        {
                                          editFormData.investigationAdvice
                                            .radiologyType
                                        }{" "}
                                        tests...
                                      </p>
                                    </div>
                                  );
                                })()}
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
                          value={editFormData.investigationAdvice.remarks}
                          onChange={handleInvestigationAdviceChange}
                          rows="3"
                          placeholder="Add any additional notes or instructions..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>
                )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t">
                <button
                  onClick={() => {
                    setEditModal(false);
                    setEditFormData(null);
                  }}
                  className="px-6 py-2 font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:bg-gray-100"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex items-center gap-2 px-6 py-2 font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-b-2 border-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Submit Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewModal && selectedIndent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 text-white bg-green-600">
              <h2 className="text-xl font-bold">
                Indent Details - {selectedIndent.indentNumber}
              </h2>
              <button
                onClick={() => {
                  setViewModal(false);
                  setSelectedIndent(null);
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
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-gray-500">
                      {selectedIndent.indentType === "departmental"
                        ? "Location"
                        : "Admission Number"}
                    </p>
                    <p className="font-medium">
                      {selectedIndent.indentType === "departmental"
                        ? selectedIndent.location
                        : selectedIndent.admissionNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">
                      {selectedIndent.indentType === "departmental"
                        ? "Indent Title"
                        : "Patient Name"}
                    </p>
                    <p className="font-medium">
                      {selectedIndent.displayTitle ||
                        selectedIndent.patientName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">
                      {selectedIndent.indentType === "departmental"
                        ? "Requested By"
                        : "UHID Number"}
                    </p>
                    <p className="font-medium">
                      {selectedIndent.indentType === "departmental"
                        ? selectedIndent.requestedBy
                        : selectedIndent.uhidNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Age</p>
                    <p className="font-medium">{selectedIndent.age}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Gender</p>
                    <p className="font-medium">{selectedIndent.gender}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    <p className="font-medium">{selectedIndent.category}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Room</p>
                    <p className="font-medium">{selectedIndent.room}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Ward Location</p>
                    <p className="font-medium">{selectedIndent.wardLocation}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Staff Name</p>
                    <p className="font-medium">{selectedIndent.staffName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Consultant Name</p>
                    <p className="font-medium">
                      {selectedIndent.consultantName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">
                      {selectedIndent.indentType === "departmental"
                        ? "Remarks"
                        : "Diagnosis"}
                    </p>
                    <p className="font-medium">
                      {selectedIndent.indentType === "departmental"
                        ? selectedIndent.remarks || "-"
                        : selectedIndent.diagnosis}
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
                  {selectedIndent.requestTypes.medicineSlip && (
                    <span className="px-3 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg">
                      Medicine Slip
                    </span>
                  )}
                  {selectedIndent.requestTypes.investigation && (
                    <span className="px-3 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg">
                      Investigation
                    </span>
                  )}
                  {selectedIndent.requestTypes.package && (
                    <span className="px-3 py-2 text-sm font-medium text-purple-700 bg-purple-100 rounded-lg">
                      Package
                    </span>
                  )}
                  {selectedIndent.requestTypes.nonPackage && (
                    <span className="px-3 py-2 text-sm font-medium text-orange-700 bg-orange-100 rounded-lg">
                      Non-Package
                    </span>
                  )}
                </div>
              </div>

              {/* Medicines */}
              {selectedIndent.requestTypes.medicineSlip &&
                selectedIndent.medicines.length > 0 && (
                  <div className="mb-6">
                    <h3 className="pb-2 mb-4 text-lg font-semibold text-gray-800 border-b">
                      Medicines
                    </h3>
                    <div className="overflow-hidden rounded-lg bg-gray-50">
                      <table className="min-w-full">
                        <thead className="text-white bg-green-600">
                          <tr>
                            <th className="px-4 py-3 text-sm font-semibold text-left">
                              #
                            </th>
                            <th className="px-4 py-3 text-sm font-semibold text-left">
                              Medicine Name
                            </th>
                            <th className="px-4 py-3 text-sm font-semibold text-left">
                              Quantity
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {selectedIndent.medicines.map((medicine, index) => (
                            <tr key={medicine.id || index}>
                              <td className="px-4 py-3 text-sm">{index + 1}</td>
                              <td className="px-4 py-3 text-sm font-medium">
                                {medicine.name}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {medicine.quantity}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* Investigation Advice */}
              {selectedIndent.requestTypes.investigation &&
                selectedIndent.investigationAdvice && (
                  <div className="mb-6">
                    <h3 className="pb-2 mb-4 text-lg font-semibold text-gray-800 border-b">
                      Investigation Advice
                    </h3>
                    <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
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
                          <span className="text-gray-600">Category:</span>
                          <div className="mt-1 font-medium text-gray-900">
                            {selectedIndent.investigationAdvice.adviceCategory}
                          </div>
                        </div>

                        {selectedIndent.investigationAdvice.adviceCategory ===
                          "Pathology" &&
                          selectedIndent.investigationAdvice.pathologyTests
                            ?.length > 0 && (
                            <div>
                              <span className="text-gray-600">
                                Pathology Tests (
                                {
                                  selectedIndent.investigationAdvice
                                    .pathologyTests.length
                                }
                                ):
                              </span>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {selectedIndent.investigationAdvice.pathologyTests.map(
                                  (test, index) => (
                                    <span
                                      key={index}
                                      className="px-2 py-1 text-xs text-green-700 bg-green-100 rounded-full"
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
                              <span className="text-gray-600">
                                Radiology Type:
                              </span>
                              <div className="mt-1 font-medium text-gray-900">
                                {
                                  selectedIndent.investigationAdvice
                                    .radiologyType
                                }
                              </div>
                            </div>
                            {selectedIndent.investigationAdvice.radiologyTests
                              ?.length > 0 && (
                              <div>
                                <span className="text-gray-600">
                                  Tests (
                                  {
                                    selectedIndent.investigationAdvice
                                      .radiologyTests.length
                                  }
                                  ):
                                </span>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {selectedIndent.investigationAdvice.radiologyTests.map(
                                    (test, index) => (
                                      <span
                                        key={index}
                                        className="px-2 py-1 text-xs text-purple-700 bg-purple-100 rounded-full"
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
                          <div>
                            <span className="text-gray-600">Remarks:</span>
                            <div className="p-2 mt-1 font-medium text-gray-900 bg-white border border-gray-200 rounded">
                              {selectedIndent.investigationAdvice.remarks}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              {/* Status */}
              {selectedIndent.status && selectedIndent.status !== "pending" && (
                <div className="mb-6">
                  <h3 className="pb-2 mb-4 text-lg font-semibold text-gray-800 border-b">
                    Status
                  </h3>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-4 py-2 rounded-lg font-medium ${
                        selectedIndent.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {selectedIndent.status === "approved"
                        ? "Approved"
                        : "Rejected"}
                    </span>
                    {selectedIndent.approvedAt && (
                      <span className="text-sm text-gray-500">
                        on{" "}
                        {new Date(selectedIndent.approvedAt).toLocaleString()}
                      </span>
                    )}
                    {selectedIndent.rejectedAt && (
                      <span className="text-sm text-gray-500">
                        on{" "}
                        {new Date(selectedIndent.rejectedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-6 border-t">
                <button
                  onClick={() => {
                    setViewModal(false);
                    setSelectedIndent(null);
                  }}
                  className="px-6 py-2 font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slip View Modal */}
      {slipModal &&
        selectedIndent &&
        (selectedIndent.slipImage || selectedIndent.slipImageUrl) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 flex items-center justify-between px-6 py-4 text-white bg-green-600">
                <h2 className="text-xl font-bold">
                  Pharmacy Slip - {selectedIndent.indentNumber}
                </h2>
                <button
                  onClick={() => {
                    setSlipModal(false);
                    setSelectedIndent(null);
                  }}
                  className="p-1 text-white rounded-full hover:bg-green-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="p-4 mb-4 bg-gray-100 rounded-lg">
                  <img
                    src={
                      selectedIndent.slipImageUrl || selectedIndent.slipImage
                    }
                    alt="Pharmacy Slip"
                    className="w-full border border-gray-300 rounded"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => downloadSlip(selectedIndent)}
                    className="flex items-center gap-2 px-6 py-2 font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                  >
                    <Download className="w-4 h-4" />
                    Download Slip
                  </button>
                  <button
                    onClick={() => {
                      setSlipModal(false);
                      setSelectedIndent(null);
                    }}
                    className="px-6 py-2 font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
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
};

export default PharmacyApproval;
