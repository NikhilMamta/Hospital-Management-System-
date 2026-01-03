import React, { useState, useEffect } from 'react';
import { Building2, X, Clock, CheckCircle, Image as ImageIcon } from 'lucide-react';
import supabase from '../../../SupabaseClient';
import { useNotification } from '../../../contexts/NotificationContext';

const ConcernDepartment = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingRecords, setPendingRecords] = useState([]);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [selectedRecords, setSelectedRecords] = useState({});
  const [concernDepartmentStatus, setConcernDepartmentStatus] = useState({});
  const [viewImageModal, setViewImageModal] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const { showNotification } = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingRecords, setUploadingRecords] = useState({});

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'pending') {
        await loadPendingRecords();
      } else {
        await loadHistoryRecords();
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPendingRecords = async () => {
    try {
      // Fetch records where:
      // - planned1 is not null AND actual1 is not null (RMO initiated)
      // - work_file is not null (file work completed)
      // - planned2 is not null (file work timestamp)
      // - planned3 is not null (concern department planned)
      // - actual3 is null (concern department not completed yet)
      const { data, error } = await supabase
        .from('discharge')
        .select('*')
        .not('planned3', 'is', null)
        .is('actual3', null)
        .order('planned3', { ascending: true });

      if (error) throw error;

      // Format the data for display
      const formattedRecords = data.map(record => ({
        id: record.id,
        admissionNo: record.admission_no,
        patientName: record.patient_name,
        department: record.department,
        consultantName: record.consultant_name,
        staffName: record.staff_name,
        dischargeDate: record.actual1 ? new Date(record.actual1).toLocaleDateString('en-GB') : 'N/A',
        dischargeTime: record.actual1 ? new Date(record.actual1).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
        status: record.rmo_status || 'N/A',
        rmoName: record.rmo_name || 'N/A',
        summaryReportImage: record.summary_report_image,
        summaryReportImageName: record.summary_report_image_name,
        workFile: record.work_file,
        workFileDate: record.planned2 ? new Date(record.planned2).toLocaleDateString('en-GB') : 'N/A',
        workFileTime: record.planned2 ? new Date(record.planned2).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
        planned3Date: record.planned3 ? new Date(record.planned3).toLocaleDateString('en-GB') : 'N/A',
        planned3Time: record.planned3 ? new Date(record.planned3).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
        planned3: record.planned3,
        actual3: record.actual3,
        delay3: record.delay3,
        remark: record.remark
      }));

      setPendingRecords(formattedRecords);
    } catch (error) {
      console.error('Error loading pending records:', error);
      setPendingRecords([]);
    }
  };

  const loadHistoryRecords = async () => {
    try {
      // Fetch records where:
      // - planned1 is not null AND actual1 is not null
      // - work_file is not null
      // - planned2 is not null
      // - planned3 is not null AND actual3 is not null (concern department completed)
      const { data, error } = await supabase
        .from('discharge')
        .select('*')
        .not('planned3', 'is', null)
        .not('actual3', 'is', null)
        .order('actual3', { ascending: false });

      if (error) throw error;

      // Format the data for display
      const formattedRecords = data.map(record => ({
        id: record.id,
        admissionNo: record.admission_no,
        patientName: record.patient_name,
        department: record.department,
        consultantName: record.consultant_name,
        staffName: record.staff_name,
        dischargeDate: record.actual1 ? new Date(record.actual1).toLocaleDateString('en-GB') : 'N/A',
        dischargeTime: record.actual1 ? new Date(record.actual1).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
        status: record.rmo_status || 'N/A',
        rmoName: record.rmo_name || 'N/A',
        summaryReportImage: record.summary_report_image,
        summaryReportImageName: record.summary_report_image_name,
        workFile: record.work_file,
        workFileDate: record.planned2 ? new Date(record.planned2).toLocaleDateString('en-GB') : 'N/A',
        workFileTime: record.planned2 ? new Date(record.planned2).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
        concernDepartment: record.concern_dept,
        concernDepartmentDate: record.actual3 ? new Date(record.actual3).toLocaleDateString('en-GB') : 'N/A',
        concernDepartmentTime: record.actual3 ? new Date(record.actual3).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
        actual3Date: record.actual3 ? new Date(record.actual3).toLocaleDateString('en-GB') : 'N/A',
        actual3Time: record.actual3 ? new Date(record.actual3).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
        planned3Date: record.planned3 ? new Date(record.planned3).toLocaleDateString('en-GB') : 'N/A',
        planned3Time: record.planned3 ? new Date(record.planned3).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
        delay3: record.delay3,
        planned3: record.planned3,
        actual3: record.actual3
      }));

      setHistoryRecords(formattedRecords);
    } catch (error) {
      console.error('Error loading history records:', error);
      setHistoryRecords([]);
    }
  };

  const handleCheckboxChange = (admissionNo) => {
    setSelectedRecords(prev => ({
      ...prev,
      [admissionNo]: !prev[admissionNo]
    }));
  };

  const handleConcernDepartmentChange = (admissionNo, value) => {
    setConcernDepartmentStatus(prev => ({
      ...prev,
      [admissionNo]: value
    }));
  };

  const handleSubmit = async () => {
    const selectedAdmissions = Object.keys(selectedRecords).filter(key => selectedRecords[key]);

    if (selectedAdmissions.length === 0) {
      showNotification('Please select at least one record', 'error');
      return;
    }

    // Check if all selected records have concern department status
    const missingConcernDept = selectedAdmissions.filter(admNo => !concernDepartmentStatus[admNo]);
    if (missingConcernDept.length > 0) {
      showNotification('Please select Concern Department status for all selected records', 'error');
      return;
    }

    try {
      setUploadingRecords(prev => {
        const updated = { ...prev };
        selectedAdmissions.forEach(admNo => {
          updated[admNo] = true;
        });
        return updated;
      });

      const updates = [];

      // Process each selected record
      for (const admissionNo of selectedAdmissions) {
        const record = pendingRecords.find(r => r.admissionNo === admissionNo);
        if (!record) continue;

        const updateData = {
          concern_dept: concernDepartmentStatus[admissionNo],
          actual3: new Date().toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false
          }).replace(',', ''),
          planned4: new Date().toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false
          }).replace(',', ''),
        };

        updates.push(
          supabase
            .from('discharge')
            .update(updateData)
            .eq('id', record.id)
        );
      }

      // Execute all updates
      const results = await Promise.all(updates);

      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update some records: ${errors[0].error.message}`);
      }

      // Clear selections and reload data
      setSelectedRecords({});
      setConcernDepartmentStatus({});
      showNotification('Concern Department status updated successfully!', 'success');
      await loadData();

    } catch (error) {
      console.error('Error saving concern department:', error);
      showNotification(error.message || 'Failed to save. Please try again.', 'error');
    } finally {
      setUploadingRecords({});
    }
  };

  const calculateDelay = (plannedDate) => {
    if (!plannedDate) return 'No planned date';

    const planned = new Date(plannedDate);
    const actual = new Date();
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

  const openImageViewer = (imageUrl) => {
    if (imageUrl) {
      setViewingImage(imageUrl);
      setViewImageModal(true);
    }
  };

  const isAnyRecordSelected = Object.values(selectedRecords).some(val => val);
  const isUploading = Object.values(uploadingRecords).some(val => val);

  return (
    <div className="p-2 space-y-3 md:p-6 md:space-y-4 bg-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-2 justify-between items-start sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-3xl">
            Concern Department
          </h1>
          <p className="hidden mt-1 text-sm text-gray-600 sm:block">
            Manage concern department status for file work completed patients
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

      {/* Tabs and Submit Button Row */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-gray-200">
        <div className="flex gap-2">
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
              {pendingRecords.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-600 rounded-full">
                  {pendingRecords.length}
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
              {historyRecords.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-600 rounded-full">
                  {historyRecords.length}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Submit Button */}
        {activeTab === 'pending' && (
          <button
            onClick={handleSubmit}
            disabled={!isAnyRecordSelected || isUploading}
            className={`w-full mt-2 md:w-auto md:mt-0 flex items-center justify-center gap-2 px-4 py-2 md:px-6 md:py-2.5 text-sm md:text-base text-white rounded-lg shadow-sm font-medium transition-all md:mb-[-2px] ${isAnyRecordSelected && !isUploading
              ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
              : 'bg-gray-400 cursor-not-allowed opacity-60'
              }`}
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              <>
                <Building2 className="w-4 h-4 md:w-5 md:h-5" />
                Submit
              </>
            )}
          </button>
        )}
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
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Concern Dept</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Admission No</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Patient Name</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Department</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Consultant</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Staff Name</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Planned Concern Dept</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">RMO Name</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Summary Report</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Work File</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingRecords.length > 0 ? (
                  pendingRecords.map((record) => (
                    <tr key={record.id} className={`hover:bg-green-50 ${selectedRecords[record.admissionNo] ? 'bg-green-50' : ''} ${uploadingRecords[record.admissionNo] ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {uploadingRecords[record.admissionNo] ? (
                          <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-2"></div>
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedRecords[record.admissionNo] || false}
                            onChange={() => handleCheckboxChange(record.admissionNo)}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <select
                          value={concernDepartmentStatus[record.admissionNo] || ''}
                          onChange={(e) => handleConcernDepartmentChange(record.admissionNo, e.target.value)}
                          disabled={uploadingRecords[record.admissionNo]}
                          className="px-2 py-1 text-sm bg-white rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">
                        {record.admissionNo}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {record.patientName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.department}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.consultantName || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.staffName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.planned3Date} {record.planned3Time}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.rmoName}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {record.summaryReportImage ? (
                          <button
                            onClick={() => openImageViewer(record.summaryReportImage)}
                            disabled={uploadingRecords[record.admissionNo]}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 bg-green-50 rounded hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ImageIcon className="w-3 h-3" />
                            View Report
                          </button>
                        ) : (
                          <span className="text-gray-500">No report</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${record.workFile === 'Yes'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                          }`}>
                          {record.workFile}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="12" className="px-4 py-8 text-center text-gray-500">
                      <Clock className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                      <p className="text-lg font-medium text-gray-900">No pending records</p>
                      <p className="text-sm">All file work completed patients have been processed</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-2 md:hidden">
            {pendingRecords.length > 0 ? (
              pendingRecords.map((record) => (
                <div key={record.id} className={`p-3 bg-white rounded-lg border shadow-sm ${selectedRecords[record.admissionNo] ? 'border-green-400 bg-green-50' : 'border-gray-200'} ${uploadingRecords[record.admissionNo] ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-start gap-2">
                      {uploadingRecords[record.admissionNo] ? (
                        <div className="mt-1 w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <input
                          type="checkbox"
                          checked={selectedRecords[record.admissionNo] || false}
                          onChange={() => handleCheckboxChange(record.admissionNo)}
                          className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                      )}
                      <div>
                        <div className="text-xs font-medium text-green-600 mb-0.5">
                          {record.admissionNo}
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {record.patientName}
                        </h3>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded-full">
                      {record.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] mb-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Department:</span>
                      <span className="font-medium text-gray-900">{record.department}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Consultant:</span>
                      <span className="font-medium text-gray-900">{record.consultantName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Staff Name:</span>
                      <span className="font-medium text-gray-900">{record.staffName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Planned Concern Dept:</span>
                      <span className="font-medium text-gray-900">{record.planned3Date} {record.planned3Time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">RMO Name:</span>
                      <span className="font-medium text-gray-900">{record.rmoName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Work File:</span>
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${record.workFile === 'Yes'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                        }`}>
                        {record.workFile}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-medium text-gray-700">Concern Dept:</label>
                      <select
                        value={concernDepartmentStatus[record.admissionNo] || ''}
                        onChange={(e) => handleConcernDepartmentChange(record.admissionNo, e.target.value)}
                        disabled={uploadingRecords[record.admissionNo]}
                        className="px-2 py-1 text-[10px] bg-white rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-600">Summary Report:</span>
                      {record.summaryReportImage ? (
                        <button
                          onClick={() => openImageViewer(record.summaryReportImage)}
                          disabled={uploadingRecords[record.admissionNo]}
                          className="flex items-center gap-0.5 px-2 py-1 text-[10px] text-green-600 bg-green-50 rounded hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ImageIcon className="w-3 h-3" />
                          View Report
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-500">No report</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
                <Clock className="mx-auto mb-2 w-10 h-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-900">No pending records</p>
                <p className="text-xs text-gray-600 mt-0.5">All file work completed patients have been processed</p>
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
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Planned Concern Dept</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Actual Concern Dept</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">RMO Name</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Summary Report</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Work File</th>
                  <th className="px-4 py-3 text-xs font-medium tracking-wider text-left uppercase">Concern Dept</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {historyRecords.length > 0 ? (
                  historyRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-green-50">
                      <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">
                        {record.admissionNo}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {record.patientName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.department}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.consultantName || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.staffName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.planned3Date} {record.planned3Time}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.actual3Date} {record.actual3Time}
                      </td>

                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.rmoName}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {record.summaryReportImage ? (
                          <button
                            onClick={() => openImageViewer(record.summaryReportImage)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 bg-green-50 rounded hover:bg-green-100"
                          >
                            <ImageIcon className="w-3 h-3" />
                            View Report
                          </button>
                        ) : (
                          <span className="text-gray-500">No report</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${record.workFile === 'Yes'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                          }`}>
                          {record.workFile}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${record.concernDepartment === 'Yes'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                          }`}>
                          {record.concernDepartment}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="12" className="px-4 py-8 text-center text-gray-500">
                      <CheckCircle className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                      <p className="text-lg font-medium text-gray-900">No history records</p>
                      <p className="text-sm">Completed concern department records will appear here</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {historyRecords.length > 0 ? (
              historyRecords.map((record) => (
                <div key={record.id} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-xs font-medium text-green-600 mb-1">
                        {record.admissionNo}
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {record.patientName}
                      </h3>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                      {record.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Department:</span>
                      <span className="font-medium text-gray-900">{record.department}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Consultant:</span>
                      <span className="font-medium text-gray-900">{record.consultantName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Staff Name:</span>
                      <span className="font-medium text-gray-900">{record.staffName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Planned Concern Dept:</span>
                      <span className="font-medium text-gray-900">{record.planned3Date} {record.planned3Time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Actual Concern Dept:</span>
                      <span className="font-medium text-gray-900">{record.actual3Date} {record.actual3Time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delay:</span>
                      <span className={`font-medium ${record.delay3?.includes('Delayed')
                        ? 'text-red-700'
                        : record.delay3?.includes('Early')
                          ? 'text-blue-700'
                          : 'text-green-700'
                        }`}>
                        {record.delay3 || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">RMO Name:</span>
                      <span className="font-medium text-gray-900">{record.rmoName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Work File:</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${record.workFile === 'Yes'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                        }`}>
                        {record.workFile}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Concern Dept:</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${record.concernDepartment === 'Yes'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                        }`}>
                        {record.concernDepartment}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <span className="text-gray-600">Summary Report:</span>
                      {record.summaryReportImage ? (
                        <button
                          onClick={() => openImageViewer(record.summaryReportImage)}
                          className="flex items-center gap-1 mt-1 px-2 py-1 text-xs text-green-600 bg-green-50 rounded hover:bg-green-100"
                        >
                          <ImageIcon className="w-3 h-3" />
                          View Report
                        </button>
                      ) : (
                        <p className="mt-1 text-gray-500">No report</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
                <CheckCircle className="mx-auto mb-2 w-12 h-12 text-gray-300" />
                <p className="text-sm font-medium text-gray-900">No history records</p>
                <p className="text-xs text-gray-600">Completed concern department records will appear here</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewImageModal && viewingImage && (
        <div className="fixed inset-0 z-50 flex justify-center items-center p-4 bg-black bg-opacity-75 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Summary Report</h3>
              <button
                onClick={() => {
                  setViewImageModal(false);
                  setViewingImage(null);
                }}
                className="text-gray-500 rounded-full p-1 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <img
                src={viewingImage}
                alt="Summary Report"
                className="w-full h-auto max-w-full rounded object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConcernDepartment;