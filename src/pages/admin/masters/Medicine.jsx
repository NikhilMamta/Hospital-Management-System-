import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X, Save, Pill, Package, DollarSign } from 'lucide-react';
import supabase from '../../../SupabaseClient';
import { useNotification } from '../../../contexts/NotificationContext';
import useRealtimeTable from '../../../hooks/useRealtimeTable';

const Medicine = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const { showNotification } = useNotification();

  // Form state
  const [formData, setFormData] = useState({
    medicine_name: '',
    price: ''
  });

  // Fetch medicine data
  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('medicine')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setMedicines(data || []);
    } catch (error) {
      console.error('Error fetching medicines:', error);
      showNotification('Error loading medicine data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedicines();
  }, []);

  useRealtimeTable('medicine', fetchMedicines);

  // Filter medicines based on search
  const filteredMedicines = medicines.filter(medicine =>
    Object.values(medicine).some(value =>
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

  // Format price for display
  const formatPrice = (price) => {
    if (!price) return 'N/A';
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return price;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numPrice);
  };

  // Handle price input
  const handlePriceChange = (e) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData(prev => ({
        ...prev,
        price: value
      }));
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      medicine_name: '',
      price: ''
    });
    setEditingMedicine(null);
  };

  // Open modal for adding/editing
  const openModal = (medicine = null) => {
    if (medicine) {
      setEditingMedicine(medicine);
      setFormData({
        medicine_name: medicine.medicine_name || '',
        price: medicine.price || ''
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
      showNotification('Medicine name is required', 'error');
      return false;
    }

    if (!formData.price.trim()) {
      showNotification('Price is required', 'error');
      return false;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price < 0) {
      showNotification('Please enter a valid price', 'error');
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
        price: formData.price
      };

      if (editingMedicine) {
        // Update existing medicine
        const { error } = await supabase
          .from('medicine')
          .update(medicineData)
          .eq('id', editingMedicine.id);

        if (error) throw error;
        showNotification('Medicine updated successfully!', 'success');
      } else {
        // Insert new medicine
        const { error } = await supabase
          .from('medicine')
          .insert([medicineData]);

        if (error) throw error;
        showNotification('Medicine added successfully!', 'success');
      }

      fetchMedicines();
      closeModal();
    } catch (error) {
      console.error('Error saving medicine:', error);
      showNotification('Error saving medicine', 'error');
    }
  };

  // Delete medicine
  const deleteMedicine = async (id) => {
    if (!window.confirm('Are you sure you want to delete this medicine?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('medicine')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Medicine deleted successfully!', 'success');
      fetchMedicines();
    } catch (error) {
      console.error('Error deleting medicine:', error);
      showNotification('Error deleting medicine', 'error');
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Medicine Management</h1>
          <p className="hidden md:block text-gray-600 mt-1">Manage hospital medicine inventory</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm md:text-base"
        >
          <Plus size={18} className="md:w-5 md:h-5" />
          Add New Medicine
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search medicine..."
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
              <p className="text-sm text-gray-600">Total Medicines</p>
              <p className="text-2xl font-bold text-gray-800">{medicines.length}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Pill className="text-green-600" size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Inventory Value</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatPrice(calculateTotalValue())}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <DollarSign className="text-blue-600" size={20} />
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
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
            <div className="bg-purple-100 p-3 rounded-full">
              <Package className="text-purple-600" size={20} />
            </div>
          </div>
        </div>
      </div> */}

      {/* Mobile View: Cards */}
      <div className="md:hidden space-y-3">
        {filteredMedicines.length === 0 ? (
          <div className="bg-white p-8 text-center text-gray-500 border border-gray-200 rounded-lg text-sm">
            {searchTerm ? 'No medicines found matching your search' : 'No medicines found'}
          </div>
        ) : (
          filteredMedicines.map((medicine, index) => (
            <div key={medicine.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Pill size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">{medicine.medicine_name || 'N/A'}</h3>
                    <p className="text-[10px] text-gray-500">ID: #{index + 1}</p>
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

              <div className="flex justify-between items-center py-2 border-t border-gray-50 mt-2">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Price</p>
                  <p className="text-sm font-bold text-green-600">{formatPrice(medicine.price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Added On</p>
                  <p className="text-xs text-gray-600">
                    {new Date(medicine.timestamp).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
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
                  Medicine Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Added On
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMedicines.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    {searchTerm ? 'No medicines found matching your search' : 'No medicines found'}
                  </td>
                </tr>
              ) : (
                filteredMedicines.map((medicine, index) => {
                  const date = new Date(medicine.timestamp);
                  const formattedDate = date.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });

                  return (
                    <tr key={medicine.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                            <Pill size={16} className="text-gray-600" />
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            {medicine.medicine_name || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        {formatPrice(medicine.price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formattedDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingMedicine ? 'Edit Medicine' : 'Add New Medicine'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    ₹
                  </span>
                  <input
                    type="text"
                    name="price"
                    value={formData.price}
                    onChange={handlePriceChange}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.00"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter price in rupees (e.g., 250.50)
                </p>
              </div>

              {/* Preview */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Preview:</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Medicine Name</p>
                    <p className="font-medium">
                      {formData.medicine_name || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Price</p>
                    <p className="font-medium text-green-600">
                      {formData.price ? `₹${parseFloat(formData.price).toFixed(2)}` : 'Not set'}
                    </p>
                  </div>
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
                onClick={saveMedicine}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 inline-flex items-center gap-2"
              >
                <Save size={18} />
                {editingMedicine ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Medicine;