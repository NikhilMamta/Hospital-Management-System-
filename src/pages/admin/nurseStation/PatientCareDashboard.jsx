import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  Search,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Bed,
  ClipboardList,
  Timer,
  TrendingUp,
  Filter,
  RefreshCw
} from 'lucide-react';
import supabase from '../../../SupabaseClient';
import useRealtimeTable from '../../../hooks/useRealtimeTable';
import { useNotification } from '../../../contexts/NotificationContext';

// ─── Helpers ───────────────────────────────────────────────
const formatDateTime = (dateStr) => {
  if (!dateStr) return { date: '—', time: '—' };
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  };
};

const computeDelay = (planned, actual) => {
  if (!planned || !actual) return null;
  const diffMs = new Date(actual) - new Date(planned);
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin <= 0) return { text: 'On Time', minutes: 0, isDelayed: false };
  if (diffMin < 60) return { text: `${diffMin}m late`, minutes: diffMin, isDelayed: true };
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return { text: `${hrs}h ${mins}m late`, minutes: diffMin, isDelayed: true };
};

const getTaskStatus = (task) => {
  if (task.planned1 && task.actual1) return 'Completed';
  return 'Pending';
};

// ─── Sub-components ────────────────────────────────────────

const SummaryCard = ({ icon: Icon, label, value, color, borderColor, bgColor }) => (
  <div className={`${bgColor} p-4 rounded-xl border ${borderColor} transition-all hover:shadow-md`}>
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} bg-opacity-20 flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      </div>
    </div>
  </div>
);

const TaskRow = ({ task, index }) => {
  const status = getTaskStatus(task);
  const planned = formatDateTime(task.planned1);
  const actual = formatDateTime(task.actual1);
  const delay = computeDelay(task.planned1, task.actual1);

  return (
    <div
      className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-0 px-4 py-3 transition-colors ${
        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
      } hover:bg-blue-50/40`}
    >
      {/* Task name + status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-800 text-sm truncate">{task.task || 'Unnamed Task'}</span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              status === 'Completed'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {status === 'Completed' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {status}
          </span>
        </div>
      </div>

      {/* Nurse */}
      <div className="md:w-36 flex items-center gap-1.5 text-xs text-gray-600">
        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="truncate">{task.assign_nurse || '—'}</span>
      </div>

      {/* Planned */}
      <div className="md:w-36 text-xs">
        <span className="text-gray-500 md:hidden font-medium">Planned: </span>
        <span className="text-gray-700">{planned.date}</span>{' '}
        <span className="text-blue-600 font-medium">{planned.time}</span>
      </div>

      {/* Actual */}
      <div className="md:w-36 text-xs">
        <span className="text-gray-500 md:hidden font-medium">Actual: </span>
        <span className="text-gray-700">{actual.date}</span>{' '}
        <span className="text-emerald-600 font-medium">{actual.time}</span>
      </div>

      {/* Delay */}
      <div className="md:w-28 text-xs">
        {delay ? (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
              delay.isDelayed
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            }`}
          >
            <Timer className="w-3 h-3" />
            {delay.text}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </div>
    </div>
  );
};

