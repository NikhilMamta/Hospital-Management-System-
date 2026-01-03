import React, { useState, useEffect } from 'react';
import { Plus, X, Edit2, Save, UserCheck, Search } from 'lucide-react';
import supabase from '../../../SupabaseClient';

const DischargePatient = () => {
  const [dischargeRecords, setDischargeRecords] = useState([]);
  const [availablePatients, setAvailablePatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalError, setModalError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [formData, setFormData] = useState({
    admission_no: '',
    patient_name: '',
    department: '',
    consultant_name: '',
    staff_name: '',
    remark: ''
  });

  useEffect(() => {
    // Get current user from localStorage
    const getUserFromLocalStorage = () => {
      try {
        const storedUser = localStorage.getItem('mis_user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setCurrentUser(user);
          // Set staff name from user name
          setFormData(prev => ({
            ...prev,
            staff_name: user.name || ''
          }));
        }
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    };

    getUserFromLocalStorage();
    fetchDischargeRecords();
    fetchAvailablePatients();
  }, []);

  const fetchDischargeRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('discharge')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setDischargeRecords(data || []);
    } catch (error) {
      console.error('Error fetching discharge records:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailablePatients = async () => {
    try {
      const { data, error } = await supabase
        .from('ipd_admissions')
        .select('*')
        .not('planned1', 'is', null)
        .is('actual1', null)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const dischargedData = await supabase
        .from('discharge')
        .select('admission_no');

      if (dischargedData.error) throw dischargedData.error;

      const dischargedAdmissionNos = new Set(
        dischargedData.data?.map(d => d.admission_no) || []
      );

      const available = (data || []).filter(
        patient => !dischargedAdmissionNos.has(patient.admission_no)
      );

      setAvailablePatients(available);
    } catch (error) {
      console.error('Error fetching available patients:', error.message);
    }
  };

  const generateDischargeNumber = () => {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000);
    return `DISC-${timestamp}-${random}`;
  };

  const handleAdmissionSelect = (patient) => {
    setFormData({
      ...formData,
      admission_no: patient.admission_no,
      patient_name: patient.patient_name || '',
      department: patient.department || '',
      consultant_name: patient.consultant_dr || '',
      // Keep the current user's name as staff name
      staff_name: currentUser ? currentUser.name : ''
    });
    setSearchTerm(`${patient.admission_no} - ${patient.patient_name}`);
    setShowDropdown(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Don't allow changing staff_name field
    if (name === 'staff_name') return;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
  };

  const handleSubmit = async () => {
    if (!formData.admission_no || !formData.staff_name) {
      setModalError('Please fill all required fields marked with *');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('discharge')
        .insert([{
          timestamp: new Date().toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false
          }).replace(',', ''),
          admission_no: formData.admission_no,
          patient_name: formData.patient_name,
          department: formData.department,
          consultant_name: formData.consultant_name,
          staff_name: formData.staff_name,
          remark: formData.remark,
          planned1: new Date().toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false
          }).replace(',', ''),
        }])
        .select()
        .single();

      if (error) throw error;
      await fetchDischargeRecords();
      await fetchAvailablePatients();

      setShowModal(false);
      resetForm();

    } catch (error) {
      console.error('Error submitting discharge:', error.message);
      setModalError('Failed to save discharge record.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      admission_no: '',
      patient_name: '',
      department: '',
      consultant_name: '',
      // Reset staff_name to current user's name
      staff_name: currentUser ? currentUser.name : '',
      remark: ''
    });
    setSearchTerm('');
    setModalError('');
  };

  const handleEdit = (id) => {
    setEditingId(id);
  };

  const handleSaveEdit = async (id) => {
    try {
      const recordToUpdate = dischargeRecords.find(r => r.id === id);
      if (!recordToUpdate) return;

      const { error } = await supabase
        .from('discharge')
        .update({
          staff_name: recordToUpdate.staff_name,
          remark: recordToUpdate.remark
        })
        .eq('id', id);

      if (error) throw error;

      setEditingId(null);
      await fetchDischargeRecords();
    } catch (error) {
      console.error('Error updating discharge record:', error.message);
    }
  };

  const handleEditChange = (id, field, value) => {
    // Prevent editing staff_name field
    if (field === 'staff_name' && !value.trim()) return;

    setDischargeRecords(prev => prev.map(record =>
      record.id === id ? { ...record, [field]: value } : record
    ));
  };

  const handleOpenModal = () => {
    // Set staff name from current user when opening modal
    setFormData(prev => ({
      ...prev,
      staff_name: currentUser ? currentUser.name : ''
    }));
    setShowModal(true);
  };

  const filteredPatients = availablePatients.filter(patient =>
    patient.admission_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.ipd_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="p-2 space-y-3 md:p-6 md:space-y-4 bg-white min-h-screen">
      <div className="flex flex-col gap-2 justify-between items-start sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-3xl">
            Discharge Patient
          </h1>
          <p className="hidden mt-1 text-sm text-gray-600 sm:block">
            Manage patient discharge records
          </p>
          {currentUser && (
            <p className="mt-0.5 text-xs text-gray-500">
              Logged in as: <span className="font-medium">{currentUser.name}</span> ({currentUser.role})
            </p>
          )}
        </div>
        <button
          onClick={handleOpenModal}
          disabled={loading}
          className="flex gap-1.5 items-center justify-center px-3 py-2 w-full text-sm text-white bg-green-600 rounded-lg shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto md:px-4 md:py-2.5 md:text-base"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          Add Discharge
        </button>
      </div>

      {loading && dischargeRecords.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <p className="mt-2 text-gray-600">Loading discharge records...</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-green-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Discharge No</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Admission No</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Patient Name</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Department</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Consultant</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Staff Name</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Discharge Date</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dischargeRecords.length > 0 ? (
                  dischargeRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-green-50">
                      <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">
                        {record.discharge_number}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-blue-600 whitespace-nowrap">
                        {record.admission_no}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {record.patient_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.department}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.consultant_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {editingId === record.id ? (
                          <input
                            type="text"
                            value={record.staff_name}
                            onChange={(e) => handleEditChange(record.id, 'staff_name', e.target.value)}
                            className="px-2 py-1 w-full border border-gray-300 rounded"
                          />
                        ) : (
                          <span className="text-gray-900">{record.staff_name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {formatDate(record.timestamp)}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {editingId === record.id ? (
                          <button
                            onClick={() => handleSaveEdit(record.id)}
                            className="flex gap-1 items-center px-3 py-1.5 text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700"
                          >
                            <Save className="w-4 h-4" />
                            Save
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEdit(record.id)}
                            className="flex gap-1 items-center px-3 py-1.5 text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                      <UserCheck className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                      <p className="text-lg font-medium text-gray-900">No discharge records yet</p>
                      <p className="text-sm">Click "Add Discharge" to get started</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {dischargeRecords.length > 0 ? (
              dischargeRecords.map((record) => (
                <div key={record.id} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-[10px] font-medium text-green-600 mb-0.5">
                        {record.discharge_number}
                      </div>
                      <div className="text-[10px] font-medium text-blue-600 mb-0.5">
                        {record.admission_no}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {record.patient_name}
                      </h3>
                    </div>
                    {editingId === record.id ? (
                      <button
                        onClick={() => handleSaveEdit(record.id)}
                        className="flex flex-shrink-0 gap-0.5 items-center px-2 py-1 text-[10px] text-white bg-green-600 rounded-lg shadow-sm"
                      >
                        <Save className="w-3 h-3" />
                        Save
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEdit(record.id)}
                        className="flex flex-shrink-0 gap-0.5 items-center px-2 py-1 text-[10px] text-white bg-green-600 rounded-lg shadow-sm"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                    )}
                  </div>

                  {editingId === record.id ? (
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Staff Name:</span>
                        <input
                          type="text"
                          value={record.staff_name || ''}
                          onChange={(e) => handleEditChange(record.id, 'staff_name', e.target.value)}
                          className="px-2 py-1 w-1/2 text-right font-medium text-gray-900 border border-gray-300 rounded text-[11px]"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Remark:</span>
                        <input
                          type="text"
                          value={record.remark || ''}
                          onChange={(e) => handleEditChange(record.id, 'remark', e.target.value)}
                          className="px-2 py-1 w-1/2 text-right font-medium text-gray-900 border border-gray-300 rounded text-[11px]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Department:</span>
                        <span className="font-medium text-gray-900">{record.department}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Consultant:</span>
                        <span className="font-medium text-gray-900">{record.consultant_name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Staff Name:</span>
                        <span className="font-medium text-gray-900">{record.staff_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Discharge Date:</span>
                        <span className="font-medium text-gray-900">{formatDate(record.timestamp)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Discharge Time:</span>
                        <span className="font-medium text-gray-900">{formatTime(record.timestamp)}</span>
                      </div>
                      {record.remark && (
                        <div className="pt-1.5 mt-1.5 border-t border-gray-200">
                          <span className="text-gray-600">Remark:</span>
                          <p className="mt-0.5 text-gray-900">{record.remark}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-6 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
                <UserCheck className="mx-auto mb-2 w-10 h-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-900">No discharge records yet</p>
                <p className="text-xs text-gray-600 mt-0.5">Click "Add Discharge" to get started</p>
              </div>
            )}
          </div>
        </>
      )}

      {showModal && (
        <div className="overflow-y-auto fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50">
          <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl animate-scale-in">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-green-600 rounded-t-lg md:p-6">
              <h2 className="text-xl font-bold text-white md:text-2xl">Add Discharge Record</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-white rounded-full p-1 hover:text-gray-200 hover:bg-green-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 md:p-6">
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Search Patient <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="flex items-center">
                      <Search className="absolute left-3 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Search by Admission No or Patient Name"
                        className="px-3 py-2 pl-10 w-full rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    {showDropdown && filteredPatients.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredPatients.map((patient) => (
                          <div
                            key={patient.id}
                            onClick={() => handleAdmissionSelect(patient)}
                            className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-semibold text-sm text-gray-900">
                              {patient.admission_no} - {patient.patient_name}
                            </div>
                            <div className="text-xs text-gray-600">
                              Dept: {patient.department}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {showDropdown && filteredPatients.length === 0 && searchTerm && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                        No patients found
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Admission No
                    </label>
                    <input
                      type="text"
                      value={formData.admission_no}
                      readOnly
                      className="px-3 py-2 w-full rounded-lg border border-gray-300 bg-gray-50 text-gray-600"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Patient Name
                    </label>
                    <input
                      type="text"
                      value={formData.patient_name}
                      readOnly
                      className="px-3 py-2 w-full rounded-lg border border-gray-300 bg-gray-50 text-gray-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Department
                    </label>
                    <input
                      type="text"
                      value={formData.department}
                      readOnly
                      className="px-3 py-2 w-full rounded-lg border border-gray-300 bg-gray-50 text-gray-600"
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Consultant Name
                    </label>
                    <input
                      type="text"
                      value={formData.consultant_name}
                      readOnly
                      className="px-3 py-2 w-full rounded-lg border border-gray-300 bg-gray-50 text-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Staff Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.staff_name}
                      readOnly
                      className="px-3 py-2 w-full rounded-lg border border-gray-300 bg-gray-50 text-gray-600 pl-10"
                    />
                    <UserCheck className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Staff name is automatically set from your login information
                  </p>
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Remark
                  </label>
                  <textarea
                    name="remark"
                    value={formData.remark}
                    onChange={handleInputChange}
                    rows="4"
                    placeholder="Enter discharge remark"
                    className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {modalError && (
                <div className="p-3 mt-4 text-sm text-red-700 bg-red-100 rounded-lg">
                  {modalError}
                </div>
              )}

              <div className="flex flex-col gap-3 justify-end mt-6 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 w-full font-medium text-gray-700 bg-gray-100 rounded-lg transition-colors hover:bg-gray-200 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-4 py-2 w-full font-medium text-white bg-green-600 rounded-lg transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                >
                  {loading ? 'Saving...' : 'Save Discharge'}
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

export default DischargePatient;