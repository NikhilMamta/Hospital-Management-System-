import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X, Save, User, Phone, Mail, Briefcase, Building } from 'lucide-react';
import supabase from '../../../SupabaseClient';
import { useNotification } from '../../../contexts/NotificationContext';

const Doctors = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const { showNotification } = useNotification();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    email: '',
    designation: '',
    department: ''
  });

  // Fetch doctors data
  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      showNotification('Error loading doctors data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  // Filter doctors based on search
  const filteredDoctors = doctors.filter(doctor =>
    Object.values(doctor).some(value =>
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      phone_number: '',
      email: '',
      designation: '',
      department: ''
    });
    setEditingDoctor(null);
  };

  // Open modal for adding/editing
  const openModal = (doctor = null) => {
    if (doctor) {
      setEditingDoctor(doctor);
      setFormData({
        name: doctor.name || '',
        phone_number: doctor.phone_number || '',
        email: doctor.email || '',
        designation: doctor.designation || '',
        department: doctor.department || ''
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
    if (!formData.name.trim()) {
      showNotification('Doctor name is required', 'error');
      return false;
    }

    // Phone number validation
    if (formData.phone_number.trim() && !/^\d{10}$/.test(formData.phone_number.trim())) {
      showNotification('Please enter a valid 10-digit phone number', 'error');
      return false;
    }

    // Email validation
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      showNotification('Please enter a valid email address', 'error');
      return false;
    }

    return true;
  };

  // Save doctor
  const saveDoctor = async () => {
    if (!validateForm()) return;

    try {
      const doctorData = {
        name: formData.name.trim(),
        phone_number: formData.phone_number.trim() || null,
        email: formData.email.trim() || null,
        designation: formData.designation.trim() || null,
        department: formData.department.trim() || null
      };

      if (editingDoctor) {
        // Update existing doctor
        const { error } = await supabase
          .from('doctors')
          .update(doctorData)
          .eq('id', editingDoctor.id);

        if (error) throw error;
        showNotification('Doctor updated successfully!', 'success');
      } else {
        // Insert new doctor
        const { error } = await supabase
          .from('doctors')
          .insert([doctorData]);

        if (error) throw error;
        showNotification('Doctor added successfully!', 'success');
      }

      fetchDoctors();
      closeModal();
    } catch (error) {
      console.error('Error saving doctor:', error);
      showNotification('Error saving doctor', 'error');
    }
  };

  // Delete doctor
  const deleteDoctor = async (id) => {
    if (!window.confirm('Are you sure you want to delete this doctor?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('doctors')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Doctor deleted successfully!', 'success');
      fetchDoctors();
    } catch (error) {
      console.error('Error deleting doctor:', error);
      showNotification('Error deleting doctor', 'error');
    }
  };

  // Designation options
  const designationOptions = [
    'Senior Consultant',
    'Consultant',
    'Associate Consultant',
    'Resident Doctor',
    'House Surgeon',
    'Visiting Doctor',
    'Professor',
    'Assistant Professor',
    'Lecturer',
    'Other'
  ];

  // Department options
  const departmentOptions = [
    'Cardiology',
    'Neurology',
    'Orthopedics',
    'Pediatrics',
    'Gynecology',
    'General Surgery',
    'ENT',
    'Ophthalmology',
    'Dermatology',
    'Psychiatry',
    'Radiology',
    'Anesthesiology',
    'Emergency Medicine',
    'ICU',
    'Pathology',
    'Dentistry',
    'Physiotherapy'
  ];

  // Get designation badge color
  const getDesignationBadgeColor = (designation) => {
    const colors = {
      'Senior Consultant': 'bg-purple-100 text-purple-800',
      'Consultant': 'bg-blue-100 text-blue-800',
      'Associate Consultant': 'bg-green-100 text-green-800',
      'Resident Doctor': 'bg-yellow-100 text-yellow-800',
      'House Surgeon': 'bg-orange-100 text-orange-800',
      'Visiting Doctor': 'bg-pink-100 text-pink-800',
      'Professor': 'bg-indigo-100 text-indigo-800',
      'Assistant Professor': 'bg-teal-100 text-teal-800',
      'Lecturer': 'bg-cyan-100 text-cyan-800'
    };
    return colors[designation] || 'bg-gray-100 text-gray-800';
  };

  // Get department badge color
  const getDepartmentBadgeColor = (department) => {
    const colors = {
      'Cardiology': 'bg-red-100 text-red-800',
      'Neurology': 'bg-blue-100 text-blue-800',
      'Orthopedics': 'bg-green-100 text-green-800',
      'Pediatrics': 'bg-yellow-100 text-yellow-800',
      'Gynecology': 'bg-pink-100 text-pink-800',
      'General Surgery': 'bg-purple-100 text-purple-800',
      'Emergency Medicine': 'bg-orange-100 text-orange-800',
      'ICU': 'bg-indigo-100 text-indigo-800'
    };
    return colors[department] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Doctors Management</h1>
          <p className="hidden md:block text-gray-600 mt-1">Manage hospital doctors and specialists</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm md:text-base"
        >
          <Plus size={18} className="md:w-5 md:h-5" />
          Add New Doctor
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search doctors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm md:text-base"
        />
      </div>



      {/* Mobile View: Cards */}
      <div className="md:hidden space-y-3">
        {filteredDoctors.length === 0 ? (
          <div className="bg-white p-8 text-center text-gray-500 border border-gray-200 rounded-lg text-sm">
            {searchTerm ? 'No doctors found matching your search' : 'No doctors found. Add your first doctor!'}
          </div>
        ) : (
          filteredDoctors.map((doctor) => (
            <div key={doctor.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <User size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">{doctor.name || 'N/A'}</h3>
                    <p className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">ID: #{doctor.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal(doctor)}
                    className="p-1.5 text-blue-600 bg-blue-50 rounded-md"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteDoctor(doctor.id)}
                    className="p-1.5 text-red-600 bg-red-50 rounded-md"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2 border-t border-gray-50 mt-2">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold italic">Designation</p>
                  {doctor.designation ? (
                    <span className={`inline-flex px-1.5 py-0.5 mt-0.5 text-[10px] font-medium rounded-full ${getDesignationBadgeColor(doctor.designation)}`}>
                      {doctor.designation}
                    </span>
                  ) : (
                    <p className="text-[10px] text-gray-400">Not specified</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase font-bold italic">Department</p>
                  {doctor.department ? (
                    <span className={`inline-flex px-1.5 py-0.5 mt-0.5 text-[10px] font-medium rounded-full ${getDepartmentBadgeColor(doctor.department)}`}>
                      {doctor.department}
                    </span>
                  ) : (
                    <p className="text-[10px] text-gray-400">Not specified</p>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-50 space-y-1">
                {doctor.phone_number && (
                  <div className="flex items-center gap-2 text-[11px] text-gray-600 font-medium">
                    <Phone size={12} className="text-gray-400" />
                    {doctor.phone_number}
                  </div>
                )}
                {doctor.email && (
                  <div className="flex items-center gap-2 text-[11px] text-gray-600 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                    <Mail size={12} className="text-gray-400" />
                    {doctor.email}
                  </div>
                )}
                {!doctor.phone_number && !doctor.email && (
                  <p className="text-[11px] text-gray-400 italic">No contact info</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden md:block bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: '500px' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Doctor Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Designation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDoctors.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    {searchTerm ? 'No doctors found matching your search' : 'No doctors found. Add your first doctor!'}
                  </td>
                </tr>
              ) : (
                filteredDoctors.map((doctor) => (
                  <tr key={doctor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{doctor.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                          <User size={16} className="text-gray-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {doctor.name || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        {doctor.phone_number && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone size={14} />
                            {doctor.phone_number}
                          </div>
                        )}
                        {doctor.email && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail size={14} />
                            {doctor.email}
                          </div>
                        )}
                        {!doctor.phone_number && !doctor.email && (
                          <span className="text-sm text-gray-400">No contact info</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {doctor.designation ? (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getDesignationBadgeColor(doctor.designation)}`}>
                          {doctor.designation}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Not specified</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {doctor.department ? (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getDepartmentBadgeColor(doctor.department)}`}>
                          {doctor.department}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Not specified</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openModal(doctor)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => deleteDoctor(doctor.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Doctor Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter 10-digit phone number"
                    maxLength="10"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Optional - 10 digits only
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter email address"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Optional
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Designation
                </label>
                <select
                  name="designation"
                  value={formData.designation}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select Designation</option>
                  {designationOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select Department</option>
                  {departmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>



            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={saveDoctor}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 inline-flex items-center gap-2"
              >
                <Save size={18} />
                {editingDoctor ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Doctors;