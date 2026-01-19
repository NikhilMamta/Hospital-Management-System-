import React, { useState, useEffect } from 'react';
import { Plus, X, Edit2, Save, UserPlus, Search, Filter } from 'lucide-react';
import supabase from '../../../SupabaseClient';

const Admission = () => {
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalError, setModalError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    patientName: '',
    phoneNumber: '',
    attenderName: '',
    reasonForVisit: '',
    dateOfBirth: '',
    age: '',
    gender: 'Male'
  });

  // Load existing patients from Supabase on component mount
  useEffect(() => {
    loadPatients();
  }, []);

  // Load patients from Supabase database
  const loadPatients = async () => {
    try {
      setIsLoading(true);

      // Fetch data from Supabase patient_admission table
      const { data, error } = await supabase
        .from('patient_admission')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error loading patients from Supabase:', error);
        setModalError('Failed to load patient data. Please try again.');
        return;
      }

      if (data) {
        // Transform the data from snake_case to camelCase
        const transformedPatients = data.map(patient => ({
          id: patient.id,
          admissionNo: patient.admission_no || `ADM-${patient.id?.toString().padStart(3, '0') || '001'}`,
          patientName: patient.patient_name || '',
          phoneNumber: patient.phone_no || '',
          attenderName: patient.attender_name || '',
          reasonForVisit: patient.reason_for_visit || '',
          dateOfBirth: patient.date_of_birth || '',
          age: patient.age || calculateAge(patient.date_of_birth),
          gender: patient.gender || 'Male',
          status: patient.status || 'pending',
          timestamp: patient.timestamp || '',
          timestampFormatted: patient.timestamp ? patient.timestamp : '-',
          submittedBy: patient.submitted_by || '-'
        }));

        setPatients(transformedPatients);
      }

    } catch (error) {
      console.error('Failed to load patients:', error);
      setModalError('An error occurred while loading patient data.');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate age from date of birth
  const calculateAge = (dob) => {
    if (!dob) return '';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  // Format date from YYYY-MM-DD to DD/MM/YYYY
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  // Generate admission number based on latest patient
  const generateAdmissionNo = () => {
    if (patients.length === 0) {
      return 'ADM-001';
    }

    const admissionNumbers = patients
      .map(p => p.admissionNo)
      .filter(num => num && num.startsWith('ADM-'))
      .map(num => parseInt(num.replace('ADM-', ''), 10))
      .filter(num => !isNaN(num));

    const maxNumber = admissionNumbers.length > 0 ? Math.max(...admissionNumbers) : 0;
    const nextNumber = maxNumber + 1;

    return `ADM-${String(nextNumber).padStart(3, '0')}`;
  };

  // Filter patients based on search query and date filter
  const filteredPatients = patients.filter(patient => {
    const matchesSearch = searchQuery === '' ||
      patient.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.phoneNumber.includes(searchQuery) ||
      patient.admissionNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.attenderName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDate = filterDate === '' || patient.dateOfBirth === filterDate;

    return matchesSearch && matchesDate;
  });

  // Updates form data state on input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'dateOfBirth') {
      const calculatedAge = calculateAge(value);
      setFormData(prev => ({
        ...prev,
        [name]: value,
        age: calculatedAge
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Submit new patient to Supabase
  const handleSubmit = async () => {
    if (!formData.patientName || !formData.phoneNumber || !formData.attenderName
      || !formData.reasonForVisit || !formData.dateOfBirth) {
      setModalError('Please fill all required fields marked with *');
      return;
    }

    setIsLoading(true);
    setModalError('');

    try {
      if (editingId) {
        // Update existing patient
        const updateData = {
          patient_name: formData.patientName.trim(),
          phone_no: formData.phoneNumber.trim(),
          attender_name: formData.attenderName.trim(),
          reason_for_visit: formData.reasonForVisit.trim(),
          date_of_birth: formData.dateOfBirth,
          age: formData.age,
          gender: formData.gender
        };

        const { error } = await supabase
          .from('patient_admission')
          .update(updateData)
          .eq('id', editingId);

        if (error) {
          throw error;
        }
      } else {
        // Create new patient
        const timestamp = new Date().toLocaleString("en-CA", {
          timeZone: "Asia/Kolkata",
          hour12: false
        }).replace(',', '');

        let submittedBy = 'Unknown';
        try {
          const misUser = JSON.parse(localStorage.getItem('mis_user'));
          if (misUser && misUser.name) {
            submittedBy = misUser.name;
          }
        } catch (e) {
          console.error('Error fetching user name:', e);
        }

        const patientData = {
          timestamp: timestamp,
          admission_no: generateAdmissionNo(),
          patient_name: formData.patientName.trim(),
          phone_no: formData.phoneNumber.trim(),
          attender_name: formData.attenderName.trim(),
          reason_for_visit: formData.reasonForVisit.trim(),
          date_of_birth: formData.dateOfBirth,
          age: formData.age,
          gender: formData.gender,
          status: 'pending',
          planned1: timestamp,
          submitted_by: submittedBy
        };

        const { error } = await supabase
          .from('patient_admission')
          .insert(patientData);

        if (error) {
          throw error;
        }
      }

      // Refresh the patient list and reset state
      await loadPatients();
      setShowModal(false);
      resetForm();

    } catch (error) {
      console.error('Error submitting patient:', error);
      setModalError(`Failed to save patient: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Resets the form and clears errors
  const resetForm = () => {
    setFormData({
      patientName: '',
      phoneNumber: '',
      attenderName: '',
      reasonForVisit: '',
      dateOfBirth: '',
      age: '',
      gender: 'Male'
    });
    setEditingId(null);
    setModalError('');
  };

  // Sets the patient data and opens modal for editing
  const handleEdit = (patient) => {
    setEditingId(patient.id);
    setFormData({
      patientName: patient.patientName,
      phoneNumber: patient.phoneNumber,
      attenderName: patient.attenderName,
      reasonForVisit: patient.reasonForVisit,
      dateOfBirth: patient.dateOfBirth,
      age: patient.age,
      gender: patient.gender
    });
    setShowModal(true);
  };



  return (
    <div className="p-1 space-y-2 md:p-0 bg-gray-50 min-h-[75vh]">
      <div className="flex flex-col gap-3 justify-between items-start sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            Patient Admission
          </h1>
          {isLoading && <p className="text-sm text-gray-600 mt-1">Loading...</p>}
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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, admission no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          />
        </div>
        <div className="relative sm:w-64">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table View with Fixed Header */}
      <div className="hidden md:block bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">Admission No</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">Patient Name</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">Phone Number</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">Attender Name</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50 min-w-[200px]">Reason For Visit</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">Date of Birth</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">Age</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">Gender</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">Admission Time</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">Submitted By</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-y">
              {isLoading && filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-4"></div>
                      <p className="text-lg font-medium text-gray-900">Loading patients...</p>
                      <p className="text-sm">Please wait while we fetch the data</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {patient.admissionNo}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
                      {patient.patientName}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
                      {patient.phoneNumber}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
                      {patient.attenderName}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[250px] whitespace-normal break-words text-gray-900">
                      {patient.reasonForVisit}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
                      {formatDateForDisplay(patient.dateOfBirth)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
                      {patient.age}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
                      {patient.gender}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
                      {patient.timestampFormatted ? new Date(patient.timestampFormatted).toLocaleString('en-GB', {
                        hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
                      }) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
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
                  <td colSpan="11" className="px-4 py-8 text-center text-gray-500">
                    <UserPlus className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                    <p className="text-lg font-medium text-gray-900">
                      {searchQuery || filterDate ? 'No patients found matching your filters' : 'No patients yet'}
                    </p>
                    <p className="text-sm">
                      {searchQuery || filterDate ? 'Try adjusting your search or filter' : 'Click "Patient Admission" to get started'}
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
          <div className="p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-4"></div>
              <p className="text-sm font-medium text-gray-900">Loading patients...</p>
              <p className="text-xs text-gray-600">Please wait while we fetch the data</p>
            </div>
          </div>
        ) : filteredPatients.length > 0 ? (
          filteredPatients.map((patient) => (
            <div key={patient.id} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-xs font-medium text-green-600 mb-1">
                    {patient.admissionNo}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {patient.patientName}
                  </h3>
                </div>
                <button
                  onClick={() => handleEdit(patient)}
                  disabled={isLoading}
                  className="flex flex-shrink-0 gap-1 items-center px-2 py-1 text-xs text-white bg-green-600 rounded-lg shadow-sm disabled:bg-gray-400"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Admission Time:</span>
                  <span className="font-medium text-gray-900">{patient.timestampFormatted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-medium text-gray-900">{patient.phoneNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Attender:</span>
                  <span className="font-medium text-gray-900">{patient.attenderName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">DOB:</span>
                  <span className="font-medium text-gray-900">{formatDateForDisplay(patient.dateOfBirth)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Age/Gender:</span>
                  <span className="font-medium text-gray-900">{patient.age} / {patient.gender}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Submitted By:</span>
                  <span className="font-medium text-gray-900">{patient.submittedBy}</span>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <span className="text-gray-600">Reason:</span>
                  <p className="mt-1 text-sm text-gray-900">{patient.reasonForVisit}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
            <UserPlus className="mx-auto mb-2 w-12 h-12 text-gray-300" />
            <p className="text-sm font-medium text-gray-900">
              {searchQuery || filterDate ? 'No patients found' : 'No patients yet'}
            </p>
            <p className="text-xs text-gray-600">
              {searchQuery || filterDate ? 'Try adjusting your search or filter' : 'Click "Patient Admission" to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Add New Patient Modal */}
      {showModal && (
        <div className="overflow-y-auto fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50 transition-opacity duration-300">
          <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl animate-scale-in">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 md:p-6">
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">
                {editingId ? 'Edit Patient' : 'Add New Patient'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 rounded-full p-1 hover:text-gray-600 hover:bg-gray-100"
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
                    className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
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
                    className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
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
                    className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    max={new Date().toISOString().split('T')[0]}
                    className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Age
                  </label>
                  <input
                    type="text"
                    name="age"
                    value={formData.age}
                    readOnly
                    className="px-3 py-2 w-full rounded-lg border border-gray-300 bg-gray-50 text-gray-600 cursor-not-allowed"
                    placeholder="Auto-calculated from DOB"
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
                    className="px-3 py-2 w-full bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
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
                  disabled={isLoading}
                  className="px-4 py-2 w-full font-medium text-gray-700 bg-gray-100 rounded-lg transition-colors hover:bg-gray-200 disabled:bg-gray-300 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex gap-2 items-center justify-center px-6 py-2 w-full font-medium text-white bg-green-600 rounded-lg shadow-sm transition-colors hover:bg-green-700 disabled:bg-gray-400 sm:w-auto"
                >
                  <Save className="w-5 h-5" />
                  {isLoading ? 'Saving...' : editingId ? 'Update Patient' : 'Save Patient'}
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