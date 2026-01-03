import React, { useState, useEffect } from 'react';
import { Scissors, Search, User, ChevronDown, ChevronUp } from 'lucide-react';
import supabase from '../../../SupabaseClient';
import { useOutletContext } from 'react-router-dom';

const StatusBadge = ({ status }) => {
  const getColors = () => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'Delayed': return 'bg-red-100 text-red-700 border-red-200';
      case 'On Time': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getColors()}`}>
      {status}
    </span>
  );
};

const OTTypeBadge = ({ otType }) => {
  const getColors = () => {
    const otTypeLower = otType?.toLowerCase() || '';
    if (otTypeLower.includes('pre')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (otTypeLower.includes('post')) return 'bg-teal-100 text-teal-700 border-teal-200';
    if (otTypeLower.includes('discharge')) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getColors()}`}>
      {otType || 'OT Staff'}
    </span>
  );
};

export default function OT() {
  const [pendingList, setPendingList] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [activeTab, setActiveTab] = useState('history');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterShift, setFilterShift] = useState('all');
  const [expandedCard, setExpandedCard] = useState(null);

  // Get IPD number from parent component context
  const { ipdNumber } = useOutletContext();

  // Fetch OT tasks from Supabase
  const fetchOTTasks = async () => {
    try {
      setLoading(true);

      console.log('Fetching OT tasks for IPD:', ipdNumber);

      // Build query based on whether IPD number is available
      let query = supabase
        .from('nurse_assign_task')
        .select('*')
        .or('staff.eq.OT Staff,staff.eq.ot staff')
        .order('timestamp', { ascending: false });

      // Add IPD filter only if we have a valid IPD number
      if (ipdNumber && ipdNumber !== 'N/A') {
        query = query.eq('Ipd_number', ipdNumber);
      }

      const { data: supabaseTasks, error } = await query;

      if (error) {
        console.error('Error fetching OT tasks:', error);
        loadFromLocalStorage();
        return;
      }

      // Transform Supabase data to match our format
      const transformedTasks = (supabaseTasks || []).map(task => ({
        id: task.id,
        taskId: `OT-${task.id}`,
        taskNo: task.task_no || `OT-${String(task.id).padStart(3, '0')}`,
        ipdNumber: task.Ipd_number || '',
        patientName: task.patient_name || '',
        taskName: task.task || 'OT Task',
        priority: 'Medium',
        shift: task.shift || 'General',
        wardType: task.ward_type || '',
        room: task.room || '',
        bedNo: task.bed_no || '',
        assignBy: 'Admin',
        nurseName: task.assign_nurse || 'OT Nurse',
        instructions: task.reminder || '',
        status: task.actual1 ? 'Completed' : 'Pending',
        plannedTime: task.planned1 ? new Date(task.planned1).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
        actualTime: task.actual1 ? new Date(task.actual1).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
        delayStatus: task.planned1 && task.actual1 ?
          (new Date(task.actual1) > new Date(task.planned1) ? 'Delayed' : 'On Time') : 'Pending',
        otType: task.staff || 'OT Staff',
        supabaseData: {
          id: task.id,
          timestamp: task.timestamp,
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
          planned1: task.planned1,
          actual1: task.actual1,
          staff: task.staff
        }
      }));

      // Separate pending and completed tasks
      const pending = transformedTasks.filter(task => !task.supabaseData.actual1 && task.supabaseData.planned1);
      const history = transformedTasks.filter(task => task.supabaseData.actual1 && task.supabaseData.planned1);

      setPendingList(pending);
      setHistoryList(history);

      // Update localStorage
      try {
        localStorage.setItem('otTasksPending', JSON.stringify(pending));
        localStorage.setItem('otTasksHistory', JSON.stringify(history));
      } catch (e) {
        console.error('Failed to update localStorage:', e);
      }

    } catch (err) {
      console.error('Error in fetchOTTasks:', err);
      loadFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  // Load from localStorage as fallback
  const loadFromLocalStorage = () => {
    try {
      const storedPending = localStorage.getItem('otTasksPending');
      const storedHistory = localStorage.getItem('otTasksHistory');

      if (storedPending) {
        const allPending = JSON.parse(storedPending);
        // Filter by IPD number if available
        const filteredPending = ipdNumber && ipdNumber !== 'N/A'
          ? allPending.filter(task => task.ipdNumber === ipdNumber)
          : allPending;
        setPendingList(filteredPending);
      }

      if (storedHistory) {
        const allHistory = JSON.parse(storedHistory);
        // Filter by IPD number if available
        const filteredHistory = ipdNumber && ipdNumber !== 'N/A'
          ? allHistory.filter(task => task.ipdNumber === ipdNumber)
          : allHistory;
        setHistoryList(filteredHistory);
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
    setLoading(false);
  };

  // Re-fetch tasks when IPD number changes
  useEffect(() => {
    if (ipdNumber) {
      console.log('IPD number available:', ipdNumber);
      fetchOTTasks();
    } else {
      console.log('No IPD number available, loading all tasks');
      fetchOTTasks();
    }
  }, [ipdNumber]);

  // Filter tasks based on search and filters
  const getFilteredTasks = () => {
    const tasks = activeTab === 'pending' ? pendingList : historyList;

    return tasks.filter(task => {
      // Search filter
      const matchesSearch =
        task.taskName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.ipdNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.taskNo?.toLowerCase().includes(searchTerm.toLowerCase());

      // Shift filter
      const matchesShift = filterShift === 'all' || task.shift === filterShift;

      return matchesSearch && matchesShift;
    });
  };

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
                <StatusBadge status={task.delayStatus} />
                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                  {task.shift}
                </span>
                <OTTypeBadge otType={task.otType} />
              </div>

              <h3 className="font-bold text-gray-800 text-sm mb-1">{task.taskName}</h3>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="font-medium">Patient:</span>
                  <span className="text-gray-800">{task.patientName}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="font-medium">IPD:</span>
                  <span className="text-gray-800">{task.ipdNumber}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-700">{task.nurseName}</span>
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
                  <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                  <span className="text-xs text-gray-700">{task.priority}</span>
                </div>
              </div>

              <div className="bg-gray-50 p-2 rounded">
                <label className="block text-xs font-medium text-gray-500 mb-1">Ward & Bed</label>
                <div className="text-xs text-gray-700">
                  {task.wardType} {task.room && `/ ${task.room}`}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Bed: {task.bedNo || 'N/A'}</div>
              </div>

              {task.instructions && (
                <div className="bg-gray-50 p-2 rounded">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Instructions</label>
                  <p className="text-xs text-gray-700">{task.instructions}</p>
                </div>
              )}

              {task.plannedTime && (
                <div className="bg-gray-50 p-2 rounded">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Planned Time</label>
                  <p className="text-xs text-gray-700">{task.plannedTime}</p>
                </div>
              )}

              {task.actualTime && (
                <div className="bg-gray-50 p-2 rounded">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Actual Time</label>
                  <p className="text-xs text-gray-700">{task.actualTime}</p>
                </div>
              )}
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
          <p className="text-gray-600">Loading OT tasks...</p>
          {ipdNumber && (
            <p className="text-sm text-gray-500 mt-1">For IPD: {ipdNumber}</p>
          )}
        </div>
      </div>
    );
  }

  const filteredTasks = getFilteredTasks();

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 200px)' }}>
      {/* Header */}
      <div className="flex-shrink-0 bg-green-600 text-white p-4 rounded-lg shadow-md">
        {/* Desktop View: Heading on left, tabs/search/filter on right in one row */}
        <div className="hidden md:flex md:items-center md:justify-between">
          {/* Left side: Heading and icon */}
          <div className="flex items-center gap-3">
            <Scissors className="w-8 h-8" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold">OT Tasks</h1>
              <p className="text-xs opacity-90 mt-1">
                {ipdNumber && ipdNumber !== 'N/A'
                  ? `Tasks for IPD: ${ipdNumber}`
                  : 'All OT Tasks'}
              </p>
            </div>
          </div>

          {/* Right side: Tabs, Search and Filter in one row */}
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

            {/* Shift Filter */}
            <select
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-green-400 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent text-white text-sm"
            >
              <option value="all" className="text-gray-900">All Shifts</option>
              <option value="Shift A" className="text-gray-900">Shift A</option>
              <option value="Shift B" className="text-gray-900">Shift B</option>
              <option value="Shift C" className="text-gray-900">Shift C</option>
              <option value="General" className="text-gray-900">General</option>
            </select>
          </div>
        </div>

        {/* Mobile View */}
        <div className="md:hidden">
          <div className="flex flex-col gap-3">
            {/* Title Row */}
            <div className="flex items-center gap-3">
              <Scissors className="w-8 h-8" />
              <div className="flex-1">
                <h1 className="text-xl font-bold">OT Tasks</h1>
                <p className="text-xs opacity-90 mt-1">
                  {ipdNumber && ipdNumber !== 'N/A'
                    ? `Tasks for IPD: ${ipdNumber}`
                    : 'All OT Tasks'}
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

              {/* Search and Filter in same row */}
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
                  value={filterShift}
                  onChange={(e) => setFilterShift(e.target.value)}
                  className="px-2 py-1.5 bg-white/10 border border-green-400 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent text-white text-xs w-24"
                >
                  <option value="all" className="text-gray-900">All Shifts</option>
                  <option value="Shift A" className="text-gray-900">Shift A</option>
                  <option value="Shift B" className="text-gray-900">Shift B</option>
                  <option value="Shift C" className="text-gray-900">Shift C</option>
                  <option value="General" className="text-gray-900">General</option>
                </select>
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
                  <Scissors className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-600 font-medium text-xs">
                    {activeTab === 'pending' ? 'No pending tasks found' : 'No completed tasks found'}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {ipdNumber && ipdNumber !== 'N/A'
                      ? `No OT tasks found for IPD: ${ipdNumber}`
                      : searchTerm
                        ? 'No tasks match your search'
                        : 'No tasks available'
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
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">IPD No</th>
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Task</th>
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">OT Type</th>
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Shift</th>
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Assigned Nurse</th>
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Ward/Bed</th>
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Planned Time</th>
                      {activeTab === 'history' && (
                        <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Actual Time</th>
                      )}
                      <th className="px-4 py-3 font-bold text-gray-700 uppercase text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTasks.map((task, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-green-600">{task.taskNo}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{task.patientName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-700">{task.ipdNumber}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{task.taskName}</div>
                          {task.instructions && (
                            <div className="text-xs text-gray-500 truncate max-w-xs">{task.instructions}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <OTTypeBadge otType={task.otType} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                            {task.shift}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">{task.nurseName}</span>
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
                          <StatusBadge status={task.delayStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center">
                  <Scissors className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-600 font-medium text-sm">
                    {activeTab === 'pending' ? 'No pending tasks found' : 'No completed tasks found'}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    {ipdNumber && ipdNumber !== 'N/A'
                      ? `No OT tasks found for IPD: ${ipdNumber}`
                      : searchTerm
                        ? 'No tasks match your search'
                        : 'No tasks available'
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}