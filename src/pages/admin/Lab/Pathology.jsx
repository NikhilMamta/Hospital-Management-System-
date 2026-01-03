import React, { useState, useEffect } from 'react';
import { X, Eye, FileText, Upload, Check, Download } from 'lucide-react';
import supabase from '../../../SupabaseClient';
import { useNotification } from '../../../contexts/NotificationContext';

const Pathology = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingRecords, setPendingRecords] = useState([]);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [modalError, setModalError] = useState('');
  const [reportPreview, setReportPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [patientNames, setPatientNames] = useState([]);
  const { showNotification } = useNotification();

  const [formData, setFormData] = useState({
    report: null,
    remarks: '',
    fileType: null // 'image' or 'pdf'
  });

  useEffect(() => {
    loadData();

    // Set up real-time subscription
    const channel = supabase
      .channel('pathology-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lab'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    try {
      setInitialLoading(true);

      // Load pending pathology records from lab table
      // Conditions: category = 'Pathology', planned1 IS NOT NULL, actual1 IS NULL, payment_status IS NOT NULL
      const { data: pendingData, error: pendingError } = await supabase
        .from('lab')
        .select(`*`)
        .eq('category', 'Pathology')
        .not('planned3', 'is', null)
        .is('actual3', null)
        .not('payment_status', 'is', null)
        .order('timestamp', { ascending: false });

      if (pendingError) throw pendingError;

      const formattedPending = pendingData.map(record => {
        return {
          id: record.id,
          uniqueNumber: record.admission_no || 'N/A',
          patientName: record.patient_name || 'N/A',
          phoneNumber: record.phone_no || 'N/A',
          age: record.age || 'N/A', // Corrected: age column
          gender: record.gender || 'N/A',
          bedNo: record.bed_no || 'N/A', // Corrected: bed_no column
          location: record.location || 'N/A',
          wardType: record.ward_type || 'N/A', // Corrected: ward_type column
          room: record.room || 'N/A',
          reasonForVisit: record.reason_for_visit || 'N/A',
          adviceNo: record.admission_no || 'N/A',
          category: record.category,
          priority: record.priority,
          pathologyTests: record.pathology_tests || [],
          planned1: record.planned1,
          planned3: record.planned3,
          actual1: record.actual1, // Corrected: actual1 column
          paymentStatus: record.payment_status,
          paymentId: record.id,
          admissionNo: record.admission_no
        };
      });

      setPendingRecords(formattedPending);

      // Load completed pathology records (pathology_report IS NOT NULL)
      const { data: historyData, error: historyError } = await supabase
        .from('lab')
        .select(`*`)
        .eq('category', 'Pathology')
        .not('planned3', 'is', null)
        .not('actual3', 'is', null)
        .order('actual3', { ascending: false });

      if (historyError) throw historyError;

      const formattedHistory = historyData.map(record => {
        return {
          id: record.id,
          uniqueNumber: record.admission_no || 'N/A',
          patientName: record.patient_name || 'N/A',
          phoneNumber: record.phone_no || 'N/A',
          age: record.age || 'N/A', // Corrected: age column
          gender: record.gender || 'N/A',
          bedNo: record.bed_no || 'N/A', // Corrected: bed_no column
          location: record.location || 'N/A',
          wardType: record.ward_type || 'N/A', // Corrected: ward_type column
          room: record.room || 'N/A',
          reasonForVisit: record.reason_for_visit || 'N/A',
          adviceNo: record.admission_no || 'N/A',
          category: record.category,
          priority: record.priority,
          pathologyTests: record.pathology_tests || [],
          pathologyReport: record.report_url,
          pathologyRemarks: record.lab_report_remarks,
          pathologyCompletedDate: record.actual3,
          planned1: record.planned1,
          planned3: record.planned3,
          actual3: record.actual3,
          actual1: record.actual1, // Corrected: actual1 column
          paymentStatus: record.payment_status,
          paymentId: record.id,
          admissionNo: record.admission_no
        };
      });

      setHistoryRecords(formattedHistory);

      // Extract unique patient names for filter
      const allRecords = [...pendingData, ...historyData];
      const uniqueNames = [...new Set(allRecords.map(item => item.patient_name).filter(Boolean))];
      setPatientNames(uniqueNames.sort());
    } catch (error) {
      console.error('Failed to load data:', error);
      setModalError('Failed to load data. Please try again.');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleActionClick = (record) => {
    setSelectedRecord(record);
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleReportChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setModalError('File size should be less than 5MB');
        return;
      }

      // Check file type
      const fileType = file.type;
      const isImage = fileType.startsWith('image/');
      const isPDF = fileType === 'application/pdf';

      if (!isImage && !isPDF) {
        setModalError('Please upload an image or PDF file');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          report: reader.result,
          fileType: isPDF ? 'pdf' : 'image'
        }));
        setReportPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!formData.report) {
      setModalError('Please upload report');
      return;
    }

    if (!formData.remarks.trim()) {
      setModalError('Please enter remarks');
      return;
    }

    try {
      setLoading(true);

      // Convert base64 to blob
      const base64Data = formData.report.split(',')[1];
      const binaryData = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(binaryData.length);
      const uint8Array = new Uint8Array(arrayBuffer);

      for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i);
      }

      const blob = new Blob([uint8Array], { type: formData.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg' });

      // Upload report to Supabase Storage
      const fileExtension = formData.fileType === 'pdf' ? 'pdf' : 'jpg';
      const fileName = `pathology_report_${selectedRecord.id}_${Date.now()}.${fileExtension}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pathology_reports')
        .upload(fileName, blob, {
          contentType: formData.fileType === 'pdf' ? 'application/pdf' : 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('pathology_reports')
        .getPublicUrl(fileName);

      // Update lab record with pathology info
      const { error: updateError } = await supabase
        .from('lab')
        .update({
          report_url: publicUrl,
          lab_report_remarks: formData.remarks,
          planned4: new Date().toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false
          }).replace(',', ''),
          actual3: new Date().toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false
          }).replace(',', ''),// Update actual1 with completion date
        })
        .eq('id', selectedRecord.id);

      if (updateError) throw updateError;

      // Reload data
      await loadData();

      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save pathology report:', error);
      setModalError('Failed to save report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      report: null,
      remarks: ''
    });
    setReportPreview(null);
    setModalError('');
    setSelectedRecord(null);
  };

  const handleViewClick = (record) => {
    setViewingRecord(record);
    setShowViewModal(true);
  };

  const handleViewReport = (reportUrl) => {
    if (!reportUrl) {
      showNotification('No report available', 'info');
      return;
    }

    // Check if it's a PDF
    const isPdf = reportUrl.toLowerCase().includes('.pdf');

    if (isPdf) {
      // For PDFs, just open in new tab - browser's built-in viewer handles it best
      window.open(reportUrl, '_blank');
    } else {
      // For images, show specialized viewer
      const newWindow = window.open();
      newWindow.document.write(`
        <html>
          <head><title>Pathology Report</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
            <img src="${reportUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
          </body>
        </html>
      `);
    }
  };

  // Apply filters to records
  const applyFilters = (records) => {
    return records.filter(record => {
      // Filter by patient name
      if (selectedPatient && record.patientName !== selectedPatient) {
        return false;
      }

      // Filter by date (match with planned3 date)
      if (selectedDate && record.planned3) {
        const planned3Date = new Date(record.planned3).toISOString().split('T')[0];
        if (planned3Date !== selectedDate) {
          return false;
        }
      }

      return true;
    });
  };

  // Get filtered data
  const filteredPendingRecords = applyFilters(pendingRecords);
  const filteredHistoryRecords = applyFilters(historyRecords);

  // Calculate statistics
  const totalRecords = pendingRecords.length + historyRecords.length;
  const highPriorityCount = [...pendingRecords, ...historyRecords].filter(r => r.priority === 'High').length;

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-600">Loading pathology data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex-none px-3 sm:px-4 py-3 sm:py-4">
        {/* Header - Compact on mobile */}
        <div className="mb-3 sm:mb-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">Pathology Department</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1 hidden sm:block">Manage pathology test reports and records</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4 md:grid-cols-4">
          <div className="p-3 sm:p-4 bg-white rounded-lg border border-green-200 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-600 uppercase">Total</span>
              <span className="text-xl sm:text-2xl font-bold text-green-600 mt-1">{totalRecords}</span>
            </div>
          </div>

          <div className="p-3 sm:p-4 bg-white rounded-lg border border-orange-200 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-600 uppercase">Pending</span>
              <span className="text-xl sm:text-2xl font-bold text-orange-600 mt-1">{pendingRecords.length}</span>
            </div>
          </div>

          <div className="p-3 sm:p-4 bg-white rounded-lg border border-green-200 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-600 uppercase">Completed</span>
              <span className="text-xl sm:text-2xl font-bold text-green-600 mt-1">{historyRecords.length}</span>
            </div>
          </div>

          <div className="p-3 sm:p-4 bg-white rounded-lg border border-purple-200 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-600 uppercase">High Priority</span>
              <span className="text-xl sm:text-2xl font-bold text-purple-600 mt-1">{highPriorityCount}</span>
            </div>
          </div>
        </div>

        {/* Tabs and Filters */}
        <div className="border-b border-gray-200">
          {/* Desktop: Tabs left, Filters right */}
          <div className="hidden lg:flex lg:items-center lg:justify-between pb-0">
            {/* Tabs */}
            <nav className="flex gap-4 -mb-[1px]">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-6 py-3 text-base font-medium border-b-2 transition-colors ${activeTab === 'pending'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Pending ({filteredPendingRecords.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-3 text-base font-medium border-b-2 transition-colors ${activeTab === 'history'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                History ({filteredHistoryRecords.length})
              </button>
            </nav>

            {/* Filters - Desktop */}
            <div className="flex gap-3 items-center">
              {/* Patient Name Filter */}
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm min-w-[180px]"
              >
                <option value="">All Patients</option>
                {patientNames.map((name, index) => (
                  <option key={index} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Date Filter */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              />

              {/* Clear Filters Button */}
              {(selectedPatient || selectedDate) && (
                <button
                  onClick={() => {
                    setSelectedPatient('');
                    setSelectedDate('');
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Mobile & Tablet: Stacked layout */}
          <div className="lg:hidden flex flex-col gap-2 sm:gap-3 pb-2 sm:pb-3">
            {/* Tabs */}
            <nav className="flex gap-2 sm:gap-4 -mb-[1px]">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium border-b-2 transition-colors ${activeTab === 'pending'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                Pending ({filteredPendingRecords.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium border-b-2 transition-colors ${activeTab === 'history'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                History ({filteredHistoryRecords.length})
              </button>
            </nav>

            {/* Filters - Mobile */}
            <div className="flex flex-wrap gap-2">
              {/* Patient Name Filter */}
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="flex-1 min-w-[140px] px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs sm:text-sm"
              >
                <option value="">All Patients</option>
                {patientNames.map((name, index) => (
                  <option key={index} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Date Filter */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 min-w-[140px] px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-xs sm:text-sm"
              />

              {/* Clear Filters Button */}
              {(selectedPatient || selectedDate) && (
                <button
                  onClick={() => {
                    setSelectedPatient('');
                    setSelectedDate('');
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-4">

        {/* Pending Section */}
        {activeTab === 'pending' && (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm md:block">
              <table className="min-w-full table-auto divide-y divide-gray-200">

                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Admission No</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Patient Name</th>
                    {/* <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Phone Number</th> */}
                    <th className="px-4 py-3 text-sm font-medium min-w-[300px] text-center">
                      Reason For Visit
                    </th>

                    {/* <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Age</th> */}
                    {/* <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Bed No.</th> */}
                    {/* <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Location</th> */}
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Ward Type</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Room</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Priority</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Tests</th>
                    <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Planned</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPendingRecords.length > 0 ? (
                    filteredPendingRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <button
                            onClick={() => handleActionClick(record)}
                            className="px-3 py-1.5 text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700"
                          >
                            Process
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">{record.admissionNo}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.patientName}</td>
                        {/* <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.phoneNumber}</td> */}
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[350px] whitespace-normal break-words text-center">
                          {record.reasonForVisit}
                        </td>

                        {/* <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.age}</td> */}
                        {/* <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.bedNo}</td> */}
                        {/* <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.location}</td> */}
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.wardType}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.room}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${record.priority === 'High' ? 'bg-red-100 text-red-700' :
                            record.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                            {record.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.category}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="max-w-xs">
                            {record.pathologyTests?.map((test, idx) => (
                              <div key={idx}>{test}</div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {record.planned3 ? new Date(record.planned3).toLocaleString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: 'short'
                          }) : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="14" className="px-4 py-8 text-center text-gray-500">
                        <FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                        <p className="text-lg font-medium text-gray-900">No pending records</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="space-y-3 md:hidden">
              {filteredPendingRecords.length > 0 ? (
                filteredPendingRecords.map((record) => (
                  <div key={record.id} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-xs font-medium text-green-600 mb-1">Admission No: {record.admissionNo}</div>
                        <h3 className="text-sm font-semibold text-gray-900">{record.patientName}</h3>
                      </div>
                      <button
                        onClick={() => handleActionClick(record)}
                        className="flex-shrink-0 px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg shadow-sm"
                      >
                        Process
                      </button>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium text-gray-900">{record.phoneNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Age:</span>
                        <span className="font-medium text-gray-900">{record.age}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Priority:</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${record.priority === 'High' ? 'bg-red-100 text-red-700' :
                          record.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                          {record.priority}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Planned:</span>
                        <span className="font-medium text-gray-900">
                          {record.planned3 ? new Date(record.planned3).toLocaleString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: 'short'
                          }) : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
                  <FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                  <p className="text-sm font-medium text-gray-900">No pending records</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* History Section */}
        {activeTab === 'history' && (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm md:block">
              <table className="min-w-full table-auto divide-y divide-gray-200">

                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Admission No</th>
                    <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Patient Name</th>
                    {/* <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Phone Number</th> */}
                    <th className="px-4 py-3 text-sm font-medium min-w-[300px] text-center">
                      Reason For Visit
                    </th>

                    {/* <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Age</th> */}
                    {/* <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Bed No.</th> */}
                    {/* <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Location</th> */}
                    <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Ward Type</th>
                    <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Room</th>
                    <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Priority</th>
                    <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Tests</th>
                    <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Planned</th>
                    <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Completed</th>
                    <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Report</th>
                    <th className="px-4 py-3 text-sm font-medium min-w-[300px] text-center">Remarks</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredHistoryRecords.length > 0 ? (
                    filteredHistoryRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">{record.admissionNo}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.patientName}</td>
                        {/* <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.phoneNumber}</td> */}
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[350px] whitespace-normal break-words text-center">
                          {record.reasonForVisit}
                        </td>

                        {/* <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.age}</td> */}
                        {/* <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.bedNo}</td> */}
                        {/* <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.location}</td> */}
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.wardType}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.room}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${record.priority === 'High' ? 'bg-red-100 text-red-700' :
                            record.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                            {record.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.category}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="max-w-xs">
                            {record.pathologyTests?.map((test, idx) => (
                              <div key={idx}>{test}</div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {record.planned3 ? new Date(record.planned3).toLocaleString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: 'short'
                          }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {record.actual3 ? new Date(record.actual3).toLocaleString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: 'short'
                          }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <button
                            onClick={() => handleViewClick(record)}
                            className="flex gap-1 items-center px-3 py-1.5 text-green-600 bg-green-50 rounded-lg shadow-sm hover:bg-green-100"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[350px] whitespace-normal break-words text-center">{record.pathologyRemarks}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="16" className="px-4 py-8 text-center text-gray-500">
                        <FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                        <p className="text-lg font-medium text-gray-900">No history records</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="space-y-3 md:hidden">
              {filteredHistoryRecords.length > 0 ? (
                filteredHistoryRecords.map((record) => (
                  <div key={record.id} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-xs font-medium text-green-600 mb-1">Admission No: {record.admissionNo}</div>
                        <h3 className="text-sm font-semibold text-gray-900">{record.patientName}</h3>
                      </div>
                      <button
                        onClick={() => handleViewClick(record)}
                        className="flex-shrink-0 px-3 py-1.5 text-xs text-green-600 bg-green-50 rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium text-gray-900">{record.phoneNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Age:</span>
                        <span className="font-medium text-gray-900">{record.age}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Planned:</span>
                        <span className="font-medium text-gray-900">
                          {record.planned3 ? new Date(record.planned3).toLocaleString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: 'short'
                          }) : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Completed:</span>
                        <span className="font-medium text-gray-900">
                          {record.actual3 ? new Date(record.actual3).toLocaleString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: 'short'
                          }) : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Remarks:</span>
                        <span className="font-medium text-gray-900">{record.pathologyRemarks}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
                  <FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                  <p className="text-sm font-medium text-gray-900">No history records</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Process Modal */}
        {showModal && selectedRecord && (
          <div className="overflow-y-auto fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50">
            <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
              <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-white border-b border-gray-200 md:p-6">
                <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Process Pathology Report</h2>
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
                <div className="p-4 mb-6 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Patient Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                    <div>
                      <span className="text-gray-600">Admission No:</span>
                      <div className="font-medium text-green-600">{selectedRecord.admissionNo}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <div className="font-medium text-gray-900">{selectedRecord.patientName}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Phone:</span>
                      <div className="font-medium text-gray-900">{selectedRecord.phoneNumber}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Age:</span>
                      <div className="font-medium text-gray-900">{selectedRecord.age}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Bed No:</span>
                      <div className="font-medium text-gray-900">{selectedRecord.bedNo}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Location:</span>
                      <div className="font-medium text-gray-900">{selectedRecord.location}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Ward Type:</span>
                      <div className="font-medium text-gray-900">{selectedRecord.wardType}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Room:</span>
                      <div className="font-medium text-gray-900">{selectedRecord.room}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Category:</span>
                      <div className="font-medium text-gray-900">{selectedRecord.category}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">Upload Report (Image or PDF) *</label>
                    <div className="mt-1">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleReportChange}
                        className="hidden"
                        id="report-upload"
                      />
                      <label
                        htmlFor="report-upload"
                        className="flex flex-col items-center justify-center px-4 py-6 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors"
                      >
                        {reportPreview ? (
                          <div className="text-center">
                            {formData.fileType === 'pdf' ? (
                              <div className="flex flex-col items-center">
                                <FileText className="w-16 h-16 text-red-600 mb-2" />
                                <p className="text-sm text-green-600 font-medium flex items-center justify-center gap-1">
                                  <Check className="w-4 h-4" />
                                  PDF uploaded successfully
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Click to change</p>
                              </div>
                            ) : (
                              <>
                                <img
                                  src={reportPreview}
                                  alt="Report preview"
                                  className="max-h-40 mb-2 rounded"
                                />
                                <p className="text-sm text-green-600 font-medium flex items-center justify-center gap-1">
                                  <Check className="w-4 h-4" />
                                  Report uploaded successfully
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Click to change</p>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="text-center">
                            <Upload className="mx-auto w-12 h-12 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600">Click to upload report</p>
                            <p className="text-xs text-gray-500 mt-1">PNG, JPG, PDF up to 5MB</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">Remarks *</label>
                    <textarea
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleInputChange}
                      rows="4"
                      placeholder="Enter your remarks here..."
                      className="px-3 py-2 w-full bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                    ></textarea>
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
                    className="px-6 py-2 w-full font-medium text-gray-700 bg-gray-100 rounded-lg transition-colors hover:bg-gray-200 sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-6 py-2 w-full font-medium text-white bg-green-600 rounded-lg transition-colors hover:bg-green-700 disabled:opacity-50 sm:w-auto"
                  >
                    {loading ? 'Processing...' : 'Save Report'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Details Modal */}
        {showViewModal && viewingRecord && (
          <div className="overflow-y-auto fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50">
            <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
              <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-white border-b border-gray-200 md:p-6">
                <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Pathology Report Details</h2>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="p-1 text-gray-400 rounded-full hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-4 md:p-6 space-y-6">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Patient Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                    <div>
                      <span className="text-gray-600">Admission No:</span>
                      <div className="font-medium text-green-600">{viewingRecord.admissionNo}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <div className="font-medium text-gray-900">{viewingRecord.patientName}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Phone:</span>
                      <div className="font-medium text-gray-900">{viewingRecord.phoneNumber}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Age:</span>
                      <div className="font-medium text-gray-900">{viewingRecord.age}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Bed No:</span>
                      <div className="font-medium text-gray-900">{viewingRecord.bedNo}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Room:</span>
                      <div className="font-medium text-gray-900">{viewingRecord.room}</div>
                    </div>
                    <div className="col-span-2 md:col-span-3">
                      <span className="text-gray-600">Tests:</span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {viewingRecord.pathologyTests?.map((test, index) => (
                          <span key={index} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                            {test}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Report Details</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-gray-600">Remarks:</span>
                      <div className="font-medium text-gray-900 mt-1 whitespace-pre-wrap">{viewingRecord.pathologyRemarks}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Completed Date:</span>
                      <div className="font-medium text-gray-900 mt-1">
                        {viewingRecord.pathologyCompletedDate ? new Date(viewingRecord.pathologyCompletedDate).toLocaleString() : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Report File</h3>
                  <div className="space-y-3">
                    {viewingRecord.pathologyReport ? (
                      <>
                        {viewingRecord.pathologyReport.toLowerCase().includes('.pdf') ? (
                          <iframe
                            src={viewingRecord.pathologyReport}
                            title="Report PDF"
                            className="w-full h-96 rounded-lg border border-gray-300"
                          />
                        ) : (
                          <img
                            src={viewingRecord.pathologyReport}
                            alt="Report"
                            className="w-full max-h-96 object-contain rounded-lg border border-gray-300"
                          />
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewReport(viewingRecord.pathologyReport)}
                            className="flex-1 px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            Open in Full Screen
                          </button>
                          <a
                            href={viewingRecord.pathologyReport}
                            download
                            className="flex-1 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </a>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="mx-auto w-12 h-12 text-gray-300 mb-2" />
                        <p className="text-gray-600">No report available</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="px-6 py-2 font-medium text-white bg-green-600 rounded-lg transition-colors hover:bg-green-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pathology;