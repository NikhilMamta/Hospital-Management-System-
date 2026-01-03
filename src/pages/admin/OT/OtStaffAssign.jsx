import React, { useState, useEffect } from 'react';
import { CheckCircle, Calendar, Clock, User, MapPin, Users, ChevronDown, ChevronUp, Search } from 'lucide-react';
import supabase from '../../../SupabaseClient';
import { useNotification } from '../../../contexts/NotificationContext';

const OtStaffAssign = () => {
  const [pendingData, setPendingData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [expandedCard, setExpandedCard] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showNotification } = useNotification();

  const [formData, setFormData] = useState({
    ot_staff: '',
    shift: '',
    reminder: 'Yes'
  });

  const [otStaffList, setOtStaffList] = useState([]);
  const shiftOptions = ['Shift A', 'Shift B', 'Shift C'];
  const reminderOptions = ['Yes', 'No'];

  // Fetch pending OT assignments
  const fetchPendingData = async () => {
    const { data, error } = await supabase
      .from('ot_information')
      .select('*')
      .not('planned2', 'is', null)
      .is('actual3', null)
      .order('planned2', { ascending: true });

    if (error) {
      console.error('Error fetching pending data:', error);
    } else {
      setPendingData(data || []);
    }
  };

  // Fetch history from nurse_assign_task table where staff is 'OT Staff'
  const fetchHistoryData = async () => {
    const { data, error } = await supabase
      .from('nurse_assign_task')
      .select('*')
      .eq('staff', 'OT Staff')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching history data:', error);
    } else {
      // Group tasks by ot_number to show unique assignments
      const groupedTasks = {};

      data.forEach(task => {
        const key = task.ot_number || task.Ipd_number;
        if (!groupedTasks[key]) {
          groupedTasks[key] = {
            ot_number: task.ot_number || 'N/A',
            Ipd_number: task.Ipd_number,
            patient_name: task.patient_name,
            patient_location: task.patient_location,
            ward_type: task.ward_type,
            room: task.room,
            bed_no: task.bed_no,
            shift: task.shift,
            assign_nurse: task.assign_nurse,
            reminder: task.reminder,
            start_date: task.start_date,
            tasks: [],
            timestamp: task.timestamp,
            planned1: task.planned1,
            actual1: task.actual1
          };
        }
        groupedTasks[key].tasks.push({
          task: task.task,
          planned1: task.planned1,
          actual1: task.actual1
        });
      });

      setHistoryData(Object.values(groupedTasks));
    }
  };

  // Fetch OT staff from all_staff table
  const fetchOtStaffList = async () => {
    const { data, error } = await supabase
      .from('all_staff')
      .select('name')
      .eq('designation', 'OT STAFF')
      .order('name');

    if (error) {
      console.error('Error fetching OT Staff list:', error);
    } else {
      setOtStaffList(data.map(item => item.name));
    }
  };

  // Create nurse assign tasks
  const createNurseAssignTasks = async (patientData, otStaff, otShift, reminder, otNumber) => {
    try {
      const tasks = [
        {
          timestamp: new Date().toISOString(),
          Ipd_number: patientData.ipd_number,
          ot_number: otNumber,
          patient_name: patientData.patient_name,
          patient_location: patientData.patient_location,
          ward_type: patientData.ward_type,
          room: patientData.room,
          bed_no: patientData.bed_no,
          shift: otShift,
          assign_nurse: otStaff,
          reminder: reminder,
          start_date: patientData.ot_date,
          task: 'Received in OT',
          planned1: new Date().toISOString(),
          actual1: null,
          staff: 'OT Staff'
        },
        {
          timestamp: new Date().toISOString(),
          Ipd_number: patientData.ipd_number,
          ot_number: otNumber,
          patient_name: patientData.patient_name,
          patient_location: patientData.patient_location,
          ward_type: patientData.ward_type,
          room: patientData.room,
          bed_no: patientData.bed_no,
          shift: otShift,
          assign_nurse: otStaff,
          reminder: reminder,
          start_date: patientData.ot_date,
          task: 'After OT Inform To Ward',
          planned1: new Date().toISOString(),
          actual1: null,
          staff: 'OT Staff'
        }
      ];

      const { error: taskError } = await supabase
        .from('nurse_assign_task')
        .insert(tasks);

      if (taskError) throw taskError;

      console.log('Successfully created 2 tasks in nurse_assign_task table');
      return true;
    } catch (error) {
      console.error('Error creating nurse assign tasks:', error);
      return false;
    }
  };

  // Handle assign button click
  const handleAssignClick = (record) => {
    setSelectedRecord(record);
    setShowForm(true);
    setFormData({
      ot_staff: record.ot_staff || '',
      shift: '',
      reminder: 'Yes'
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting || !selectedRecord) return;

    if (!formData.ot_staff || !formData.shift) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // Update ot_information table with ot_staff
      const { error: updateError } = await supabase
        .from('ot_information')
        .update({
          ot_staff: formData.ot_staff,
          actual3: new Date().toLocaleString("en-CA", {
            timeZone: "Asia/Kolkata",
            hour12: false
          }).replace(',', ''),
        })
        .eq('id', selectedRecord.id);

      if (updateError) throw updateError;

      // Create nurse assign tasks
      const patientData = {
        ipd_number: selectedRecord.ipd_number,
        patient_name: selectedRecord.patient_name,
        patient_location: selectedRecord.patient_location,
        ward_type: selectedRecord.ward_type,
        room: selectedRecord.room,
        bed_no: selectedRecord.bed_no,
        ot_date: selectedRecord.ot_date
      };

      const tasksCreated = await createNurseAssignTasks(
        patientData,
        formData.ot_staff,
        formData.shift,
        formData.reminder,
        selectedRecord.ot_number
      );

      if (!tasksCreated) {
        showNotification('OT staff assigned but failed to create nurse tasks. Please check console for details.', 'warning');
      }

      // Reset form and close modal
      setFormData({
        ot_staff: '',
        shift: '',
        reminder: 'Yes'
      });
      setSelectedRecord(null);
      setShowForm(false);

      // Refresh data
      fetchPendingData();
      fetchHistoryData();

      showNotification(tasksCreated
        ? 'OT staff assigned successfully and nurse tasks created!'
        : 'OT staff assigned but nurse tasks creation failed!',
        tasksCreated ? 'success' : 'error'
      );
    } catch (error) {
      console.error('Error assigning OT staff:', error);
      showNotification(`Error assigning OT staff: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  useEffect(() => {
    fetchPendingData();
    fetchHistoryData();
    fetchOtStaffList();
  }, []);

  // Mobile Card Component for Pending Tasks
  const MobilePendingCard = ({ item }) => {
    const isExpanded = expandedCard === item.id;

    return (
      <div className="bg-white rounded-lg border border-green-200 p-4 mb-3 shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-green-600 text-sm">{item.ot_number || 'N/A'}</span>
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                Pending
              </span>
            </div>
            <h3 className="font-medium text-gray-900 text-sm mb-1">{item.patient_name}</h3>
            <p className="text-xs text-gray-600">IPD: {item.ipd_number}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => handleAssignClick(item)}
              className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
            >
              Assign
            </button>
            <button
              onClick={() => setExpandedCard(isExpanded ? null : item.id)}
              className="text-gray-500"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">OT Date</span>
            </div>
            <p className="text-sm font-medium">{item.ot_date || 'N/A'}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">OT Time</span>
            </div>
            <p className="text-sm font-medium">{item.ot_time || 'N/A'}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <User className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">Doctor</span>
            </div>
            <p className="text-sm font-medium">{item.doctor || 'N/A'}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <User className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">RMO</span>
            </div>
            <p className="text-sm font-medium">{item.rmo || 'N/A'}</p>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t pt-3 mt-3">
            <div className="mb-3">
              <div className="flex items-center gap-1 mb-1">
                <MapPin className="w-3 h-3 text-green-600" />
                <span className="text-xs text-gray-500">Location</span>
              </div>
              <p className="text-sm">{item.patient_location || 'N/A'}</p>
            </div>
            {item.ot_description && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs text-gray-500">Description</span>
                </div>
                <p className="text-sm text-gray-700">{item.ot_description}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Mobile Card Component for History
  const MobileHistoryCard = ({ item }) => {
    const isExpanded = expandedCard === item.id;

    return (
      <div className="bg-white rounded-lg border border-green-200 p-4 mb-3 shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-green-600 text-sm">{item.ot_number || 'N/A'}</span>
              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                Completed
              </span>
            </div>
            <h3 className="font-medium text-gray-900 text-sm mb-1">{item.patient_name}</h3>
            <p className="text-xs text-gray-600">IPD: {item.Ipd_number}</p>
          </div>
          <button
            onClick={() => setExpandedCard(isExpanded ? null : item.id)}
            className="text-gray-500"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">OT Date</span>
            </div>
            <p className="text-sm font-medium">{item.start_date || 'N/A'}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Users className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">OT Staff</span>
            </div>
            <p className="text-sm font-medium">{item.assign_nurse || 'N/A'}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">Shift</span>
            </div>
            <p className="text-sm font-medium">{item.shift || 'N/A'}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <MapPin className="w-3 h-3 text-green-600" />
              <span className="text-xs text-gray-500">Ward</span>
            </div>
            <p className="text-sm font-medium">{item.ward_type || 'N/A'}</p>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t pt-3 mt-3 space-y-3">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <MapPin className="w-3 h-3 text-green-600" />
                <span className="text-xs text-gray-500">Location</span>
              </div>
              <p className="text-sm">{item.patient_location || 'N/A'}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-green-600" />
                <span className="text-xs text-gray-500">Room/Bed</span>
              </div>
              <p className="text-sm font-medium">{item.room ? `${item.room}/${item.bed_no}` : 'N/A'}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-green-600" />
                <span className="text-xs text-gray-500">Assigned On</span>
              </div>
              <p className="text-sm font-medium">
                {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'}
              </p>
            </div>
            {item.tasks && item.tasks.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs text-gray-500">Tasks</span>
                </div>
                <div className="space-y-1">
                  {item.tasks.map((task, index) => (
                    <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                      <span className="font-medium">{task.task}</span>
                      {task.planned1 && (
                        <div className="text-gray-600 mt-0.5">
                          Planned: {new Date(task.planned1).toLocaleString()}
                        </div>
                      )}
                      {task.actual1 && (
                        <div className="text-green-600 mt-0.5">
                          Completed: {new Date(task.actual1).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col p-3 md:p-5 bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-green-600">OT Staff Assignment</h1>
            <p className="text-sm text-gray-600 mt-1">Assign OT staff to scheduled operations</p>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex mt-6 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-2.5 px-4 font-medium text-sm md:text-base rounded-lg transition-colors ${activeTab === 'pending'
                ? 'bg-green-600 text-white'
                : 'bg-transparent text-gray-600 hover:text-green-600'
              }`}
          >
            <div className="flex flex-col items-center">
              <span>Pending <span className=" mt-0.5">{pendingData.length}</span> </span>

            </div>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 px-4 font-medium text-sm md:text-base rounded-lg transition-colors ${activeTab === 'history'
                ? 'bg-green-600 text-white'
                : 'bg-transparent text-gray-600 hover:text-green-600'
              }`}
          >
            <div className="flex flex-col items-center">
              <span>History <span className=" mt-0.5">{historyData.length}</span></span>

            </div>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Mobile Card View */}
        <div className="md:hidden h-full overflow-y-auto pb-4">
          {activeTab === 'pending' ? (
            pendingData.length > 0 ? (
              <div className="space-y-3 px-1">
                {pendingData.map((item) => (
                  <MobilePendingCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8">
                <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
                <h3 className="text-base font-medium text-green-600 mb-2">No pending assignments</h3>
                <p className="text-sm text-green-500 text-center">All OT staff are assigned!</p>
              </div>
            )
          ) : (
            historyData.length > 0 ? (
              <div className="space-y-3 px-1">
                {historyData.map((item, index) => (
                  <MobileHistoryCard key={index} item={item} />
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8">
                <Calendar className="w-16 h-16 text-green-400 mb-4" />
                <h3 className="text-base font-medium text-green-600 mb-2">No assignment history</h3>
                <p className="text-sm text-green-500 text-center">Assign some OT staff to see history</p>
              </div>
            )
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block h-full overflow-hidden">
          {activeTab === 'pending' && (
            <div className="h-full bg-green-50 rounded-lg border border-green-200 flex flex-col">
              <div className="flex-shrink-0 p-5">
                <h2 className="text-lg font-semibold text-green-700">Pending OT Staff Assignments</h2>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {pendingData.length > 0 ? (
                  <table className="min-w-full bg-white">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-green-600 text-white">
                        <th className="px-4 py-3 text-left font-medium sticky left-0 bg-green-600">Action</th>
                        <th className="px-4 py-3 text-left font-medium">OT Number</th>
                        <th className="px-4 py-3 text-left font-medium">IPD Number</th>
                        <th className="px-4 py-3 text-left font-medium">Patient Name</th>
                        <th className="px-4 py-3 text-left font-medium">Location</th>
                        <th className="px-4 py-3 text-left font-medium">OT Date</th>
                        <th className="px-4 py-3 text-left font-medium">OT Time</th>
                        <th className="px-4 py-3 text-left font-medium">Doctor</th>
                        <th className="px-4 py-3 text-left font-medium">RMO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingData.map((item, index) => (
                        <tr
                          key={item.id}
                          className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-green-50'}`}
                        >
                          <td className="px-4 py-3 sticky left-0 bg-white">
                            <button
                              onClick={() => handleAssignClick(item)}
                              className="px-4 py-1.5 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors whitespace-nowrap"
                            >
                              Assign Staff
                            </button>
                          </td>
                          <td className="px-4 py-3">{item.ot_number || 'N/A'}</td>
                          <td className="px-4 py-3">{item.ipd_number || 'N/A'}</td>
                          <td className="px-4 py-3">{item.patient_name || 'N/A'}</td>
                          <td className="px-4 py-3">{item.patient_location || 'N/A'}</td>
                          <td className="px-4 py-3">{item.ot_date || 'N/A'}</td>
                          <td className="px-4 py-3">{item.ot_time || 'N/A'}</td>
                          <td className="px-4 py-3">{item.doctor || 'N/A'}</td>
                          <td className="px-4 py-3">{item.rmo || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8">
                    <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
                    <h3 className="text-lg font-medium text-green-600 mb-2">No pending OT staff assignments</h3>
                    <p className="text-green-500">All OT staff are assigned!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="h-full bg-green-50 rounded-lg border border-green-200 flex flex-col">
              <div className="flex-shrink-0 p-5">
                <h2 className="text-lg font-semibold text-green-700">OT Staff Assignment History</h2>
                <p className="text-sm text-green-600 mt-1">Showing data from nurse assign task table</p>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {historyData.length > 0 ? (
                  <table className="min-w-full bg-white">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-green-600 text-white">
                        <th className="px-4 py-3 text-left font-medium sticky left-0 bg-green-600">OT Number</th>
                        <th className="px-4 py-3 text-left font-medium">IPD Number</th>
                        <th className="px-4 py-3 text-left font-medium">Patient Name</th>
                        <th className="px-4 py-3 text-left font-medium">Patient Location</th>
                        <th className="px-4 py-3 text-left font-medium">Ward Type</th>
                        <th className="px-4 py-3 text-left font-medium">Room/Bed</th>
                        <th className="px-4 py-3 text-left font-medium">Start Date</th>
                        <th className="px-4 py-3 text-left font-medium">Shift</th>
                        <th className="px-4 py-3 text-left font-medium">OT Staff</th>
                        <th className="px-4 py-3 text-left font-medium">Reminder</th>
                        <th className="px-4 py-3 text-left font-medium">Tasks</th>
                        <th className="px-4 py-3 text-left font-medium">Assigned On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.map((item, index) => (
                        <tr
                          key={index}
                          className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-green-50'}`}
                        >
                          <td className="px-4 py-3 sticky left-0 bg-white">{item.ot_number || 'N/A'}</td>
                          <td className="px-4 py-3">{item.Ipd_number || 'N/A'}</td>
                          <td className="px-4 py-3">{item.patient_name || 'N/A'}</td>
                          <td className="px-4 py-3">{item.patient_location || 'N/A'}</td>
                          <td className="px-4 py-3">{item.ward_type || 'N/A'}</td>
                          <td className="px-4 py-3">
                            {item.room ? `${item.room}/${item.bed_no}` : 'N/A'}
                          </td>
                          <td className="px-4 py-3">{item.start_date || 'N/A'}</td>
                          <td className="px-4 py-3">{item.shift || 'N/A'}</td>
                          <td className="px-4 py-3">{item.assign_nurse || 'N/A'}</td>
                          <td className="px-4 py-3">{item.reminder || 'N/A'}</td>
                          <td className="px-4 py-3">
                            {item.tasks?.length || 0} tasks
                          </td>
                          <td className="px-4 py-3">
                            {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8">
                    <Calendar className="w-16 h-16 text-green-400 mb-4" />
                    <h3 className="text-lg font-medium text-green-600 mb-2">No OT staff assignment history</h3>
                    <p className="text-green-500">Assign some OT staff to see history here</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign OT Staff Form Modal */}
      {showForm && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-start md:items-center justify-center p-2 md:p-4 z-50">
          <div className="bg-white p-4 md:p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto border-2 border-green-600">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg md:text-xl font-semibold text-green-600">Assign OT Staff</h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setSelectedRecord(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            {/* Patient Information Summary */}
            <div className="mb-6 p-3 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-medium text-green-700 mb-2">Patient Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Patient:</span>
                  <p className="font-medium">{selectedRecord.patient_name}</p>
                </div>
                <div>
                  <span className="text-gray-600">IPD No:</span>
                  <p className="font-medium">{selectedRecord.ipd_number}</p>
                </div>
                <div>
                  <span className="text-gray-600">OT Date:</span>
                  <p className="font-medium">{selectedRecord.ot_date}</p>
                </div>
                <div>
                  <span className="text-gray-600">OT Time:</span>
                  <p className="font-medium">{selectedRecord.ot_time}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">OT Number:</span>
                  <p className="font-medium text-green-600">{selectedRecord.ot_number}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* OT Staff Field */}
              <div className="mb-4">
                <label className="block mb-2 text-green-600 font-medium text-sm">
                  OT Staff *
                </label>
                <select
                  name="ot_staff"
                  value={formData.ot_staff}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2.5 rounded-lg border border-green-600 outline-none bg-white text-sm"
                >
                  <option value="">Select OT Staff</option>
                  {otStaffList.map((staff, index) => (
                    <option key={index} value={staff}>{staff}</option>
                  ))}
                </select>
              </div>

              {/* Shift Field */}
              <div className="mb-4">
                <label className="block mb-2 text-green-600 font-medium text-sm">
                  Shift *
                </label>
                <select
                  name="shift"
                  value={formData.shift}
                  onChange={handleInputChange}
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2.5 rounded-lg border border-green-600 outline-none bg-white text-sm"
                >
                  <option value="">Select Shift</option>
                  {shiftOptions.map((shift, index) => (
                    <option key={index} value={shift}>{shift}</option>
                  ))}
                </select>
              </div>

              {/* Reminder Field */}
              <div className="mb-6">
                <label className="block mb-2 text-green-600 font-medium text-sm">
                  Reminder
                </label>
                <select
                  name="reminder"
                  value={formData.reminder}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2.5 rounded-lg border border-green-600 outline-none bg-white text-sm"
                >
                  {reminderOptions.map((option, index) => (
                    <option key={index} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 py-3 rounded-lg font-medium text-sm transition-colors ${!isSubmitting
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                  {isSubmitting ? 'Assigning...' : 'Assign OT Staff'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setSelectedRecord(null);
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
};

export default OtStaffAssign;