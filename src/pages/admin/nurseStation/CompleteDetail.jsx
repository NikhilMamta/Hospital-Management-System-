import React, { useState, useEffect, useCallback } from 'react';
import {
    User,
    ClipboardList,
    CheckCircle,
    AlertCircle,
    Calendar,
    Bed,
    Users,
    Home,
    Award,
    TrendingUp,
    ArrowLeft
} from 'lucide-react';
import supabase from '../../../SupabaseClient';
import useRealtimeTable from '../../../hooks/useRealtimeTable';

const CompleteDetail = ({ nurseName, onClose }) => {
    const [nurseTasks, setNurseTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [summary, setSummary] = useState({
        totalTasks: 0,
        completed: 0,
        pending: 0,
        completionRate: 0
    });
    const [lastUpdated, setLastUpdated] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    const fetchNurseTasks = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const { data: tasksData, error } = await supabase
                .from('nurse_assign_task')
                .select('*')
                .eq('assign_nurse', nurseName)
                .order('timestamp', { ascending: false });

            if (error) throw error;

            if (tasksData) {
                const formattedTasks = tasksData.map(task => ({
                    id: task.id,
                    taskId: task.task_no || `TASK-${task.id.toString().padStart(4, '0')}`,
                    status: task.planned1 && task.actual1 ? 'Completed' : 'Pending',
                    patientName: task.patient_name || 'N/A',
                    patientLocation: task.patient_location || 'N/A',
                    bedNo: task.bed_no || 'N/A',
                    shift: task.shift || 'N/A',
                    taskName: task.task || 'N/A',
                    startDate: task.start_date || 'N/A',
                    planned1: task.planned1,
                    planned1Date: task.planned1 ? new Date(task.planned1).toLocaleDateString('en-GB') : 'N/A',
                    planned1Time: task.planned1 ? new Date(task.planned1).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }) : 'N/A',
                    actual1: task.actual1,
                    actual1Date: task.actual1 ? new Date(task.actual1).toLocaleDateString('en-GB') : 'N/A',
                    actual1Time: task.actual1 ? new Date(task.actual1).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }) : 'N/A',
                    reminder: task.reminder || 'No',
                    wardType: task.ward_type || 'N/A',
                    room: task.room || 'N/A',
                    ipdNumber: task.Ipd_number || 'N/A',
                }));

                setNurseTasks(formattedTasks);

                const completedTasks = formattedTasks.filter(task => task.status === 'Completed').length;
                const pendingTasks = formattedTasks.filter(task => task.status === 'Pending').length;
                const totalTasks = formattedTasks.length;
                const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                setSummary({
                    totalTasks,
                    completed: completedTasks,
                    pending: pendingTasks,
                    completionRate
                });

                setLastUpdated(new Date().toLocaleTimeString());
            }
        } catch (error) {
            console.error("Error fetching nurse tasks:", error);
            setError("Failed to load nurse tasks. Please try again.");
            setNurseTasks([]);
        } finally {
            setLoading(false);
        }
    }, [nurseName]);

    // Real-time sync: refresh tasks when any user modifies nurse_assign_task
    useRealtimeTable('nurse_assign_task', fetchNurseTasks);

    useEffect(() => {
        if (nurseName) {
            fetchNurseTasks();
        }
    }, [nurseName, fetchNurseTasks]);

    const filteredTasks = nurseTasks.filter(task => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'completed') return task.status === 'Completed';
        if (activeFilter === 'pending') return task.status === 'Pending';
        return true;
    });

    const getStatusColor = (status) => {
        if (status === 'Completed') return 'bg-green-100 text-green-800 border-green-200';
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    };

    const getShiftColor = (shift) => {
        switch (shift) {
            case 'Shift A': return 'bg-blue-100 text-blue-800';
            case 'Shift B': return 'bg-green-100 text-green-800';
            case 'Shift C': return 'bg-purple-100 text-purple-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getFilterButtonClass = (filter) => {
        const baseClass = "px-4 py-2 rounded-lg text-sm font-medium transition-colors";
        return activeFilter === filter
            ? `${baseClass} bg-blue-600 text-white`
            : `${baseClass} bg-gray-100 text-gray-700 hover:bg-gray-200`;
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading tasks for {nurseName}...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-7xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-3 md:p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-blue-100">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <User className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg md:text-xl font-bold text-gray-800">Task Details for {nurseName}</h2>
                            <p className="hidden md:block text-sm text-gray-600">Complete task history and performance</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="inline-flex items-center gap-1 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs md:text-sm font-medium transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="md:inline">Back</span>
                    </button>
                </div>

                <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-4 md:space-y-6">
                    {error ? (
                        <div className="text-center py-8">
                            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                            <p className="text-gray-600">{error}</p>
                            <button
                                onClick={fetchNurseTasks}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                                <div className="bg-blue-50 p-3 md:p-4 rounded-lg border border-blue-200">
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <ClipboardList className="w-5 h-5 md:w-8 md:h-8 text-blue-600" />
                                        <div>
                                            <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">Total</p>
                                            <h3 className="text-lg md:text-2xl font-bold text-gray-900">{summary.totalTasks}</h3>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-green-50 p-3 md:p-4 rounded-lg border border-green-200">
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <CheckCircle className="w-5 h-5 md:w-8 md:h-8 text-green-600" />
                                        <div>
                                            <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">Done</p>
                                            <h3 className="text-lg md:text-2xl font-bold text-gray-900">{summary.completed}</h3>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-orange-50 p-3 md:p-4 rounded-lg border border-orange-200">
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <AlertCircle className="w-5 h-5 md:w-8 md:h-8 text-orange-600" />
                                        <div>
                                            <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">Pending</p>
                                            <h3 className="text-lg md:text-2xl font-bold text-gray-900">{summary.pending}</h3>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-purple-50 p-3 md:p-4 rounded-lg border border-purple-200">
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <Award className="w-5 h-5 md:w-8 md:h-8 text-purple-600" />
                                        <div>
                                            <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">Rate</p>
                                            <h3 className="text-lg md:text-2xl font-bold text-gray-900">{summary.completionRate}%</h3>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Performance Chart */}
                            <div className="bg-white p-3 md:p-4 rounded-lg border border-gray-200">
                                <div className="flex justify-between items-center mb-3 md:mb-4">
                                    <h3 className="text-sm md:text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                                        Performance Overview
                                    </h3>
                                    <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-sm font-bold border ${getStatusColor('Completed').replace('bg-', 'bg-opacity-20 ')}`}>
                                        {summary.completionRate}%
                                    </span>
                                </div>
                                <div className="h-2 md:h-4 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-green-500 to-blue-500"
                                        style={{ width: `${summary.completionRate}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Filter Buttons */}
                            <div className="bg-white p-3 md:p-4 rounded-lg border border-gray-200">
                                <div className="flex justify-between items-center mb-2 md:mb-0">
                                    <h3 className="text-sm md:text-lg font-bold text-gray-800">Task Filters</h3>
                                    <div className="text-[10px] md:text-sm text-gray-600">
                                        {filteredTasks.length} / {nurseTasks.length}
                                    </div>
                                </div>
                                <div className="flex gap-1.5 md:gap-2 mt-1 md:mt-3">
                                    <button
                                        onClick={() => setActiveFilter('all')}
                                        className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-blue-600 active:text-white"
                                        style={activeFilter === 'all' ? { backgroundColor: '#2563eb', color: 'white' } : {}}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setActiveFilter('completed')}
                                        className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-blue-600 active:text-white"
                                        style={activeFilter === 'completed' ? { backgroundColor: '#2563eb', color: 'white' } : {}}
                                    >
                                        Done
                                    </button>
                                    <button
                                        onClick={() => setActiveFilter('pending')}
                                        className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-blue-600 active:text-white"
                                        style={activeFilter === 'pending' ? { backgroundColor: '#2563eb', color: 'white' } : {}}
                                    >
                                        Pending
                                    </button>
                                </div>
                            </div>

                            {/* Mobile View: Cards */}
                            <div className="md:hidden space-y-3">
                                {filteredTasks.length === 0 ? (
                                    <div className="bg-white p-8 text-center text-gray-500 border border-gray-200 rounded-lg">
                                        No {activeFilter === 'all' ? '' : activeFilter} tasks found for {nurseName}
                                    </div>
                                ) : (
                                    filteredTasks.map((task) => (
                                        <div key={task.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                            <div className="p-2 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                                                <div className="pl-1">
                                                    <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{task.taskId}</div>
                                                    <div className="font-bold text-gray-900 text-sm leading-tight">{task.taskName}</div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusColor(task.status)} mr-1 mt-1`}>
                                                    {task.status}
                                                </span>
                                            </div>

                                            <div className="p-2 space-y-2">
                                                <div className="flex items-center justify-between px-1">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${getShiftColor(task.shift)}`}>
                                                        {task.shift}
                                                    </span>
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                                        <Calendar className="w-3 h-3" />
                                                        {task.startDate}
                                                    </div>
                                                </div>

                                                <div className="bg-blue-50/50 rounded-md p-2 space-y-1">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <div className="flex items-center gap-1.5 text-gray-500">
                                                            <User className="w-3 h-3" />
                                                            Patient
                                                        </div>
                                                        <div className="font-bold text-gray-900 text-[11px]">{task.patientName}</div>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <div className="flex items-center gap-1.5 text-gray-500">
                                                            <Bed className="w-3 h-3" />
                                                            Bed / IPD
                                                        </div>
                                                        <div className="text-gray-700 text-[10px]">{task.bedNo} / {task.ipdNumber}</div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="bg-gray-50 p-1.5 rounded">
                                                        <div className="text-[9px] font-bold text-gray-400 uppercase">Planned</div>
                                                        <div className="text-[10px] font-medium text-gray-700">
                                                            <div>{task.planned1Date}</div>
                                                            <div className="text-blue-600">{task.planned1Time}</div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-green-50/50 p-1.5 rounded">
                                                        <div className="text-[9px] font-bold text-gray-400 uppercase">Actual</div>
                                                        <div className="text-[10px] font-medium text-green-700">
                                                            <div>{task.actual1Date}</div>
                                                            <div className="text-green-600">{task.actual1Time}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="pt-1.5 border-t border-gray-100 px-1">
                                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 overflow-hidden whitespace-nowrap text-ellipsis">
                                                        <Home className="w-3 h-3 flex-shrink-0" />
                                                        <span className="font-medium text-gray-700">{task.patientLocation}</span>
                                                        <span>•</span>
                                                        <span>{task.wardType}</span>
                                                        <span>•</span>
                                                        <span>{task.room}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Desktop View: Table */}
                            <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-hidden">
                                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-gray-800">
                                        {activeFilter === 'all' ? 'All Tasks' :
                                            activeFilter === 'completed' ? 'Completed Tasks' : 'Pending Tasks'}
                                        ({filteredTasks.length})
                                    </h3>
                                    <div className="text-sm text-gray-600">
                                        Last updated: {lastUpdated}
                                    </div>
                                </div>
                                <div className="overflow-x-auto max-h-96">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 text-sm">Task ID</th>
                                                <th className="px-4 py-3 text-sm">Status</th>
                                                <th className="px-4 py-3 text-sm">Shift</th>
                                                <th className="px-4 py-3 text-sm">Patient Details</th>
                                                <th className="px-4 py-3 text-sm">Planned Task</th>
                                                <th className="px-4 py-3 text-sm">Actual Task</th>
                                                <th className="px-4 py-3 text-sm">Task Details</th>
                                                <th className="px-4 py-3 text-sm">Start Date</th>
                                                <th className="px-4 py-3 text-sm">Location</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredTasks.length === 0 ? (
                                                <tr>
                                                    <td colSpan="9" className="px-4 py-12 text-center text-gray-500">
                                                        No {activeFilter === 'all' ? '' : activeFilter} tasks found for {nurseName}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredTasks.map((task) => (
                                                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-blue-600">{task.taskId}</div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(task.status)}`}>
                                                                {task.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getShiftColor(task.shift)}`}>
                                                                {task.shift}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div>
                                                                <div className="font-medium">{task.patientName}</div>
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    <div>Bed: {task.bedNo}</div>
                                                                    <div>IPD: {task.ipdNumber}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 font-medium text-gray-700">
                                                            {task.planned1Date} {task.planned1Time}
                                                        </td>
                                                        <td className="px-4 py-3 font-medium text-green-700">
                                                            {task.actual1Date} {task.actual1Time}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium">{task.taskName}</div>
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                Reminder: {task.reminder}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-1 text-sm">
                                                                <Calendar className="w-3 h-3 text-gray-400" />
                                                                {task.startDate}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="space-y-1 text-sm">
                                                                <div className="flex items-center gap-1">
                                                                    <Home className="w-3 h-3 text-gray-400" />
                                                                    {task.patientLocation}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {task.wardType} • {task.room}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Simple Shift Distribution */}

                        </>
                    )}
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                        Showing {filteredTasks.length} of {nurseTasks.length} tasks for {nurseName}
                    </div>
                    {/* <div className="flex gap-3">
                        <button
                            onClick={fetchNurseTasks}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                            Refresh Data
                        </button>
                    </div> */}
                </div>
            </div>
        </div>
    );
};

export default CompleteDetail;