import React, { useState, useEffect } from 'react';
import { CheckCircle, User, Stethoscope, Scissors, Search, ChevronDown, ChevronUp, X, Syringe, Clock, Info } from 'lucide-react';
import supabase from '../../../SupabaseClient';
import { useOutletContext } from 'react-router-dom';
import { useNotification } from '../../../contexts/NotificationContext';

const StatusBadge = ({ status }) => {
  const getColors = () => {
    if (status === 'Completed') return 'bg-green-100 text-green-700';
    if (status === 'Pending') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getColors()}`}>
      {status}
    </span>
  );
};

const MobileTaskCard = ({ task, activeTab, onComplete, completingTask, getTableName }) => {
  const [expanded, setExpanded] = useState(false);

  const getAssignedPerson = () => {
    if (activeTab === 'nurse') return task.assign_nurse;
    if (activeTab === 'rmo') return task.assign_rmo;
    if (activeTab === 'ot') return task.assign_nurse || task.staff;
    if (activeTab === 'dressing') return task.assign_nurse || task.assign_rmo;
    return '';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3 shadow-sm">
      {/* Task Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-green-600 text-sm">{task.task_no}</span>
            <StatusBadge status={task.status} />
          </div>
          <h3 className="font-medium text-gray-900 text-sm">{task.patient_name}</h3>
          <p className="text-xs text-gray-600">IPD: {task.ipd_number}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 p-1"
        >
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Main Task Info */}
      <div className="mb-3">
        <p className="text-gray-700 text-sm font-medium mb-1">Task:</p>
        <p className="text-gray-800 text-sm">{task.task}</p>
      </div>

      {/* Compact Details */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div>
          <p className="text-xs text-gray-500">Ward</p>
          <p className="text-sm font-medium">{task.ward_type || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Bed</p>
          <p className="text-sm font-medium">{task.bed_no || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Shift</p>
          <p className="text-sm font-medium">{task.shift || 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Assigned To</p>
          <p className="text-sm font-medium">{getAssignedPerson() || 'N/A'}</p>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t pt-3 mb-4">
          {task.reminder && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Reminder:</p>
              <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{task.reminder}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500">Start Date</p>
              <p className="text-sm font-medium">
                {task.start_date ? new Date(task.start_date).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Planned Time</p>
              <p className="text-sm font-medium">
                {task.plannedTimeFormatted || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Complete Button */}
      <button
        onClick={() => onComplete(task.id, getTableName())}
        disabled={completingTask === task.id}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors ${completingTask === task.id ? 'opacity-50 cursor-not-allowed' : ''
          }`}
      >
        {completingTask === task.id ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Completing...
          </>
        ) : (
          <>
            <CheckCircle className="w-4 h-4" />
            Mark as Complete
          </>
        )}
      </button>
    </div>
  );
};

