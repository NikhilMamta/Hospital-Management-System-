import React, { useState, useEffect } from 'react';
import { Heart, Search, ChevronDown, ChevronUp, User, Calendar, Clock } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import supabase from '../../../SupabaseClient';
import { useNotification } from '../../../contexts/NotificationContext';

const StatusBadge = ({ status }) => {
  const getColors = () => {
    if (status === 'Yes') return 'bg-green-100 text-green-700 border-green-200';
    if (status === 'No') return 'bg-red-100 text-red-700 border-red-200';
    if (status === 'Pending') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getLabel = (status) => {
    if (status === 'Yes') return 'Completed';
    if (status === 'No') return 'Cancelled';
    if (status === 'Pending') return 'Pending';
    return status;
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getColors()}`}>
      {getLabel(status)}
    </span>
  );
};

export default function Dressing() {
  const { data } = useOutletContext();

  const [pendingList, setPendingList] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [activeTab, setActiveTab] = useState('history');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedCard, setExpandedCard] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allPatients, setAllPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const { showNotification } = useNotification();

  const [formData, setFormData] = useState({
    admission_number: '',
    ipd_number: '',
    patient_name: '',
    task_no: '',
    patient_location: '',
    ward_type: '',
    room: '',
    bed_no: '',
    remarks: '',
    status: ''
  });

  // Function to get patient details from ipd_admissions table by matching IPD number
  const getPatientFromIPD = async (ipdNumber) => {
    if (!ipdNumber || ipdNumber === 'N/A') return null;

    try {
      const { data: patientData, error } = await supabase
        .from('ipd_admissions')
        .select(`
          admission_no,
          patient_name,
          bed_location,
          ward_type,
          room,
          bed_no,
          ipd_number,
          location_status,
          ward_no,
          room_no
        `)
        .eq('ipd_number', ipdNumber)
        .single();

      if (error) {
        console.error('Error fetching patient details:', error);
        return null;
      }

      return {
        admission_number: patientData.admission_no, // Map admission_no to admission_number
        patient_name: patientData.patient_name,
        patient_location: patientData.bed_location || patientData.location_status,
        ward_type: patientData.ward_type,
        room: patientData.room || patientData.room_no,
        bed_no: patientData.bed_no,
        ipd_number: patientData.ipd_number,
        ward_no: patientData.ward_no
      };
    } catch (err) {
      console.error('Error in getPatientFromIPD:', err);
      return null;
    }
  };

  // Fetch all patients for search
  const fetchAllPatients = async () => {
    try {
      const { data: patients, error } = await supabase
        .from('ipd_admissions')
        .select(`
          id,
          admission_no,
          patient_name,
          ipd_number,
          bed_location,
          ward_type,
          room,
          bed_no,
          location_status,
          ward_no,
          room_no
        `)
        .order('patient_name');

      if (error) {
        console.error('Error fetching patients:', error);
        return;
      }

      setAllPatients(patients || []);
    } catch (err) {
      console.error('Error in fetchAllPatients:', err);
    }
  };

  // Fetch dressing records from Supabase
  const fetchDressingRecords = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('dressing')
        .select('*')
        .order('timestamp', { ascending: false });

      // If we have a specific patient from context, get their details first
      if (data?.personalInfo?.ipd && data.personalInfo.ipd !== 'N/A') {
        const patientInfo = await getPatientFromIPD(data.personalInfo.ipd);

        if (patientInfo?.admission_number) {
          // Filter by admission number
          query = query.eq('admission_number', patientInfo.admission_number);
        }
      }

      const { data: dressingData, error } = await query;

      if (error) {
        console.error('Error fetching dressing records:', error);
        return;
      }

      const records = dressingData || [];

      // Transform data to match UI structure
      const transformedRecords = records.map(record => ({
        id: record.id,
        taskId: record.id,
        taskNo: record.task_no || `DR-${String(record.id).padStart(3, '0')}`,
        admissionNo: record.admission_number || 'N/A',
        patientName: record.patient_name || 'N/A',
        taskName: 'Dressing',
        wardType: record.ward_type || '',
        room: record.room || '',
        bedNo: record.bed_no || '',
        location: record.patient_location || '',
        remarks: record.remarks || '',
        status: record.status || 'Pending',
        date: record.timestamp ? new Date(record.timestamp).toISOString().split('T')[0] : 'N/A',
        supabaseData: record,
        plannedTime: record.planned1 ? new Date(record.planned1).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
        actualTime: record.actual1 ? new Date(record.actual1).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
        plannedDate: record.planned1,
        actualDate: record.actual1
      }));

      // Separate pending and history records based on actual1
      const history = transformedRecords.filter(record => record.actualDate);
      const pending = transformedRecords.filter(record => !record.actualDate);

      setHistoryList(history);
      setPendingList(pending);

    } catch (err) {
      console.error('Error in fetchDressingRecords:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fill patient details when admission number is selected
  const handlePatientSelect = (patient) => {
    setFormData({
      admission_number: patient.admission_no || '',
      ipd_number: patient.ipd_number || '',
      patient_name: patient.patient_name || '',
      task_no: '',
      patient_location: patient.bed_location || patient.location_status || '',
      ward_type: patient.ward_type || '',
      room: patient.room || patient.room_no || '',
      bed_no: patient.bed_no || '',
      remarks: '',
      status: ''
    });
    setSearchQuery(patient.admission_no || '');
    setShowPatientDropdown(false);
  };

  // Generate task number
  const generateTaskNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `DR${year}${month}${day}${random}`;
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.admission_number || !formData.status) {
      showNotification('Please fill in Admission Number and Status', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      //   const taskNo = generateTaskNumber();
      //   const now = new Date().toISOString();

      const dressingData = {
        timestamp: new Date().toLocaleString("en-CA", {
          timeZone: "Asia/Kolkata",
          hour12: false
        }).replace(',', ''),
        admission_number: formData.admission_number,
        ipd_number: formData.ipd_number,
        patient_name: formData.patient_name,
        // task_no: taskNo,
        patient_location: formData.patient_location,
        ward_type: formData.ward_type,
        room: formData.room,
        bed_no: formData.bed_no,
        planned1: new Date().toLocaleString("en-CA", {
          timeZone: "Asia/Kolkata",
          hour12: false
        }).replace(',', ''),
        actual1: null,
        remarks: formData.remarks || null,
        status: formData.status
      };

      const { error } = await supabase
        .from('dressing')
        .insert([dressingData]);

      if (error) throw error;

      // Reset form
      setFormData({
        admission_number: '',
        ipd_number: '',
        patient_name: '',
        task_no: '',
        patient_location: '',
        ward_type: '',
        room: '',
        bed_no: '',
        remarks: '',
        status: ''
      });
      setSearchQuery('');

      setShowForm(false);
      fetchDressingRecords();
      showNotification('Dressing record added successfully!', 'success');
    } catch (error) {
      console.error('Error adding dressing record:', error);
      showNotification('Failed to add dressing record', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update dressing status
  const updateDressingStatus = async (id, status) => {
    try {
      const updateData = {
        status: status,
        actual1: new Date().toISOString()
      };

      const { error } = await supabase
        .from('dressing')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      fetchDressingRecords();
      showNotification(`Dressing marked as ${status === 'Yes' ? 'Completed' : 'Cancelled'}`, 'success');
    } catch (error) {
      console.error('Error updating dressing status:', error);
      showNotification('Failed to update dressing status', 'error');
    }
  };

  // Auto-fill form with current patient data from context
  const autoFillCurrentPatient = async () => {
    if (!data?.personalInfo?.ipd || data.personalInfo.ipd === 'N/A') {
      // If no IPD number, use basic info from context
      setFormData({
        admission_number: data?.personalInfo?.uhid || '',
        ipd_number: data?.personalInfo?.ipd || '',
        patient_name: data?.personalInfo?.name || '',
        task_no: '',
        patient_location: data?.departmentInfo?.ward || '',
        ward_type: data?.departmentInfo?.ward_type || '',
        room: data?.departmentInfo?.room || '',
        bed_no: data?.departmentInfo?.bedNumber || '',
        remarks: '',
        status: ''
      });
      setSearchQuery(data?.personalInfo?.uhid || '');
      return;
    }

    // Fetch patient details from ipd_admissions using IPD number
    const patientInfo = await getPatientFromIPD(data.personalInfo.ipd);

    if (patientInfo) {
      setFormData({
        admission_number: patientInfo.admission_number || data.personalInfo.uhid || '',
        ipd_number: patientInfo.ipd_number || data.personalInfo.ipd || '',
        patient_name: patientInfo.patient_name || data.personalInfo.name || '',
        task_no: '',
        patient_location: patientInfo.patient_location || data.departmentInfo.ward || '',
        ward_type: patientInfo.ward_type || data.departmentInfo.ward_type || '',
        room: patientInfo.room || data.departmentInfo.room || '',
        bed_no: patientInfo.bed_no || data.departmentInfo.bedNumber || '',
        remarks: '',
        status: ''
      });
      setSearchQuery(patientInfo.admission_number || data.personalInfo.uhid || '');
    } else {
      // Fallback to context data
      setFormData({
        admission_number: data.personalInfo.uhid || '',
        ipd_number: data.personalInfo.ipd || '',
        patient_name: data.personalInfo.name || '',
        task_no: '',
        patient_location: data.departmentInfo.ward || '',
        ward_type: data.departmentInfo.ward_type || '',
        room: data.departmentInfo.room || '',
        bed_no: data.departmentInfo.bedNumber || '',
        remarks: '',
        status: ''
      });
      setSearchQuery(data.personalInfo.uhid || '');
    }
  };

  useEffect(() => {
    fetchDressingRecords();
    fetchAllPatients();
  }, []);

  // Auto-fill form when opening form
  useEffect(() => {
    if (showForm && data) {
      autoFillCurrentPatient();
    }
  }, [showForm, data]);

  const getFilteredTasks = () => {
    const tasks = activeTab === 'pending' ? pendingList : historyList;

    return tasks.filter(task => {
      const matchesSearch =
        task.admissionNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.taskNo?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  };

  // Filter patients for dropdown - using correct column names
  const filteredPatients = allPatients.filter(patient => {
    if (!searchQuery) return false;

    return (
      (patient.admission_no && patient.admission_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (patient.patient_name && patient.patient_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (patient.ipd_number && patient.ipd_number.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }).slice(0, 10); // Limit to 10 results

  const toggleCardExpansion = (taskId) => {
    if (expandedCard === taskId) {
      setExpandedCard(null);
    } else {
      setExpandedCard(taskId);
    }
  };

  const MobileTaskCard = ({ task }) => {
    const isExpanded = expandedCard === task.id;

    return (
      <div className="bg-white rounded-lg border border-gray-200 mb-3">
        <div
          className="p-3 cursor-pointer"
          onClick={() => toggleCardExpansion(task.id)}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={task.status} />
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                  {task.taskNo}
                </span>
              </div>

              <h3 className="font-bold text-gray-800 text-sm mb-1">{task.taskName}</h3>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="font-medium">Patient:</span>
                  <span className="text-gray-800">{task.patientName}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="font-medium">Admission:</span>
                  <span className="text-gray-800">{task.admissionNo}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-700">{task.location}</span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="px-3 pb-3 border-t border-gray-100 pt-3">
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 p-2 rounded">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Task ID</label>
                  <span className="text-xs font-medium text-green-600">{task.taskNo}</span>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <label className="block text-xs font-medium text-gray-500 mb-1">IPD</label>
                  <span className="text-xs text-gray-700">{task.supabaseData.ipd_number || 'N/A'}</span>
                </div>
              </div>

              <div className="bg-gray-50 p-2 rounded">
                <label className="block text-xs font-medium text-gray-500 mb-1">Ward & Bed</label>
                <div className="text-xs text-gray-700">
                  {task.wardType} {task.room && `/ ${task.room}`}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Bed: {task.bedNo || 'N/A'}</div>
              </div>

              {task.remarks && (
                <div className="bg-gray-50 p-2 rounded">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Remarks</label>
                  <p className="text-xs text-gray-700">{task.remarks}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 p-2 rounded">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Planned Time</label>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-700">{task.plannedTime || 'N/A'}</p>
                  </div>
                </div>

                {task.actualTime && (
                  <div className="bg-gray-50 p-2 rounded">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Actual Time</label>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <p className="text-xs text-gray-700">{task.actualTime}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* {activeTab === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateDressingStatus(task.id, 'Yes');
                    }}
                    className="flex-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                  >
                    Mark Complete
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateDressingStatus(task.id, 'No');
                    }}
                    className="flex-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )} */}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-600">Loading dressing records...</p>
        </div>
      </div>
    );
  }

  const filteredTasks = getFilteredTasks();

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 200px)' }}>
      {/* Header - GREEN THEME */}
      <div className="flex-shrink-0 bg-green-600 text-white p-4 rounded-lg shadow-md">
        {/* Desktop View */}
        <div className="hidden md:flex md:items-center md:justify-between">
          {/* Left side: Heading and icon */}
          <div className="flex items-center gap-3">
            <Heart className="w-8 h-8" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Dressing Records</h1>
              <p className="text-xs opacity-90 mt-1">
                {data?.personalInfo?.name ? `${data.personalInfo.name} - UHID: ${data.personalInfo.uhid}` : 'Manage dressing records'}
              </p>
            </div>
          </div>

          {/* Right side: Tabs, Search, Filter and Add Button */}
          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center bg-white/20 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${activeTab === 'history'
                  ? 'bg-white text-green-600'
                  : 'text-white hover:bg-white/30'
                  }`}
              >
                Complete ({historyList.length})
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${activeTab === 'pending'
                  ? 'bg-white text-green-600'
                  : 'text-white hover:bg-white/30'
                  }`}
              >
                Pending ({pendingList.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-300 w-4 h-4" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 pl-9 pr-3 py-2 bg-white/10 border border-green-400 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent placeholder-green-300 text-white text-sm"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-green-400 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent text-white text-sm"
            >
              <option value="all" className="text-gray-900">All Status</option>
              <option value="Yes" className="text-gray-900">Completed</option>
              <option value="No" className="text-gray-900">Cancelled</option>
              {/* <option value="Pending" className="text-gray-900">Pending</option> */}
            </select>

            {/* Add New Button */}
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-white text-green-600 rounded-lg font-medium hover:bg-green-50 transition-colors shadow-sm text-sm whitespace-nowrap"
            >
              + New
            </button>
          </div>
        </div>

        {/* Mobile View */}
        <div className="md:hidden">
          <div className="flex flex-col gap-3">
            {/* Title Row */}
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8" />
              <div className="flex-1">
                <h1 className="text-xl font-bold">Dressing Records</h1>
                <p className="text-xs opacity-90 mt-1">
                  {data?.personalInfo?.name ? `${data.personalInfo.name} - UHID: ${data.personalInfo.uhid}` : 'Manage dressing records'}
                </p>
              </div>
            </div>

            {/* Tabs, Search and Filter */}
            <div className="flex flex-col gap-2">
              {/* Small Tabs */}
              <div className="flex items-center bg-white/20 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${activeTab === 'history'
                    ? 'bg-white text-green-600'
                    : 'text-white hover:bg-white/30'
                    }`}
                >
                  Complete ({historyList.length})
                </button>
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${activeTab === 'pending'
                    ? 'bg-white text-green-600'
                    : 'text-white hover:bg-white/30'
                    }`}
                >
                  Pending ({pendingList.length})
                </button>
              </div>

              {/* Search, Filter and Add Button in same row */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-300 w-3 h-3" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white/10 border border-green-400 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent placeholder-green-300 text-white text-xs"
                  />
                </div>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-2 py-1.5 bg-white/10 border border-green-400 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent text-white text-xs w-24"
                >
                  <option value="all" className="text-gray-900">All Status</option>
                  <option value="Yes" className="text-gray-900">Completed</option>
                  <option value="No" className="text-gray-900">Cancelled</option>
                  <option value="Pending" className="text-gray-900">Pending</option>
                </select>

                {/* Add New Button for mobile */}
                <button
                  onClick={() => setShowForm(true)}
                  className="px-3 py-1.5 bg-white text-green-600 rounded-lg font-medium hover:bg-green-50 transition-colors shadow-sm text-xs whitespace-nowrap"
                >
                  + New
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area - Fixed height with independent scrolling */}
      <div className="flex-1 min-h-0 mt-3">
        {/* Mobile Card View with independent scroll */}
        <div className="md:hidden h-full">
          <div className="h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
            {filteredTasks.length === 0 ? (
              <div className="h-full flex items-center justify-center p-4">
                <div className="text-center">
                  <Heart className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-600 font-medium text-xs">
                    {activeTab === 'pending' ? 'No pending dressing found' : 'No completed dressing found'}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {searchTerm ? 'No records match your search' :
                      activeTab === 'pending' ? 'No pending dressing available' : 'No completed dressing available'
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                <div className="p-3">
                  <div className="space-y-2">
                    {filteredTasks.map((task) => (
                      <MobileTaskCard key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block h-full">
          <div className="h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
            {filteredTasks.length > 0 ? (
              <div className="h-full overflow-auto">
                <table className="w-full text-sm text-left">
                  <thead className="sticky top-0 z-10 bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Task NO</th>
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Patient</th>
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Admission No</th>
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Location</th>
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Ward/Bed</th>
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Planned Time</th>
                      {activeTab === 'history' && (
                        <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Actual Time</th>
                      )}
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Status</th>
                      {/* <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Actions</th> */}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-green-600">{task.taskNo}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{task.patientName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-500">{task.admissionNo}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-700 max-w-xs truncate">
                            {task.location || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-700">
                            {task.wardType} {task.room && `/ ${task.room}`}
                          </div>
                          <div className="text-xs text-gray-500">Bed: {task.bedNo || 'N/A'}</div>
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-700">
                          {task.plannedTime}
                        </td>
                        {activeTab === 'history' && (
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {task.actualTime}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <StatusBadge status={task.status} />
                        </td>
                        {/* <td className="px-4 py-3">
                          {activeTab === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateDressingStatus(task.id, 'Yes')}
                                className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => updateDressingStatus(task.id, 'No')}
                                className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </td> */}
                        {/* <td className="px-4 py-3">
                          <StatusBadge status={task.status} />
                        </td> */}
                        {/* <td className="px-4 py-3">
                          {activeTab === 'pending' && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => updateDressingStatus(task.id, 'Yes')}
                                className="px-2 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => updateDressingStatus(task.id, 'No')}
                                className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </td> */}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center">
                  <Heart className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-600 font-medium text-sm">
                    {activeTab === 'pending' ? 'No pending dressing found' : 'No completed dressing found'}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {searchTerm ? 'No records match your search' :
                      activeTab === 'pending' ? 'No pending dressing available' : 'No completed dressing available'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Dressing Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start md:items-center justify-center p-2 md:p-4 z-50">
          <div className="bg-white p-4 md:p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border-2 border-green-600">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg md:text-xl font-semibold text-green-600">Add New Dressing Record</h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormData({
                    admission_number: '',
                    ipd_number: '',
                    patient_name: '',
                    task_no: '',
                    patient_location: '',
                    ward_type: '',
                    room: '',
                    bed_no: '',
                    remarks: '',
                    status: ''
                  });
                  setSearchQuery('');
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Admission Number Search */}
              <div className="mb-4 relative">
                <label className="block mb-2 text-green-600 font-medium text-sm">
                  Search Patient *
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowPatientDropdown(true);
                    }}
                    onFocus={() => setShowPatientDropdown(true)}
                    placeholder="Search by Admission Number, Patient Name, or IPD..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-green-600 outline-none text-sm"
                  />
                </div>

                {showPatientDropdown && searchQuery && filteredPatients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-green-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredPatients.map((patient) => (
                      <div
                        key={patient.id}
                        onClick={() => handlePatientSelect(patient)}
                        className="p-3 cursor-pointer border-b border-gray-100 hover:bg-green-50 transition-colors"
                      >
                        <div className="font-medium text-green-600 text-sm">
                          {patient.admission_no} - {patient.patient_name}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          IPD: {patient.ipd_number} | Ward: {patient.ward_type}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  {data?.personalInfo?.name
                    ? `Current Patient: ${data.personalInfo.name} (${data.personalInfo.uhid})`
                    : 'Search for a patient to auto-fill details'
                  }
                </p>
              </div>

              {/* Auto-filled Patient Details */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Patient Details (Auto-filled)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Admission Number</label>
                    <input
                      type="text"
                      name="admission_number"
                      value={formData.admission_number}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 rounded border border-gray-300 bg-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">IPD Number</label>
                    <input
                      type="text"
                      name="ipd_number"
                      value={formData.ipd_number}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded border border-gray-300 bg-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Patient Name</label>
                    <input
                      type="text"
                      name="patient_name"
                      value={formData.patient_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded border border-gray-300 bg-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Location</label>
                    <input
                      type="text"
                      name="patient_location"
                      value={formData.patient_location}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded border border-gray-300 bg-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Ward Type</label>
                    <input
                      type="text"
                      name="ward_type"
                      value={formData.ward_type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded border border-gray-300 bg-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Room</label>
                    <input
                      type="text"
                      name="room"
                      value={formData.room}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded border border-gray-300 bg-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Bed No</label>
                    <input
                      type="text"
                      name="bed_no"
                      value={formData.bed_no}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded border border-gray-300 bg-gray-100 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Status and Remarks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                <div>
                  <label className="block mb-2 text-green-600 font-medium text-sm">
                    Status *
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2.5 rounded-lg border border-green-600 outline-none bg-white text-sm"
                  >
                    <option value="">Select Status</option>
                    <option value="Yes">Yes </option>
                    <option value="No">No </option>
                    {/* <option value="Pending">Pending</option> */}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block mb-2 text-green-600 font-medium text-sm">
                  Remarks (Optional)
                </label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 rounded-lg border border-green-600 outline-none min-h-[80px] resize-y text-sm"
                  placeholder="Enter any remarks about the dressing..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 py-3 rounded-lg font-medium text-sm transition-colors ${isSubmitting
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                >
                  {isSubmitting ? 'Submitting...' : 'Add Dressing Record'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({
                      admission_number: '',
                      ipd_number: '',
                      patient_name: '',
                      task_no: '',
                      patient_location: '',
                      ward_type: '',
                      room: '',
                      bed_no: '',
                      remarks: '',
                      status: ''
                    });
                    setSearchQuery('');
                  }}
                  disabled={isSubmitting}
                  className={`flex-1 py-3 rounded-lg font-medium text-sm transition-colors ${isSubmitting
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                    }`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}