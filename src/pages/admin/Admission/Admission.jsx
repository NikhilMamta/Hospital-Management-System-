import React, { useState } from "react";
import { Plus, X, Edit2, Save, UserPlus, Search, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import supabase from "../../../SupabaseClient";
import { getPatients, createPatient, updatePatient } from "../../../api/patients";
import useRealtimeQuery from "../../../hooks/useRealtimeQuery";

const Admission = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalError, setModalError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  
  const [formData, setFormData] = useState({
    patientName: "",
    phoneNumber: "",
    attenderName: "",
    reasonForVisit: "",
    dateOfBirth: "",
    age: "",
    gender: "Male",
  });

  // Queries
  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: getPatients,
  });

  // Real-time synchronization
  useRealtimeQuery('patient_admission', ['patients']);

  // Mutations
  const createMutation = useMutation({
    mutationFn: createPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setShowModal(false);
      resetForm();
    },
    onError: (error) => setModalError(`Failed to save patient: ${error.message}`)
  });

  const updateMutation = useMutation({
    mutationFn: updatePatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setShowModal(false);
      resetForm();
    },
    onError: (error) => setModalError(`Failed to update patient: ${error.message}`)
  });

  // Format date from YYYY-MM-DD to DD/MM/YYYY
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };

  // Filter patients based on search query and date filter
  const filteredPatients = patients.filter((patient) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === "" ||
      patient.patientName.toLowerCase().includes(q) ||
      patient.phoneNumber.includes(searchQuery) ||
      patient.admissionNo.toLowerCase().includes(q) ||
      patient.attenderName.toLowerCase().includes(q);

    const matchesDate = filterDate === "" || patient.dateOfBirth === filterDate;

    return matchesSearch && matchesDate;
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    if (
      !formData.patientName ||
      !formData.phoneNumber ||
      !formData.attenderName ||
      !formData.reasonForVisit
    ) {
      setModalError("Please fill all required fields marked with *");
      return;
    }

    setModalError("");

    try {
      if (editingId) {
        const updateData = {
          patient_name: formData.patientName.trim(),
          phone_no: formData.phoneNumber.trim(),
          attender_name: formData.attenderName.trim(),
          reason_for_visit: formData.reasonForVisit.trim(),
          date_of_birth: formData.dateOfBirth || null,
          age: formData.age,
          gender: formData.gender,
        };
        updateMutation.mutate({ id: editingId, updateData });
      } else {
        const timestamp = new Date()
          .toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false,
          })
          .replace(",", "");

        let submittedBy = "Unknown";
        try {
          const misUser = JSON.parse(localStorage.getItem("mis_user"));
          if (misUser && misUser.name) {
            submittedBy = misUser.name;
          }
        } catch (e) {
          console.error("Error fetching user name:", e);
        }

        const patientData = {
          timestamp: timestamp,
          patient_name: formData.patientName.trim(),
          phone_no: formData.phoneNumber.trim(),
          attender_name: formData.attenderName.trim(),
          reason_for_visit: formData.reasonForVisit.trim(),
          date_of_birth: formData.dateOfBirth || null,
          age: formData.age,
          gender: formData.gender,
          status: "pending",
          planned1: timestamp,
          submitted_by: submittedBy,
        };
        createMutation.mutate(patientData);
      }
    } catch (error) {
      console.error("Error submitting patient:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      patientName: "",
      phoneNumber: "",
      attenderName: "",
      reasonForVisit: "",
      dateOfBirth: "",
      age: "",
      gender: "Male",
    });
    setEditingId(null);
    setModalError("");
  };

  const handleEdit = (patient) => {
    setEditingId(patient.id);
    setFormData({
      patientName: patient.patientName,
      phoneNumber: patient.phoneNumber,
      attenderName: patient.attenderName,
      reasonForVisit: patient.reasonForVisit,
      dateOfBirth: patient.dateOfBirth,
      age: patient.age,
      gender: patient.gender,
    });
    setShowModal(true);
  };

  return (
    <div className="p-1 space-y-2 md:p-0 bg-gray-50 min-h-[75vh]">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Patient Admission
          </h1>
          {isLoading && (
            <p className="mt-1 text-sm text-gray-600">Loading...</p>
          )}
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          disabled={isLoading}
          className="flex gap-2 items-center justify-center px-4 py-2.5 w-full text-white bg-green-600 rounded-lg shadow-sm transition-colors hover:bg-green-700 disabled:bg-gray-400 sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          Patient Admission
        </button>
      </div>

      {/* Search and Filter Section */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute w-5 h-5 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
          <input
            type="text"
            value={searchQuery}
            placeholder="Search by name, admission no.."
            onChange={(e) => {
              console.log("RAW:", e.target.value);
              setSearchQuery(e.target.value);
            }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          />
        </div>
        <div className="relative sm:w-64">
          <Filter className="absolute w-5 h-5 text-gray-400 transform -translate-y-1/2 left-3 top-1/2" />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate("")}
              className="absolute text-gray-400 transform -translate-y-1/2 right-3 top-1/2 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table View with Fixed Header */}
      <div className="hidden overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm md:block">
        <div
          className="overflow-auto"
          style={{ maxHeight: "calc(100vh - 280px)" }}
        >
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                  Admission No
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                  Patient Name
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                  Phone Number
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                  Attender Name
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50 min-w-[200px]">
                  Reason For Visit
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                  Date of Birth
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                  Age
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                  Gender
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                  Admission Time
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                  Submitted By
                </th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-y">
              {isLoading && filteredPatients.length === 0 ? (
                <tr>
                  <td
                    colSpan="11"
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 mb-4 border-b-2 border-green-600 rounded-full animate-spin"></div>
                      <p className="text-lg font-medium text-gray-900">
                        Loading patients...
                      </p>
                      <p className="text-sm">
                        Please wait while we fetch the data
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {patient.admissionNo}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {patient.patientName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {patient.phoneNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {patient.attenderName}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[250px] whitespace-normal break-words text-gray-900">
                      {patient.reasonForVisit}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {formatDateForDisplay(patient.dateOfBirth)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {patient.age}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {patient.gender}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {patient.timestampFormatted
                        ? new Date(patient.timestampFormatted).toLocaleString(
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
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {patient.submittedBy}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(patient)}
                        disabled={isLoading}
                        className="flex gap-1 items-center px-3 py-1.5 text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700 disabled:bg-gray-400"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="11"
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    <UserPlus className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-lg font-medium text-gray-900">
                      {searchQuery || filterDate
                        ? "No patients found matching your filters"
                        : "No patients yet"}
                    </p>
                    <p className="text-sm">
                      {searchQuery || filterDate
                        ? "Try adjusting your search or filter"
                        : 'Click "Patient Admission" to get started'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="space-y-3 md:hidden">
        {isLoading && filteredPatients.length === 0 ? (
          <div className="p-8 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 mb-4 border-b-2 border-green-600 rounded-full animate-spin"></div>
              <p className="text-sm font-medium text-gray-900">
                Loading patients...
              </p>
              <p className="text-xs text-gray-600">
                Please wait while we fetch the data
              </p>
            </div>
          </div>
        ) : filteredPatients.length > 0 ? (
          filteredPatients.map((patient) => (
            <div
              key={patient.id}
              className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-green-600">
                    {patient.admissionNo}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {patient.patientName}
                  </h3>
                </div>
                <button
                  onClick={() => handleEdit(patient)}
                  disabled={isLoading}
                  className="flex items-center flex-shrink-0 gap-1 px-2 py-1 text-xs text-white bg-green-600 rounded-lg shadow-sm disabled:bg-gray-400"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Admission Time:</span>
                  <span className="font-medium text-gray-900">
                    {patient.timestampFormatted}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-medium text-gray-900">
                    {patient.phoneNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Attender:</span>
                  <span className="font-medium text-gray-900">
                    {patient.attenderName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">DOB:</span>
                  <span className="font-medium text-gray-900">
                    {formatDateForDisplay(patient.dateOfBirth)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Age/Gender:</span>
                  <span className="font-medium text-gray-900">
                    {patient.age} / {patient.gender}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Submitted By:</span>
                  <span className="font-medium text-gray-900">
                    {patient.submittedBy}
                  </span>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <span className="text-gray-600">Reason:</span>
                  <p className="mt-1 text-sm text-gray-900">
                    {patient.reasonForVisit}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
            <UserPlus className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-900">
              {searchQuery || filterDate
                ? "No patients found"
                : "No patients yet"}
            </p>
            <p className="text-xs text-gray-600">
              {searchQuery || filterDate
                ? "Try adjusting your search or filter"
                : 'Click "Patient Admission" to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Add New Patient Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto transition-opacity duration-300 bg-black bg-opacity-50">
          <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 md:p-6">
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">
                {editingId ? "Edit Patient" : "Add New Patient"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-1 text-gray-400 rounded-full hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 md:p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Patient Name *
                  </label>
                  <input
                    type="text"
                    name="patientName"
                    value={formData.patientName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Attender Name *
                  </label>
                  <input
                    type="text"
                    name="attenderName"
                    value={formData.attenderName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Age
                  </label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    min="0"
                    step="1"
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter age"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Gender *
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Reason For Visit *
                  </label>
                  <textarea
                    name="reasonForVisit"
                    value={formData.reasonForVisit}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {modalError && (
                <div className="p-3 mt-4 text-sm text-red-700 bg-red-100 rounded-lg">
                  {modalError}
                </div>
              )}

              <div className="flex flex-col justify-end gap-3 mt-6 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  disabled={isLoading}
                  className="w-full px-4 py-2 font-medium text-gray-700 transition-colors bg-gray-100 rounded-lg hover:bg-gray-200 disabled:bg-gray-300 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex items-center justify-center w-full gap-2 px-6 py-2 font-medium text-white transition-colors bg-green-600 rounded-lg shadow-sm hover:bg-green-700 disabled:bg-gray-400 sm:w-auto"
                >
                  <Save className="w-5 h-5" />
                  {isLoading
                    ? "Saving..."
                    : editingId
                      ? "Update Patient"
                      : "Save Patient"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Admission;