export default function GivenTask() {
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState('nurse');
  const [nurseTasks, setNurseTasks] = useState([]);
  const [rmoTasks, setRmoTasks] = useState([]);
  const [otTasks, setOtTasks] = useState([]);
  const [dressingTasks, setDressingTasks] = useState([]);
  const [loading, setLoading] = useState({
    nurse: true,
    rmo: true,
    ot: true,
    dressing: true
  });
  const [completingTask, setCompletingTask] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showOtCompletionModal, setShowOtCompletionModal] = useState(false);
  const [selectedOtTask, setSelectedOtTask] = useState(null);
  const [otCompletionType, setOtCompletionType] = useState('surgical');

  // Vitals Check Modal State
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [selectedVitalsTask, setSelectedVitalsTask] = useState(null);
  const [vitalsData, setVitalsData] = useState({
    "Blood Pressure": false,
    "Pulse rate": false,
    "Temperature": false,
    "SPO2": false,
    "RR": false
  });

  // Get IPD number from parent component context
  const { ipdNumber } = useOutletContext();

  // Get user role from localStorage on component mount
  useEffect(() => {
    const storedUser = localStorage.getItem('mis_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const role = user.role || '';
        const name = user.name || '';

        setUserRole(role);
        setUserName(name);

        // Set initial active tab based on role
        if (role) {
          const lowerRole = role.toLowerCase();
          if (lowerRole === 'nurse') setActiveTab('nurse');
          else if (lowerRole === 'rmo') setActiveTab('rmo');
          else if (lowerRole === 'ot' || lowerRole === 'ot staff') setActiveTab('ot');
          else if (lowerRole === 'dressing' || lowerRole === 'dressing staff') setActiveTab('dressing');
        }
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    }
  }, []);

  // Get available tabs based on user role - SINGLE TAB ONLY
  const getAvailableTabs = () => {
    if (!userRole) {
      // If no role, show all tabs (fallback)
      return [
        { key: 'nurse', label: 'Nurse ', icon: User, count: nurseTasks.length },
        { key: 'rmo', label: 'RMO ', icon: Stethoscope, count: rmoTasks.length },
        { key: 'ot', label: 'OT ', icon: Scissors, count: otTasks.length },



        { key: 'dressing', label: 'Dressing ', icon: Syringe, count: dressingTasks.length }
      ];
    }

    const role = userRole.toLowerCase();

    // Return only ONE tab based on role
    if (role.includes('nurse')) {
      return [{ key: 'nurse', label: 'Nurse', icon: User, count: nurseTasks.length }];
    }

    if (role.includes('rmo')) {
      return [{ key: 'rmo', label: 'RMO ', icon: Stethoscope, count: rmoTasks.length }];
    }

    if (role.includes('ot')) {
      return [{ key: 'ot', label: 'OT ', icon: Scissors, count: otTasks.length }];
    }

    if (role.includes('dressing')) {
      return [{ key: 'dressing', label: 'Dressing ', icon: Syringe, count: dressingTasks.length }];
    }

    // If no specific role match, show all tabs
    return [
      { key: 'nurse', label: 'Nurse ', icon: User, count: nurseTasks.length },
      { key: 'rmo', label: 'RMO ', icon: Stethoscope, count: rmoTasks.length },
      { key: 'ot', label: 'OT ', icon: Scissors, count: otTasks.length },
      { key: 'dressing', label: 'Dressing ', icon: Syringe, count: dressingTasks.length }
    ];
  };

  // Calculate delay status
  const calculateDelayStatus = (task) => {
    if (!task.planned1) return 'No Delay';

    const planned = new Date(task.planned1);
    const now = new Date();

    if (task.actual1) {
      const actual = new Date(task.actual1);
      const diffHours = (actual - planned) / (1000 * 60 * 60);
      return diffHours > 2 ? 'Delayed' : 'On Time';
    } else {
      const diffHours = (now - planned) / (1000 * 60 * 60);
      if (diffHours > 0) {
        return `Delayed by ${Math.floor(diffHours)}h`;
      } else {
        return 'On Time';
      }
    }
  };

  // Fetch nurse tasks with IPD filter
  // Fetch nurse tasks with IPD filter
  const fetchNurseTasks = async () => {
    try {
      setLoading(prev => ({ ...prev, nurse: true }));

      let query = supabase
        .from('nurse_assign_task')
        .select('*')
        .not('planned1', 'is', null)
        .is('actual1', null)
        .or('staff.is.null,staff.eq.nurse')  // ← ADD THIS LINE to exclude OT Staff
        .order('planned1', { ascending: true });

      // Add IPD filter only if we have a valid IPD number
      if (ipdNumber && ipdNumber !== 'N/A') {
        query = query.eq('Ipd_number', ipdNumber);
      }

      // Filter by nurse name if role is nurse
      if (userRole && userRole.toLowerCase().includes('nurse') && userName) {
        query = query.ilike('assign_nurse', userName);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedTasks = (data || []).map(task => ({
        id: task.id,
        task_no: task.task_no || `NT-${task.id.toString().padStart(3, '0')}`,
        ipd_number: task.Ipd_number,
        patient_name: task.patient_name,
        task: task.task,
        assign_nurse: task.assign_nurse,
        shift: task.shift,
        reminder: task.reminder,
        start_date: task.start_date,
        planned1: task.planned1,
        actual1: task.actual1,
        ward_type: task.ward_type,
        patient_location: task.patient_location,
        room: task.room,
        bed_no: task.bed_no,
        plannedTimeFormatted: task.planned1 ? new Date(task.planned1).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
        delayStatus: calculateDelayStatus(task),
        status: task.actual1 ? 'Completed' : 'Pending'
      }));

      setNurseTasks(formattedTasks);
    } catch (error) {
      console.error('Error fetching nurse tasks:', error);
      setNurseTasks([]);
    } finally {
      setLoading(prev => ({ ...prev, nurse: false }));
    }
  };

  // Fetch RMO tasks with IPD filter
  const fetchRmoTasks = async () => {
    try {
      setLoading(prev => ({ ...prev, rmo: true }));

      let query = supabase
        .from('rmo_assign_task')
        .select('*')
        .not('planned1', 'is', null)
        .is('actual1', null)
        .order('planned1', { ascending: true });

      // Add IPD filter only if we have a valid IPD number
      if (ipdNumber && ipdNumber !== 'N/A') {
        query = query.eq('ipd_number', ipdNumber);
      }

      // Filter by RMO name if role is rmo
      if (userRole && userRole.toLowerCase().includes('rmo') && userName) {
        query = query.ilike('assign_rmo', userName);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedTasks = (data || []).map(task => ({
        id: task.id,
        task_no: task.task_no || `RMO-${task.id.toString().padStart(3, '0')}`,
        ipd_number: task.ipd_number,
        patient_name: task.patient_name,
        task: task.task,
        assign_rmo: task.assign_rmo,
        shift: task.shift,
        reminder: task.reminder,
        start_date: task.start_date,
        planned1: task.planned1,
        actual1: task.actual1,
        ward_type: task.ward_type,
        patient_location: task.patient_location,
        room: task.room,
        bed_no: task.bed_no,
        plannedTimeFormatted: task.planned1 ? new Date(task.planned1).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
        delayStatus: calculateDelayStatus(task),
        status: task.actual1 ? 'Completed' : 'Pending'
      }));

      setRmoTasks(formattedTasks);
    } catch (error) {
      console.error('Error fetching RMO tasks:', error);
      setRmoTasks([]);
    } finally {
      setLoading(prev => ({ ...prev, rmo: false }));
    }
  };

  // Fetch OT tasks with IPD filter
  const fetchOtTasks = async () => {
    try {
      setLoading(prev => ({ ...prev, ot: true }));

      let query = supabase
        .from('nurse_assign_task')
        .select('*')
        .eq('staff', 'OT Staff')
        .not('planned1', 'is', null)
        .is('actual1', null)
        .order('planned1', { ascending: true });

      // Add IPD filter only if we have a valid IPD number
      if (ipdNumber && ipdNumber !== 'N/A') {
        query = query.eq('Ipd_number', ipdNumber);
      }

      // Filter by nurse/staff name if role is OT
      if (userRole && userRole.toLowerCase().includes('ot') && userName) {
        query = query.ilike('assign_nurse', userName);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedTasks = (data || []).map(task => ({
        id: task.id,
        task_no: task.task_no || `OT-${task.id.toString().padStart(3, '0')}`,
        ipd_number: task.Ipd_number,
        patient_name: task.patient_name,
        task: task.task,
        assign_nurse: task.assign_nurse,
        staff: task.staff,
        shift: task.shift,
        reminder: task.reminder,
        start_date: task.start_date,
        planned1: task.planned1,
        actual1: task.actual1,
        ward_type: task.ward_type,
        patient_location: task.patient_location,
        room: task.room,
        bed_no: task.bed_no,
        plannedTimeFormatted: task.planned1 ? new Date(task.planned1).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
        delayStatus: calculateDelayStatus(task),
        status: task.actual1 ? 'Completed' : 'Pending'
      }));

      setOtTasks(formattedTasks);
    } catch (error) {
      console.error('Error fetching OT tasks:', error);
      setOtTasks([]);
    } finally {
      setLoading(prev => ({ ...prev, ot: false }));
    }
  };

  // Fetch Dressing tasks with IPD filter
  const fetchDressingTasks = async () => {
    try {
      setLoading(prev => ({ ...prev, dressing: true }));

      let query = supabase
        .from('dressing')
        .select('*')
        .not('planned1', 'is', null)
        .is('actual1', null)
        .order('planned1', { ascending: true });

      // Add IPD filter only if we have a valid IPD number
      if (ipdNumber && ipdNumber !== 'N/A') {
        query = query.eq('ipd_number', ipdNumber);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedTasks = (data || []).map(task => ({
        id: task.id,
        task_no: task.task_no || `DR-${task.id.toString().padStart(3, '0')}`,
        ipd_number: task.ipd_number,
        patient_name: task.patient_name,
        task: task.task,
        assign_nurse: task.assign_nurse,
        assign_rmo: task.assign_rmo,
        shift: task.shift,
        reminder: task.reminder,
        start_date: task.start_date,
        planned1: task.planned1,
        actual1: task.actual1,
        status: task.status || 'Pending',
        ward_type: task.ward_type,
        patient_location: task.patient_location,
        room: task.room,
        bed_no: task.bed_no,
        plannedTimeFormatted: task.planned1 ? new Date(task.planned1).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
        delayStatus: calculateDelayStatus(task)
      }));

      setDressingTasks(formattedTasks);
    } catch (error) {
      console.error('Error fetching dressing tasks:', error);
      setDressingTasks([]);
    } finally {
      setLoading(prev => ({ ...prev, dressing: false }));
    }
  };

  // Fetch tasks based on user role
  useEffect(() => {
    // Wait until user info is loaded from localStorage
    if (!userRole) return;

    const role = userRole.toLowerCase();

    if (role.includes('nurse')) {
      fetchNurseTasks();
      fetchDressingTasks();
      fetchRmoTasks();
      fetchOtTasks();
    } else if (role.includes('rmo')) {
      fetchRmoTasks();
      fetchDressingTasks();
      fetchNurseTasks();
      fetchOtTasks();
    } else if (role.includes('ot')) {
      fetchOtTasks();
      fetchNurseTasks();
      fetchRmoTasks();
      fetchDressingTasks();
    } else if (role.includes('dressing')) {
      fetchDressingTasks();
      fetchNurseTasks();
      fetchRmoTasks();
      fetchOtTasks();
    } else {
      // For admin or other roles, fetch all tasks without specific filtering
      fetchNurseTasks();
      fetchRmoTasks();
      fetchOtTasks();
      fetchDressingTasks();
    }
  }, [userRole, userName, ipdNumber]);

  // Handle completing a task
  const handleCompleteTask = async (taskId, tableName) => {
    try {
      // Check if this is a Vitals Check task in the nurse section
      const taskToCheck = getCurrentTasks().find(t => t.id === taskId);

      // Trigger Vitals Modal for Nurse Vitals Check tasks
      if (activeTab === 'nurse' && taskToCheck && (
        taskToCheck.task?.toLowerCase().includes("vitals check") ||
        taskToCheck.task?.toLowerCase().includes("bp, pulse, temp,spo2,rr")
      )) {
        setSelectedVitalsTask(taskToCheck);
        setVitalsData({
          bloodPressure: '',
          pulseRate: '',
          temperature: '',
          spo2: '',
          rr: ''
        });
        setShowVitalsModal(true);
        return;
      }

      // Check if this is an OT Information task in the RMO section
      if (activeTab === 'rmo' && taskToCheck && (taskToCheck.task === "OT Information" || taskToCheck.task?.toLowerCase().includes("ot information"))) {
        setSelectedOtTask(taskToCheck);
        setOtCompletionType('surgical');
        setShowOtCompletionModal(true);
        return;
      }

      setCompletingTask(taskId);

      // Create update data with Indian timezone format
      const updateData = {
        // status: 'Completed',
        actual1: new Date().toLocaleString("en-CA", {
          timeZone: "Asia/Kolkata",
          hour12: false
        }).replace(',', ''),
        submitted_by: userName // Add submitted_by field
      };

      // Special handling for different tables
      // if (tableName === 'nurse_assign_task') {
      //   updateData.status = 'Completed';
      // } else if (tableName === 'rmo_assign_task') {
      //   // RMO table might have different field names
      //   updateData.status = 'Completed';
      // }
      // For dressing table, we're already setting status above

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      // Update local state based on active tab
      if (activeTab === 'nurse') {
        setNurseTasks(prev => prev.filter(task => task.id !== taskId));
      } else if (activeTab === 'rmo') {
        setRmoTasks(prev => prev.filter(task => task.id !== taskId));
      } else if (activeTab === 'ot') {
        setOtTasks(prev => prev.filter(task => task.id !== taskId));
      } else if (activeTab === 'dressing') {
        setDressingTasks(prev => prev.filter(task => task.id !== taskId));
      }

      showNotification('Task marked as completed successfully!', 'success');
    } catch (error) {
      console.error('Error completing task:', error);
      showNotification('Failed to complete task. Please try again.', 'error');
    } finally {
      setCompletingTask(null);
    }
  };

  // Handle Vitals Form Submission
  const handleSubmitVitals = async () => {
    if (!selectedVitalsTask) return;

    // Validate that at least one field is filled
    const hasAnyValue = Object.values(vitalsData).some(value => value.trim() !== '');
    if (!hasAnyValue) {
      showNotification('Please enter at least one vital sign value', 'error');
      return;
    }

    try {
      setCompletingTask(selectedVitalsTask.id);

      const timestamp = new Date().toLocaleString("en-CA", {
        timeZone: "Asia/Kolkata",
        hour12: false
      }).replace(',', '');

      const { error } = await supabase
        .from('nurse_assign_task')
        .update({
          check_up: vitalsData,
          actual1: timestamp,
          submitted_by: userName // Add submitted_by field
        })
        .eq('id', selectedVitalsTask.id);

      if (error) throw error;

      // Update local state
      setNurseTasks(prev => prev.filter(task => task.id !== selectedVitalsTask.id));

      showNotification('Vitals Check saved successfully!', 'success');
      setShowVitalsModal(false);
      setSelectedVitalsTask(null);
    } catch (error) {
      console.error('Error saving vitals:', error);
      showNotification('Failed to save vitals. Please try again.', 'error');
    } finally {
      setCompletingTask(null);
    }
  };

  // Handle OT Information Completion
  const handleOtCompletion = async () => {
    if (!selectedOtTask) return;

    try {
      setCompletingTask(selectedOtTask.id);

      const timestamp = new Date().toLocaleString("en-CA", {
        timeZone: "Asia/Kolkata",
        hour12: false
      }).replace(',', '');

      // Prepare update data for rmo_assign_task table
      let updateData = {
        actual1: timestamp,
        ot_information: otCompletionType,
        submitted_by: userName // Add submitted_by field
      };

      // For surgical type, post to ot_information table
      if (otCompletionType === 'surgical') {
        const otInformationData = {
          timestamp: timestamp,
          ipd_number: selectedOtTask.ipd_number || null,
          patient_name: selectedOtTask.patient_name || null,
          patient_location: selectedOtTask.patient_location || null,
          ward_type: selectedOtTask.ward_type || null,
          room: selectedOtTask.room || null,
          bed_no: selectedOtTask.bed_no || null,
          planned1: timestamp,
          submitted_by: userName // Add submitted_by field
        };

        const { error: otError } = await supabase
          .from('ot_information')
          .insert([otInformationData]);

        if (otError) throw otError;
      }

      // Update the rmo_assign_task table
      const { error } = await supabase
        .from('rmo_assign_task')
        .update(updateData)
        .eq('id', selectedOtTask.id);

      if (error) throw error;

      // Update local state
      setRmoTasks(prev => prev.filter(task => task.id !== selectedOtTask.id));

      showNotification('OT Information task completed successfully!', 'success');
      setShowOtCompletionModal(false);
      setSelectedOtTask(null);
    } catch (error) {
      console.error('Error completing OT task:', error);
      showNotification('Failed to complete OT task. Please try again.', 'error');
    } finally {
      setCompletingTask(null);
    }
  };

  const handleVitalsCheckboxChange = (field) => {
    setVitalsData(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Get current tasks based on active tab
  const getCurrentTasks = () => {
    if (activeTab === 'nurse') return nurseTasks;
    if (activeTab === 'rmo') return rmoTasks;
    if (activeTab === 'ot') return otTasks;
    if (activeTab === 'dressing') return dressingTasks;
    return [];
  };

  // Filter tasks based on search
  const getFilteredTasks = () => {
    const tasks = getCurrentTasks();

    return tasks.filter(task => {
      return (
        task.task_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.ipd_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.task?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  };

  const getCurrentLoading = () => {
    if (activeTab === 'nurse') return loading.nurse;
    if (activeTab === 'rmo') return loading.rmo;
    if (activeTab === 'ot') return loading.ot;
    if (activeTab === 'dressing') return loading.dressing;
    return false;
  };

  const getTableName = () => {
    if (activeTab === 'nurse') return 'nurse_assign_task';
    if (activeTab === 'rmo') return 'rmo_assign_task';
    if (activeTab === 'ot') return 'nurse_assign_task';
    if (activeTab === 'dressing') return 'dressing';
    return '';
  };

  const availableTabs = getAvailableTabs();
  const filteredTasks = getFilteredTasks();
  const currentLoading = getCurrentLoading();

  // Don't show loading spinner for all tabs, only for the current role's tab
  const showLoading = (loading.nurse && activeTab === 'nurse') ||
    (loading.rmo && activeTab === 'rmo') ||
    (loading.ot && activeTab === 'ot') ||
    (loading.dressing && activeTab === 'dressing');

  if (showLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-600">Loading {activeTab} tasks...</p>
          {ipdNumber && (
            <p className="text-sm text-gray-500 mt-1">For IPD: {ipdNumber}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Fixed Header Section */}
      <div className="flex-shrink-0 bg-green-600 text-white p-4 rounded-lg shadow-md">
        {/* Desktop View */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between gap-4">
            {/* Left side: Heading and icon */}
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle className="w-8 h-8 flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold truncate">Task Completion</h1>
                <p className="text-xs opacity-90 mt-1 truncate">
                  {ipdNumber && ipdNumber !== 'N/A'
                    ? `${userRole ? userRole.toUpperCase() + ' - ' : ''}IPD: ${ipdNumber}`
                    : userRole
                      ? `${userRole.toUpperCase()} Tasks`
                      : 'Complete assigned tasks'}
                </p>
              </div>
            </div>

            {/* Right side: Tabs and Search */}
            <div className="flex items-center gap-3 flex-1 justify-end">
              {/* Tabs */}
              {availableTabs.length > 0 && (
                <div className="flex items-center bg-white/20 rounded-lg p-1 overflow-x-auto">
                  <div className="flex items-center gap-1 flex-nowrap whitespace-nowrap">
                    {availableTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors flex-shrink-0 ${activeTab === tab.key
                          ? 'bg-white text-green-600'
                          : 'text-white hover:bg-white/30'
                          }`}
                      >
                        <tab.icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full min-w-5 ${activeTab === tab.key ? 'bg-green-600 text-white' : 'bg-white/20 text-white'
                          }`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Input */}
              <div className="relative flex-shrink-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-300 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48 pl-9 pr-3 py-2 bg-white/10 border border-green-400 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent placeholder-green-300 text-white text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile View */}
        <div className="md:hidden">
          <div className="flex flex-col gap-3">
            {/* Title Row */}
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold truncate">Task Completion</h1>
                <p className="text-xs opacity-90 mt-1 truncate">
                  {ipdNumber && ipdNumber !== 'N/A'
                    ? `${userRole ? userRole.toUpperCase() + ' - ' : ''}IPD: ${ipdNumber}`
                    : userRole
                      ? `${userRole.toUpperCase()} Tasks`
                      : 'Complete assigned tasks'}
                </p>
              </div>
            </div>

            {/* Mobile Tabs and Search */}
            <div className="flex flex-col gap-2">
              {availableTabs.length > 0 && (
                <div className="flex overflow-x-auto bg-white/20 rounded-lg p-1 gap-1">
                  {availableTabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${activeTab === tab.key
                        ? 'bg-white text-green-600'
                        : 'text-white hover:bg-white/30'
                        }`}
                    >
                      <tab.icon className="w-3 h-3" />
                      <span>{tab.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full min-w-5 ${activeTab === tab.key ? 'bg-green-600 text-white' : 'bg-white/20 text-white'
                        }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-300 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white/10 border border-green-400 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent placeholder-green-300 text-white text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Height Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden mt-2">
        {/* Desktop Table View */}
        <div className="hidden md:block h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
          {filteredTasks.length > 0 ? (
            <div className="h-full overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 z-10 bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Action</th>
                    <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Task No</th>
                    <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Patient</th>
                    <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">IPD No</th>
                    {activeTab !== 'dressing' && (
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Task</th>
                    )}
                    {activeTab === 'nurse' && (
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Nurse</th>
                    )}
                    {activeTab === 'rmo' && (
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">RMO</th>
                    )}
                    {activeTab === 'ot' && (
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Assigned Nurse</th>
                    )}

                    {activeTab !== 'dressing' && (
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Shift</th>
                    )}
                    <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Ward</th>
                    <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Bed</th>
                    {activeTab !== 'dressing' && (
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Start Date</th>
                    )}
                    <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Planned Time</th>
                    <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleCompleteTask(task.id, getTableName())}
                          disabled={completingTask === task.id}
                          className={`flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium transition-colors ${completingTask === task.id ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                          {completingTask === task.id ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                              Completing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              Complete
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-green-600 whitespace-nowrap">{task.task_no}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 whitespace-nowrap">{task.patient_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-700 whitespace-nowrap">{task.ipd_number}</span>
                      </td>
                      {activeTab !== 'dressing' && (
                        <td className="px-4 py-3">
                          <div className="text-gray-700">{task.task}</div>
                          {task.reminder && (
                            <div className="text-xs text-gray-500 truncate max-w-xs mt-1">
                              {task.reminder}
                            </div>
                          )}
                        </td>
                      )}
                      {activeTab === 'nurse' && (
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{task.assign_nurse}</td>
                      )}
                      {activeTab === 'rmo' && (
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{task.assign_rmo}</td>
                      )}
                      {activeTab === 'ot' && (
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{task.assign_nurse || task.staff}</td>
                      )}

                      {activeTab !== 'dressing' && (
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium whitespace-nowrap">
                            {task.shift}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{task.ward_type}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{task.bed_no}</td>
                      {activeTab !== 'dressing' && (
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-500 whitespace-nowrap">
                            {task.start_date ? new Date(task.start_date).toLocaleDateString() : 'N/A'}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {task.plannedTimeFormatted}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={task.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-4">
              {activeTab === 'nurse' && <User className="w-12 h-12 text-gray-300 mb-3" />}
              {activeTab === 'rmo' && <Stethoscope className="w-12 h-12 text-gray-300 mb-3" />}
              {activeTab === 'ot' && <Scissors className="w-12 h-12 text-gray-300 mb-3" />}
              {activeTab === 'dressing' && <Syringe className="w-12 h-12 text-gray-300 mb-3" />}
              <p className="text-gray-600 font-medium text-center">
                No pending {activeTab === 'nurse' ? 'nurse' : activeTab === 'rmo' ? 'RMO' : activeTab === 'ot' ? 'OT' : 'dressing'} tasks found
              </p>
              <p className="text-gray-500 text-xs text-center mt-1 max-w-md">
                {ipdNumber && ipdNumber !== 'N/A'
                  ? `No ${activeTab === 'nurse' ? 'nurse' : activeTab === 'rmo' ? 'RMO' : activeTab === 'ot' ? 'OT' : 'dressing'} tasks found for IPD: ${ipdNumber}`
                  : searchTerm
                    ? 'No tasks match your search'
                    : 'All tasks are completed or no tasks assigned'}
              </p>
            </div>
          )}
        </div>

        {/* Mobile Card View - Fixed Scrollable Area */}
        <div className="md:hidden h-full overflow-hidden">
          {filteredTasks.length > 0 ? (
            <div className="h-full overflow-y-auto pb-20">
              <div className="p-2 space-y-2">
                {/* Results count indicator */}
                <div className="px-2 py-1 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">
                    Showing <span className="font-semibold">{filteredTasks.length}</span> task{filteredTasks.length !== 1 ? 's' : ''}
                    {searchTerm && (
                      <span> for "<span className="font-semibold">{searchTerm}</span>"</span>
                    )}
                  </p>
                </div>

                {/* Task Cards */}
                {filteredTasks.map((task) => (
                  <MobileTaskCard
                    key={task.id}
                    task={task}
                    activeTab={activeTab}
                    onComplete={handleCompleteTask}
                    completingTask={completingTask}
                    getTableName={getTableName}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6">
              <div className="text-center">
                {activeTab === 'nurse' && <User className="w-16 h-16 text-gray-300 mb-4 mx-auto" />}
                {activeTab === 'rmo' && <Stethoscope className="w-16 h-16 text-gray-300 mb-4 mx-auto" />}
                {activeTab === 'ot' && <Scissors className="w-16 h-16 text-gray-300 mb-4 mx-auto" />}
                {activeTab === 'dressing' && <Syringe className="w-16 h-16 text-gray-300 mb-4 mx-auto" />}
                <p className="text-gray-600 font-medium text-center text-sm">
                  No pending {activeTab === 'nurse' ? 'nurse' : activeTab === 'rmo' ? 'RMO' : activeTab === 'ot' ? 'OT' : 'dressing'} tasks found
                </p>
                <p className="text-gray-500 text-xs text-center mt-2">
                  {ipdNumber && ipdNumber !== 'N/A'
                    ? `No tasks found for IPD: ${ipdNumber}`
                    : searchTerm
                      ? 'No tasks match your search'
                      : 'All tasks are completed'}
                </p>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="mt-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Search Info Bar */}
      {showMobileSearch && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-green-600 text-white p-3 border-t border-green-500 z-20">
          <div className="flex items-center justify-between">
            <div className="text-xs">
              <span className="font-medium">{filteredTasks.length}</span> tasks found
            </div>
            <button
              onClick={() => setShowMobileSearch(false)}
              className="flex items-center gap-1 text-sm bg-white/20 px-3 py-1 rounded-lg"
            >
              <X className="w-3 h-3" />
              Close
            </button>
          </div>
        </div>
      )}

      {/* Vitals Check Modal */}
      {showVitalsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-in fade-in duration-200">
            <div className="p-4 border-b flex justify-between items-center bg-green-50 rounded-t-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-lg text-gray-800">Vitals Check</h3>
              </div>
              <button
                onClick={() => setShowVitalsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={completingTask === selectedVitalsTask?.id}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600 font-medium">Record performed vitals:</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Blood Pressure
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 120/80"
                    value={vitalsData.bloodPressure}
                    onChange={(e) => setVitalsData(prev => ({ ...prev, bloodPressure: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    disabled={completingTask === selectedVitalsTask?.id}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pulse Rate (bpm)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 72"
                    value={vitalsData.pulseRate}
                    onChange={(e) => setVitalsData(prev => ({ ...prev, pulseRate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    disabled={completingTask === selectedVitalsTask?.id}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temperature (°F)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 98.6"
                    value={vitalsData.temperature}
                    onChange={(e) => setVitalsData(prev => ({ ...prev, temperature: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    disabled={completingTask === selectedVitalsTask?.id}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SPO2 (%)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 98"
                    value={vitalsData.spo2}
                    onChange={(e) => setVitalsData(prev => ({ ...prev, spo2: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    disabled={completingTask === selectedVitalsTask?.id}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Respiratory Rate (breaths/min)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 16"
                    value={vitalsData.rr}
                    onChange={(e) => setVitalsData(prev => ({ ...prev, rr: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    disabled={completingTask === selectedVitalsTask?.id}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t flex gap-3 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setShowVitalsModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                disabled={completingTask === selectedVitalsTask?.id}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitVitals}
                disabled={completingTask === selectedVitalsTask?.id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm transition-all disabled:opacity-50 shadow-sm shadow-green-200"
              >
                {completingTask === selectedVitalsTask?.id ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OT Completion Modal */}
      {showOtCompletionModal && selectedOtTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-emerald-100">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Scissors className="w-6 h-6 text-green-600" />
                Complete OT Information Task
              </h2>
              <button
                onClick={() => setShowOtCompletionModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OT Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setOtCompletionType('surgical')}
                      className={`p-4 rounded-lg border-2 transition-all ${otCompletionType === 'surgical'
                        ? 'bg-red-50 border-red-500 text-red-700'
                        : 'bg-white border-gray-200 hover:border-red-300'}`}
                    >
                      <div className="font-medium">Surgical</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOtCompletionType('non-surgical')}
                      className={`p-4 rounded-lg border-2 transition-all ${otCompletionType === 'non-surgical'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-200 hover:border-blue-300'}`}
                    >
                      <div className="font-medium">Non-Surgical</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowOtCompletionModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleOtCompletion}
                disabled={completingTask !== null}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {completingTask !== null ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Complete Task
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}