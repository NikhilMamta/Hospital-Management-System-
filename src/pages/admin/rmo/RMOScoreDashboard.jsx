import React, { useState, useEffect, useCallback } from 'react';
import {
    Award,
    TrendingUp,
    Users,
    CheckCircle,
    Clock,
    AlertCircle,
    BarChart3,
    Eye,
    RefreshCw,
    User
} from 'lucide-react';
import supabase from '../../../SupabaseClient';
import RMOCompleteDetail from './RMOCompleteDetail';
import useRealtimeTable from '../../../hooks/useRealtimeTable';

const RMOScoreDashboard = () => {
    const [rmoStats, setRmoStats] = useState([]);
    const [summary, setSummary] = useState({
        totalTasks: 0,
        totalCompleted: 0,
        pendingTasks: 0,
        uniqueRmos: 0,
        avgScore: 0,
        topPerformer: 'N/A'
    });
    const [loading, setLoading] = useState(true);
    const [selectedRmo, setSelectedRmo] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('');

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            setIsRefreshing(true);

            // Fetch summary data directly from Supabase for RMO tasks
            const [
                totalTasksResult,
                pendingTasksResult,
                completedTasksResult,
                uniqueRmosResult,
                rmoStatsResult
            ] = await Promise.all([
                supabase
                    .from('rmo_assign_task')
                    .select('id', { count: 'exact', head: true }),

                supabase
                    .from('rmo_assign_task')
                    .select('id', { count: 'exact', head: true })
                    .not('planned1', 'is', null)
                    .is('actual1', null),

                supabase
                    .from('rmo_assign_task')
                    .select('id', { count: 'exact', head: true })
                    .not('planned1', 'is', null)
                    .not('actual1', 'is', null),

                supabase
                    .from('rmo_assign_task')
                    .select('assign_rmo')
                    .not('assign_rmo', 'is', null)
                    .neq('assign_rmo', ''),

                supabase
                    .from('rmo_assign_task')
                    .select('*')
                    .not('assign_rmo', 'is', null)
                    .neq('assign_rmo', '')
            ]);

            // Extract counts from results
            const totalTasks = totalTasksResult.count || 0;
            const pendingTasks = pendingTasksResult.count || 0;
            const completedTasks = completedTasksResult.count || 0;

            // Get unique RMOs from assign_rmo column
            const uniqueRmos = new Set();
            if (uniqueRmosResult.data) {
                uniqueRmosResult.data.forEach(task => {
                    if (task.assign_rmo && task.assign_rmo.trim() !== '') {
                        uniqueRmos.add(task.assign_rmo.trim());
                    }
                });
            }

            // Calculate RMO statistics for the table
            const rmoStatsMap = new Map();

            if (rmoStatsResult.data) {
                rmoStatsResult.data.forEach(task => {
                    if (!task.assign_rmo || task.assign_rmo.trim() === '') return;

                    const rmoName = task.assign_rmo.trim();

                    if (!rmoStatsMap.has(rmoName)) {
                        rmoStatsMap.set(rmoName, {
                            name: rmoName,
                            total: 0,
                            completed: 0,
                            pending: 0,
                            shifts: new Set(),
                            score: 0
                        });
                    }

                    const stats = rmoStatsMap.get(rmoName);
                    stats.total += 1;

                    // Check if task is completed
                    if (task.planned1 && task.actual1) {
                        stats.completed += 1;
                    }
                    // Check if task is pending
                    else if (task.planned1 && !task.actual1) {
                        stats.pending += 1;
                    }

                    // Track shifts
                    if (task.shift) {
                        stats.shifts.add(task.shift);
                    }
                });

                // Calculate performance score and format shifts for each RMO
                const formattedRmoStats = Array.from(rmoStatsMap.values()).map(stat => {
                    // Calculate performance score (completed/total * 100)
                    const score = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;

                    // Format shifts as string
                    const shiftsArray = Array.from(stat.shifts);
                    const shifts = shiftsArray.length > 0
                        ? shiftsArray.slice(0, 2).join(', ') + (shiftsArray.length > 2 ? '...' : '')
                        : 'N/A';

                    return {
                        ...stat,
                        shifts,
                        score
                    };
                });

                // Sort by score (highest first)
                formattedRmoStats.sort((a, b) => b.score - a.score);

                setRmoStats(formattedRmoStats);

                // Find top performer
                const topPerformer = formattedRmoStats.length > 0
                    ? formattedRmoStats[0].name
                    : 'N/A';

                // Calculate average score
                const avgScore = formattedRmoStats.length > 0
                    ? Math.round(formattedRmoStats.reduce((sum, stat) => sum + stat.score, 0) / formattedRmoStats.length)
                    : 0;

                setSummary({
                    totalTasks,
                    totalCompleted: completedTasks,
                    pendingTasks,
                    uniqueRmos: uniqueRmos.size,
                    avgScore,
                    topPerformer
                });

                setLastUpdated(new Date().toLocaleTimeString());
            }

        } catch (error) {
            console.error("Error fetching RMO dashboard data", error);
            setSummary({
                totalTasks: 0,
                totalCompleted: 0,
                pendingTasks: 0,
                uniqueRmos: 0,
                avgScore: 0,
                topPerformer: 'N/A'
            });
            setRmoStats([]);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    const handleViewRmoTasks = (rmoName) => {
        setSelectedRmo(rmoName);
    };

    const handleCloseCompleteDetail = () => {
        setSelectedRmo(null);
    };

    // Real-time sync: refresh dashboard when any user modifies rmo_assign_task
    useRealtimeTable('rmo_assign_task', fetchDashboardData);

    useEffect(() => {
        // Initial fetch
        fetchDashboardData();

        // No automatic refresh interval - manual refresh only
    }, [fetchDashboardData]);

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
        if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    const getProgressBarColor = (score) => {
        if (score >= 80) return 'bg-green-500';
        if (score >= 50) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const handleManualRefresh = () => {
        if (!isRefreshing) {
            fetchDashboardData();
        }
    };

    if (loading && !isRefreshing) {
        return (
            <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading RMO dashboard data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 h-screen flex flex-col overflow-hidden">
            {/* CompleteDetail Modal */}
            {selectedRmo && (
                <RMOCompleteDetail
                    nurseName={selectedRmo}
                    onClose={handleCloseCompleteDetail}
                    taskType="rmo" // Pass task type to distinguish between nurse and RMO
                />
            )}

            <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col p-4 md:p-6 overflow-hidden space-y-4 md:space-y-6">

                {/* Header */}
                <div className="flex flex-row justify-between items-center gap-4 shrink-0">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg md:text-2xl font-bold text-gray-900 flex items-center gap-2 truncate">
                            <Award className="w-5 h-5 md:w-8 md:h-8 text-green-600 shrink-0" />
                            <span className="truncate">RMO Performance</span>
                        </h1>
                        <p className="text-gray-500 text-sm mt-1 hidden md:block">Real-time performance metrics based on RMO task completion</p>
                    </div>
                    <div className="hidden md:flex bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        Last Updated: {lastUpdated}
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 shrink-0">
                    <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">Total Tasks</p>
                                <h3 className="text-lg md:text-2xl font-bold text-gray-900 mt-1 md:mt-2">{summary.totalTasks}</h3>
                            </div>
                            <div className="p-1.5 md:p-3 bg-blue-100 rounded-lg text-blue-600">
                                <BarChart3 className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">Pending</p>
                                <h3 className="text-lg md:text-2xl font-bold text-gray-900 mt-1 md:mt-2">{summary.pendingTasks}</h3>
                            </div>
                            <div className="p-1.5 md:p-3 bg-orange-100 rounded-lg text-orange-600">
                                <AlertCircle className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">Completed</p>
                                <h3 className="text-lg md:text-2xl font-bold text-gray-900 mt-1 md:mt-2">{summary.totalCompleted}</h3>
                            </div>
                            <div className="p-1.5 md:p-3 bg-green-100 rounded-lg text-green-600">
                                <CheckCircle className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">Active RMOs</p>
                                <h3 className="text-lg md:text-2xl font-bold text-gray-900 mt-1 md:mt-2">{summary.uniqueRmos}</h3>
                            </div>
                            <div className="p-1.5 md:p-3 bg-purple-100 rounded-lg text-purple-600">
                                <User className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Average Score Card */}
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-6 shrink-0">
                    <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">Avg Perf.</p>
                                <h3 className={`text-lg md:text-2xl font-bold mt-1 md:mt-2 ${getScoreColor(summary.avgScore).split(' ')[0]}`}>
                                    {summary.avgScore}%
                                </h3>
                            </div>
                            <div className="p-1.5 md:p-3 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg text-blue-600">
                                <TrendingUp className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                        </div>
                        <div className="mt-3 md:mt-4 hidden md:block">
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${getProgressBarColor(summary.avgScore)}`}
                                    style={{ width: `${summary.avgScore}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-3 md:p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">Top RMO</p>
                                <h3 className="text-sm md:text-2xl font-bold text-gray-900 mt-1 md:mt-2 truncate max-w-[80px] md:max-w-none">{summary.topPerformer}</h3>
                            </div>
                            <div className="p-1.5 md:p-3 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg text-yellow-600">
                                <Award className="w-4 h-4 md:w-6 md:h-6" />
                            </div>
                        </div>
                        <div className="mt-3 md:mt-4 hidden md:block">
                            {rmoStats.length > 0 && (
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${getProgressBarColor(rmoStats[0]?.score || 0)}`}
                                        style={{ width: `${rmoStats[0]?.score || 0}%` }}
                                    ></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Score Table - Flex-1 and Overflow Hidden to allow internal scroll */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex-1 flex flex-col min-h-0 overflow-hidden mb-2">
                    <div className="p-4 md:p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
                        <h2 className="text-base md:text-lg font-bold text-gray-800">RMO Rankings</h2>
                        <button
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                            className="p-2 md:px-4 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs md:text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            <span className="hidden md:inline">{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
                        </button>
                    </div>

                    {/* Desktop View Table - Scrollable */}
                    <div className="hidden md:block overflow-auto flex-1 scroll-container">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 w-16">Rank</th>
                                    <th className="px-6 py-4">RMO Name</th>
                                    <th className="px-6 py-4">Assigned Shift</th>
                                    <th className="px-6 py-4 text-center">Total</th>
                                    <th className="px-6 py-4 text-center">Done</th>
                                    <th className="px-6 py-4 text-center">Pending</th>
                                    <th className="px-6 py-4 w-1/4">Score</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rmoStats.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                                            No RMO data available.
                                        </td>
                                    </tr>
                                ) : (
                                    rmoStats.map((stat, index) => (
                                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-gray-400">#{index + 1}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-semibold text-gray-900">{stat.name}</span>
                                                    {index === 0 && <span className="text-[10px] bg-yellow-100 text-yellow-700 font-bold px-1 rounded">TOP</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{stat.shifts}</td>
                                            <td className="px-6 py-4 text-center">{stat.total}</td>
                                            <td className="px-6 py-4 text-center text-green-600">{stat.completed}</td>
                                            <td className="px-6 py-4 text-center text-orange-500">{stat.pending}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div className={`h-full ${getProgressBarColor(stat.score)}`} style={{ width: `${stat.score}%` }}></div>
                                                    </div>
                                                    <span className={`text-xs font-bold ${getScoreColor(stat.score).split(' ')[0]}`}>{stat.score}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => handleViewRmoTasks(stat.name)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">View</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View - Scrollable */}
                    <div className="md:hidden overflow-y-auto flex-1 scroll-container divide-y divide-gray-100 bg-gray-50">
                        {rmoStats.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm bg-white">No RMO data available.</div>
                        ) : (
                            rmoStats.map((stat, index) => (
                                <div key={index} className="p-4 space-y-4 bg-white shadow-sm first:rounded-t-xl last:rounded-b-xl border-x border-gray-100">
                                    <div className="flex justify-between items-center border-b border-gray-50 pb-2 mb-1">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0 border border-gray-200">
                                                {index + 1}
                                            </div>
                                            <span className="font-bold text-gray-900 truncate">{stat.name}</span>
                                            {index === 0 && <Award className="w-4 h-4 text-yellow-500 shrink-0" />}
                                        </div>
                                        <div className={`px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm shrink-0 ${getScoreColor(stat.score)}`}>
                                            {stat.score}%
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                        <div className="flex flex-col items-center">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total</p>
                                            <p className="font-black text-lg text-gray-700">{stat.total}</p>
                                        </div>
                                        <div className="flex flex-col items-center border-x border-gray-200 px-2">
                                            <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider mb-1">Done</p>
                                            <p className="font-black text-lg text-green-600">{stat.completed}</p>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mb-1">Wait</p>
                                            <p className="font-black text-lg text-orange-600">{stat.pending}</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center bg-blue-50/50 rounded-lg px-3 py-2">
                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                            <Clock className="w-3 h-3 text-blue-400 shrink-0" />
                                            <span className="text-[11px] text-blue-600 font-medium truncate">{stat.shifts}</span>
                                        </div>
                                        <button
                                            onClick={() => handleViewRmoTasks(stat.name)}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 shrink-0 ml-2"
                                        >
                                            Details <Eye className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RMOScoreDashboard;