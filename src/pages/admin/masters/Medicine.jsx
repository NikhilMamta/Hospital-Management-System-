import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  Save,
  Pill,
  Package,
  DollarSign,
} from "lucide-react";
import supabase from "../../../SupabaseClient";
import { useNotification } from "../../../contexts/NotificationContext";
import useRealtimeTable from "../../../hooks/useRealtimeTable";

const Medicine = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const { showNotification } = useNotification();

  // Form state
  const [formData, setFormData] = useState({
    medicine_name: "",
    price: "",
  });

  // Fetch medicine data
  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("medicine")
        .select("*")
        .order("timestamp", { ascending: false });

      if (error) throw error;
      setMedicines(data || []);
    } catch (error) {
      console.error("Error fetching medicines:", error);
      showNotification("Error loading medicine data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicines();
  }, []);

  useRealtimeTable("medicine", fetchMedicines);

  // Filter medicines based on search
  const filteredMedicines = medicines.filter((medicine) =>
    Object.values(medicine).some((value) =>
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  );

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Format price for display
  const formatPrice = (price) => {
    if (!price) return "N/A";
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return price;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numPrice);
  };

  // Handle price input
  const handlePriceChange = (e) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setFormData((prev) => ({
        ...prev,
        price: value,
      }));
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      medicine_name: "",
      price: "",
    });
    setEditingMedicine(null);
  };

  // Open modal for adding/editing
  const openModal = (medicine = null) => {
    if (medicine) {
      setEditingMedicine(medicine);
      setFormData({
        medicine_name: medicine.medicine_name || "",
        price: medicine.price || "",
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  // Validate form
  const validateForm = () => {
    if (!formData.medicine_name.trim()) {
      showNotification("Medicine name is required", "error");
      return false;
    }

    if (!formData.price.trim()) {
      showNotification("Price is required", "error");
      return false;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price < 0) {
      showNotification("Please enter a valid price", "error");
      return false;
    }

    return true;
  };

  // Save medicine
  const saveMedicine = async () => {
    if (!validateForm()) return;

    try {
      const medicineData = {
        medicine_name: formData.medicine_name.trim(),
        price: formData.price,
      };

      if (editingMedicine) {
        // Update existing medicine
        const { error } = await supabase
          .from("medicine")
          .update(medicineData)
          .eq("id", editingMedicine.id);

        if (error) throw error;
        showNotification("Medicine updated successfully!", "success");
      } else {
        // Insert new medicine
        const { error } = await supabase
          .from("medicine")
          .insert([medicineData]);

        if (error) throw error;
        showNotification("Medicine added successfully!", "success");
      }

      fetchMedicines();
      closeModal();
    } catch (error) {
      console.error("Error saving medicine:", error);
      showNotification("Error saving medicine", "error");
    }
  };

  // Delete medicine
  const deleteMedicine = async (id) => {
    if (!window.confirm("Are you sure you want to delete this medicine?")) {
      return;
    }

    try {
      const { error } = await supabase.from("medicine").delete().eq("id", id);

      if (error) throw error;
      showNotification("Medicine deleted successfully!", "success");
      fetchMedicines();
    } catch (error) {
      console.error("Error deleting medicine:", error);
      showNotification("Error deleting medicine", "error");
    }
  };

  // Calculate total value of medicines
  const calculateTotalValue = () => {
    return medicines.reduce((total, medicine) => {
      const price = parseFloat(medicine.price) || 0;
      return total + price;
    }, 0);
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-12 h-12 border-b-2 border-green-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center md:gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 md:text-2xl">
            Medicine Management
          </h1>
          <p className="hidden mt-1 text-gray-600 md:block">
            Manage hospital medicine inventory
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 bg-green-600 rounded-lg hover:bg-green-700 md:text-base"
        >
          <Plus size={18} className="md:w-5 md:h-5" />
          Add New Medicine
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search
          className="absolute text-gray-400 transform -translate-y-1/2 left-3 top-1/2"
          size={18}
        />
        <input
          type="text"
          placeholder="Search medicine..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full py-2 pl-10 pr-4 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent md:text-base"
        />
      </div>

      {/* Stats Cards
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Medicines</p>
              <p className="text-2xl font-bold text-gray-800">{medicines.length}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <Pill className="text-green-600" size={20} />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Inventory Value</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatPrice(calculateTotalValue())}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <DollarSign className="text-blue-600" size={20} />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg. Medicine Price</p>
              <p className="text-2xl font-bold text-gray-800">
                {medicines.length > 0 
                  ? formatPrice(calculateTotalValue() / medicines.length)
                  : formatPrice(0)
                }
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Package className="text-purple-600" size={20} />
            </div>
          </div>
        </div>
      </div> */}

      {/* Mobile View: Cards */}
      <div className="space-y-3 md:hidden">
        {filteredMedicines.length === 0 ? (
          <div className="p-8 text-sm text-center text-gray-500 bg-white border border-gray-200 rounded-lg">
            {searchTerm
              ? "No medicines found matching your search"
              : "No medicines found"}
          </div>
        ) : (
          filteredMedicines.map((medicine, index) => (
            <div
              key={medicine.id}
              className="p-3 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
                    <Pill size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-tight text-gray-900">
                      {medicine.medicine_name || "N/A"}
                    </h3>
                    <p className="text-[10px] text-gray-500">
                      ID: #{index + 1}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal(medicine)}
                    className="p-1.5 text-blue-600 bg-blue-50 rounded-md"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteMedicine(medicine.id)}
                    className="p-1.5 text-red-600 bg-red-50 rounded-md"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 mt-2 border-t border-gray-50">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold">
                    Price
                  </p>
                  <p className="text-sm font-bold text-green-600">
                    {formatPrice(medicine.price)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">
                    Added On
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(medicine.timestamp).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden overflow-hidden bg-white border border-gray-200 rounded-lg shadow md:block">
        <div className="overflow-x-auto" style={{ maxHeight: "500px" }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  ID
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Medicine Name
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Price
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Added On
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMedicines.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    {searchTerm
                      ? "No medicines found matching your search"
                      : "No medicines found"}
                  </td>
                </tr>
              ) : (
                filteredMedicines.map((medicine, index) => {
                  const date = new Date(medicine.timestamp);
                  const formattedDate = date.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr key={medicine.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                        #{index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex items-center justify-center w-8 h-8 mr-3 bg-gray-100 rounded-full">
                            <Pill size={16} className="text-gray-600" />
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            {medicine.medicine_name || "N/A"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-600 whitespace-nowrap">
                        {formatPrice(medicine.price)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openModal(medicine)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => deleteMedicine(medicine.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingMedicine ? "Edit Medicine" : "Add New Medicine"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Medicine Name *
                </label>
                <input
                  type="text"
                  name="medicine_name"
                  value={formData.medicine_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter medicine name"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Price (₹) *
                </label>
                <div className="relative">
                  <span className="absolute text-gray-500 transform -translate-y-1/2 left-3 top-1/2">
                    ₹
                  </span>
                  <input
                    type="text"
                    name="price"
                    value={formData.price}
                    onChange={handlePriceChange}
                    className="w-full py-2 pl-10 pr-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.00"
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Enter price in rupees (e.g., 250.50)
                </p>
              </div>

              {/* Preview */}
              <div className="p-4 mt-4 rounded-lg bg-gray-50">
                <h3 className="mb-2 text-sm font-medium text-gray-700">
                  Preview:
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Medicine Name</p>
                    <p className="font-medium">
                      {formData.medicine_name || "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Price</p>
                    <p className="font-medium text-green-600">
                      {formData.price
                        ? `₹${parseFloat(formData.price).toFixed(2)}`
                        : "Not set"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 transition-colors duration-200 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveMedicine}
                className="inline-flex items-center gap-2 px-4 py-2 text-white transition-colors duration-200 bg-green-600 rounded-lg hover:bg-green-700"
              >
                <Save size={18} />
                {editingMedicine ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Medicine;
