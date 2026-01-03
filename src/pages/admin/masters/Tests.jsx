import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X, Save, FlaskConical, IndianRupee } from 'lucide-react';
import supabase from '../../../SupabaseClient';
import { useNotification } from '../../../contexts/NotificationContext';

const Tests = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const { showNotification } = useNotification();

  // Form state
  const [formData, setFormData] = useState({
    type: '',
    name: '',
    price: ''
  });

  // Fixed tabs for Pathology, X-ray, CT Scan, USG
  const [activeTab, setActiveTab] = useState('Pathology');
  const tabs = [
    { id: 'Pathology', name: 'Pathology' },
    { id: 'X-ray', name: 'X-ray' },
    { id: 'CT Scan', name: 'CT Scan' },
    { id: 'USG', name: 'USG' }
  ];

  // Fetch test data
  const fetchTests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('investigation')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setTests(data || []);
    } catch (error) {
      console.error('Error fetching tests:', error);
      showNotification('Error loading test data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  // Filter tests based on active tab and search
  const filteredTests = tests.filter(test => {
    // Apply tab filter - exact match
    if (test.type !== activeTab) {
      return false;
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const testName = test.name?.toLowerCase() || '';
      const testPrice = test.price?.toString() || '';
      return testName.includes(searchLower) || testPrice.includes(searchLower);
    }

    return true;
  });

  // Get counts for each tab
  const getTabCounts = () => {
    const counts = {};

    tabs.forEach(tab => {
      counts[tab.id] = tests.filter(test => test.type === tab.id).length;
    });

    return counts;
  };

  const tabCounts = getTabCounts();

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle price input - only allow numbers and decimal
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

  // Format price for display
  const formatPrice = (price) => {
    if (!price) return '₹0';
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return price;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(numPrice);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      type: activeTab,
      name: '',
      price: ''
    });
    setEditingTest(null);
  };

  // Open modal for adding/editing
  const openModal = (test = null) => {
    if (test) {
      setEditingTest(test);
      setFormData({
        type: test.type || '',
        name: test.name || '',
        price: test.price || ''
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
    if (!formData.type.trim()) {
      showNotification('Test type is required', 'error');
      return false;
    }

    if (!formData.name.trim()) {
      showNotification('Test name is required', 'error');
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

    // Check for duplicates (case insensitive, same type and name)
    const duplicate = tests.find(
      test =>
        test.type === formData.type &&
        test.name?.toLowerCase() === formData.name.toLowerCase() &&
        (!editingTest || test.id !== editingTest.id)
    );

    if (duplicate) {
      showNotification(`Test "${formData.name}" of type "${formData.type}" already exists`, 'error');
      return false;
    }

    return true;
  };

  // Save test
  const saveTest = async () => {
    if (!validateForm()) return;

    try {
      const testData = {
        type: formData.type.trim(),
        name: formData.name.trim(),
        price: formData.price
      };

      if (editingTest) {
        // Update existing test
        const { error } = await supabase
          .from('investigation')
          .update(testData)
          .eq('id', editingTest.id);

        if (error) throw error;
        showNotification('Test updated successfully!', 'success');
      } else {
        // Insert new test
        const { error } = await supabase
          .from('investigation')
          .insert([testData]);

        if (error) throw error;
        showNotification('Test added successfully!', 'success');
      }

      fetchTests();
      closeModal();
    } catch (error) {
      console.error('Error saving test:', error);
      showNotification('Error saving test', 'error');
    }
  };

  // Delete test
  const deleteTest = async (id) => {
    if (!window.confirm('Are you sure you want to delete this test?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('investigation')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showNotification('Test deleted successfully!', 'success');
      fetchTests();
    } catch (error) {
      console.error('Error deleting test:', error);
      showNotification('Error deleting test', 'error');
    }
  };

  // Get type badge color
  const getTypeBadgeColor = (type) => {
    const colors = {
      'Pathology': 'bg-blue-100 text-blue-800',
      'X-ray': 'bg-green-100 text-green-800',
      'CT Scan': 'bg-purple-100 text-purple-800',
      'USG': 'bg-yellow-100 text-yellow-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  // Calculate total value for active tab
  const calculateTotalValue = () => {
    return filteredTests.reduce((total, test) => {
      const price = parseFloat(test.price) || 0;
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
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Tests Management</h1>
          <p className="hidden md:block text-gray-600 mt-1">Manage hospital investigation tests</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm md:text-base"
        >
          <Plus size={18} className="md:w-5 md:h-5" />
          Add New Test
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 -mx-4 px-4 md:mx-0 md:px-0">
        <nav className="-mb-px flex space-x-4 md:space-x-8 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchTerm('');
              }}
              className={`
                whitespace-nowrap py-2.5 md:py-3 px-1 border-b-2 font-bold text-xs md:text-sm uppercase tracking-wider transition-all
                ${activeTab === tab.id
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.name}
              <span className={`ml-2 px-1.5 py-0.5 text-[10px] rounded-full font-bold ${activeTab === tab.id
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                {tabCounts[tab.id] || 0}
              </span>
            </button>
          ))}
        </nav>
      </div>



      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm md:text-base"
        />
      </div>

      {/* Mobile View: Cards */}
      <div className="md:hidden space-y-3">
        {filteredTests.length === 0 ? (
          <div className="bg-white p-8 text-center text-gray-500 border border-gray-200 rounded-lg text-sm">
            {searchTerm
              ? `No ${activeTab} tests found matching your search`
              : `No ${activeTab} tests found.`}
          </div>
        ) : (
          filteredTests.map((test) => (
            <div key={test.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <FlaskConical size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">{test.name || 'N/A'}</h3>
                    <p className="text-[10px] text-gray-500 uppercase font-bold mt-0.5">ID: #{test.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openModal(test)}
                    className="p-1.5 text-blue-600 bg-blue-50 rounded-md"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteTest(test.id)}
                    className="p-1.5 text-red-600 bg-red-50 rounded-md"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center py-2 border-t border-gray-50 mt-2">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold italic">Price</p>
                  <div className="flex items-center gap-1">
                    <IndianRupee size={12} className="text-green-600" />
                    <span className="text-sm font-bold text-green-700">{formatPrice(test.price)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase font-bold italic">Category</p>
                  <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full mt-0.5 ${getTypeBadgeColor(test.type)}`}>
                    {test.type}
                  </span>
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
                  Test Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTests.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    {searchTerm
                      ? `No ${activeTab} tests found matching "${searchTerm}"`
                      : `No ${activeTab} tests found. Add your first ${activeTab} test!`}
                  </td>
                </tr>
              ) : (
                filteredTests.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{test.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                          <FlaskConical size={16} className="text-gray-600" />
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {test.name || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <IndianRupee size={14} className="text-green-600" />
                        <span className="text-sm font-semibold text-green-700">
                          {formatPrice(test.price)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openModal(test)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => deleteTest(test.id)}
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">
                {editingTest ? 'Edit Test' : `Add ${activeTab} Test`}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Test Type - fixed for adding, selectable for editing */}
              {editingTest ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Test Type *
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Type</option>
                    {tabs.map((tab) => (
                      <option key={tab.id} value={tab.id}>{tab.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Test Type
                  </label>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getTypeBadgeColor(activeTab)}`}>
                      {activeTab}
                    </span>
                    <input type="hidden" name="type" value={activeTab} />
                  </div>
                </div>
              )}

              {/* Test Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter test name"
                  required
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (₹) *
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
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


            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={saveTest}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 inline-flex items-center gap-2"
              >
                <Save size={18} />
                {editingTest ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tests;