import React, { useState, useEffect } from 'react';
import { FileText, X, Clock, CheckCircle, Upload, Image as ImageIcon } from 'lucide-react';
import supabase from '../../../SupabaseClient';
import useRealtimeTable from '../../../hooks/useRealtimeTable';

const InitiationByRMO = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingPatients, setPendingPatients] = useState([]);
  const [historyPatients, setHistoryPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [modalError, setModalError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState(() => {
    // Initialize formData with user name from localStorage
    const storedUser = localStorage.getItem('mis_user');
    let initialName = '';

    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        initialName = user.name || '';
      } catch (error) {
        console.error('Error parsing mis_user from localStorage:', error);
      }
    }

    return {
      status: '',
      rmoName: initialName,
      summaryReportImage: null,
      summaryReportImageName: ''
    };
  });

  const statusOptions = [

    'Completed',
    'Pending Documentation'
  ];

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'pending') {
        await loadPendingPatients();
      } else {
        await loadHistoryPatients();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time sync: refresh when discharge table changes
  useRealtimeTable('discharge', loadData);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadPendingPatients = async () => {
    try {
      // Fetch patients where planned1 is not null AND actual1 is null
      const { data, error } = await supabase
        .from('discharge')
        .select('*')
        .not('planned1', 'is', null)
        .is('actual1', null)
        .order('planned1', { ascending: true });

      if (error) throw error;

      // Format the data for display
      const formattedPatients = data.map(patient => ({
        id: patient.id,
        admissionNo: patient.admission_no,
        patientName: patient.patient_name,
        department: patient.department,
        consultantName: patient.consultant_name,
        staffName: patient.staff_name,
        dischargeDate: patient.planned1 ? new Date(patient.planned1).toLocaleDateString('en-GB') : 'N/A',
        dischargeTime: patient.planned1 ? new Date(patient.planned1).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
        planned1: patient.planned1,
        actual1: patient.actual1,
        remark: patient.remark,
        dischargeNumber: patient.discharge_number,
        // RMO fields (will be null for pending patients)
        rmo_status: patient.rmo_status,
        rmo_name: patient.rmo_name,
        summary_report_image: patient.summary_report_image,
        summary_report_image_name: patient.summary_report_image_name
      }));

      setPendingPatients(formattedPatients);
    } catch (error) {
      console.error('Error loading pending patients:', error);
      setPendingPatients([]);
    }
  };

  const loadHistoryPatients = async () => {
    try {
      // Fetch patients where planned1 AND actual1 are not null
      // AND also has RMO initiation data (rmo_name is not null)
      const { data, error } = await supabase
        .from('discharge')
        .select('*')
        .not('planned1', 'is', null)
        .not('actual1', 'is', null)
        .not('rmo_name', 'is', null) // Only show patients with RMO initiation
        .order('actual1', { ascending: false });

      if (error) throw error;

      // Format the data for display
      const formattedPatients = data.map(patient => ({
        id: patient.id,
        admissionNo: patient.admission_no,
        patientName: patient.patient_name,
        department: patient.department,
        consultantName: patient.consultant_name,
        staffName: patient.staff_name,
        dischargeDate: patient.planned1 ? new Date(patient.planned1).toLocaleDateString('en-GB') : 'N/A',
        dischargeTime: patient.planned1 ? new Date(patient.planned1).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
        actualDate: patient.actual1 ? new Date(patient.actual1).toLocaleDateString('en-GB') : 'N/A',
        actualTime: patient.actual1 ? new Date(patient.actual1).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
        planned1: patient.planned1,
        actual1: patient.actual1,
        delay1: patient.delay1,
        remark: patient.remark,
        dischargeNumber: patient.discharge_number,
        // RMO fields
        rmo_status: patient.rmo_status,
        rmo_name: patient.rmo_name,
        summary_report_image: patient.summary_report_image,
        summary_report_image_name: patient.summary_report_image_name,
        initiation_date: patient.rmo_initiation_date
      }));

      setHistoryPatients(formattedPatients);
    } catch (error) {
      console.error('Error loading history patients:', error);
      setHistoryPatients([]);
    }
  };

  const handleInitiation = (patient) => {
    setSelectedPatient(patient);

    // Get current user name from localStorage
    const storedUser = localStorage.getItem('mis_user');
    let currentUserName = '';

    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        currentUserName = user.name || '';
      } catch (error) {
        console.error('Error parsing user data in handleInitiation:', error);
      }
    }

    // Pre-fill with existing data or current user's name
    setFormData({
      status: patient.rmo_status || '',
      rmoName: patient.rmo_name || currentUserName,
      summaryReportImage: patient.summary_report_image || null,
      summaryReportImageName: patient.summary_report_image_name || ''
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        setModalError('Please upload a valid image or PDF file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setModalError('File size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          summaryReportImage: reader.result,
          summaryReportImageName: file.name
        }));
        setModalError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({
      ...prev,
      summaryReportImage: null,
      summaryReportImageName: ''
    }));
  };

  const handleSubmit = async () => {
    if (!formData.status || !formData.rmoName) {
      setModalError('Please fill all required fields marked with *');
      return;
    }

    try {
      let imageUrl = null;

      // If there's an image/PDF to upload
      if (formData.summaryReportImage && typeof formData.summaryReportImage === 'string' &&
        (formData.summaryReportImage.startsWith('data:image') || formData.summaryReportImage.startsWith('data:application/pdf'))) {

        // Extract raw base64 data and mime type
        const [meta, base64Data] = formData.summaryReportImage.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];

        const binaryData = atob(base64Data);
        const arrayBuffer = new ArrayBuffer(binaryData.length);
        const uint8Array = new Uint8Array(arrayBuffer);

        for (let i = 0; i < binaryData.length; i++) {
          uint8Array[i] = binaryData.charCodeAt(i);
        }

        const blob = new Blob([uint8Array], { type: mimeType });

        // Determine extension based on mime type
        const fileExt = mimeType === 'application/pdf' ? 'pdf' : 'jpg';
        const fileName = `summary_report_${selectedPatient.admissionNo}_${Date.now()}.${fileExt}`;
        const filePath = `summary-reports/${fileName}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('summary_report_image')
          .upload(filePath, blob, {
            contentType: mimeType,
            upsert: true
          });

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          throw new Error('Failed to upload summary report');
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('summary_report_image')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      } else if (typeof formData.summaryReportImage === 'string') {
        // If it's already a URL (from history), use it directly
        imageUrl = formData.summaryReportImage;
      }

      // Prepare update data object
      const updateData = {
        // RMO initiation fields (always updated)
        rmo_status: formData.status,
        rmo_name: formData.rmoName,
        summary_report_image: imageUrl,
        summary_report_image_name: formData.summaryReportImageName,
      };

      // Only set actual1 and planned2 if status is NOT "Pending Documentation"
      if (formData.status !== 'Pending Documentation') {
        const currentTime = new Date().toLocaleString("en-CA", {
          timeZone: "Asia/Kolkata",
          hour12: false
        }).replace(',', '');

        updateData.actual1 = currentTime;
        updateData.planned2 = currentTime;
      } else {
        // For Pending Documentation, ensure these fields remain null
        updateData.actual1 = null;
        updateData.planned2 = null;
      }

      // Update the discharge record in Supabase with RMO initiation data
      const { error: updateError } = await supabase
        .from('discharge')
        .update(updateData)
        .eq('id', selectedPatient.id);

      if (updateError) throw updateError;

      setShowModal(false);
      setSelectedPatient(null);
      resetForm();

      // Reload data
      await loadData();

    } catch (error) {
      console.error('Error saving initiation:', error);
      setModalError(error.message || 'Failed to save. Please try again.');
    }
  };

  const calculateDelay = (plannedDate, actualDate) => {
    if (!plannedDate) return 'No planned date';

    const planned = new Date(plannedDate);
    const actual = actualDate || new Date();
    const diffMs = actual - planned;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours < 0) {
      const hoursEarly = Math.abs(diffHours);
      const minsEarly = Math.abs(diffMinutes);
      return `Early by ${hoursEarly}h ${minsEarly}m`;
    }
    if (diffHours === 0 && diffMinutes <= 5) return 'On time';
    return `Delayed by ${diffHours}h ${diffMinutes}m`;
  };

  const resetForm = () => {
    // Get current user name from localStorage
    const storedUser = localStorage.getItem('mis_user');
    let userName = '';

    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        userName = user.name || '';
      } catch (error) {
        console.error('Error parsing user data in resetForm:', error);
      }
    }

    setFormData({
      status: '',
      rmoName: userName,
      summaryReportImage: null,
      summaryReportImageName: ''
    });
    setModalError('');
  };

  const [viewImageModal, setViewImageModal] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);

  const openImageViewer = (imageData) => {
    setViewingImage(imageData);
    setViewImageModal(true);
  };

  return (
    <div className="p-2 space-y-3 md:p-6 md:space-y-4 bg-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-2 justify-between items-start sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-3xl">
            Initiation by RMO
          </h1>
          <p className="hidden mt-1 text-sm text-gray-600 sm:block">
            Manage RMO initiation records for discharged patients
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="text-xs text-gray-600 flex items-center gap-1.5 md:text-sm md:gap-2">
              <div className="w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin md:w-4 md:h-4"></div>
              Loading...
            </div>
          )}
          <button
            onClick={loadData}
            className="px-2.5 py-1.5 text-xs text-green-600 bg-green-50 rounded-lg hover:bg-green-100 md:px-3 md:text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-3 py-1.5 font-medium text-xs md:text-sm transition-colors relative ${activeTab === 'pending'
            ? 'text-green-600 border-b-2 border-green-600'
            : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
            Pending
            {pendingPatients.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-600 rounded-full">
                {pendingPatients.length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-1.5 font-medium text-xs md:text-sm transition-colors relative ${activeTab === 'history'
            ? 'text-green-600 border-b-2 border-green-600'
            : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
            History
            {historyPatients.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-600 rounded-full">
                {historyPatients.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Pending Section */}
      {activeTab === 'pending' && (
        <div>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-green-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Action</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Admission No</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Patient Name</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Department</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Consultant</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Staff Name</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Planned Discharge</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingPatients.length > 0 ? (
                  pendingPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-green-50">
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <button
                          onClick={() => handleInitiation(patient)}
                          className="flex gap-1 items-center px-3 py-1.5 text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700"
                        >
                          <FileText className="w-4 h-4" />
                          Initiation
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">
                        {patient.admissionNo}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {patient.patientName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {patient.department}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {patient.consultantName || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {patient.staffName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {patient.dischargeDate} {patient.dischargeTime}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                      <Clock className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                      <p className="text-lg font-medium text-gray-900">No pending initiations</p>
                      <p className="text-sm">All planned discharges have been initiated</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-2 md:hidden">
            {pendingPatients.length > 0 ? (
              pendingPatients.map((patient) => (
                <div key={patient.id} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-xs font-medium text-green-600 mb-0.5">
                        {patient.admissionNo}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {patient.patientName}
                      </h3>
                    </div>
                    <button
                      onClick={() => handleInitiation(patient)}
                      className="flex flex-shrink-0 gap-0.5 items-center px-2 py-1 text-[10px] text-white bg-green-600 rounded-lg shadow-sm"
                    >
                      <FileText className="w-3 h-3" />
                      Initiation
                    </button>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Department:</span>
                      <span className="font-medium text-gray-900">{patient.department}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Consultant:</span>
                      <span className="font-medium text-gray-900">{patient.consultantName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Staff Name:</span>
                      <span className="font-medium text-gray-900">{patient.staffName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Planned Discharge:</span>
                      <span className="font-medium text-gray-900">{patient.dischargeDate} {patient.dischargeTime}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
                <Clock className="mx-auto mb-2 w-10 h-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-900">No pending initiations</p>
                <p className="text-xs text-gray-600 mt-0.5">All planned discharges have been initiated</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Section */}
      {activeTab === 'history' && (
        <div>
          {/* Desktop Table */}
          <div className="hidden overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-green-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Admission No</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Patient Name</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Department</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Consultant</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Staff Name</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Planned Discharge</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Actual Discharge</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">RMO Name</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Summary Report</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {historyPatients.length > 0 ? (
                  historyPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-green-50">
                      <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">
                        {patient.admissionNo}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {patient.patientName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {patient.department}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {patient.consultantName || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {patient.staffName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {patient.dischargeDate} {patient.dischargeTime}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {patient.actualDate} {patient.actualTime}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {patient.rmo_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${patient.rmo_status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                          {patient.rmo_status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {patient.summary_report_image ? (
                          <button
                            onClick={() => openImageViewer(patient.summary_report_image)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 bg-green-50 rounded hover:bg-green-100"
                          >
                            <FileText className="w-3 h-3" />
                            View Report
                          </button>
                        ) : (
                          <span className="text-gray-500">No image</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-gray-500">
                      <CheckCircle className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                      <p className="text-lg font-medium text-gray-900">No history records</p>
                      <p className="text-sm">Initiated patients will appear here</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-2 md:hidden">
            {historyPatients.length > 0 ? (
              historyPatients.map((patient) => (
                <div key={patient.id} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-xs font-medium text-green-600 mb-0.5">
                        {patient.admissionNo}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {patient.patientName}
                      </h3>
                    </div>
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded-full">
                      {patient.rmo_status || 'N/A'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Department:</span>
                      <span className="font-medium text-gray-900">{patient.department}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Consultant:</span>
                      <span className="font-medium text-gray-900">{patient.consultantName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Staff Name:</span>
                      <span className="font-medium text-gray-900">{patient.staffName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Planned Discharge:</span>
                      <span className="font-medium text-gray-900">{patient.dischargeDate} {patient.dischargeTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Actual Discharge:</span>
                      <span className="font-medium text-gray-900">{patient.actualDate} {patient.actualTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">RMO Name:</span>
                      <span className="font-medium text-gray-900">{patient.rmo_name || 'N/A'}</span>
                    </div>
                    <div className="pt-1.5 mt-1.5 border-t border-gray-200">
                      <span className="text-gray-600">Summary Report:</span>
                      {patient.summary_report_image ? (
                        <button
                          onClick={() => openImageViewer(patient.summary_report_image)}
                          className="flex items-center gap-0.5 mt-1 px-2 py-1 text-[10px] text-green-600 bg-green-50 rounded hover:bg-green-100"
                        >
                          <FileText className="w-3 h-3" />
                          View Report
                        </button>
                      ) : (
                        <p className="mt-0.5 text-gray-500">No image</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
                <CheckCircle className="mx-auto mb-2 w-10 h-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-900">No history records</p>
                <p className="text-xs text-gray-600 mt-0.5">Initiated patients will appear here</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Initiation Modal */}
      {showModal && selectedPatient && (
        <div className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-lg shadow-xl animate-scale-in overflow-y-auto">
            <div className="sticky top-0 flex justify-between items-center p-4 border-b border-gray-200 bg-green-600 rounded-t-lg md:p-6 z-10">
              <h2 className="text-xl font-bold text-white md:text-2xl">
                RMO Initiation - {selectedPatient.admissionNo}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedPatient(null);
                  resetForm();
                }}
                className="text-white rounded-full p-1 hover:text-gray-200 hover:bg-green-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 md:p-6">
              <div className="space-y-4">
                {/* Pre-filled Information */}
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Patient Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Patient Name:</span>
                      <p className="font-medium text-gray-900">{selectedPatient.patientName}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Department:</span>
                      <p className="font-medium text-gray-900">{selectedPatient.department}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Consultant:</span>
                      <p className="font-medium text-gray-900">{selectedPatient.consultantName || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Staff Name:</span>
                      <p className="font-medium text-gray-900">{selectedPatient.staffName}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-gray-600">Planned Discharge:</span>
                      <p className="font-medium text-gray-900">{selectedPatient.dischargeDate} {selectedPatient.dischargeTime}</p>
                    </div>
                  </div>
                </div>

                {/* User Input Fields */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="px-3 py-2 w-full bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">Select Status</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    RMO Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="rmoName"
                    value={formData.rmoName}
                    readOnly
                    className="px-3 py-2 w-full bg-gray-100 rounded-lg border border-gray-300 text-gray-700 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-green-600">
                    Auto-filled from your login
                  </p>
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Summary Report (Optional)
                  </label>

                  {!formData.summaryReportImage ? (
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="imageUpload"
                      />
                      <label
                        htmlFor="imageUpload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors"
                      >
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-600">Click to upload report (Optional)</span>
                        <span className="text-xs text-gray-500 mt-1">PNG, JPG, PDF (Max 5MB)</span>
                      </label>
                    </div>
                  ) : (
                    <div className="relative border-2 border-green-300 rounded-lg p-2 bg-green-50">
                      <button
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 z-10"
                        type="button"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {formData.summaryReportImage.startsWith('data:application/pdf') || formData.summaryReportImage.toLowerCase().endsWith('.pdf') ? (
                        <div className="flex flex-col items-center justify-center h-48 bg-gray-100 rounded">
                          <FileText className="w-12 h-12 text-red-500 mb-2" />
                          <span className="text-sm text-gray-600">PDF Document Selected</span>
                        </div>
                      ) : (
                        <img
                          src={formData.summaryReportImage}
                          alt="Summary Report"
                          className="w-full h-48 object-contain rounded"
                        />
                      )}

                      <p className="text-xs text-gray-600 mt-2 text-center truncate">
                        {formData.summaryReportImageName}
                      </p>
                    </div>
                  )}
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
                    setSelectedPatient(null);
                    resetForm();
                  }}
                  className="px-4 py-2 w-full font-medium text-gray-700 bg-gray-100 rounded-lg transition-colors hover:bg-gray-200 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-4 py-2 w-full font-medium text-white bg-green-600 rounded-lg transition-colors hover:bg-green-700 sm:w-auto"
                >
                  {selectedPatient.rmo_name ? 'Update Initiation' : 'Save Initiation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Viewer Modal */}
      {viewImageModal && viewingImage && (
        <div className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-75 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col">
            <div className="sticky top-0 flex justify-between items-center p-4 border-b border-gray-200 bg-white rounded-t-lg z-10 shink-0">
              <h2 className="text-lg font-semibold text-gray-900">Summary Report</h2>
              <div className="flex gap-2">
                {viewingImage.toLowerCase().includes('.pdf') && (
                  <button
                    onClick={() => window.open(viewingImage, '_blank')}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Open in New Tab
                  </button>
                )}
                <button
                  onClick={() => setViewImageModal(false)}
                  className="text-gray-500 rounded-full p-1 hover:text-gray-700 hover:bg-gray-100"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {viewingImage.toLowerCase().includes('.pdf') ? (
                <iframe
                  src={viewingImage}
                  className="w-full h-[70vh] rounded border border-gray-200"
                  title="Report PDF"
                />
              ) : (
                <img
                  src={viewingImage}
                  alt="Summary Report"
                  className="w-full h-auto max-h-[70vh] object-contain rounded"
                />
              )}
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

export default InitiationByRMO;