import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  Loader2,
  Package,
  User,
  ClipboardList,
  Calendar,
  Building2,
  Layers,
} from "lucide-react";
import { useNotification } from "../../../contexts/NotificationContext";
import { getMedicines } from "../../../api/pharmacy";
import {
  getStoreMasters,
  createStoreOut,
  getNextStoreOutIndentNo,
} from "../../../api/store";
import Select from "react-select";

const INDENT_TYPES = ["Store Out", "Store In", "Internal Transfer"];
const APPROVAL_ROLES = ["Store Incharge", "Pharmacy Head", "Admin"];
const WARDS = [
  "Male General Ward",
  "Female General Ward",
  "ICU",
  "HDU",
  "Private Ward",
  "NICU",
  "PICU",
];
const DEFAULT_HEAD_GROUPS = ["Medicine", "Consumables", "Surgical", "Others"];

export default function StoreOutModal({ isOpen, onClose, userName }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [medicineOptions, setMedicineOptions] = useState([]);
  const [masters, setMasters] = useState([]); // Array of {item_name, group_head, unit_of_measurement}
  const [categories, setCategories] = useState(DEFAULT_HEAD_GROUPS);
  const [uomOptions, setUomOptions] = useState([
    "Unit",
    "Mg",
    "Ml",
    "Tab",
    "Cap",
  ]);
  const { showNotification } = useNotification();

  const [formData, setFormData] = useState({
    indenter_name: userName || "",
    indent_type: "Store Out",
    approval_needed: "Store Incharge",
    ward_name: "",
    issue_date: new Date().toISOString().split("T")[0],
    medicines: [
      { product_name: "", quantity: "", uom: "Unit", group_of_head: "" },
    ],
  });

  useEffect(() => {
    if (isOpen) {
      fetchMedicines();
      // Ensure indenter name matches the current user
      setFormData((prev) => ({ ...prev, indenter_name: userName || "" }));
    }
  }, [isOpen, userName]);

  const fetchMedicines = async () => {
    try {
      // First try to fetch from store masters (for mapping)
      const mastersData = await getStoreMasters();
      if (mastersData && Array.isArray(mastersData)) {
        console.log("Store masters loaded:", mastersData.length, "items");
        setMasters(mastersData);
        setMedicineOptions(mastersData.map((m) => m.item_name));

        // Dynamically build category list from masters
        const uniqueGroups = [
          ...new Set(mastersData.map((m) => m.group_head).filter(Boolean)),
        ];
        const combinedCategories = [
          ...new Set([...DEFAULT_HEAD_GROUPS, ...uniqueGroups]),
        ];
        setCategories(combinedCategories);

        // Dynamically build UOM list from masters
        const uniqueUoms = [
          ...new Set(
            mastersData.map((m) => m.unit_of_measurement).filter(Boolean),
          ),
        ];
        const combinedUoms = [...new Set(["Unit", ...uniqueUoms])];
        setUomOptions(combinedUoms);
      } else {
        // Fallback to legacy medicine list if masters fail
        const data = await getMedicines();
        setMedicineOptions(data);
      }
    } catch (err) {
      console.error("Error fetching store masters:", err);
      // Fallback
      const data = await getMedicines().catch(() => []);
      setMedicineOptions(data);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMedicineChange = (index, field, value) => {
    const updatedMedicines = [...formData.medicines];
    updatedMedicines[index][field] = value;

    // Auto-fill group_head when product_name is selected
    if (field === "product_name") {
      const searchValue = (value || "").trim().toLowerCase();
      const match = masters.find(
        (m) => (m.item_name || "").trim().toLowerCase() === searchValue,
      );

      console.log("Searching for match:", value, "Result:", match);

      if (match && match.group_head) {
        console.log("Auto-filling group_head:", match.group_head);
        updatedMedicines[index]["group_of_head"] = match.group_head;
      }
    }

    setFormData((prev) => ({ ...prev, medicines: updatedMedicines }));
  };

  const addMedicine = () => {
    setFormData((prev) => ({
      ...prev,
      medicines: [
        ...prev.medicines,
        { product_name: "", quantity: "", uom: "Unit", group_of_head: "" },
      ],
    }));
  };

  const removeMedicine = (index) => {
    if (formData.medicines.length === 1) return;
    const updatedMedicines = formData.medicines.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, medicines: updatedMedicines }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.indenter_name || !formData.ward_name) {
      showNotification("Please fill in all required fields", "error");
      return;
    }

    const isMedicinesValid = formData.medicines.every(
      (med) => med.product_name && med.quantity && med.group_of_head,
    );
    if (!isMedicinesValid) {
      showNotification(
        "Please fill in all product details including Group Head",
        "error",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const planned7 = new Date().toISOString();
      const storeOutIndentNo = await getNextStoreOutIndentNo();
      const hasMultipleMedicines = formData.medicines.length > 1;

      // Mapping form data to the Edge Function payload structure
      // If the form has multiple medicines, we'll send one request per medicine
      const requests = formData.medicines.map((med, index) => {
        const issueNo = hasMultipleMedicines
          ? `${storeOutIndentNo}/${index + 1}`
          : storeOutIndentNo;
        const payload = {
          issue_no: issueNo,
          indent_number: issueNo,
          product_name: med.product_name || null,
          issue_date: formData.issue_date || null,
          indenter_name: formData.indenter_name || null,
          indent_type: formData.indent_type || null,
          approval_needed: formData.approval_needed || null,
          requested_by: userName || null,
          floor: null, // Field not in form, sending as null
          ward_name: formData.ward_name || null,
          qty: med.quantity || null,
          unit: med.uom || null,
          category: med.group_of_head || null,
          planned_7: planned7, // Always included
        };
        return createStoreOut(payload);
      });

      await Promise.all(requests);

      showNotification("Store Out indent submitted successfully!", "success");
      onClose();
      // Reset form
      setFormData({
        indenter_name: userName || "",
        indent_type: "Store Out",
        approval_needed: "Store Incharge",
        ward_name: "",
        issue_date: new Date().toISOString().split("T")[0],
        medicines: [
          { product_name: "", quantity: "", uom: "Unit", group_of_head: "" },
        ],
      });
    } catch (err) {
      console.error("Error submitting store out:", err);
      showNotification(
        err.message || "Failed to submit store out indent",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl sm:rounded-[2rem] w-full max-w-4xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] sm:max-h-[80vh] relative">
        {/* Loading Overlay */}
        {isSubmitting && (
          <div className="absolute inset-0 z-[110] flex items-center justify-center bg-white/60 backdrop-blur-[2px] transition-all duration-300">
            <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-3xl shadow-xl border border-teal-50">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-teal-100 rounded-full"></div>
                <Loader2 className="w-12 h-12 text-teal-600 animate-spin absolute inset-0" />
              </div>
              <div className="text-center">
                <p className="text-teal-900 font-black uppercase tracking-widest text-xs">
                  Submitting Indent
                </p>
                <p className="text-teal-600/60 text-[10px] font-bold mt-1 uppercase tracking-tight">
                  Please wait while we process your request...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-700 p-3 sm:p-4 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                <ClipboardList className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter">
                  Indent Form
                </h2>
                <p className="text-teal-100 text-xs font-bold uppercase tracking-widest mt-1">
                  Create new Store Out Indent
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Indenter Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                Indenter Name *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  name="indenter_name"
                  value={formData.indenter_name}
                  onChange={handleInputChange}
                  className="w-full bg-gray-100 border border-gray-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none cursor-not-allowed transition-all"
                  placeholder="Name of indenter"
                  required
                  disabled
                />
              </div>
            </div>

            {/* Indent Type */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                Indent Type *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <Package size={18} />
                </div>
                <select
                  name="indent_type"
                  value={formData.indent_type}
                  onChange={handleInputChange}
                  className="w-full bg-gray-100 border border-gray-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none cursor-not-allowed transition-all appearance-none"
                  disabled
                >
                  {INDENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Approval Needed */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                Approval Needed *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <Layers size={18} />
                </div>
                <select
                  name="approval_needed"
                  value={formData.approval_needed}
                  onChange={handleInputChange}
                  className="w-full bg-gray-100 border border-gray-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none cursor-not-allowed transition-all appearance-none"
                  disabled
                >
                  {APPROVAL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ward Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                Ward Name *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <Building2 size={18} />
                </div>
                <select
                  name="ward_name"
                  value={formData.ward_name}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all appearance-none"
                  required
                >
                  <option value="">Select Ward</option>
                  {WARDS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Issue Date */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                Issue Date *
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <Calendar size={18} />
                </div>
                <input
                  type="date"
                  name="issue_date"
                  value={formData.issue_date}
                  onChange={handleInputChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* Medicines Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                Medicines / Products
              </h3>
            </div>

            <div className="space-y-3">
              {formData.medicines.map((med, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-3 items-end bg-gray-50/50 p-2 sm:p-3 rounded-2xl border border-gray-100"
                >
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                      Product Name *
                    </label>
                    <Select
                      className="text-xs font-bold"
                      options={medicineOptions.map((m) => ({
                        label: m,
                        value: m,
                      }))}
                      value={
                        med.product_name
                          ? { label: med.product_name, value: med.product_name }
                          : null
                      }
                      onChange={(option) =>
                        handleMedicineChange(
                          index,
                          "product_name",
                          option ? option.value : "",
                        )
                      }
                      placeholder="Search product..."
                      isClearable
                      isSearchable
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          borderRadius: "0.75rem",
                          padding: "0.25rem",
                          border: state.isFocused
                            ? "1px solid #14b8a6"
                            : "1px solid #e5e7eb",
                          boxShadow: state.isFocused
                            ? "0 0 0 2px rgba(20, 184, 166, 0.2)"
                            : "none",
                          "&:hover": {
                            border: "1px solid #14b8a6",
                          },
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isFocused
                            ? "#f0fdfa"
                            : "white",
                          color: state.isFocused ? "#0f766e" : "#374151",
                          fontSize: "0.75rem",
                          fontWeight: "700",
                          "&:active": {
                            backgroundColor: "#ccfbf1",
                          },
                        }),
                      }}
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                      Group Head *
                    </label>
                    <select
                      value={med.group_of_head}
                      onChange={(e) =>
                        handleMedicineChange(
                          index,
                          "group_of_head",
                          e.target.value,
                        )
                      }
                      className="w-full bg-gray-100 border border-gray-200 rounded-xl py-3 px-4 text-xs font-bold outline-none cursor-not-allowed appearance-none opacity-70"
                      required
                      disabled
                    >
                      <option value="">Select Group</option>
                      {categories.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      value={med.quantity}
                      onChange={(e) =>
                        handleMedicineChange(index, "quantity", e.target.value)
                      }
                      placeholder="Qty"
                      className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/20"
                      required
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                      UOM
                    </label>
                    <select
                      value={med.uom}
                      onChange={(e) =>
                        handleMedicineChange(index, "uom", e.target.value)
                      }
                      className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/20 appearance-none"
                    >
                      {uomOptions.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-1 flex justify-end md:justify-center pb-1">
                    <button
                      type="button"
                      onClick={() => removeMedicine(index)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2 md:block"
                    >
                      <Trash2 size={18} />
                      <span className="md:hidden text-[10px] font-bold uppercase tracking-widest">
                        Remove Item
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addMedicine}
              className="w-full py-4 border-2 border-dashed border-teal-200 rounded-3xl text-teal-600 hover:bg-teal-50 hover:border-teal-400 transition-all flex items-center justify-center gap-3 group"
            >
              <div className="bg-teal-100 p-1 rounded-lg group-hover:scale-110 transition-transform">
                <Plus size={18} />
              </div>
              <span className="text-xs font-black uppercase tracking-widest">
                Add Another Item
              </span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 pt-4 sticky bottom-0 bg-white pb-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 py-3 sm:py-4 border border-gray-200 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:flex-[2] bg-gradient-to-r from-teal-600 to-emerald-700 text-white font-black py-3 sm:py-4 px-6 rounded-2xl shadow-xl shadow-teal-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>CREATING...</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>CREATE INDENT</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
