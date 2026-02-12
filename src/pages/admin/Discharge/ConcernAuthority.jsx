import React, { useState, useEffect } from 'react';
import { Building2, X, Clock, CheckCircle, Image } from 'lucide-react';
import supabase from '../../../SupabaseClient';
import useRealtimeTable from '../../../hooks/useRealtimeTable';
import { useNotification } from '../../../contexts/NotificationContext';

const ConcernAuthority = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingRecords, setPendingRecords] = useState([]);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [selectedRecords, setSelectedRecords] = useState({});
  const [workFileStatus, setWorkFileStatus] = useState({});
  const [viewImageModal, setViewImageModal] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const { showNotification } = useNotification();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // Separate state for submission

  // Real-time sync: refresh when discharge table changes (replaces aggressive polling)
  useRealtimeTable('discharge', loadData);

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Fetch pending records (planned4 is not null and actual4 is null)
      const { data: pendingData, error: pendingError } = await supabase
        .from('discharge')
        .select('*')
        .not('planned4', 'is', null)
        .is('actual4', null)
        .order('planned4', { ascending: true });

      if (pendingError) throw pendingError;
      const formattedPending = (pendingData || []).map(record => ({
        ...record,
        planned4Date: record.planned4 ? new Date(record.planned4).toLocaleDateString('en-GB') : 'N/A',
        planned4Time: record.planned4 ? new Date(record.planned4).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
      }));
      setPendingRecords(formattedPending || []);

      // Fetch history records (both planned4 and actual4 are not null)
      const { data: historyData, error: historyError } = await supabase
        .from('discharge')
        .select('*')
        .not('planned4', 'is', null)
        .not('actual4', 'is', null)
        .order('actual4', { ascending: false });

      if (historyError) throw historyError;
      const formattedHistory = (historyData || []).map(record => ({
        ...record,
        planned4Date: record.planned4 ? new Date(record.planned4).toLocaleDateString('en-GB') : 'N/A',
        planned4Time: record.planned4 ? new Date(record.planned4).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
        actual4Date: record.actual4 ? new Date(record.actual4).toLocaleDateString('en-GB') : 'N/A',
        actual4Time: record.actual4 ? new Date(record.actual4).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }) : 'N/A',
      }));
      setHistoryRecords(formattedHistory || []);

    } catch (error) {
      console.error('Error loading data from Supabase:', error);
      showNotification('Failed to load data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckboxChange = (admissionNo) => {
    setSelectedRecords((prev) => ({
      ...prev,
      [admissionNo]: !prev[admissionNo],
    }));
  };

  const handleWorkFileChange = (admissionNo, value) => {
    setWorkFileStatus((prev) => ({
      ...prev,
      [admissionNo]: value,
    }));
  };

  const handleSubmit = async () => {
    const selectedAdmissions = Object.keys(selectedRecords).filter(
      (key) => selectedRecords[key]
    );

    if (selectedAdmissions.length === 0) {
      showNotification('Please select at least one record', 'error');
      return;
    }

    const missingWorkFile = selectedAdmissions.filter(
      (admNo) => !workFileStatus[admNo]
    );
    if (missingWorkFile.length > 0) {
      showNotification('Please select Work File status (Yes/No) for all selected records', 'error');
      return;
    }

    try {
      setIsSubmitting(true); // Set submitting state to true

      // Prepare update data for each selected record
      const updates = selectedAdmissions.map(admissionNo => ({
        admission_no: admissionNo,
        actual4: new Date().toISOString(), // Set current timestamp
        concern_dept: workFileStatus[admissionNo], // Yes or No
        delay4: calculateDelay(admissionNo), // Calculate delay
      }));

      // Update records in Supabase
      const updatePromises = updates.map(async (updateData) => {
        const { error } = await supabase
          .from('discharge')
          .update({
            actual4: new Date().toLocaleString("en-CA", {
              timeZone: "Asia/Kolkata",
              hour12: false
            }).replace(',', ''),
            concern_authority_work_file: updateData.concern_dept,
            planned5: new Date().toLocaleString("en-CA", {
              timeZone: "Asia/Kolkata",
              hour12: false
            }).replace(',', ''),

          })
          .eq('admission_no', updateData.admission_no);

        if (error) throw error;
      });

      await Promise.all(updatePromises);

      // Reset form
      setSelectedRecords({});
      setWorkFileStatus({});
      showNotification('Concern Authority status updated successfully!', 'success');

      // Reload data
      await loadData();

    } catch (error) {
      console.error('Error updating records in Supabase:', error);
      showNotification('Failed to save. Please try again.', 'error');
    } finally {
      setIsSubmitting(false); // Reset submitting state
    }
  };

  const calculateDelay = (admissionNo) => {
    const record = pendingRecords.find(r => r.admission_no === admissionNo);
    if (!record || !record.planned4) return null;

    const plannedDate = new Date(record.planned4);
    const actualDate = new Date();
    const diffHours = Math.floor((actualDate - plannedDate) / (1000 * 60 * 60));

    if (diffHours <= 0) return 'On Time';
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} delay`;
  };

  const openImageViewer = (imageUrl) => {
    setViewingImage(imageUrl);
    setViewImageModal(true);
  };

  const isAnySelected = Object.values(selectedRecords).some((v) => v);

  return (
    <div className="p-2 space-y-3 md:p-6 md:space-y-4 bg-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-2 justify-between items-start sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900 md:text-3xl">
            Concern Authority
          </h1>
          <p className="hidden mt-1 text-sm text-gray-600 sm:block">
            Final approval for work file after Concern Department review
          </p>
        </div>
      </div>

      {/* Tabs & Submit Button */}
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

        {activeTab === 'pending' && (
          <button
            onClick={handleSubmit}
            disabled={!isAnySelected || isSubmitting}
            className={`w-full mt-2 md:w-auto md:mt-0 flex items-center justify-center gap-2 px-4 py-2 md:px-6 md:py-2.5 text-sm md:text-base text-white rounded-lg shadow-sm font-medium transition-all md:mb-[-2px] ${isAnySelected && !isSubmitting
              ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
              : 'bg-gray-400 cursor-not-allowed opacity-60'
              }`}
          >
            <Building2 className="w-4 h-4 md:w-5 md:h-5" />
            {isSubmitting ? 'Processing...' : 'Submit'}
          </button>
        )}
      </div>

      {/* === PENDING SECTION === */}
      {activeTab === 'pending' && (
        <div>


          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-green-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Action</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Work File</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Admission No</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Patient Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Department</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Consultant</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Staff Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Planned Authority</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">RMO Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Summary Report</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Concern Dept</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingRecords.length > 0 ? (
                  pendingRecords.map((record) => (
                    <tr
                      key={record.id}
                      className={`hover:bg-green-50 ${selectedRecords[record.admission_no] ? 'bg-green-50' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedRecords[record.admission_no] || false}
                          onChange={() => handleCheckboxChange(record.admission_no)}
                          className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                          disabled={isSubmitting} // Use isSubmitting here too
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <select
                          value={workFileStatus[record.admission_no] || ''}
                          onChange={(e) => handleWorkFileChange(record.admission_no, e.target.value)}
                          className="px-2 py-1 text-sm border rounded bg-white focus:ring-2 focus:ring-green-500"
                          disabled={isSubmitting} // Use isSubmitting here too
                        >
                          <option value="">Select</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">
                        {record.admission_no}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {record.patient_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.department}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.consultant_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.staff_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.planned4Date} {record.planned4Time}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                          Pending
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.rmo_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {record.summary_report_image ? (
                          <button
                            onClick={() => openImageViewer(record.summary_report_image)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 bg-green-50 rounded hover:bg-green-100"
                            disabled={isSubmitting} // Use isSubmitting here too
                          >
                            <Image className="w-3 h-3" />
                            View
                          </button>
                        ) : (
                          <span className="text-gray-500">No image</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.concern_dept}
                      </td>
                    </tr>

                  ))
                ) : (
                  <tr>
                    <td colSpan="12" className="px-4 py-12 text-center text-gray-500">
                      <Clock className="mx-auto mb-4 w-12 h-12 text-gray-300" />
                      <p className="text-lg font-medium">No pending approvals</p>
                      <p>Records will appear here after Concern Department review</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - Pending */}
          <div className="space-y-3 md:hidden">
            {pendingRecords.length > 0 ? (
              pendingRecords.map((record) => (
                <div
                  key={record.id}
                  className={`p-4 rounded-lg border shadow-sm ${selectedRecords[record.admission_no]
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 bg-white'
                    }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedRecords[record.admission_no] || false}
                        onChange={() => handleCheckboxChange(record.admission_no)}
                        className="mt-1 w-4 h-4 text-green-600 rounded"
                        disabled={isSubmitting} // Use isSubmitting here too
                      />
                      <div>
                        <div className="text-sm font-medium text-green-600">{record.admission_no}</div>
                        <div className="font-semibold">{record.patient_name}</div>
                      </div>
                    </div>
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                      Pending
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs my-3">
                    <div><span className="text-gray-600">Dept:</span> <strong>{record.department}</strong></div>
                    <div><span className="text-gray-600">Consultant:</span> {record.consultant_name || 'N/A'}</div>
                    <div><span className="text-gray-600">Staff:</span> {record.staff_name}</div>
                    <div><span className="text-gray-600">Planned Authority:</span> {record.planned4Date} {record.planned4Time}</div>
                    <div><span className="text-gray-600">RMO:</span> {record.rmo_name || 'N/A'}</div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t">
                    <label className="text-xs font-medium">Work File (Authority):</label>
                    <select
                      value={workFileStatus[record.admission_no] || ''}
                      onChange={(e) => handleWorkFileChange(record.admission_no, e.target.value)}
                      className="px-2 py-1 text-xs border rounded text-sm"
                      disabled={isSubmitting} // Use isSubmitting here too
                    >
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  {record.summary_report_image && (
                    <div className="mt-3 text-right">
                      <button
                        onClick={() => openImageViewer(record.summary_report_image)}
                        className="text-xs text-green-600 underline"
                        disabled={isSubmitting} // Use isSubmitting here too
                      >
                        View Summary Report →
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-white rounded-lg border">
                <Clock className="mx-auto mb-4 w-12 h-12 text-gray-300" />
                <p className="font-medium">No pending approvals</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === HISTORY SECTION === */}
      {activeTab === 'history' && (
        <div>
          {/* Desktop History Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-green-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Admission No</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Patient Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Department</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Consultant</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Staff Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Planned Authority</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Actual Authority</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">RMO Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Summary Report</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Work File</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Concern Dept</th>
                  <th className="px-4 py-3 text-xs font-medium text-left uppercase">Authority</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {historyRecords.length > 0 ? (
                  historyRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-green-50">
                      <td className="px-4 py-3 text-sm font-medium text-green-600">{record.admission_no}</td>
                      <td className="px-4 py-3 text-sm">{record.patient_name}</td>
                      <td className="px-4 py-3 text-sm">{record.department}</td>
                      <td className="px-4 py-3 text-sm">{record.consultant_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm">{record.staff_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.planned4Date} {record.planned4Time}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {record.actual4Date} {record.actual4Time}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {record.rmo_status}
                      </td>

                      <td className="px-4 py-3 text-sm">{record.rmo_name || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm">
                        {record.summary_report_image ? (
                          <button
                            onClick={() => openImageViewer(record.summary_report_image)}
                            className="flex items-center gap-1 text-xs text-green-600"
                          >
                            <Image className="w-4 h-4" /> View
                          </button>
                        ) : 'No image'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 text-xs rounded-full ${record.work_file === 'Yes'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                          }`}>
                          {record.work_file || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{record.concern_dept}</td>
                      <td className="px-4 py-3 text-sm">{record.concern_authority_work_file}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="13" className="py-12 text-center text-gray-500">
                      <CheckCircle className="mx-auto mb-4 w-12 h-12 text-gray-300" />
                      <p>No completed approvals yet</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile History Cards */}
          <div className="space-y-3 md:hidden">
            {historyRecords.map((record) => (
              <div key={record.id} className="p-4 bg-white rounded-lg border">
                <div className="flex justify-between">
                  <div>
                    <div className="text-sm font-medium text-green-600">{record.admission_no}</div>
                    <div className="font-semibold">{record.patient_name}</div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${record.delay4 === 'On Time' || !record.delay4
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                    }`}>
                    {record.delay4 || 'N/A'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>Dept: <strong>{record.department}</strong></div>
                  <div>Consultant: {record.consultant_name || 'N/A'}</div>
                  <div>Staff: {record.staff_name}</div>
                  <div>Planned Authority: {record.planned4Date} {record.planned4Time}</div>
                  <div>Actual Authority: {record.actual4Date} {record.actual4Time}</div>
                  <div>Work File: <strong className={record.concern_dept === 'Yes' ? 'text-green-700' : 'text-red-700'}>{record.concern_dept}</strong></div>
                </div>
                {record.summary_report_image && (
                  <div className="mt-3 text-right">
                    <button onClick={() => openImageViewer(record.summary_report_image)} className="text-xs text-green-600 underline">
                      View Summary →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Modal */}
      {viewImageModal && viewingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
          <div className="relative max-w-4xl w-full bg-white rounded-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold">Summary Report Image</h3>
              <button
                onClick={() => {
                  setViewImageModal(false);
                  setViewingImage(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 max-h-[80vh] overflow-auto">
              <img src={viewingImage} alt="Summary" className="w-full rounded" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConcernAuthority;