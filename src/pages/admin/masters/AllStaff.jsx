import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X, Save, User, Tag, Building, ChevronDown, ChevronUp } from 'lucide-react';
import supabase from '../../../SupabaseClient';
import { useNotification } from '../../../contexts/NotificationContext';

const AllStaff = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const { showNotification } = useNotification();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    email: '',
    designation: '',
    department: ''
  });

  // Designation and Department management
  const [designations, setDesignations] = useState([
    'Doctor', 'Nurse', 'Receptionist', 'Lab Technician',
    'Pharmacist', 'Administrator', 'Accountant', 'Cleaner', 'Security', 'Other'
  ]);
  const [departments, setDepartments] = useState([
    'Emergency', 'ICU', 'Cardiology', 'Neurology', 'Orthopedics',
    'Pediatrics', 'Gynecology', 'Radiology', 'Pathology',
    'Pharmacy', 'Administration', 'Housekeeping', 'Security'
  ]);

  // State for new designation/department inputs
  const [newDesignation, setNewDesignation] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [showCustomDesignation, setShowCustomDesignation] = useState(false);
  const [showCustomDepartment, setShowCustomDepartment] = useState(false);

  // Fetch staff data
  const fetchStaff = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('all_staff')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setStaff(data || []);

      // Extract unique designations and departments from existing staff
      const uniqueDesignations = [...new Set(data?.map(s => s.designation).filter(Boolean))];
      const uniqueDepartments = [...new Set(data?.map(s => s.department).filter(Boolean))];

      // Merge with default options
      const allDesignations = [...new Set([...designations, ...uniqueDesignations])];
      const allDepartments = [...new Set([...departments, ...uniqueDepartments])];

      setDesignations(allDesignations);
      setDepartments(allDepartments);
    } catch (error) {
      console.error('Error fetching staff:', error);
      showNotification('Error loading staff data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Filter staff based on search
  const filteredStaff = staff.filter(staffMember =>
    Object.values(staffMember).some(value =>
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
    setNewDesignation('');
    setNewDepartment('');
    setShowCustomDesignation(false);
    setShowCustomDepartment(false);
    setEditingStaff(null);
  };

  // Open modal for adding/editing
  const openModal = (staffMember = null) => {
    if (staffMember) {
      setEditingStaff(staffMember);
      setFormData({
        name: staffMember.name || '',
        phone_number: staffMember.phone_number || '',
        email: staffMember.email || '',
        designation: staffMember.designation || '',
        department: staffMember.department || ''
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

  // Add new designation
  const addNewDesignation = () => {
    if (newDesignation.trim() && !designations.includes(newDesignation.trim())) {
      const updatedDesignations = [...designations, newDesignation.trim()];
      setDesignations(updatedDesignations);
      setFormData(prev => ({ ...prev, designation: newDesignation.trim() }));
      setNewDesignation('');
      setShowCustomDesignation(false);
    }
  };

  // Add new department
  const addNewDepartment = () => {
    if (newDepartment.trim() && !departments.includes(newDepartment.trim())) {
      const updatedDepartments = [...departments, newDepartment.trim()];
      setDepartments(updatedDepartments);
      setFormData(prev => ({ ...prev, department: newDepartment.trim() }));
      setNewDepartment('');
      setShowCustomDepartment(false);
    }
  };

  // Delete staff member
  const deleteStaff = async (id) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('all_staff')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Staff member deleted successfully!', 'success');
      fetchStaff();
    } catch (error) {
      console.error('Error deleting staff:', error);
      showNotification('Error deleting staff member', 'error');
    }
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
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">All Staff Management</h1>
          <p className="hidden md:block text-gray-600 mt-1">Manage hospital staff members</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search staff..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm md:text-base"
        />
      </div>

      {/* Mobile View: Cards */}
      <div className="md:hidden space-y-3">
        {filteredStaff.length === 0 ? (
          <div className="bg-white p-8 text-center text-gray-500 border border-gray-200 rounded-lg text-sm">
            {searchTerm ? 'No staff members found matching your search' : 'No staff members found'}
          </div>
        ) : (
          filteredStaff.map((staffMember) => (
            <div key={staffMember.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <User size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">{staffMember.name || 'N/A'}</h3>
                    <p className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">ID: #{staffMember.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal(staffMember)}
                    className="p-1.5 text-blue-600 bg-blue-50 rounded-md"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteStaff(staffMember.id)}
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
                  <span className={`inline-flex px-1.5 py-0.5 mt-0.5 text-[10px] font-medium rounded-full ${staffMember.designation === 'Doctor'
                    ? 'bg-blue-100 text-blue-800'
                    : staffMember.designation === 'Nurse'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-800'
                    }`}>
                    {staffMember.designation || 'N/A'}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase font-bold italic">Department</p>
                  <p className="text-[11px] text-gray-800 font-medium truncate">{staffMember.department || 'N/A'}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-50 space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-500 font-bold uppercase italic">Contact Info</span>
                </div>
                <div className="text-[11px] text-gray-600 space-y-0.5">
                  <p className="font-medium truncate">{staffMember.email || 'No email'}</p>
                  <p className="font-medium">{staffMember.phone_number || 'No phone'}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden md:block bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: '520px' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
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
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    {searchTerm ? 'No staff members found matching your search' : 'No staff members found'}
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staffMember) => (
                  <tr key={staffMember.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{staffMember.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                          <User size={16} className="text-gray-600" />
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {staffMember.name || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {staffMember.phone_number || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {staffMember.email || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${staffMember.designation === 'Doctor'
                        ? 'bg-blue-100 text-blue-800'
                        : staffMember.designation === 'Nurse'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                        }`}>
                        {staffMember.designation || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {staffMember.department || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openModal(staffMember)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => deleteStaff(staffMember.id)}
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
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
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
                  Name *
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
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter email address"
                />
              </div>

              {/* Designation Field with Add Option */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Designation
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCustomDesignation(!showCustomDesignation)}
                    className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                  >
                    {showCustomDesignation ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    Add New
                  </button>
                </div>

                {showCustomDesignation ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newDesignation}
                        onChange={(e) => setNewDesignation(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Enter new designation"
                      />
                      <button
                        type="button"
                        onClick={addNewDesignation}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      New designation will be added to the dropdown list
                    </p>
                  </div>
                ) : (
                  <select
                    name="designation"
                    value={formData.designation}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select Designation</option>
                    {designations.sort().map((designation) => (
                      <option key={designation} value={designation}>
                        {designation}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Department Field with Add Option */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Department
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCustomDepartment(!showCustomDepartment)}
                    className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                  >
                    {showCustomDepartment ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    Add New
                  </button>
                </div>

                {showCustomDepartment ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newDepartment}
                        onChange={(e) => setNewDepartment(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Enter new department"
                      />
                      <button
                        type="button"
                        onClick={addNewDepartment}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      New department will be added to the dropdown list
                    </p>
                  </div>
                ) : (
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select Department</option>
                    {departments.sort().map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                )}
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
                onClick={saveStaff}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 inline-flex items-center gap-2"
              >
                <Save size={18} />
                {editingStaff ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllStaff;