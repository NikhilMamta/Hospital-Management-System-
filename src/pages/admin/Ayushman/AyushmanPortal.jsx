import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShieldCheck,
  Search,
  Calendar,
  RefreshCw,
  Image as ImageIcon,
  User,
  Phone,
  Bed,
  Building,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  fetchAyushmanPatients,
  updateAyushmanPlannedActual,
  formatISTDateTime,
  toDateTimeLocal,
  ALLOWED_CATEGORIES,
} from "../../../api/ayushman";
import AyushmanPhotosModal from "./AyushmanPhotosModal";

/**
 * AyushmanPortal Component
 * Single-page portal dedicated to tracking patients under government & private schemes:
 * BSKY, AYUSHMAN BHARAT, AYUSHMAN BHARAT(GJAY), PRIVATE, ESIC.
 *
 * 13 Required Columns:
 * 1. Timestamp | 2. Admission No. | 3. Patient Name | 4. Ward Number | 5. Bed Number
 * 6. Attender Mobile Number | 7. Reason For Visit | 8. Age | 9. Gender | 10. Category
 * 11. Planned | 12. Actual | 13. photos (up to 20 images per patient row)
 */
const AyushmanPortal = () => {
  // Data state
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // "active" | "all"
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Photos Modal
  const [photosModalPatient, setPhotosModalPatient] = useState(null);

  // Inline editing for Planned and Actual
  // editingCell: { admissionNo, field: 'planned' | 'actual', value: '' }
  const [editingCell, setEditingCell] = useState(null);
  const [savingCell, setSavingCell] = useState(false);

  // Load patients
  const loadPatients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAyushmanPatients({
        search,
        category: selectedCategory,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        excludeDischarged: statusFilter === "active",
      });
      setPatients(data);
      setCurrentPage(1);
    } catch (err) {
      console.error("Error loading Ayushman patients:", err);
      setError("Failed to load Ayushman portal data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  // Statistics calculation
  const stats = useMemo(() => {
    let bsky = 0;
    let ayushman = 0;
    let esic = 0;
    let priv = 0;
    let totalPhotos = 0;

    patients.forEach((p) => {
      const c = (p.category || "").toUpperCase();
      if (c.includes("BSKY")) bsky++;
      else if (c.includes("AYUSHMAN") || c.includes("GJAY")) ayushman++;
      else if (c.includes("ESIC")) esic++;
      else if (c.includes("PRIVATE")) priv++;

      if (Array.isArray(p.photos)) {
        totalPhotos += p.photos.length;
      }
    });

    return {
      total: patients.length,
      bsky,
      ayushman,
      esic,
      priv,
      totalPhotos,
    };
  }, [patients]);

  // Pagination slice
  const totalPages = Math.ceil(patients.length / pageSize) || 1;
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return patients.slice(start, start + pageSize);
  }, [patients, currentPage, pageSize]);

  // Update Planned or Actual
  const handleSaveInlineDateTime = async () => {
    if (!editingCell) return;
    const { admissionNo, ipdAdmissionId, field, value } = editingCell;

    setSavingCell(true);
    try {
      const updated = await updateAyushmanPlannedActual({
        admissionNo,
        ipdAdmissionId,
        [field]: value || null,
      });

      // Update local state instantly
      setPatients((prev) =>
        prev.map((p) => {
          if (p.admission_no === admissionNo) {
            return {
              ...p,
              [field]: updated[field],
            };
          }
          return p;
        })
      );
      setEditingCell(null);
    } catch (err) {
      alert(`Failed to save ${field}: ` + (err.message || "Unknown error"));
    } finally {
      setSavingCell(false);
    }
  };

  // Quick set to current IST time
  const handleSetNow = () => {
    if (!editingCell) return;
    setEditingCell((prev) => ({
      ...prev,
      value: new Date().toISOString(),
    }));
  };

  // Update photos callback when photos are uploaded or deleted in modal
  const handlePhotosUpdated = (admissionNo, newPhotos) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.admission_no === admissionNo) {
          return {
            ...p,
            photos: newPhotos,
          };
        }
        return p;
      })
    );
    if (photosModalPatient && photosModalPatient.admission_no === admissionNo) {
      setPhotosModalPatient((prev) => ({
        ...prev,
        photos: newPhotos,
      }));
    }
  };

  // Category Badge Colors
  const getCategoryBadge = (category) => {
    const c = (category || "").toUpperCase();
    if (c.includes("BSKY")) {
      return (
        <span className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-blue-100 text-blue-800 border border-blue-200">
          BSKY
        </span>
      );
    }
    if (c.includes("GJAY")) {
      return (
        <span className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-amber-100 text-amber-900 border border-amber-300">
          AYUSHMAN (GJAY)
        </span>
      );
    }
    if (c.includes("AYUSHMAN")) {
      return (
        <span className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
          AYUSHMAN BHARAT
        </span>
      );
    }
    if (c.includes("ESIC")) {
      return (
        <span className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-purple-100 text-purple-800 border border-purple-200">
          ESIC
        </span>
      );
    }
    if (c.includes("PRIVATE")) {
      return (
        <span className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-slate-100 text-slate-800 border border-slate-300">
          PRIVATE
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-gray-100 text-gray-700">
        {category || "N/A"}
      </span>
    );
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!patients.length) {
      alert("No data available to export.");
      return;
    }

    const headers = [
      "Timestamp",
      "Admission No",
      "Patient Name",
      "Ward Number",
      "Bed Number",
      "Attender Mobile",
      "Reason For Visit",
      "Age",
      "Gender",
      "Category",
      "Planned",
      "Actual",
      "Photos Count",
    ];

    const rows = patients.map((p) => [
      `"${formatISTDateTime(p.admission_timestamp)}"`,
      `"${p.admission_no || ""}"`,
      `"${p.patient_name || ""}"`,
      `"${p.ward_number || ""}"`,
      `"${p.bed_number || ""}"`,
      `"${p.attender_mobile_number || ""}"`,
      `"${(p.reason_for_visit || "").replace(/"/g, '""')}"`,
      `"${p.age || ""}"`,
      `"${p.gender || ""}"`,
      `"${p.category || ""}"`,
      `"${p.planned ? formatISTDateTime(p.planned) : ""}"`,
      `"${p.actual ? formatISTDateTime(p.actual) : ""}"`,
      Array.isArray(p.photos) ? p.photos.length : 0,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ayushman_portal_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                Ayushman & Government Scheme Portal
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized register for BSKY, Ayushman Bharat, GJAY, Private & ESIC patients with bucket photo verification
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Export data to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Export CSV
          </button>
          <button
            onClick={loadPatients}
            disabled={loading}
            className="flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Top Metric Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            {statusFilter === "active" ? "Active Patients" : "Total Patients"}
          </span>
          <div className="text-xl font-black text-slate-900 mt-1 flex items-center">
            {statusFilter === "active" && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse inline-block" />
            )}
            {stats.total}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
            BSKY
          </span>
          <div className="text-xl font-black text-blue-900 mt-1">{stats.bsky}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
            Ayushman / GJAY
          </span>
          <div className="text-xl font-black text-emerald-900 mt-1">{stats.ayushman}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">
            ESIC
          </span>
          <div className="text-xl font-black text-purple-900 mt-1">{stats.esic}</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
            Private
          </span>
          <div className="text-xl font-black text-slate-900 mt-1">{stats.priv}</div>
        </div>

        <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
            Bucket Photos
          </span>
          <div className="text-xl font-black text-emerald-900 mt-1 flex items-center">
            <ImageIcon className="w-4 h-4 mr-1 text-emerald-600" />
            {stats.totalPhotos}
          </div>
        </div>
      </div>

      {/* ── Filters & Category Selector ──────────────────────────── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        {/* Category Pills & Patient Status Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-2 flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1" /> Category:
            </span>
            {["All", ...ALLOWED_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedCategory === cat
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Active vs Discharged filter toggle */}
          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center ${
                statusFilter === "active"
                  ? "bg-white text-emerald-700 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Active (Not Discharged)
            </button>
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                statusFilter === "all"
                  ? "bg-white text-slate-800 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All (Inc. Discharged)
            </button>
          </div>
        </div>

        {/* Search & Date Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Patient Name, Admission No., Mobile, Ward, Bed, or Reason..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date From */}
          <div className="sm:col-span-3 flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Date To */}
          <div className="sm:col-span-3 flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-700 flex items-center">
          <AlertCircle className="w-4 h-4 mr-2 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ── 13-Column Ayushman Table ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold uppercase tracking-wider text-[11px] whitespace-nowrap">
                <th className="py-3 px-3.5">1. Timestamp</th>
                <th className="py-3 px-3.5">2. Admission No.</th>
                <th className="py-3 px-3.5">3. Patient Name</th>
                <th className="py-3 px-3.5">4. Ward Number</th>
                <th className="py-3 px-3.5">5. Bed Number</th>
                <th className="py-3 px-3.5">6. Attender Mobile</th>
                <th className="py-3 px-3.5">7. Reason For Visit</th>
                <th className="py-3 px-2.5 text-center">8. Age</th>
                <th className="py-3 px-2.5 text-center">9. Gender</th>
                <th className="py-3 px-3.5">10. Category</th>
                <th className="py-3 px-3.5 bg-slate-800 text-emerald-300">11. Planned</th>
                <th className="py-3 px-3.5 bg-slate-800 text-emerald-300">12. Actual</th>
                <th className="py-3 px-3.5 text-right bg-slate-800 text-white">13. Photos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-medium">Loading Ayushman portal patient records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedPatients.length > 0 ? (
                paginatedPatients.map((p, idx) => {
                  const photoCount = Array.isArray(p.photos) ? p.photos.length : 0;
                  const isEditingPlanned =
                    editingCell?.admissionNo === p.admission_no && editingCell?.field === "planned";
                  const isEditingActual =
                    editingCell?.admissionNo === p.admission_no && editingCell?.field === "actual";

                  return (
                    <tr
                      key={p.admission_no || idx}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* 1. Timestamp */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-600 font-medium">
                        {formatISTDateTime(p.admission_timestamp)}
                      </td>

                      {/* 2. Admission No. */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {p.admission_no || "-"}
                        </span>
                      </td>

                      {/* 3. Patient Name */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center">
                          <User className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                          {p.patient_name}
                        </div>
                      </td>

                      {/* 4. Ward Number */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          <Building className="w-3 h-3 mr-1 text-slate-400" />
                          {p.ward_number}
                        </span>
                      </td>

                      {/* 5. Bed Number */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center font-semibold text-slate-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Bed className="w-3 h-3 mr-1 text-emerald-600" />
                          {p.bed_number}
                        </span>
                      </td>

                      {/* 6. Attender Mobile Number */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {p.attender_mobile_number && p.attender_mobile_number !== "-" ? (
                          <a
                            href={`tel:${p.attender_mobile_number}`}
                            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium group/phone"
                            title="Call Attender"
                          >
                            <Phone className="w-3 h-3 mr-1 text-blue-500 group-hover/phone:scale-110 transition-transform" />
                            {p.attender_mobile_number}
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 7. Reason For Visit */}
                      <td className="py-3 px-3.5 max-w-[220px]">
                        <div
                          className="truncate text-slate-700"
                          title={p.reason_for_visit}
                        >
                          {p.reason_for_visit}
                        </div>
                      </td>

                      {/* 8. Age */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap font-medium text-slate-700">
                        {p.age ? `${p.age} Y` : "-"}
                      </td>

                      {/* 9. Gender */}
                      <td className="py-3 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${
                            (p.gender || "").toLowerCase().startsWith("m")
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : (p.gender || "").toLowerCase().startsWith("f")
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {p.gender || "-"}
                        </span>
                      </td>

                      {/* 10. Category */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {getCategoryBadge(p.category)}
                      </td>

                      {/* 11. Planned (Inline Interactive Editor) */}
                      <td className="py-3 px-3.5 whitespace-nowrap bg-emerald-50/20">
                        {isEditingPlanned ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="datetime-local"
                              value={toDateTimeLocal(editingCell.value)}
                              onChange={(e) =>
                                setEditingCell((prev) => ({
                                  ...prev,
                                  value: e.target.value,
                                }))
                              }
                              className="text-xs p-1 rounded border border-emerald-400 bg-white shadow-xs focus:outline-none"
                            />
                            <button
                              onClick={handleSaveInlineDateTime}
                              disabled={savingCell}
                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-xs"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingCell(null)}
                              className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() =>
                              setEditingCell({
                                admissionNo: p.admission_no,
                                ipdAdmissionId: p.ipd_admission_id,
                                field: "planned",
                                value: p.planned || "",
                              })
                            }
                            className="cursor-pointer group/cell flex items-center justify-between hover:bg-emerald-100/60 p-1 rounded transition-colors"
                            title="Click to set Planned Date/Time"
                          >
                            <span
                              className={`text-xs ${
                                p.planned
                                  ? "font-semibold text-slate-900"
                                  : "text-slate-400 italic"
                              }`}
                            >
                              {p.planned ? formatISTDateTime(p.planned) : "Set Planned"}
                            </span>
                            <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover/cell:opacity-100 ml-1.5" />
                          </div>
                        )}
                      </td>

                      {/* 12. Actual (Inline Interactive Editor) */}
                      <td className="py-3 px-3.5 whitespace-nowrap bg-emerald-50/20">
                        {isEditingActual ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="datetime-local"
                              value={toDateTimeLocal(editingCell.value)}
                              onChange={(e) =>
                                setEditingCell((prev) => ({
                                  ...prev,
                                  value: e.target.value,
                                }))
                              }
                              className="text-xs p-1 rounded border border-emerald-400 bg-white shadow-xs focus:outline-none"
                            />
                            <button
                              onClick={handleSaveInlineDateTime}
                              disabled={savingCell}
                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-xs"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingCell(null)}
                              className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() =>
                              setEditingCell({
                                admissionNo: p.admission_no,
                                ipdAdmissionId: p.ipd_admission_id,
                                field: "actual",
                                value: p.actual || "",
                              })
                            }
                            className="cursor-pointer group/cell flex items-center justify-between hover:bg-emerald-100/60 p-1 rounded transition-colors"
                            title="Click to set Actual Date/Time"
                          >
                            <span
                              className={`text-xs ${
                                p.actual
                                  ? "font-semibold text-slate-900"
                                  : "text-slate-400 italic"
                              }`}
                            >
                              {p.actual ? formatISTDateTime(p.actual) : "Set Actual"}
                            </span>
                            <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover/cell:opacity-100 ml-1.5" />
                          </div>
                        )}
                      </td>

                      {/* 13. Photos (Up to 20 images in ayushman_photos bucket) */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap bg-slate-50/60">
                        <button
                          onClick={() => setPhotosModalPatient(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center shadow-2xs transition-all ${
                            photoCount > 0
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-300"
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                          {photoCount > 0 ? (
                            <span>{photoCount} / 20 Photos</span>
                          ) : (
                            <span>Upload Photos (0/20)</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-slate-400">
                    <ShieldCheck className="w-12 h-12 mx-auto stroke-1 mb-2 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">No Ayushman Portal Patients Found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ensure patients in IPD Admission have Pat. Category set to BSKY, AYUSHMAN BHARAT,
                      AYUSHMAN BHARAT(GJAY), PRIVATE, or ESIC.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer & Pagination ──────────────────────────── */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing{" "}
            <span className="font-bold text-slate-900">
              {patients.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="font-bold text-slate-900">
              {Math.min(currentPage * pageSize, patients.length)}
            </span>{" "}
            of <span className="font-bold text-slate-900">{patients.length}</span> eligible patients
          </div>

          {totalPages > 1 && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Photos Modal (Bucket Photos Uploader & Lightbox) ─────── */}
      {photosModalPatient && (
        <AyushmanPhotosModal
          isOpen={!!photosModalPatient}
          onClose={() => setPhotosModalPatient(null)}
          patient={photosModalPatient}
          onPhotosUpdated={handlePhotosUpdated}
        />
      )}
    </div>
  );
};

export default AyushmanPortal;
