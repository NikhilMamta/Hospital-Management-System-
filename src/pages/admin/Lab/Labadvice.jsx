import React, { useState, useEffect } from 'react';
import { Plus, X, Eye, FileText, CheckCircle } from 'lucide-react';
import supabase from '../../../SupabaseClient'; // Adjust import path
import { useNotification } from '../../../contexts/NotificationContext';

const LabAdvice = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingAdvices, setPendingAdvices] = useState([]);
  const [historyAdvices, setHistoryAdvices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [modalError, setModalError] = useState('');
  const { showNotification } = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const [availableTests, setAvailableTests] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [formData, setFormData] = useState({
    priority: 'Medium',
    category: '',
    pathologyTests: [],
    radiologyType: '',
    radiologyTests: [],
    remarks: ''
  });

  // Load data from Supabase
  useEffect(() => {
    loadData();

    // Set up real-time subscription for lab table
    const setupRealtimeSubscription = () => {
      const channel = supabase
        .channel('lab_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lab'
          },
          () => {
            loadHistoryData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupRealtimeSubscription();

    return () => {
      cleanup();
    };
  }, []);

  // Show success popup (legacy - use showNotification)
  const showSuccessNotification = (message) => {
    showNotification(message, 'success');
  };

  // Fetch tests from investigation table based on category and type
  const fetchTestsFromDatabase = async (category, type = null) => {
    try {
      let query = supabase
        .from('investigation')
        .select('name, type')
        .order('name', { ascending: true });

      if (category === 'Pathology') {
        query = query.eq('type', 'Pathology');
      } else if (category === 'Radiology' && type) {
        // Map UI types to database types if needed
        const dbTypeMap = {
          'X-ray': 'X-ray',
          'CT-scan': 'CT Scan',
          'USG': 'USG'
        };
        query = query.eq('type', dbTypeMap[type] || type);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tests:', error);
        return [];
      }

      return data.map(item => item.name);
    } catch (error) {
      console.error('Failed to fetch tests:', error);
      return [];
    }
  };

  // Update available tests when category or radiology type changes
  useEffect(() => {
    const loadTests = async () => {
      if (formData.category === 'Pathology') {
        const tests = await fetchTestsFromDatabase('Pathology');
        setAvailableTests(tests);
      } else if (formData.category === 'Radiology' && formData.radiologyType) {
        const tests = await fetchTestsFromDatabase('Radiology', formData.radiologyType);
        setAvailableTests(tests);
      } else {
        setAvailableTests([]);
      }
    };

    loadTests();
  }, [formData.category, formData.radiologyType]);

  // Load pending data from ipd_admissions table
  const loadPendingData = async () => {
    try {
      setIsLoading(true);

      // Fetch from ipd_admissions where planned1 is not null and actual1 is null
      const { data: pendingPatients, error } = await supabase
        .from('ipd_admissions')
        .select('*')
        .not('planned1', 'is', null)  // planned1 is not null
        .is('actual1', null)          // actual1 is null
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error loading pending lab advices:', error);
        return [];
      }

      // Transform data for the component
      const transformedData = pendingPatients.map(patient => ({
        id: patient.id,
        admission_no: patient.admission_no,
        uniqueNumber: patient.admission_no,
        patientName: patient.patient_name,
        consultantDr: patient.consultant_dr,
        referByDr: patient.refer_by_dr,
        phoneNumber: patient.phone_no || patient.whatsapp_no,
        fatherHusband: patient.father_husband_name,
        age: patient.age,
        gender: patient.gender,
        reasonForVisit: patient.adm_purpose || 'N/A',
        bedNo: patient.bed_no || 'Not assigned',
        location: patient.location_status || 'General Ward',
        wardType: patient.ward_type || 'General',
        room: patient.room || 'Not assigned',
        department: patient.department,
        timestamp: patient.timestamp,
        ipd_number: patient.ipd_number

      }));

      return transformedData;
    } catch (error) {
      console.error('Failed to load pending data:', error);
      return [];
    }
  };

  // Load history data from lab table
  const loadHistoryData = async () => {
    try {
      const { data: labRecords, error } = await supabase
        .from('lab')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error loading lab history:', error);
        return [];
      }

      // Transform data for the component
      const transformedData = labRecords.map(record => ({
        id: record.id,
        adviceId: record.id,
        adviceNo: record.lab_no,
        admission_no: record.admission_no,
        uniqueNumber: record.admission_no,
        patientName: record.patient_name,
        phoneNumber: record.phone_no,
        fatherHusband: record.father_husband_name,
        age: record.age,
        gender: record.gender,
        reasonForVisit: record.reason_for_visit,
        bedNo: record.bed_no,
        location: record.location,
        wardType: record.ward_type,
        room: record.room,
        department: record.department,
        priority: record.priority,
        category: record.category,
        pathologyTests: record.pathology_tests || [],
        radiologyType: record.radiology_type || '',
        radiologyTests: record.radiology_tests || [],
        remarks: record.remarks || '',
        completedDate: record.timestamp,
        ipd_number: record.ipd_number,
        timestamp: record.timestamp,

      }));

      return transformedData;
    } catch (error) {
      console.error('Failed to load history data:', error);
      return [];
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      const pendingData = await loadPendingData();
      const historyData = await loadHistoryData();

      setPendingAdvices(pendingData);
      setHistoryAdvices(historyData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate lab number based on latest record
  const generateLabNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('lab')
        .select('lab_no')
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching lab number:', error);
        return 'LAB-001';
      }

      if (data && data.length > 0) {
        const lastLabNo = data[0].lab_no;
        if (lastLabNo && lastLabNo.startsWith('LAB-')) {
          const lastNumber = parseInt(lastLabNo.replace('LAB-', ''), 10);
          if (!isNaN(lastNumber)) {
            return `LAB-${String(lastNumber + 1).padStart(3, '0')}`;
          }
        }
      }

      return 'LAB-001';
    } catch (error) {
      console.error('Error generating lab number:', error);
      return 'LAB-001';
    }
  };

  const handleActionClick = (patient) => {
    setSelectedPatient(patient);
    setShowModal(true);
    // Reset form when opening modal
    setFormData({
      priority: 'Medium',
      category: '',
      pathologyTests: [],
      radiologyType: '',
      radiologyTests: [],
      remarks: ''
    });
    setAvailableTests([]);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'category' && {
        pathologyTests: [],
        radiologyType: '',
        radiologyTests: []
      }),
      ...(name === 'radiologyType' && { radiologyTests: [] })
    }));
  };

  const handleCheckboxChange = (testName) => {
    setFormData(prev => {
      const currentTests = prev.category === 'Pathology' ? prev.pathologyTests : prev.radiologyTests;
      const newTests = currentTests.includes(testName)
        ? currentTests.filter(t => t !== testName)
        : [...currentTests, testName];

      return {
        ...prev,
        [prev.category === 'Pathology' ? 'pathologyTests' : 'radiologyTests']: newTests
      };
    });
  };

  const handleSubmit = async () => {
    if (!formData.category) {
      setModalError('Please select Pathology or Radiology');
      return;
    }

    if (formData.category === 'Pathology' && formData.pathologyTests.length === 0) {
      setModalError('Please select at least one pathology test');
      return;
    }

    if (formData.category === 'Radiology' && (!formData.radiologyType || formData.radiologyTests.length === 0)) {
      setModalError('Please select radiology type and at least one test');
      return;
    }

    try {
      setIsLoading(true);

      // Generate lab number
      const labNumber = await generateLabNumber();

      // Prepare data for lab table
      // Prepare data for lab table
      const labData = {
        lab_no: labNumber,
        admission_no: selectedPatient.admission_no,
        patient_name: selectedPatient.patientName,
        phone_no: selectedPatient.phoneNumber,
        father_husband_name: selectedPatient.fatherHusband,
        age: selectedPatient.age,
        consultant_dr: selectedPatient.consultantDr,
        refer_by_dr: selectedPatient.referByDr,
        gender: selectedPatient.gender,
        reason_for_visit: selectedPatient.reasonForVisit,
        bed_no: selectedPatient.bedNo,
        location: selectedPatient.location,
        ward_type: selectedPatient.wardType,
        room: selectedPatient.room,
        department: selectedPatient.department,
        priority: formData.priority,
        category: formData.category,
        pathology_tests: formData.category === 'Pathology' ? formData.pathologyTests : null,
        radiology_type: formData.category === 'Radiology' ? formData.radiologyType : null,
        radiology_tests: formData.category === 'Radiology' ? formData.radiologyTests : null,
        remarks: formData.remarks || '',
        status: 'completed',
        planned1: new Date().toLocaleString("en-CA", {
          timeZone: "Asia/Kolkata",
          hour12: false
        }).replace(',', ''),
        timestamp: new Date().toLocaleString("en-CA", {
          timeZone: "Asia/Kolkata",
          hour12: false
        }).replace(',', ''),
        ipd_number: selectedPatient.ipd_number
      };

      // Insert into lab table
      const { data: labResult, error: labError } = await supabase
        .from('lab')
        .insert(labData)
        .select();

      if (labError) {
        throw new Error(`Failed to save lab record: ${labError.message}`);
      }

      // Reload data
      await loadData();

      setShowModal(false);
      resetForm();

      // Show success popup instead of alert
      showSuccessNotification(`Lab advice submitted successfully! Lab Number: ${labNumber}`);

    } catch (error) {
      console.error('Error submitting lab advice:', error);
      setModalError(`Failed to submit: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      priority: 'Medium',
      category: '',
      pathologyTests: [],
      radiologyType: '',
      radiologyTests: [],
      remarks: ''
    });
    setModalError('');
    setSelectedPatient(null);
    setAvailableTests([]);
  };

  const handleViewClick = (record) => {
    setViewingRecord(record);
    setShowViewModal(true);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Header and Tabs - Fixed at top */}
      <div className="flex-none bg-white border-b border-gray-200 shrink-0 shadow-sm z-10">
        <div className="px-4 py-2 sm:px-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900 md:text-3xl leading-tight">Lab Advice</h1>
              <p className="hidden mt-0.5 text-xs text-gray-600 sm:block">Manage pathology and radiology requests</p>
            </div>
          </div>
        </div>

        {/* Tabs - More compact */}
        <div className="px-3 sm:px-4 py-2">
          <div className="flex gap-2 p-1 bg-gray-50 rounded-lg border border-gray-200">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all shadow-sm ${activeTab === 'pending'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 hover:bg-gray-200'
                }`}
            >
              PENDING ({pendingAdvices.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-4 py-2 text-sm font-bold rounded-lg transition-all shadow-sm ${activeTab === 'history'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 hover:bg-gray-200'
                }`}
            >
              HISTORY ({historyAdvices.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-hidden p-3 md:p-6 pt-4 md:pt-4">

        {activeTab === 'pending' && (
          <>
            {/* Desktop Table */}
            <div className="hidden h-full flex-col bg-white rounded-lg border border-gray-200 shadow-sm md:flex overflow-hidden">
              <div className="overflow-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Action</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Admission No</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Patient Name</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Phone Number</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Consultant Dr.</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Refer By Dr.</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Father/Husband</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Reason For Visit</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Age</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Gender</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Bed No.</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Location</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Ward Type</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Room</th>
                      <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Department</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingAdvices.length > 0 ? (
                      pendingAdvices.map((patient) => (
                        <tr key={patient.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <button
                              onClick={() => handleActionClick(patient)}
                              disabled={isLoading}
                              className="px-3 py-1.5 text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700 disabled:bg-gray-400"
                            >
                              Process
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">{patient.admission_no}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{patient.patientName}</td>

                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{patient.phoneNumber}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{patient.consultantDr}</td>

                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{patient.referByDr}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{patient.fatherHusband || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{patient.reasonForVisit}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{patient.age}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{patient.gender}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{patient.bedNo}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{patient.location}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{patient.wardType}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{patient.room}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{patient.department || 'N/A'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="15" className="px-4 py-8 text-center text-gray-500">
                          <FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                          <p className="text-lg font-medium text-gray-900">No pending lab advices</p>
                          <p className="text-sm text-gray-600">Patients with planned1 not null and actual1 null will appear here</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden h-full overflow-auto space-y-3 pb-4">
              {pendingAdvices.length > 0 ? (
                pendingAdvices.map((patient) => (
                  <div key={patient.id} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-xs font-medium text-green-600 mb-1">{patient.admission_no}</div>
                        <h3 className="text-sm font-semibold text-gray-900">{patient.patientName}</h3>
                      </div>
                      <button
                        onClick={() => handleActionClick(patient)}
                        disabled={isLoading}
                        className="flex-shrink-0 px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg shadow-sm disabled:bg-gray-400"
                      >
                        Process
                      </button>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium text-gray-900">{patient.phoneNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Age/Gender:</span>
                        <span className="font-medium text-gray-900">{patient.age} / {patient.gender}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Bed/Location:</span>
                        <span className="font-medium text-gray-900">{patient.bedNo} / {patient.location}</span>
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
                  <FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                  <p className="text-sm font-medium text-gray-900">No pending lab advices</p>
                  <p className="text-xs text-gray-600 mt-1">Patients with planned1 not null and actual1 null will appear here</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* History Section */}
        {activeTab === 'history' && (
          <>
            {/* Desktop Table */}
            <div className="hidden h-full flex-col bg-white rounded-lg border border-gray-200 shadow-sm md:flex overflow-hidden">
              <div className="overflow-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Lab No</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Timestamp</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Admission No</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Patient Name</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Phone Number</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Reason For Visit</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Age</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Bed No.</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Location</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Pathology Tests</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Radiology Tests</th>
                      <th className="px-4 py-3 text-xs font-medium text-left text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-gray-200">
                    {historyAdvices.length > 0 ? (
                      historyAdvices.map((record) => (
                        <tr key={record.adviceId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">{record.adviceNo}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.timestamp ? new Date(record.timestamp).toLocaleString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: 'short'
                            }) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-purple-600 whitespace-nowrap">{record.admission_no}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.patientName}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.phoneNumber}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{record.reasonForVisit}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.age}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.bedNo}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.location}</td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${record.priority === 'High'
                                ? 'bg-red-100 text-red-700'
                                : record.priority === 'Medium'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-green-100 text-green-700'
                                }`}
                            >
                              {record.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{record.category}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.category === 'Pathology' && record.pathologyTests?.length > 0
                              ? record.pathologyTests.slice(0, 2).join(', ') +
                              (record.pathologyTests?.length > 2 ? '...' : '')
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {record.category === 'Radiology' && record.radiologyTests?.length > 0
                              ? record.radiologyTests.slice(0, 2).join(', ') +
                              (record.radiologyTests?.length > 2 ? '...' : '')
                              : '-'}
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
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="14" className="px-4 py-8 text-center text-gray-500">
                          <FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                          <p className="text-lg font-medium text-gray-900">No lab history records</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden h-full overflow-auto space-y-3 pb-4">
              {historyAdvices.length > 0 ? (
                historyAdvices.map((record) => (
                  <div key={record.adviceId} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-xs font-medium text-green-600 mb-1">{record.adviceNo}</div>
                        <div className="text-xs font-medium text-purple-600 mb-1">{record.admission_no}</div>
                        <h3 className="text-sm font-semibold text-gray-900">{record.patientName}</h3>
                        <div className="text-xs text-gray-500 mt-1">{record.phoneNumber}</div>
                      </div>
                      <button
                        onClick={() => handleViewClick(record)}
                        className="flex-shrink-0 px-3 py-1.5 text-xs text-green-600 bg-green-50 rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-xs space-y-1">
                      <div><span className="text-gray-600">Reason:</span> {record.reasonForVisit}</div>
                      <div><span className="text-gray-600">Age:</span> {record.age}</div>
                      <div><span className="text-gray-600">Bed/Location:</span> {record.bedNo} / {record.location}</div>
                      <div><span className="text-gray-600">Priority:</span> {record.priority}</div>
                      <div><span className="text-gray-600">Category:</span> {record.category}</div>
                      {record.category === 'Pathology' && record.pathologyTests?.length > 0 && (
                        <div><span className="text-gray-600">Pathology:</span> {record.pathologyTests.slice(0, 2).join(', ')}{record.pathologyTests.length > 2 ? '...' : ''}</div>
                      )}
                      {record.category === 'Radiology' && record.radiologyTests?.length > 0 && (
                        <div><span className="text-gray-600">Radiology:</span> {record.radiologyTests.slice(0, 2).join(', ')}{record.radiologyTests.length > 2 ? '...' : ''}</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
                  <FileText className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                  <p className="text-sm font-medium text-gray-900">No lab history records</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal for Processing Lab Advice */}
      {showModal && selectedPatient && (
        <div className="overflow-y-auto fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
            <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-white border-b border-gray-200 md:p-6">
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Lab Advice Form</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                disabled={isLoading}
                className="p-1 text-gray-400 rounded-full hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 md:p-6">
              {/* Patient Info (Read-only) */}
              <div className="p-4 mb-6 bg-green-50 rounded-lg border border-green-200">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Patient Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                  <div>
                    <span className="text-gray-600">Admission No:</span>
                    <div className="font-medium text-gray-900">{selectedPatient.admission_no}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <div className="font-medium text-gray-900">{selectedPatient.patientName}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <div className="font-medium text-gray-900">{selectedPatient.phoneNumber}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Age:</span>
                    <div className="font-medium text-gray-900">{selectedPatient.age}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Gender:</span>
                    <div className="font-medium text-gray-900">{selectedPatient.gender}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Department:</span>
                    <div className="font-medium text-gray-900">{selectedPatient.department || 'N/A'}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Bed No:</span>
                    <div className="font-medium text-gray-900">{selectedPatient.bedNo}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Location:</span>
                    <div className="font-medium text-gray-900">{selectedPatient.location}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Reason:</span>
                    <div className="font-medium text-gray-900">{selectedPatient.reasonForVisit}</div>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">Priority *</label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className="px-3 py-2 w-full bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">Pathology & Radiology *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      disabled={isLoading}
                      className="px-3 py-2 w-full bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                    >
                      <option value="">Select Category</option>
                      <option value="Pathology">Pathology</option>
                      <option value="Radiology">Radiology</option>
                    </select>
                  </div>
                </div>

                {/* Pathology Tests */}
                {formData.category === 'Pathology' && (
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">
                      Select Pathology Tests * ({formData.pathologyTests.length} selected)
                    </label>
                    <div className="p-4 max-h-60 overflow-y-auto bg-gray-50 rounded-lg border border-gray-300">
                      {availableTests.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                          {availableTests.map((test) => (
                            <label key={test} className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.pathologyTests.includes(test)}
                                onChange={() => handleCheckboxChange(test)}
                                disabled={isLoading}
                                className="mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                              />
                              <span className="text-sm text-gray-700">{test}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          <p>Loading pathology tests...</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Radiology Section */}
                {formData.category === 'Radiology' && (
                  <>
                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">Radiology Type *</label>
                      <select
                        name="radiologyType"
                        value={formData.radiologyType}
                        onChange={handleInputChange}
                        disabled={isLoading}
                        className="px-3 py-2 w-full bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                      >
                        <option value="">Select Type</option>
                        <option value="X-ray">X-ray</option>
                        <option value="CT-scan">CT Scan</option>
                        <option value="USG">USG</option>
                      </select>
                    </div>

                    {formData.radiologyType && (
                      <div>
                        <label className="block mb-2 text-sm font-medium text-gray-700">
                          Select {formData.radiologyType} Tests * ({formData.radiologyTests.length} selected)
                        </label>
                        <div className="p-4 max-h-60 overflow-y-auto bg-gray-50 rounded-lg border border-gray-300">
                          {availableTests.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                              {availableTests.map((test) => (
                                <label key={test} className="flex items-start gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={formData.radiologyTests.includes(test)}
                                    onChange={() => handleCheckboxChange(test)}
                                    disabled={isLoading}
                                    className="mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                                  />
                                  <span className="text-sm text-gray-700">{test}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center text-gray-500 py-8">
                              <p>Loading {formData.radiologyType} tests...</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Remarks */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Remarks</label>
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleInputChange}
                    rows="3"
                    placeholder="Add any additional notes or instructions..."
                    disabled={isLoading}
                    className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                  />
                </div>
              </div>

              {modalError && (
                <div className="p-3 mt-4 text-sm text-red-700 bg-red-100 rounded-lg">
                  {modalError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 justify-end mt-6 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  disabled={isLoading}
                  className="px-6 py-2 w-full font-medium text-gray-700 bg-gray-100 rounded-lg transition-colors hover:bg-gray-200 disabled:opacity-50 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="px-6 py-2 w-full font-medium text-white bg-green-600 rounded-lg transition-colors hover:bg-green-700 disabled:bg-gray-400 sm:w-auto"
                >
                  {isLoading ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal for History */}
      {showViewModal && viewingRecord && (
        <div className="overflow-y-auto fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
            <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-white border-b border-gray-200 md:p-6">
              <h2 className="text-xl font-bold text-gray-900 md:text-2xl">Lab Advice Details</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-1 text-gray-400 rounded-full hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-6">
              {/* Patient Information */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Patient Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                  <div>
                    <span className="text-gray-600">Lab No:</span>
                    <div className="font-medium text-green-600">{viewingRecord.adviceNo}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Admission No:</span>
                    <div className="font-medium text-gray-900">{viewingRecord.admission_no}</div>
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
                    <span className="text-gray-600">Gender:</span>
                    <div className="font-medium text-gray-900">{viewingRecord.gender}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Bed No:</span>
                    <div className="font-medium text-gray-900">{viewingRecord.bedNo}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Location:</span>
                    <div className="font-medium text-gray-900">{viewingRecord.location}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Ward Type:</span>
                    <div className="font-medium text-gray-900">{viewingRecord.wardType}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Department:</span>
                    <div className="font-medium text-gray-900">{viewingRecord.department || 'N/A'}</div>
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <span className="text-gray-600">Reason for Visit:</span>
                    <div className="font-medium text-gray-900">{viewingRecord.reasonForVisit}</div>
                  </div>
                </div>
              </div>

              {/* Lab Advice Details */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Lab Advice Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Priority:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${viewingRecord.priority === 'High' ? 'bg-red-100 text-red-700' :
                      viewingRecord.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                      {viewingRecord.priority}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Category:</span>
                    <div className="font-medium text-gray-900 mt-1">{viewingRecord.category}</div>
                  </div>

                  {/* Pathology Tests */}
                  {viewingRecord.category === 'Pathology' && viewingRecord.pathologyTests.length > 0 && (
                    <div>
                      <span className="text-gray-600">Pathology Tests ({viewingRecord.pathologyTests.length}):</span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {viewingRecord.pathologyTests.map((test, index) => (
                          <span key={index} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                            {test}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Radiology Tests */}
                  {viewingRecord.category === 'Radiology' && (
                    <>
                      <div>
                        <span className="text-gray-600">Radiology Type:</span>
                        <div className="font-medium text-gray-900 mt-1">{viewingRecord.radiologyType}</div>
                      </div>
                      {viewingRecord.radiologyTests.length > 0 && (
                        <div>
                          <span className="text-gray-600">Tests ({viewingRecord.radiologyTests.length}):</span>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {viewingRecord.radiologyTests.map((test, index) => (
                              <span key={index} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                                {test}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Remarks */}
                  {viewingRecord.remarks && (
                    <div>
                      <span className="text-gray-600">Remarks:</span>
                      <div className="font-medium text-gray-900 mt-1 p-2 bg-white rounded border border-gray-200">
                        {viewingRecord.remarks}
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-gray-600">Completed Date:</span>
                    <div className="font-medium text-gray-900 mt-1">
                      {new Date(viewingRecord.completedDate).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button */}
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
  );
};

export default LabAdvice;