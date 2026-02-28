import React, { useState, useEffect } from "react";
import { Eye } from "lucide-react";
import supabase from "../SupabaseClient";

// Status Badge Component
const StatusBadge = ({ status }) => {
  const getColors = () => {
    const statusUpper = (status || "").toUpperCase();
    if (statusUpper.includes("PRIVATE") || statusUpper === "VIP") {
      return "bg-purple-100 text-purple-700";
    } else if (
      statusUpper.includes("INSURANCE") ||
      statusUpper.includes("CORPORATE")
    ) {
      return "bg-blue-100 text-blue-700";
    } else if (
      statusUpper.includes("AYUSHMAN") ||
      statusUpper.includes("GJAY")
    ) {
      return "bg-green-100 text-green-700";
    }
    return "bg-gray-100 text-gray-700";
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${getColors()}`}
    >
      {status}
    </span>
  );
};

// Patient Card Component
const PatientCard = ({ patient, onViewDetails, onEdit, onDelete }) => {
  const [assignedNurses, setAssignedNurses] = useState([]);
  const [currentShift, setCurrentShift] = useState("");
  const [otDays, setOtDays] = useState(null);
  const [otDaysLabel, setOtDaysLabel] = useState("OT Days:");

  // Function to calculate time in ward
  const calculateTimeInWard = (admissionDate) => {
    if (!admissionDate) return "N/A";
    try {
      const admitted = new Date(admissionDate);
      const now = new Date();
      const diffMs = now - admitted;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      const remainingHours = diffHours % 24;
      if (diffDays > 0) {
        return `${diffDays}d ${remainingHours}h`;
      } else if (diffHours > 0) {
        return `${diffHours}h`;
      } else {
        return "Less than 1h";
      }
    } catch (error) {
      return "N/A";
    }
  };

  // Fetch assigned nurses for this patient and current shift
  useEffect(() => {
    const fetchNurses = async () => {
      // Calculate current shift
      const now = new Date();
      const hour = now.getHours();
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .split("T")[0];
      let shift = "";
      let start = "";
      let end = "";
      if (hour >= 8 && hour < 14) {
        shift = "A";
        start = `${today} 08:00:00`;
        end = `${today} 14:00:00`;
      } else if (hour >= 14 && hour < 20) {
        shift = "B";
        start = `${today} 14:00:00`;
        end = `${today} 20:00:00`;
      } else if (hour >= 20) {
        shift = "C";
        start = `${today} 20:00:00`;
        end = `${today} 23:59:59`;
      } else {
        shift = "C";
        start = `${yesterday} 20:00:00`;
        end = `${today} 08:00:00`;
      }
      setCurrentShift(shift);
      // Fetch nurse assignments for this patient and shift
      try {
        const { data, error } = await supabase
          .from("nurse_assign_task")
          .select("assign_nurse")
          .eq("Ipd_number", patient.ipd_number || patient.admission_no)
          .gte("planned1", start)
          .lte("planned1", end);
        if (!error && data) {
          const uniqueNurses = [
            ...new Set(data.map((n) => n.assign_nurse?.trim()).filter(Boolean)),
          ];

          setAssignedNurses(uniqueNurses);
        } else {
          setAssignedNurses([]);
        }
      } catch (err) {
        setAssignedNurses([]);
      }
    };
    fetchNurses();
  }, [patient.ipd_number, patient.admission_no]);

  // Fetch OT Days:
  //  - If OT is cancelled (status === "Cancel") → hide field.
  //  - If OT is completed (actual2 is set) → show days since completion.
  //  - Otherwise → hide field.
  useEffect(() => {
    const fetchOTDays = async () => {
      const ipd = patient.ipd_number || patient.admission_no;
      if (!ipd) return;
      try {
        const { data, error } = await supabase
          .from("ot_information")
          .select("ot_date, actual2, status")
          .eq("ipd_number", ipd)
          .not("ot_date", "is", null)
          .order("ot_date", { ascending: true })
          .limit(1);

        if (!error && data && data.length > 0) {
          const record = data[0];

          // If OT was cancelled — hide the field entirely
          if (record.status === "Cancel") {
            setOtDays(null);
            setOtDaysLabel("Days Since OT Done:");
            return;
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (record.actual2) {
            // OT is completed — count days since completion
            const completedDate = new Date(record.actual2);
            completedDate.setHours(0, 0, 0, 0);
            const diffMs = today - completedDate;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            setOtDays(diffDays < 0 ? 0 : diffDays);
            setOtDaysLabel("Days Since OT Done:");
          } else {
            // OT not yet completed — hide the field
            setOtDays(null);
            setOtDaysLabel("Days Since OT Done:");
          }
        } else {
          setOtDays(null); // null = no OT record → field hidden
          setOtDaysLabel("Days Since OT Done:");
        }
      } catch (err) {
        setOtDays(null);
      }
    };
    fetchOTDays();
  }, [patient.ipd_number, patient.admission_no]);

  const patientName = patient.patient_name || patient.name || "N/A";
  const consultantDr = patient.consultant_dr || patient.doctor || "N/A";
  const age = patient.age || "N/A";
  const bedLocation =
    patient.bed_location || patient.location_status || patient.ward || "N/A";
  const bedNo = patient.bed_no || patient.bedNumber || "N/A";
  const ipdNo = patient.ipd_number || patient.admission_no || "N/A";
  const patCategory =
    patient.pat_category || patient.patientCategory || "General";
  const timeInWard =
    patient.time_in_ward ||
    calculateTimeInWard(patient.admission_date) ||
    "N/A";
  const mobileNumber = patient.phone_no || patient.mobileNumber || "N/A";
  const wardType = patient.ward_type || "N/A";
  const roomNo = patient.room || patient.room_no || "N/A";
  const department = patient.department || "N/A";

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg border border-gray-200 p-5 transition-all duration-300 hover:scale-[1.02]">
      <div className="flex justify-between items-start mb-4 gap-4">
        {/* Left: Patient Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 truncate">
            {patientName}
          </h3>

          <p className="text-sm text-gray-600 truncate">{consultantDr}</p>

          <p className="text-xs text-gray-500 mt-0.5 truncate">{department}</p>
        </div>

        {/* Right: Shift + Nurse + Age */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* Shift Badge */}
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide
        ${
          currentShift === "Night"
            ? "bg-indigo-100 text-indigo-700"
            : currentShift === "Evening"
              ? "bg-orange-100 text-orange-700"
              : "bg-green-100 text-green-700"
        }`}
          >
            Shift {currentShift || "N/A"}
          </span>

          {/* Assigned Nurses */}
          <div className="flex flex-wrap justify-end gap-1 max-w-[180px]">
            {assignedNurses.length > 0 ? (
              assignedNurses.map((nurse, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-green-50 text-green-700 text-[11px] font-semibold rounded-full border border-green-200 truncate"
                >
                  {nurse}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-400 italic">
                No Nurse Assigned
              </span>
            )}
          </div>

          {/* Age Badge */}
          <div className="bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-sm shadow">
            {age}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4 border-t pt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Ward/Bed:</span>
          <span className="font-semibold text-gray-900">
            {bedLocation} / {bedNo}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">IPD No:</span>
          <span className="font-semibold text-gray-900">{ipdNo}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Mobile:</span>
          <span className="font-semibold text-gray-900">{mobileNumber}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Ward Type:</span>
          <span className="font-semibold text-blue-600">{wardType}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Room:</span>
          <span className="font-semibold text-gray-900">{roomNo}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Time in Ward:</span>
          <span className="font-semibold text-green-600">{timeInWard}</span>
        </div>
        {otDays !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{otDaysLabel}</span>
            <span className="font-semibold text-purple-600">
              {otDays === 0
                ? "Today"
                : `${otDays} day${otDays !== 1 ? "s" : ""}`}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t mb-4">
        <StatusBadge status={patCategory} />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onViewDetails(patient)}
          className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg transition-colors font-medium text-sm"
        >
          <Eye className="w-4 h-4" />
          View Details
        </button>
      </div>
    </div>
  );
};

export default PatientCard;
