import React, { useState, useEffect } from "react";
import { Eye } from "lucide-react";
import supabase from "../SupabaseClient";

// Status Badge Component
const StatusBadge = ({ status }) => {
  const getColors = () => {
    const statusUpper = (status || "").toUpperCase();
    if (statusUpper.includes("PRIVATE") || statusUpper === "VIP") {
      return "bg-purple-50 text-purple-700 border-purple-100";
    } else if (
      statusUpper.includes("INSURANCE") ||
      statusUpper.includes("CORPORATE")
    ) {
      return "bg-blue-50 text-blue-700 border-blue-100";
    } else if (
      statusUpper.includes("AYUSHMAN") ||
      statusUpper.includes("GJAY")
    ) {
      return "bg-green-50 text-green-700 border-green-100";
    }
    return "bg-gray-50 text-gray-700 border-gray-100";
  };

  return (
    <div
      className={`px-3 py-1.5 rounded-xl border font-bold text-[10px] uppercase tracking-wider max-w-[150px] sm:max-w-[180px] lg:max-w-[200px] ${getColors()}`}
      title={status}
    >
      <p className="leading-tight break-words line-clamp-2">{status}</p>
    </div>
  );
};

// Patient Card Component
const PatientCard = ({
  patient,
  onViewDetails,
  onEdit,
  onDelete,
  compactView,
}) => {
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
      const now = new Date();
      const hour = now.getHours();

      let shiftLabel = "";
      if (hour >= 8 && hour < 14) {
        shiftLabel = "Shift A";
      } else if (hour >= 14 && hour < 20) {
        shiftLabel = "Shift B";
      } else {
        shiftLabel = "Shift C";
      }
      setCurrentShift(shiftLabel);

      try {
        const { data, error } = await supabase
          .from("nurse_assign_task")
          .select("assign_nurse, shift")
          .eq("Ipd_number", patient.ipd_number || patient.admission_no)
          .eq("shift", shiftLabel)
          .order("timestamp", { ascending: false });

        if (!error && data) {
          const unique = [
            ...new Set(data.map((n) => n.assign_nurse?.trim()).filter(Boolean)),
          ];
          setAssignedNurses(unique);
        } else {
          setAssignedNurses([]);
        }
      } catch (err) {
        setAssignedNurses([]);
      }
    };
    fetchNurses();
  }, [patient.ipd_number, patient.admission_no]);

  // Fetch OT Days
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
          if (record.status === "Cancel") {
            setOtDays(null);
            return;
          }
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (record.actual2) {
            const completedDate = new Date(record.actual2);
            completedDate.setHours(0, 0, 0, 0);
            const diffMs = today - completedDate;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            setOtDays(diffDays < 0 ? 0 : diffDays);
            setOtDaysLabel("Days Since OT Done:");
          } else {
            setOtDays(null);
          }
        } else {
          setOtDays(null);
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
  const roomNo = patient.room || patient.room_no || "N/A";
  const department = patient.department || "N/A";

  const initial = patientName.charAt(0).toUpperCase();

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 hover:scale-[1.01] ${compactView ? "p-3" : "p-4 sm:p-5"}`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start min-w-0 gap-3">
          {/* Avatar Initial */}
          <div
            className={`shrink-0 flex items-center justify-center font-bold text-gray-600 bg-gray-100 rounded-full ${compactView ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"}`}
          >
            {initial}
          </div>

          <div className="flex-1 min-w-0">
            <h3
              className={`font-bold text-gray-900 break-words line-clamp-2 leading-tight ${compactView ? "text-sm" : "text-base sm:text-lg"}`}
            >
              {patientName}
            </h3>
            <div className="flex flex-wrap items-center mt-1 gap-x-2 gap-y-1">
              <p className="text-xs font-semibold text-green-600 truncate">
                {consultantDr}
              </p>
              <span className="text-[10px] text-gray-300 hidden sm:inline">
                |
              </span>
              <p className="text-[11px] text-gray-500 font-medium truncate">
                {department}
              </p>
            </div>

            {/* Nurse + Shift Block */}
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                  {currentShift}
                </span>
              </div>

              {assignedNurses.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {assignedNurses.slice(0, 2).map((nurse, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 rounded-md"
                    >
                      {nurse}
                    </span>
                  ))}
                  {assignedNurses.length > 2 && (
                    <span className="text-[10px] text-gray-400 font-medium">
                      +{assignedNurses.length - 2}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[10px] text-red-500 font-medium">
                  No nurse assigned
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div
            className={`flex items-center justify-center font-black text-white bg-green-600 rounded-full shadow-sm ring-2 ring-green-50 ${compactView ? "w-8 h-8 text-[10px]" : "w-10 h-10 text-xs sm:text-sm"}`}
          >
            {age}
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold border border-green-200">
            Active
          </span>
        </div>
      </div>

      {!compactView && (
        <div className="grid grid-cols-2 gap-3 p-3 mb-4 border bg-gray-50 rounded-xl border-gray-100/50">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
              Location
            </p>
            <p className="text-xs font-bold text-gray-700 truncate">
              {bedLocation} ({bedNo})
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
              IPD / Admission
            </p>
            <p className="text-xs font-bold text-gray-700 truncate">
              {ipdNo} / {patient.admission_no || "N/A"}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
              Time In Ward
            </p>
            <p className="text-xs font-bold text-green-600">{timeInWard}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
              Room / Mobile
            </p>
            <p className="text-xs font-bold text-gray-700 truncate">
              R:{roomNo} / {mobileNumber}
            </p>
          </div>
        </div>
      )}

      {compactView && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[11px] font-semibold text-gray-500 px-1">
          <span className="truncate">Bed: {bedNo}</span>
          <span>IPD: {ipdNo}</span>
          <span className="text-blue-600">Adm: {patient.admission_no || "N/A"}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
        <StatusBadge status={patCategory} />
        <button
          onClick={() => onViewDetails(patient)}
          className={`flex items-center justify-center gap-2 font-bold transition-all bg-green-50 text-green-700 rounded-lg border border-green-100 hover:bg-green-600 hover:text-white active:scale-95 ${compactView ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm flex-1"}`}
        >
          <Eye className={compactView ? "w-3 h-3" : "w-4 h-4"} />
          View Profile
        </button>
      </div>
    </div>
  );
};

export default PatientCard;
