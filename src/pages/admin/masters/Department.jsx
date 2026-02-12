import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X, Save, Building, Hash, Calendar } from 'lucide-react';
import supabase from '../../../SupabaseClient';
import { useNotification } from '../../../contexts/NotificationContext';
import useRealtimeTable from '../../../hooks/useRealtimeTable';

const Department = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const { showNotification } = useNotification();

  // Form state
  const [formData, setFormData] = useState({
    department: ''
  });

  // Fetch department data
  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('master')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      showNotification('Error loading department data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useRealtimeTable('master', fetchDepartments);

  // Filter departments based on search
  const filteredDepartments = departments.filter(dept =>
    dept.department?.toLowerCase().includes(searchTerm.toLowerCase())
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
      department: ''
    });
    setEditingDepartment(null);
  };

  // Open modal for adding/editing
  const openModal = (department = null) => {
    if (department) {
      setEditingDepartment(department);
      setFormData({
        department: department.department || ''
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
    if (!formData.department.trim()) {
      showNotification('Department name is required', 'error');
      return false;
    }

    // Check for duplicates (case insensitive)
    const duplicate = departments.find(
      dept =>
        dept.department?.toLowerCase() === formData.department.toLowerCase() &&
        (!editingDepartment || dept.id !== editingDepartment.id)
    );

    if (duplicate) {
      showNotification(`Department "${formData.department}" already exists`, 'error');
      return false;
    }

    return true;
  };

  // Save department
  const saveDepartment = async () => {
    if (!validateForm()) return;

    try {
      const departmentData = {
        department: formData.department.trim()
      };

      if (editingDepartment) {
        // Update existing department
        const { error } = await supabase
          .from('master')
          .update(departmentData)
          .eq('id', editingDepartment.id);

        if (error) throw error;
        showNotification('Department updated successfully!', 'success');
      } else {
        // Insert new department
        const { error } = await supabase
          .from('master')
          .insert([departmentData]);

        if (error) throw error;
        showNotification('Department added successfully!', 'success');
      }

      fetchDepartments();
      closeModal();
    } catch (error) {
      console.error('Error saving department:', error);
      showNotification('Error saving department', 'error');
    }
  };

  // Delete department
  const deleteDepartment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this department?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('master')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Department deleted successfully!', 'success');
      fetchDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      showNotification('Error deleting department', 'error');
    }
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Department Management</h1>
          <p className="hidden md:block text-gray-600 mt-1">Manage hospital departments</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm md:text-base"
        >
          <Plus size={18} className="md:w-5 md:h-5" />
          Add New Department
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search departments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm md:text-base"
        />
      </div>

      {/* Stats Cards
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Departments</p>
              <p className="text-2xl font-bold text-gray-800">{departments.length}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Building className="text-green-600" size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Recent Addition</p>
              <p className="text-lg font-semibold text-gray-800 truncate">
                {departments[0]?.department || 'N/A'}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Calendar className="text-blue-600" size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Entries</p>
              <p className="text-2xl font-bold text-gray-800">
                {departments.length}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <Hash className="text-purple-600" size={20} />
            </div>
          </div>
        </div>
      </div> */}

      {/* Mobile View: Cards */}
      <div className="md:hidden space-y-3">
        {filteredDepartments.length === 0 ? (
          <div className="bg-white p-8 text-center text-gray-500 border border-gray-200 rounded-lg text-sm">
            {searchTerm ? 'No departments found matching your search' : 'No departments found. Add your first department!'}
          </div>
        ) : (
          filteredDepartments.map((dept, index) => (
            <div key={dept.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Building size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">{dept.department || 'N/A'}</h3>
                    <p className="text-[10px] text-gray-500">ID: #{index + 1}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal(dept)}
                    className="p-1.5 text-blue-600 bg-blue-50 rounded-md"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteDepartment(dept.id)}
                    className="p-1.5 text-red-600 bg-red-50 rounded-md"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
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
                  Department Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    {searchTerm ? 'No departments found matching your search' : 'No departments found. Add your first department!'}
                  </td>
                </tr>
              ) : (
                filteredDepartments.map((dept, index) => (
                  <tr key={dept.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                          <Building size={16} className="text-gray-600" />
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {dept.department || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openModal(dept)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => deleteDepartment(dept.id)}
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

      {/* Quick Add Form */}
      <div className="bg-white p-3 md:p-4 rounded-lg shadow border border-gray-200">
        <h3 className="text-base md:text-lg font-medium text-gray-800 mb-2 md:mb-3">Quick Add Department</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={formData.department}
            onChange={(e) => setFormData({ department: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm md:text-base"
            placeholder="Enter department name"
          />
          <button
            onClick={() => {
              if (formData.department.trim()) {
                const tempFormData = { department: formData.department };
                setFormData(tempFormData);
                if (validateForm()) {
                  saveDepartment();
                  resetForm();
                }
              }
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center min-w-[44px]"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingDepartment ? 'Edit Department' : 'Add New Department'}
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
                  Department Name *
                </label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter department name"
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Examples: Cardiology, Neurology, Pediatrics, etc.
                </p>
              </div>

              {/* Preview */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Preview:</h3>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Building size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Department Name</p>
                    <p className="font-medium text-gray-800">
                      {formData.department || 'Not set'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Department List Preview */}
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Existing Departments ({departments.length}):</h3>
                <div className="max-h-40 overflow-y-auto">
                  <ul className="space-y-1">
                    {departments.slice(0, 10).map((dept) => (
                      <li key={dept.id} className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded">
                        <span className="text-sm text-gray-600">{dept.department}</span>
                        <span className="text-xs text-gray-400">#{dept.id}</span>
                      </li>
                    ))}
                    {departments.length > 10 && (
                      <li className="text-xs text-gray-500 text-center py-1">
                        ...and {departments.length - 10} more
                      </li>
                    )}
                  </ul>
                </div>
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
                onClick={saveDepartment}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 inline-flex items-center gap-2"
              >
                <Save size={18} />
                {editingDepartment ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Department;