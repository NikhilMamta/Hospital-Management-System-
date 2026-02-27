import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  Save,
  Bed,
  Building,
  DoorOpen,
  Hash,
} from "lucide-react";
import supabase from "../../../SupabaseClient";
import { useNotification } from "../../../contexts/NotificationContext";
import useRealtimeTable from "../../../hooks/useRealtimeTable";

const FloorBed = () => {
  const [floorBeds, setFloorBeds] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFloorBed, setEditingFloorBed] = useState(null);
  const { showNotification } = useNotification();

  // Form state
  const [formData, setFormData] = useState({
    serial_no: "",
    floor: "",
    ward: "",
    room: "",
    bed: "",
  });

  // Filter state
  const [filters, setFilters] = useState({
    floor: "all",
    ward: "all",
    room: "all",
  });

  // Available options (extracted from existing data)
  const [availableOptions, setAvailableOptions] = useState({
    floors: [],
    wards: [],
    rooms: [],
  });

  // Fetch floor bed data
  const fetchFloorBeds = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("all_floor_bed")
        .select("*")
        .order("timestamp", { ascending: false });

      if (error) throw error;
      setFloorBeds(data || []);

      // Extract unique options from data
      const floors = [
        ...new Set(data?.map((item) => item.floor).filter(Boolean)),
      ];
      const wards = [
        ...new Set(data?.map((item) => item.ward).filter(Boolean)),
      ];
      const rooms = [
        ...new Set(data?.map((item) => item.room).filter(Boolean)),
      ];

      setAvailableOptions({
        floors: floors.sort(),
        wards: wards.sort(),
        rooms: rooms.sort(),
      });
    } catch (error) {
      console.error("Error fetching floor beds:", error);
      showNotification("Error loading floor bed data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFloorBeds();
  }, []);

  useRealtimeTable("all_floor_bed", fetchFloorBeds);

  // Filter floor beds based on search and filters
  const filteredFloorBeds = floorBeds.filter((item) => {
    // Apply filters
    if (filters.floor !== "all" && item.floor !== filters.floor) return false;
    if (filters.ward !== "all" && item.ward !== filters.ward) return false;
    if (filters.room !== "all" && item.room !== filters.room) return false;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        item.serial_no?.toLowerCase().includes(searchLower) ||
        item.floor?.toLowerCase().includes(searchLower) ||
        item.ward?.toLowerCase().includes(searchLower) ||
        item.room?.toLowerCase().includes(searchLower) ||
        item.bed?.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      serial_no: "",
      floor: "",
      ward: "",
      room: "",
      bed: "",
    });
    setEditingFloorBed(null);
  };

  // Open modal for adding/editing
  const openModal = (item = null) => {
    if (item) {
      setEditingFloorBed(item);
      setFormData({
        serial_no: item.serial_no || "",
        floor: item.floor || "",
        ward: item.ward || "",
        room: item.room || "",
        bed: item.bed || "",
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
    if (!formData.floor.trim()) {
      showNotification("Floor is required", "error");
      return false;
    }

    if (!formData.ward.trim()) {
      showNotification("Ward is required", "error");
      return false;
    }

    if (!formData.room.trim()) {
      showNotification("Room is required", "error");
      return false;
    }

    if (!formData.bed.trim()) {
      showNotification("Bed number is required", "error");
      return false;
    }

    // Check for duplicates (same floor, ward, room, bed)
    const duplicate = floorBeds.find(
      (item) =>
        item.floor === formData.floor &&
        item.ward === formData.ward &&
        item.room === formData.room &&
        item.bed === formData.bed &&
        (!editingFloorBed || item.id !== editingFloorBed.id),
    );

    if (duplicate) {
      showNotification(
        `Bed ${formData.bed} already exists in ${formData.floor} - ${formData.ward} - ${formData.room}`,
        "error",
      );
      return false;
    }

    return true;
  };

  // Save floor bed
  const saveFloorBed = async () => {
    if (!validateForm()) return;

    try {
      const floorBedData = {
        serial_no: formData.serial_no.trim() || null,
        floor: formData.floor.trim(),
        ward: formData.ward.trim(),
        room: formData.room.trim(),
        bed: formData.bed.trim(),
      };

      if (editingFloorBed) {
        // Update existing floor bed
        const { error } = await supabase
          .from("all_floor_bed")
          .update(floorBedData)
          .eq("id", editingFloorBed.id);

        if (error) throw error;
        showNotification("Floor bed updated successfully!", "success");
      } else {
        // Insert new floor bed
        const { error } = await supabase
          .from("all_floor_bed")
          .insert([floorBedData]);

        if (error) throw error;
        showNotification("Floor bed added successfully!", "success");
      }

      fetchFloorBeds();
      closeModal();
    } catch (error) {
      console.error("Error saving floor bed:", error);
      showNotification("Error saving floor bed", "error");
    }
  };

  // Delete floor bed
  const deleteFloorBed = async (id) => {
    if (!window.confirm("Are you sure you want to delete this floor bed?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("all_floor_bed")
        .delete()
        .eq("id", id);

      if (error) throw error;
      showNotification("Floor bed deleted successfully!", "success");
      fetchFloorBeds();
    } catch (error) {
      console.error("Error deleting floor bed:", error);
      showNotification("Error deleting floor bed", "error");
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      floor: "all",
      ward: "all",
      room: "all",
    });
    setSearchTerm("");
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
            Floor & Bed Management
          </h1>
          <p className="hidden mt-1 text-gray-600 md:block">
            Manage hospital floors, wards, rooms, and beds
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 bg-green-600 rounded-lg hover:bg-green-700 md:text-base"
        >
          <Plus size={18} className="md:w-5 md:h-5" />
          Add New Bed
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
          placeholder="Search beds..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full py-2 pl-10 pr-4 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent md:text-base"
        />
      </div>

      {/* Filters */}
      <div className="p-3 bg-white border border-gray-200 rounded-lg shadow md:p-4">
        <div className="flex items-center justify-between mb-2 md:mb-3">
          <h3 className="text-xs font-bold tracking-tight text-gray-700 uppercase md:text-sm">
            Filters
          </h3>
          <button
            onClick={clearFilters}
            className="text-[10px] md:text-sm text-blue-600 font-bold hover:text-blue-800 uppercase"
          >
            Clear all
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <div>
            <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1 uppercase italic">
              Floor
            </label>
            <select
              name="floor"
              value={filters.floor}
              onChange={handleFilterChange}
              className="w-full px-2 py-1.5 md:px-3 md:py-2 text-[11px] md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
            >
              <option value="all">All</option>
              {availableOptions.floors.map((floor) => (
                <option key={floor} value={floor}>
                  {floor}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1 uppercase italic">
              Ward
            </label>
            <select
              name="ward"
              value={filters.ward}
              onChange={handleFilterChange}
              className="w-full px-2 py-1.5 md:px-3 md:py-2 text-[11px] md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
            >
              <option value="all">All</option>
              {availableOptions.wards.map((ward) => (
                <option key={ward} value={ward}>
                  {ward}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1 uppercase italic">
              Room
            </label>
            <select
              name="room"
              value={filters.room}
              onChange={handleFilterChange}
              className="w-full px-2 py-1.5 md:px-3 md:py-2 text-[11px] md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
            >
              <option value="all">All</option>
              {availableOptions.rooms.map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mobile View: Cards */}
      <div className="space-y-3 md:hidden">
        {filteredFloorBeds.length === 0 ? (
          <div className="p-8 text-sm text-center text-gray-500 bg-white border border-gray-200 rounded-lg">
            {searchTerm || Object.values(filters).some((f) => f !== "all")
              ? "No floor beds found matching your criteria"
              : "No floor beds found. Add your first bed!"}
          </div>
        ) : (
          filteredFloorBeds.map((item) => (
            <div
              key={item.id}
              className="p-3 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
                    <Bed size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-tight text-gray-900">
                      Bed: {item.bed || "N/A"}
                    </h3>
                    <p className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">
                      ID: #{item.id} | SN: {item.serial_no || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal(item)}
                    className="p-1.5 text-blue-600 bg-blue-50 rounded-md"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteFloorBed(item.id)}
                    className="p-1.5 text-red-600 bg-red-50 rounded-md"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 mt-2 border-t border-gray-50">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold italic">
                    Floor
                  </p>
                  <p className="text-[11px] text-gray-800 font-medium truncate">
                    {item.floor || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold italic">
                    Ward
                  </p>
                  <p className="text-[11px] text-gray-800 font-medium truncate">
                    {item.ward || "N/A"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase font-bold italic">
                    Room
                  </p>
                  <p className="text-[11px] text-gray-800 font-medium truncate">
                    {item.room || "N/A"}
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
                  Serial No
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Location
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Bed No
                </th>
                <th className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFloorBeds.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    {searchTerm ||
                    Object.values(filters).some((f) => f !== "all")
                      ? "No floor beds found matching your criteria"
                      : "No floor beds found. Add your first bed!"}
                  </td>
                </tr>
              ) : (
                filteredFloorBeds.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                        #{item.id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {item.serial_no || "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Building size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {item.floor || "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DoorOpen size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {item.ward || "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Hash size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {item.room || "N/A"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Bed size={16} className="text-gray-600" />
                          <span className="text-sm font-medium text-gray-900">
                            {item.bed || "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openModal(item)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => deleteFloorBed(item.id)}
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-6 bg-white border-b">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingFloorBed ? "Edit Bed Details" : "Add New Bed"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Serial No */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Serial Number (Optional)
                </label>
                <input
                  type="text"
                  name="serial_no"
                  value={formData.serial_no}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter serial number"
                />
              </div>

              {/* Floor */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Floor *
                </label>
                <select
                  name="floor"
                  value={formData.floor}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Floor</option>
                  {availableOptions.floors.map((floor) => (
                    <option key={floor} value={floor}>
                      {floor}
                    </option>
                  ))}
                  <option value="custom">Add New Floor...</option>
                </select>
                {formData.floor === "custom" && (
                  <input
                    type="text"
                    value={formData.floor === "custom" ? "" : formData.floor}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        floor: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter new floor"
                    autoFocus
                  />
                )}
              </div>

              {/* Ward */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Ward *
                </label>
                <select
                  name="ward"
                  value={formData.ward}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Ward</option>
                  {availableOptions.wards.map((ward) => (
                    <option key={ward} value={ward}>
                      {ward}
                    </option>
                  ))}
                  <option value="custom">Add New Ward...</option>
                </select>
                {formData.ward === "custom" && (
                  <input
                    type="text"
                    value={formData.ward === "custom" ? "" : formData.ward}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, ward: e.target.value }))
                    }
                    className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter new ward"
                    autoFocus
                  />
                )}
              </div>

              {/* Room */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Room *
                </label>
                <select
                  name="room"
                  value={formData.room}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Room</option>
                  {availableOptions.rooms.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                  <option value="custom">Add New Room...</option>
                </select>
                {formData.room === "custom" && (
                  <input
                    type="text"
                    value={formData.room === "custom" ? "" : formData.room}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, room: e.target.value }))
                    }
                    className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter new room"
                    autoFocus
                  />
                )}
              </div>

              {/* Bed */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Bed Number *
                </label>
                <input
                  type="text"
                  name="bed"
                  value={formData.bed}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter bed number"
                  required
                />
              </div>

              {/* Preview */}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 transition-colors duration-200 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveFloorBed}
                className="inline-flex items-center gap-2 px-4 py-2 text-white transition-colors duration-200 bg-green-600 rounded-lg hover:bg-green-700"
              >
                <Save size={18} />
                {editingFloorBed ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FloorBed;
