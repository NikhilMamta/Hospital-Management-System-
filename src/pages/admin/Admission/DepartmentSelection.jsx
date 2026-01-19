import React, { useState, useEffect } from 'react';
import { Building2, Users, X, CheckCircle, Clock, Activity, AlertTriangle, Search, Bell } from 'lucide-react';
import supabase from '../../../SupabaseClient';

const DepartmentSelection = () => {
  const [pendingPatients, setPendingPatients] = useState([]);
  const [historyPatients, setHistoryPatients] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [activeView, setActiveView] = useState('pending');
  const [assignError, setAssignError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    opd: 0,
    ipd: 0,
    emergency: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // New state for notification popup
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('success'); // 'success' or 'error'

  useEffect(() => {
    loadPatients();

    // Set up real-time subscription for patient updates
    const setupRealtimeSubscription = () => {
      const channel = supabase
        .channel('patient_admission_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'patient_admission'
          },
          () => {
            loadPatients();
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

  // Auto-hide notification after 3 seconds
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

  const loadPatients = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('patient_admission')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error loading patients:', error);
        showNotificationPopup('Failed to load patients', 'error');
        return;
      }

      if (data) {
        const transformedPatients = data.map(patient => ({
          id: patient.id,
          admissionNo: patient.admission_no || `ADM-${patient.id?.toString().padStart(3, '0') || '001'}`,
          patientName: patient.patient_name || '',
          phoneNumber: patient.phone_no || '',
          attenderName: patient.attender_name || '',
          attenderMobile: patient.attender_mobile_no || '',
          reasonForVisit: patient.reason_for_visit || '',
          dateOfBirth: patient.date_of_birth || '',
          age: patient.age || '',
          gender: patient.gender || 'Male',
          status: patient.status || 'pending',
          department: patient.department || '',
          assignedDate: patient.actual1 || '',
          timestamp: patient.timestamp || '',
          planned1: patient.planned1 || '',
          actual1: patient.actual1 || '',
          planned1Formatted: patient.planned1 ? patient.planned1.split(' ')[0].split('-').reverse().join('/') + ' ' + (patient.planned1.split(' ')[1]?.substring(0, 5) || '') : '-',
          actual1Formatted: patient.actual1 ? patient.actual1.split(' ')[0].split('-').reverse().join('/') + ' ' + (patient.actual1.split(' ')[1]?.substring(0, 5) || '') : '-',
          submittedBy: patient.submitted_by || '-'
        }));

        const pending = transformedPatients.filter(p => p.status === 'pending');
        const assigned = transformedPatients.filter(p => p.status === 'assigned');

        setPendingPatients(pending);
        setHistoryPatients(assigned);

        const opdCount = assigned.filter(p => p.department === 'OPD').length;
        const ipdCount = assigned.filter(p => p.department === 'IPD').length;
        const emergencyCount = assigned.filter(p => p.department === 'Emergency').length;

        setStats({
          total: transformedPatients.length,
          pending: pending.length,
          opd: opdCount,
          ipd: ipdCount,
          emergency: emergencyCount
        });
      }
    } catch (error) {
      console.error('Failed to load patients:', error);
      showNotificationPopup('Failed to load patients', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignClick = (patient) => {
    setSelectedPatient(patient);
    setSelectedDepartment('');
    setAssignError('');
    setShowAssignModal(true);
  };

  const handleAssignDepartment = async () => {
    if (!selectedDepartment) {
      setAssignError('Please select a department');
      return;
    }

    try {
      setIsAssigning(true);

      const timestamp = new Date().toLocaleString("en-CA", {
        timeZone: "Asia/Kolkata",
        hour12: false
      }).replace(',', '');

      const { data, error } = await supabase
        .from('patient_admission')
        .update({
          department: selectedDepartment,
          status: 'assigned',
          actual1: timestamp,
          planned2: timestamp,
        })
        .eq('admission_no', selectedPatient.admissionNo)
        .select();

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        await loadPatients();

        setShowAssignModal(false);
        setSelectedPatient(null);
        setSelectedDepartment('');

        // Show success notification instead of alert
        showNotificationPopup(`Patient successfully assigned to ${selectedDepartment}`, 'success');
      }

    } catch (error) {
      console.error('Failed to assign department:', error);
      setAssignError(`Failed to assign department: ${error.message}`);
      showNotificationPopup('Failed to assign department', 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const formatDOBForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const getDepartmentBadge = (department) => {
    switch (department) {
      case 'OPD':
        return 'bg-green-100 text-green-800';
      case 'IPD':
        return 'bg-purple-100 text-purple-800';
      case 'Emergency':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filterPatients = (patients) => {
    if (!searchQuery.trim()) return patients;

    const query = searchQuery.toLowerCase();
    return patients.filter(patient =>
      patient.admissionNo?.toLowerCase().includes(query) ||
      patient.patientName?.toLowerCase().includes(query) ||
      patient.phoneNumber?.toLowerCase().includes(query) ||
      patient.attenderName?.toLowerCase().includes(query) ||
      patient.attenderMobile?.toLowerCase().includes(query) ||
      patient.department?.toLowerCase().includes(query)
    );
  };

  const filteredPendingPatients = filterPatients(pendingPatients);
  const filteredHistoryPatients = filterPatients(historyPatients);

  return (
    <div className="p-3 space-y-4 md:p-6 bg-gray-50 min-h-[75vh]">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 md:gap-4">
        <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm md:p-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <p className="text-xs text-gray-600 md:text-sm">Total Patients</p>
              <Users className="w-4 h-4 text-green-600 md:w-5 md:h-5" />
            </div>
            <p className="text-xl font-bold text-green-600 md:text-2xl">{stats.total}</p>
          </div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm md:p-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <p className="text-xs text-gray-600 md:text-sm">Pending</p>
              <Clock className="w-4 h-4 text-yellow-600 md:w-5 md:h-5" />
            </div>
            <p className="text-xl font-bold text-yellow-600 md:text-2xl">{stats.pending}</p>
          </div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm md:p-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <p className="text-xs text-gray-600 md:text-sm">Total OPD</p>
              <Building2 className="w-4 h-4 text-green-600 md:w-5 md:h-5" />
            </div>
            <p className="text-xl font-bold text-green-600 md:text-2xl">{stats.opd}</p>
          </div>
        </div>

        <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm md:p-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <p className="text-xs text-gray-600 md:text-sm">Total IPD</p>
              <Activity className="w-4 h-4 text-purple-600 md:w-5 md-h-5" />
            </div>
            <p className="text-xl font-bold text-purple-600 md:text-2xl">{stats.ipd}</p>
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 p-3 bg-white rounded-lg border border-gray-200 shadow-sm md:p-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <p className="text-xs text-gray-600 md:text-sm">Total Emergency</p>
              <AlertTriangle className="w-4 h-4 text-red-600 md:w-5 md:h-5" />
            </div>
            <p className="text-xl font-bold text-red-600 md:text-2xl">{stats.emergency}</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by admission number, patient name, phone, attender name, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isLoading}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-gray-600">
            Found {activeView === 'pending' ? filteredPendingPatients.length : filteredHistoryPatients.length} results
          </p>
        )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveView('pending')}
            disabled={isLoading}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors md:text-base ${activeView === 'pending'
              ? 'text-yellow-600 border-b-2 border-yellow-600 bg-yellow-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Clock className="w-4 h-4 md:w-5 md:h-5" />
            Pending ({stats.pending})
            {isLoading && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600"></div>}
          </button>
          <button
            onClick={() => setActiveView('history')}
            disabled={isLoading}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors md:text-base ${activeView === 'history'
              ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
            History ({historyPatients.length})
          </button>
        </div>

        {activeView === 'pending' ? (
          <>
            <div className="hidden md:block">
              <div className="overflow-auto" style={{ maxHeight: 'calc(105vh - 400px)' }}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Action</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Planned Time</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Admission No</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Patient Name</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Phone Number</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Attender Name</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Attender Mobile</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">DOB</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Reason For Visit</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Age</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Gender</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Submitted By</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {isLoading ? (
                      <tr>
                        <td colSpan="12" className="px-4 py-8 text-center text-gray-500">
                          <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-4"></div>
                            <p className="text-gray-700">Loading patients...</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredPendingPatients.length > 0 ? (
                      filteredPendingPatients.map((patient) => (
                        <tr key={patient.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              onClick={() => handleAssignClick(patient)}
                              className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700 transition-colors disabled:bg-gray-400"
                              disabled={isLoading}
                            >
                              Assign
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.planned1Formatted}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {patient.admissionNo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.patientName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.phoneNumber}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.attenderName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.attenderMobile}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {formatDOBForDisplay(patient.dateOfBirth)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                            {patient.reasonForVisit}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.age}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.gender}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.submittedBy}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="12" className="px-4 py-8 text-center text-gray-500">
                          <Clock className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                          <p className="text-lg font-medium text-gray-900">
                            {searchQuery ? 'No patients found matching your search' : 'No pending assignments'}
                          </p>
                          <p className="text-sm">
                            {searchQuery ? 'Try different search terms' : 'All new patients will appear here'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 space-y-3 md:hidden">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-700">Loading patients...</p>
                </div>
              ) : filteredPendingPatients.length > 0 ? (
                filteredPendingPatients.map((patient) => (
                  <div key={patient.id} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="text-xs font-medium text-green-600 mb-1">
                          {patient.admissionNo} • <span className="text-gray-500">{patient.planned1Formatted}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {patient.patientName}
                        </h3>
                      </div>
                      <button
                        onClick={() => handleAssignClick(patient)}
                        className="px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700"
                        disabled={isLoading}
                      >
                        Assign
                      </button>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium text-gray-900">{patient.phoneNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Attender:</span>
                        <span className="font-medium text-gray-900">{patient.attenderName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Attender Mobile:</span>
                        <span className="font-medium text-gray-900">{patient.attenderMobile}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">DOB:</span>
                        <span className="font-medium text-gray-900">{formatDOBForDisplay(patient.dateOfBirth)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Age/Gender:</span>
                        <span className="font-medium text-gray-900">{patient.age} / {patient.gender}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Submitted By:</span>
                        <span className="font-medium text-gray-900">{patient.submittedBy}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-gray-100">
                        <span className="text-gray-600">Reason:</span>
                        <p className="mt-1 text-sm text-gray-900">{patient.reasonForVisit}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center bg-white">
                  <Clock className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                  <p className="text-sm font-medium text-gray-900">
                    {searchQuery ? 'No patients found' : 'No pending assignments'}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="hidden md:block">
              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Department</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Planned Time</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Actual Time</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Admission No</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Patient Name</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Phone Number</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Attender Name</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Attender Mobile</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">DOB</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Reason For Visit</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Age</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Gender</th>
                      <th className="px-4 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase bg-gray-50 border-b-2 border-gray-200">Submitted By</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {isLoading ? (
                      <tr>
                        <td colSpan="14" className="px-4 py-8 text-center text-gray-500">
                          <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-4"></div>
                            <p className="text-gray-700">Loading patients...</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredHistoryPatients.length > 0 ? (
                      filteredHistoryPatients.map((patient) => (
                        <tr key={patient.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${getDepartmentBadge(patient.department)}`}>
                              {patient.department}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.planned1Formatted}
                          </td>
                          <td className="px-4 py-3 text-sm text-green-700 whitespace-nowrap">
                            {patient.actual1Formatted}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {patient.admissionNo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.patientName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.phoneNumber}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.attenderName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.attenderMobile}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {formatDOBForDisplay(patient.dateOfBirth)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                            {patient.reasonForVisit}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.age}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.gender}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {patient.submittedBy}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="14" className="px-4 py-8 text-center text-gray-500">
                          <CheckCircle className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                          <p className="text-lg font-medium text-gray-900">
                            {searchQuery ? 'No patients found matching your search' : 'No assignment history'}
                          </p>
                          <p className="text-sm">
                            {searchQuery ? 'Try different search terms' : 'Assigned patients will appear here'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 space-y-3 md:hidden max-h-[calc(100vh-400px)] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-700">Loading patients...</p>
                </div>
              ) : filteredHistoryPatients.length > 0 ? (
                filteredHistoryPatients.map((patient) => (
                  <div key={patient.id} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="text-xs font-medium text-green-600 mb-1">
                          {patient.admissionNo} • <span className="text-gray-500">{patient.planned1Formatted}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {patient.patientName}
                        </h3>
                      </div>
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${getDepartmentBadge(patient.department)}`}>
                        {patient.department}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium text-gray-900">{patient.phoneNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Attender:</span>
                        <span className="font-medium text-gray-900">{patient.attenderName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Attender Mobile:</span>
                        <span className="font-medium text-gray-900">{patient.attenderMobile}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">DOB:</span>
                        <span className="font-medium text-gray-900">{formatDOBForDisplay(patient.dateOfBirth)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Age/Gender:</span>
                        <span className="font-medium text-gray-900">{patient.age} / {patient.gender}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Submitted By:</span>
                        <span className="font-medium text-gray-900">{patient.submittedBy}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-gray-100">
                        <span className="text-gray-600">Reason:</span>
                        <p className="mt-1 text-sm text-gray-900">{patient.reasonForVisit}</p>
                      </div>
                      <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between">
                        <span className="text-gray-600">Actual:</span>
                        <span className="font-medium text-green-700">{patient.actual1Formatted}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center bg-white">
                  <CheckCircle className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                  <p className="text-sm font-medium text-gray-900">
                    {searchQuery ? 'No patients found' : 'No assignment history'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Assign Department Modal */}
      {showAssignModal && selectedPatient && (
        <div className="overflow-y-auto fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-50 transition-opacity duration-300">
          <div className="relative w-full max-w-md bg-white rounded-lg shadow-xl animate-scale-in">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 md:p-6">
              <h2 className="text-xl font-bold text-gray-900">Assign Department</h2>
              <button
                onClick={() => setShowAssignModal(false)}
                disabled={isAssigning}
                className="text-gray-400 rounded-full p-1 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 md:p-6">
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Admission No
                  </label>
                  <input
                    type="text"
                    value={selectedPatient.admissionNo}
                    disabled
                    className="px-3 py-2 w-full bg-gray-100 rounded-lg border border-gray-300 text-gray-700"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Patient Name
                  </label>
                  <input
                    type="text"
                    value={selectedPatient.patientName}
                    disabled
                    className="px-3 py-2 w-full bg-gray-100 rounded-lg border border-gray-300 text-gray-700"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={selectedPatient.phoneNumber}
                    disabled
                    className="px-3 py-2 w-full bg-gray-100 rounded-lg border border-gray-300 text-gray-700"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Department Select *
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    disabled={isAssigning}
                    className="px-3 py-2 w-full bg-white rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                  >
                    <option value="">Select Department</option>
                    <option value="OPD">OPD (Out-Patient Department)</option>
                    <option value="IPD">IPD (In-Patient Department)</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
              </div>

              {assignError && (
                <div className="p-3 mt-4 text-sm text-red-700 bg-red-100 rounded-lg">
                  {assignError}
                </div>
              )}

              <div className="flex flex-col gap-3 justify-end mt-6 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  disabled={isAssigning}
                  className="px-4 py-2 w-full font-medium text-gray-700 bg-gray-100 rounded-lg transition-colors hover:bg-gray-200 disabled:bg-gray-300 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignDepartment}
                  disabled={isAssigning}
                  className="px-4 py-2 w-full font-medium text-white bg-green-600 rounded-lg transition-colors hover:bg-green-700 disabled:bg-gray-400 sm:w-auto flex items-center justify-center gap-2"
                >
                  {isAssigning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Assigning...
                    </>
                  ) : (
                    'Assign Department'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Popup */}
      {showNotification && (
        <div className={`fixed top-4 right-4 z-50 max-w-md animate-slide-in ${notificationType === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          } border rounded-lg shadow-lg`}>
          <div className="p-4">
            <div className="flex items-start">
              <div className={`flex-shrink-0 p-1 rounded-full ${notificationType === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                <Bell className="w-5 h-5" />
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${notificationType === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>
                  {notificationMessage}
                </p>
              </div>
              <button
                onClick={() => setShowNotification(false)}
                className={`ml-4 flex-shrink-0 ${notificationType === 'success' ? 'text-green-400 hover:text-green-600' : 'text-red-400 hover:text-red-600'
                  }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes scale-in {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default DepartmentSelection;