const PatientCard = ({ patient, tasks, isExpanded, onToggle }) => {
  const completed = tasks.filter(t => getTaskStatus(t) === 'Completed').length;
  const total = tasks.length;
  const pending = total - completed;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Find if any task is delayed
  const hasDelays = tasks.some(t => {
    const d = computeDelay(t.planned1, t.actual1);
    return d && d.isDelayed;
  });

  const latestTask = tasks[0]; // already sorted by timestamp desc

  return (
    <div className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${
      isExpanded ? 'shadow-lg border-blue-200 ring-1 ring-blue-100' : 'shadow-sm border-gray-200 hover:shadow-md hover:border-gray-300'
    }`}>
      {/* Card header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-4 md:px-5 md:py-4 flex items-center gap-4 focus:outline-none"
      >
        {/* Patient avatar */}
        <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
          progress === 100
            ? 'bg-emerald-100 text-emerald-700'
            : hasDelays
            ? 'bg-red-100 text-red-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
          {patient.patient_name
            ? patient.patient_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            : 'PT'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 text-sm md:text-base truncate">
              {patient.patient_name || 'Unknown Patient'}
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
              IPD: {patient.Ipd_number || 'N/A'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> Bed {patient.bed_no || 'N/A'}</span>
            <span>{patient.ward_type || ''} • {patient.room || ''}</span>
          </div>
        </div>

        {/* Progress ring + stats */}
        <div className="hidden sm:flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <CheckCircle className="w-3.5 h-3.5" /> {completed}
            </span>
            <span className="flex items-center gap-1 text-amber-600 font-semibold">
              <Clock className="w-3.5 h-3.5" /> {pending}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-24">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-bold text-gray-600">{progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progress === 100
                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                    : progress > 50
                    ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                    : 'bg-gradient-to-r from-amber-400 to-amber-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Expand icon */}
        <div className="flex-shrink-0 text-gray-400">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Mobile progress bar */}
      <div className="sm:hidden px-4 pb-3 -mt-1">
        <div className="flex items-center gap-2 text-xs mb-1">
          <span className="text-emerald-600 font-semibold">✅ {completed}</span>
          <span className="text-amber-600 font-semibold">⏳ {pending}</span>
          <span className="ml-auto text-gray-600 font-bold">{progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              progress === 100 ? 'bg-emerald-400' : progress > 50 ? 'bg-blue-400' : 'bg-amber-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Expanded task list */}
      {isExpanded && (
        <div className="border-t border-gray-100 animate-[fadeIn_0.3s_ease-out]">
          {/* Table header (desktop) */}
          <div className="hidden md:flex items-center px-4 py-2 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
            <div className="flex-1">Task</div>
            <div className="w-36">Nurse</div>
            <div className="w-36">Planned</div>
            <div className="w-36">Actual</div>
            <div className="w-28">Delay</div>
          </div>

          {/* Task rows */}
          {tasks.map((task, idx) => (
            <TaskRow key={task.id} task={task} index={idx} />
          ))}

          {/* Summary footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-gray-500">
              {completed} of {total} tasks completed
            </span>
            {hasDelays && (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Delays detected in care timeline
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard ────────────────────────────────────────

const PatientCareDashboard = () => {
  const [rawTasks, setRawTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | has-pending | all-complete
  const [expandedPatient, setExpandedPatient] = useState(null);
  const { showNotification } = useNotification();

  // ── Fetch ──
  const fetchTasks = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);

      const { data, error } = await supabase
        .from('nurse_assign_task')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setRawTasks(data || []);
    } catch (err) {
      console.error('Error loading PC dashboard data:', err);
      showNotification('Error loading patient care data', 'error');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  // Real-time
  useRealtimeTable('nurse_assign_task', () => fetchTasks(false));

  useEffect(() => {
    fetchTasks(true);
  }, [fetchTasks]);

  // ── Group by patient ──
  const patientGroups = useMemo(() => {
    const map = new Map();

    rawTasks.forEach(task => {
      const key = task.Ipd_number || `unknown-${task.id}`;
      if (!map.has(key)) {
        map.set(key, {
          patient: {
            Ipd_number: task.Ipd_number,
            patient_name: task.patient_name,
            bed_no: task.bed_no,
            ward_type: task.ward_type,
            room: task.room,
            patient_location: task.patient_location
          },
          tasks: []
        });
      }
      map.get(key).tasks.push(task);
    });

    return Array.from(map.values());
  }, [rawTasks]);

  // ── Filter ──
  const filteredGroups = useMemo(() => {
    let groups = patientGroups;

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      groups = groups.filter(g =>
        (g.patient.patient_name || '').toLowerCase().includes(q) ||
        (g.patient.Ipd_number || '').toLowerCase().includes(q) ||
        (g.patient.bed_no || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter === 'has-pending') {
      groups = groups.filter(g => g.tasks.some(t => getTaskStatus(t) === 'Pending'));
    } else if (statusFilter === 'all-complete') {
      groups = groups.filter(g => g.tasks.every(t => getTaskStatus(t) === 'Completed'));
    }

    return groups;
  }, [patientGroups, searchTerm, statusFilter]);

  // ── Summary stats ──
  const stats = useMemo(() => {
    const totalPatients = patientGroups.length;
    const totalTasks = rawTasks.length;
    const completed = rawTasks.filter(t => getTaskStatus(t) === 'Completed').length;
    const pending = totalTasks - completed;
    const delayed = rawTasks.filter(t => {
      const d = computeDelay(t.planned1, t.actual1);
      return d && d.isDelayed;
    }).length;

    return { totalPatients, totalTasks, completed, pending, delayed };
  }, [rawTasks, patientGroups]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="p-4 sm:p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">Loading Patient Care Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <Activity className="w-7 h-7 text-blue-600" />
              Patient Care Dashboard
            </h1>
            <p className="text-gray-500 text-sm mt-1">Real-time overview of patient care progress</p>
          </div>
          <button
            onClick={() => fetchTasks(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <SummaryCard
            icon={Users}
            label="Patients"
            value={stats.totalPatients}
            color="bg-blue-500"
            borderColor="border-blue-100"
            bgColor="bg-gradient-to-br from-blue-50 to-white"
          />
          <SummaryCard
            icon={ClipboardList}
            label="Total Tasks"
            value={stats.totalTasks}
            color="bg-violet-500"
            borderColor="border-violet-100"
            bgColor="bg-gradient-to-br from-violet-50 to-white"
          />
          <SummaryCard
            icon={CheckCircle}
            label="Completed"
            value={stats.completed}
            color="bg-emerald-500"
            borderColor="border-emerald-100"
            bgColor="bg-gradient-to-br from-emerald-50 to-white"
          />
          <SummaryCard
            icon={Clock}
            label="Pending"
            value={stats.pending}
            color="bg-amber-500"
            borderColor="border-amber-100"
            bgColor="bg-gradient-to-br from-amber-50 to-white"
          />
          <SummaryCard
            icon={AlertCircle}
            label="Delayed"
            value={stats.delayed}
            color="bg-red-500"
            borderColor="border-red-100"
            bgColor="bg-gradient-to-br from-red-50 to-white"
          />
        </div>

        {/* ── Search & Filter ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by patient name, IPD number, or bed..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {[
                { key: 'all', label: 'All' },
                { key: 'has-pending', label: 'Has Pending' },
                { key: 'all-complete', label: 'All Complete' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === f.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Patient Cards ── */}
        <div className="space-y-3">
          {filteredGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-600">No patients found</h3>
              <p className="text-sm text-gray-400 mt-1">
                {searchTerm ? 'Try a different search term' : 'No task data available yet'}
              </p>
            </div>
          ) : (
            filteredGroups.map(group => (
              <PatientCard
                key={group.patient.Ipd_number || group.tasks[0]?.id}
                patient={group.patient}
                tasks={group.tasks}
                isExpanded={expandedPatient === (group.patient.Ipd_number || group.tasks[0]?.id)}
                onToggle={() =>
                  setExpandedPatient(prev =>
                    prev === (group.patient.Ipd_number || group.tasks[0]?.id)
                      ? null
                      : (group.patient.Ipd_number || group.tasks[0]?.id)
                  )
                }
              />
            ))
          )}
        </div>

        {/* ── Footer count ── */}
        {filteredGroups.length > 0 && (
          <div className="text-center text-xs text-gray-400 pb-2">
            Showing {filteredGroups.length} of {patientGroups.length} patients •{' '}
            {rawTasks.length} total tasks
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientCareDashboard;
