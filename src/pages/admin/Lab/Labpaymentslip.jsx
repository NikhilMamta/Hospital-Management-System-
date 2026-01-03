import React, { useState, useEffect } from 'react';
import { X, Eye, FileText, Upload, Check, Bell } from 'lucide-react';
import supabase from '../../../SupabaseClient';

const Payment = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingPayments, setPendingPayments] = useState([]);
  const [historyPayments, setHistoryPayments] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [patientNames, setPatientNames] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [modalError, setModalError] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Notification state
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success'); // 'success' or 'error'

  const [formData, setFormData] = useState({
    payment: '',
    billImage: null,
    fileType: null // 'image' or 'pdf'
  });

  // Auto-hide notification after 1 second
  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  const showNotificationPopup = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
  };

  // Load data from Supabase
  useEffect(() => {
    loadData();

    // Set up real-time subscription
    const channel = supabase
      .channel('payment-changes')
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

      // Load pending payments (planned1 IS NOT NULL AND actually IS NULL AND payment_status IS NULL)
      const { data: pendingData, error: pendingError } = await supabase
        .from('lab')
        .select(`*`)
        .not('planned1', 'is', null)
        .is('actual1', null)
        .order('timestamp', { ascending: false });

      if (pendingError) throw pendingError;

      const formattedPending = pendingData.map(record => ({
        id: record.id,
        uniqueNumber: record.admission_no || 'N/A',
        patientName: record.patient_name || 'N/A',
        phoneNumber: record.phone_no || 'N/A',
        age: record.age || 'N/A',
        gender: record.gender || 'N/A',
        bedNo: record.bed_no || 'N/A',
        location: record.location || 'N/A',
        wardType: record.ward_type || 'N/A',
        room: record.room || 'N/A',
        reasonForVisit: record.reason_for_visit || 'N/A',
        adviceNo: record.admission_no || 'N/A',
        category: record.category,
        priority: record.priority,
        pathologyTests: record.pathology_tests || [],
        radiologyTests: record.radiology_tests || [],
        radiologyType: record.radiology_type,
        planned1: record.planned1,
        actual1: record.actual1,
        paymentId: record.id,
        admissionNo: record.admission_no,
        planned3: record.planned1
      }));

      setPendingPayments(formattedPending);

      // Load history payments (payment_status IS NOT NULL)
      const { data: historyData, error: historyError } = await supabase
        .from('lab')
        .select(`*`)
        .not('planned1', 'is', null)
        .not('actual1', 'is', null)
        .order('timestamp', { ascending: false });

      if (historyError) throw historyError;

      const formattedHistory = historyData.map(record => ({
        id: record.id,
        uniqueNumber: record.admission_no || 'N/A',
        patientName: record.patient_name || 'N/A',
        phoneNumber: record.phone_no || 'N/A',
        age: record.age || 'N/A',
        gender: record.gender || 'N/A',
        bedNo: record.bed_no || 'N/A',
        location: record.location || 'N/A',
        wardType: record.ward_type || 'N/A',
        room: record.room || 'N/A',
        reasonForVisit: record.reason_for_visit || 'N/A',
        adviceNo: record.admission_no || 'N/A',
        category: record.category,
        priority: record.priority,
        pathologyTests: record.pathology_tests || [],
        radiologyTests: record.radiology_tests || [],
        radiologyType: record.radiology_type,
        paymentStatus: record.payment_status,
        billImage: record.bill_image_url,
        processedDate: record.actual1,
        paymentId: record.id,
        admissionNo: record.admission_no,
        planned1: record.planned1,
        actual1: record.actual1
      }));

      setHistoryPayments(formattedHistory);

      // Extract unique patient names
      const allRecords = [...formattedPending, ...formattedHistory];
      const uniquePatients = [...new Set(allRecords.map(r => r.patientName))]
        .filter(name => name && name !== 'N/A')
        .sort();
      setPatientNames(uniquePatients);
    } catch (error) {
      console.error('Failed to load data:', error);
      showNotificationPopup('Failed to load payment data. Please try again.', 'error');
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

  const handleImageChange = (e) => {
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
          billImage: reader.result,
          fileType: isPDF ? 'pdf' : 'image'
        }));
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!formData.payment) {
      setModalError('Please select payment status');
      return;
    }

    try {
      setLoading(true);
      let publicUrl = null;

      if (formData.payment === 'Yes' && formData.billImage) {
        const base64Data = formData.billImage.split(',')[1];
        const binaryData = atob(base64Data);
        const arrayBuffer = new ArrayBuffer(binaryData.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        for (let i = 0; i < binaryData.length; i++) {
          uint8Array[i] = binaryData.charCodeAt(i);
        }

        // Determine content type and file extension based on fileType
        const isPDF = formData.fileType === 'pdf';
        const contentType = isPDF ? 'application/pdf' : 'image/jpeg';
        const fileExtension = isPDF ? 'pdf' : 'jpg';

        const blob = new Blob([uint8Array], { type: contentType });
        const fileName = `bill_${selectedRecord.id}_${Date.now()}.${fileExtension}`;
        const { error: uploadError } = await supabase.storage
          .from('bill_image')
          .upload(fileName, blob, { contentType, upsert: true });

        if (uploadError) throw uploadError;
        const { data: { publicUrl: url } } = supabase.storage.from('bill_image').getPublicUrl(fileName);
        publicUrl = url;
      }

      const now = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata", hour12: false }).replace(',', '');
      const updateData = {
        payment_status: formData.payment,
        planned2: now,
        actual1: now,
      };

      if (formData.payment === 'Yes' && publicUrl) {
        updateData.bill_image_url = publicUrl;
      } else if (formData.payment !== 'Yes') {
        updateData.bill_image_url = null;
      }

      const { error: updateError } = await supabase.from('lab').update(updateData).eq('id', selectedRecord.id);
      if (updateError) throw updateError;

      await loadData();
      showNotificationPopup('Payment processed successfully!', 'success');
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to process payment:', error);
      showNotificationPopup('Failed to process payment. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ payment: '', billImage: null });
    setImagePreview(null);
    setModalError('');
    setSelectedRecord(null);
  };

  const handleViewClick = (record) => {
    setViewingRecord(record);
    setShowViewModal(true);
  };

  const handleViewImage = (imageUrl) => {
    if (!imageUrl) {
      showNotificationPopup('No bill image available', 'error');
      return;
    }
    const newWindow = window.open();
    newWindow.document.write(`
      <html>
        <head><title>Bill Image</title></head>
        <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
          <img src="${imageUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
        </body>
      </html>
    `);
  };

  const applyFilters = (records) => {
    return records.filter(record => {
      if (selectedPatient && record.patientName !== selectedPatient) return false;
      if (selectedDate && record.planned1) {
        const recordDate = new Date(record.planned1).toISOString().split('T')[0];
        if (recordDate !== selectedDate) return false;
      }
      return true;
    });
  };

  const filteredPendingPayments = applyFilters(pendingPayments);
  const filteredHistoryPayments = applyFilters(historyPayments);

  const totalPathology = [...pendingPayments, ...historyPayments].filter(r => r.category === 'Pathology').length;
  const totalRadiology = [...pendingPayments, ...historyPayments].filter(r => r.category === 'Radiology').length;
  const completePathology = historyPayments.filter(r => r.category === 'Pathology').length;
  const completeRadiology = historyPayments.filter(r => r.category === 'Radiology').length;
  const pendingPathology = pendingPayments.filter(r => r.category === 'Pathology').length;
  const pendingRadiology = pendingPayments.filter(r => r.category === 'Radiology').length;

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-600">Loading payment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Fixed Section: Header, Notification, Stats, Tabs & Filters */}
      <div className="flex-none bg-white border-b border-gray-200 shrink-0 shadow-sm z-10">
        <div className="px-4 py-2 sm:px-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold text-gray-900 sm:text-2xl lg:text-3xl">Payment Management</h1>
              <p className="hidden mt-0.5 text-xs text-gray-500 sm:block">Process payments and manage billing records</p>
            </div>
          </div>
        </div>

        {showNotification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className={`relative w-full max-w-md transform transition-all duration-300 animate-scale-in opacity-100`}>
              <div className={`rounded-lg shadow-2xl overflow-hidden ${notificationType === 'success' ? 'bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200' : 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200'} `}>
                <div className="p-6 text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${notificationType === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {notificationType === 'success' ? <Check className="w-8 h-8 text-green-600" /> : <X className="w-8 h-8 text-red-600" />}
                  </div>
                  <h3 className={`text-lg font-bold mb-2 ${notificationType === 'success' ? 'text-green-800' : 'text-red-800'}`}>{notificationType === 'success' ? 'Success!' : 'Error!'}</h3>
                  <p className={`text-sm ${notificationType === 'success' ? 'text-green-600' : 'text-red-600'}`}>{notificationMessage}</p>
                  <div className={`mt-4 h-1 w-full ${notificationType === 'success' ? 'bg-green-200' : 'bg-red-200'}`}>
                    <div className={`h-full ${notificationType === 'success' ? 'bg-green-500' : 'bg-red-500'} animate-progress`}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-3 sm:px-4 pt-2">
          {/* Stats Grid - More compact */}
          <div className="grid grid-cols-3 gap-2 mb-3 md:grid-cols-6">
            {[
              { label: 'Total Path', val: totalPathology, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
              { label: 'Total Rad', val: totalRadiology, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
              { label: 'Comp Path', val: completePathology, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
              { label: 'Comp Rad', val: completeRadiology, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100' },
              { label: 'Pend Path', val: pendingPathology, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
              { label: 'Pend Rad', val: pendingRadiology, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' }
            ].map((s, idx) => (
              <div key={idx} className={`p-1.5 sm:p-2 ${s.bg} rounded-lg border ${s.border} shadow-sm transition-all hover:shadow-md`}>
                <div className="flex flex-col">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase truncate leading-tight">{s.label}</span>
                  <span className={`text-sm sm:text-base font-black ${s.color} mt-0.5 leading-none`}>{s.val}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs and Filters Combined */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pb-2">
            <nav className="flex gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar border-b lg:border-none">
              {['pending', 'history'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-bold whitespace-nowrap transition-all border-b-2 ${activeTab === tab
                    ? 'border-green-600 text-green-700 bg-green-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  {tab.toUpperCase()} ({tab === 'pending' ? filteredPendingPayments.length : filteredHistoryPayments.length})
                </button>
              ))}
            </nav>

            <div className="flex flex-wrap lg:flex-nowrap gap-2 w-full lg:w-auto">
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="flex-1 lg:w-48 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-green-500 outline-none"
              >
                <option value="">All Patients</option>
                {patientNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 lg:w-40 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-green-500 outline-none"
              />

              {(selectedPatient || selectedDate) && (
                <button
                  onClick={() => { setSelectedPatient(''); setSelectedDate(''); }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-xs font-bold transition-colors"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-3 md:p-4">
        {activeTab === 'pending' && (
          <div className="h-full flex flex-col">
            <div className="hidden flex-1 overflow-hidden bg-white rounded-lg border border-gray-200 shadow-sm md:flex flex-col">
              <div className="overflow-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Action</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Admission No</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Patient Name</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Planned</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase min-w-[200px]">Reason For Visit</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Ward Type</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Room</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Tests</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPendingPayments.length > 0 ? filteredPendingPayments.map(record => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <button onClick={() => handleActionClick(record)} className="px-3 py-1.5 text-white bg-green-600 rounded-lg hover:bg-green-700">Process</button>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">{record.admissionNo || record.uniqueNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.patientName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {record.planned1 ? new Date(record.planned1).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[250px] whitespace-normal break-words">{record.reasonForVisit}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.wardType}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.room}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${record.priority === 'High' ? 'bg-red-100 text-red-700' : record.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                            {record.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.category}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="max-w-[200px] whitespace-normal break-words">
                            {record.category === 'Pathology'
                              ? (record.pathologyTests && record.pathologyTests.length > 0
                                ? record.pathologyTests.join(', ')
                                : 'No tests')
                              : (record.radiologyTests && record.radiologyTests.length > 0
                                ? record.radiologyTests.join(', ')
                                : 'No tests')}
                          </div>
                        </td>
                      </tr>
                    )) : <tr><td colSpan="10" className="px-4 py-8 text-center text-gray-500"><FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" /><p className="text-sm">No pending payments</p></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="md:hidden h-full overflow-auto space-y-3 pb-8">
              {filteredPendingPayments.map(record => (
                <div key={record.id} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-semibold">{record.patientName}</h3>
                    <button onClick={() => handleActionClick(record)} className="text-xs text-white bg-green-600 px-2 py-1 rounded">Process</button>
                  </div>
                  <div className="text-xs text-gray-600">Adm: {record.admissionNo} | {record.wardType} | {record.room}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="h-full flex flex-col">
            <div className="hidden flex-1 overflow-hidden bg-white rounded-lg border border-gray-200 shadow-sm md:flex flex-col">
              <div className="overflow-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Admission No</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Patient Name</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Planned</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Actual</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase min-w-[200px]">Reason For Visit</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Ward Type</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Room</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Payment</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredHistoryPayments.length > 0 ? filteredHistoryPayments.map(record => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">{record.admissionNo || record.uniqueNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.patientName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {record.planned1 ? new Date(record.planned1).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {record.actual1 ? new Date(record.actual1).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[250px] whitespace-normal break-words">{record.reasonForVisit}</td>
                        <td className="px-4 py-3 text-sm">{record.wardType}</td>
                        <td className="px-4 py-3 text-sm">{record.room}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${record.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{record.priority}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${record.paymentStatus === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{record.paymentStatus === 'Yes' ? 'Paid' : 'Unpaid'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button onClick={() => handleViewClick(record)} className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded hover:bg-green-100"><Eye className="w-4 h-4" />View</button>
                        </td>
                      </tr>
                    )) : <tr><td colSpan="10" className="px-4 py-8 text-center text-gray-500">No history records</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="md:hidden h-full overflow-auto space-y-3 pb-8">
              {filteredHistoryPayments.map(record => (
                <div key={record.id} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-semibold">{record.patientName}</h3>
                    <button onClick={() => handleViewClick(record)} className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded"><Eye className="w-4 h-4" /></button>
                  </div>
                  <div className="text-xs text-gray-600">Status: {record.paymentStatus === 'Yes' ? 'Paid' : 'Unpaid'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showModal && selectedRecord && (
        <div className="overflow-y-auto fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
            <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-white border-b border-gray-200 md:p-6">
              <h2 className="text-xl font-bold">Payment Processing</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 text-gray-400 hover:text-gray-600 ring-1 ring-gray-200 rounded-full"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 md:p-6">
              <div className="p-4 mb-6 bg-green-50 rounded-lg border border-green-200 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                <div className="col-span-2 md:col-span-3 font-semibold text-gray-900 border-b pb-1 mb-1">Patient: {selectedRecord.patientName}</div>
                <div><span className="text-gray-600">Adm:</span> {selectedRecord.admissionNo}</div>
                <div><span className="text-gray-600">Category:</span> {selectedRecord.category}</div>
                <div><span className="text-gray-600">Ward:</span> {selectedRecord.wardType}</div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 text-sm font-medium">Payment Status *</label>
                  <select name="payment" value={formData.payment} onChange={handleInputChange} className="px-3 py-2 w-full border rounded-lg focus:ring-2 focus:ring-green-500">
                    <option value="">Select Status</option>
                    <option value="Yes">Paid</option>
                    <option value="No">Unpaid</option>
                  </select>
                </div>
                {formData.payment === 'Yes' && (
                  <div>
                    <label className="block mb-1 text-sm font-medium">Upload Bill (Image or PDF - Optional)</label>
                    <input type="file" accept="image/*,application/pdf" onChange={handleImageChange} className="hidden" id="bill-upload" />
                    <label htmlFor="bill-upload" className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-green-50">
                      {imagePreview ? (
                        formData.fileType === 'pdf' ? (
                          <div className="flex flex-col items-center">
                            <FileText className="w-12 h-12 text-red-600 mb-2" />
                            <p className="text-xs font-medium text-gray-700">PDF Uploaded</p>
                          </div>
                        ) : (
                          <img src={imagePreview} className="max-h-32 rounded" alt="Bill preview" />
                        )
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-gray-400 mb-1" />
                          <p className="text-xs text-gray-500">Upload Image or PDF</p>
                        </>
                      )}
                      <p className="text-xs text-gray-500 mt-1">{imagePreview ? 'Click to change' : 'Max 5MB'}</p>
                    </label>
                  </div>
                )}
                {modalError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{modalError}</div>}
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 text-white bg-green-600 rounded-lg disabled:opacity-50">{loading ? 'Processing...' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showViewModal && viewingRecord && (
        <div className="overflow-y-auto fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
            <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-white border-b md:p-6">
              <h2 className="text-xl font-bold">Details</h2>
              <button onClick={() => setShowViewModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-sm font-semibold mb-2">{viewingRecord.patientName}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Adm: {viewingRecord.admissionNo}</div>
                  <div>Category: {viewingRecord.category}</div>
                  <div>Status: {viewingRecord.paymentStatus}</div>
                </div>
              </div>
              {viewingRecord.billImage && (
                <div className="border rounded-lg overflow-hidden">
                  <img src={viewingRecord.billImage} alt="Bill" className="w-full h-auto max-h-96 object-contain" />
                  <button onClick={() => handleViewImage(viewingRecord.billImage)} className="w-full py-2 bg-green-50 text-green-600 text-sm">Full Screen</button>
                </div>
              )}
              <div className="flex justify-end"><button onClick={() => setShowViewModal(false)} className="px-4 py-2 bg-green-600 text-white rounded-lg">Close</button></div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes progress { from { width: 100%; } to { width: 0%; } }
        .animate-scale-in { animation: scale-in 0.3s ease-out; }
        .animate-progress { animation: progress 1s linear forwards; }
      `}</style>
    </div>
  );
};

export default Payment;