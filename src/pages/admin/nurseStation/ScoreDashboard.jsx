import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import supabase from "../../../SupabaseClient";
import CompleteDetail from "./CompleteDetail";
import useRealtimeTable from "../../../hooks/useRealtimeTable";

const ScoreDashboard = () => {
  const [nurseStats, setNurseStats] = useState([]);
  const [summary, setSummary] = useState({
    totalTasks: 0,
    totalCompleted: 0,
    pendingTasks: 0,
    uniqueNurses: 0,
    avgScore: 0,
    topPerformer: "N/A",
  });
  const [loading, setLoading] = useState(true);
  const [selectedNurse, setSelectedNurse] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setIsRefreshing(true);

      // Fetch summary data directly from Supabase
      const [
        totalTasksResult,
        pendingTasksResult,
        completedTasksResult,
        uniqueNursesResult,
        nurseStatsResult,
      ] = await Promise.all([
        supabase
          .from("nurse_assign_task")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("nurse_assign_task")
          .select("id", { count: "exact", head: true })
          .not("planned1", "is", null)
          .is("actual1", null),

        supabase
          .from("nurse_assign_task")
          .select("id", { count: "exact", head: true })
          .not("planned1", "is", null)
          .not("actual1", "is", null),

        supabase
          .from("nurse_assign_task")
          .select("assign_nurse")
          .not("assign_nurse", "is", null)
          .neq("assign_nurse", ""),

        supabase
          .from("nurse_assign_task")
          .select("*")
          .not("assign_nurse", "is", null)
          .neq("assign_nurse", ""),
      ]);

      // Extract counts from results
      const totalTasks = totalTasksResult.count || 0;
      const pendingTasks = pendingTasksResult.count || 0;
      const completedTasks = completedTasksResult.count || 0;

      // Get unique nurses from assign_nurse column
      const uniqueNurses = new Set();
      if (uniqueNursesResult.data) {
        uniqueNursesResult.data.forEach((task) => {
          if (task.assign_nurse && task.assign_nurse.trim() !== "") {
            uniqueNurses.add(task.assign_nurse.trim());
          }
        });
      }

      // Calculate nurse statistics for the table
      const nurseStatsMap = new Map();

      if (nurseStatsResult.data) {
        nurseStatsResult.data.forEach((task) => {
          if (!task.assign_nurse || task.assign_nurse.trim() === "") return;

          const nurseName = task.assign_nurse.trim();

          if (!nurseStatsMap.has(nurseName)) {
            nurseStatsMap.set(nurseName, {
              name: nurseName,
              total: 0,
              completed: 0,
              pending: 0,
              shifts: new Set(),
              score: 0,
            });
          }

          const stats = nurseStatsMap.get(nurseName);
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

        // Calculate performance score and format shifts for each nurse
        const formattedNurseStats = Array.from(nurseStatsMap.values()).map(
          (stat) => {
            // Calculate performance score (completed/total * 100)
            const score =
              stat.total > 0
                ? Math.round((stat.completed / stat.total) * 100)
                : 0;

            // Format shifts as string
            const shiftsArray = Array.from(stat.shifts);
            const shifts =
              shiftsArray.length > 0
                ? shiftsArray.slice(0, 2).join(", ") +
                  (shiftsArray.length > 2 ? "..." : "")
                : "N/A";

            return {
              ...stat,
              shifts,
              score,
            };
          },
        );

        // Sort by score (highest first)
        formattedNurseStats.sort((a, b) => b.score - a.score);

        setNurseStats(formattedNurseStats);

        // Find top performer
        const topPerformer =
          formattedNurseStats.length > 0 ? formattedNurseStats[0].name : "N/A";

        // Calculate average score
        const avgScore =
          formattedNurseStats.length > 0
            ? Math.round(
                formattedNurseStats.reduce((sum, stat) => sum + stat.score, 0) /
                  formattedNurseStats.length,
              )
            : 0;

        setSummary({
          totalTasks,
          totalCompleted: completedTasks,
          pendingTasks,
          uniqueNurses: uniqueNurses.size,
          avgScore,
          topPerformer,
        });

        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error("Error fetching dashboard data", error);
      setSummary({
        totalTasks: 0,
        totalCompleted: 0,
        pendingTasks: 0,
        uniqueNurses: 0,
        avgScore: 0,
        topPerformer: "N/A",
      });
      setNurseStats([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleViewNurseTasks = (nurseName) => {
    setSelectedNurse(nurseName);
  };

  const handleCloseCompleteDetail = () => {
    setSelectedNurse(null);
  };

  // Real-time sync: refresh dashboard when any user modifies nurse_assign_task
  useRealtimeTable("nurse_assign_task", fetchDashboardData);

  useEffect(() => {
    // Initial fetch
    fetchDashboardData();

    // No automatic refresh interval - manual refresh only
  }, [fetchDashboardData]);

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getProgressBarColor = (score) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const handleManualRefresh = () => {
    if (!isRefreshing) {
      fetchDashboardData();
    }
  };

  if (loading && !isRefreshing) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto border-b-2 border-blue-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* CompleteDetail Modal */}
      {selectedNurse && (
        <CompleteDetail
          nurseName={selectedNurse}
          onClose={handleCloseCompleteDetail}
        />
      )}

      <div className="max-w-7xl mx-auto w-full h-full flex flex-col p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex-1 min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900 truncate md:text-2xl">
              <Award className="w-5 h-5 text-green-600 md:w-8 md:h-8 shrink-0" />
              <span className="truncate">Performance Scoreboard</span>
            </h1>
            <p className="hidden mt-1 text-sm text-gray-500 md:block">
              Real-time performance metrics based on task completion
            </p>
          </div>
          <div className="items-center hidden gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm md:flex">
            <Clock className="w-4 h-4" />
            Last Updated: {lastUpdated}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6 shrink-0">
          <div className="p-3 bg-white border border-gray-200 shadow-sm md:p-6 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">
                  Total Tasks
                </p>
                <h3 className="mt-1 text-lg font-bold text-gray-900 md:text-2xl md:mt-2">
                  {summary.totalTasks}
                </h3>
              </div>
              <div className="p-1.5 md:p-3 bg-blue-100 rounded-lg text-blue-600">
                <BarChart3 className="w-4 h-4 md:w-6 md:h-6" />
              </div>
            </div>
          </div>

          <div className="p-3 bg-white border border-gray-200 shadow-sm md:p-6 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">
                  Pending
                </p>
                <h3 className="mt-1 text-lg font-bold text-gray-900 md:text-2xl md:mt-2">
                  {summary.pendingTasks}
                </h3>
              </div>
              <div className="p-1.5 md:p-3 bg-orange-100 rounded-lg text-orange-600">
                <AlertCircle className="w-4 h-4 md:w-6 md:h-6" />
              </div>
            </div>
          </div>

          <div className="p-3 bg-white border border-gray-200 shadow-sm md:p-6 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">
                  Completed
                </p>
                <h3 className="mt-1 text-lg font-bold text-gray-900 md:text-2xl md:mt-2">
                  {summary.totalCompleted}
                </h3>
              </div>
              <div className="p-1.5 md:p-3 bg-green-100 rounded-lg text-green-600">
                <CheckCircle className="w-4 h-4 md:w-6 md:h-6" />
              </div>
            </div>
          </div>

          <div className="p-3 bg-white border border-gray-200 shadow-sm md:p-6 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">
                  Active Staff
                </p>
                <h3 className="mt-1 text-lg font-bold text-gray-900 md:text-2xl md:mt-2">
                  {summary.uniqueNurses}
                </h3>
              </div>
              <div className="p-1.5 md:p-3 bg-purple-100 rounded-lg text-purple-600">
                <Users className="w-4 h-4 md:w-6 md:h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Average Score Card */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 shrink-0">
          <div className="p-3 bg-white border border-gray-200 shadow-sm md:p-6 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">
                  Avg Perf.
                </p>
                <h3
                  className={`text-lg md:text-2xl font-bold mt-1 md:mt-2 ${getScoreColor(summary.avgScore).split(" ")[0]}`}
                >
                  {summary.avgScore}%
                </h3>
              </div>
              <div className="p-1.5 md:p-3 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg text-blue-600">
                <TrendingUp className="w-4 h-4 md:w-6 md:h-6" />
              </div>
            </div>
            <div className="hidden mt-3 md:mt-4 md:block">
              <div className="h-2 overflow-hidden bg-gray-100 rounded-full">
                <div
                  className={`h-full rounded-full ${getProgressBarColor(summary.avgScore)}`}
                  style={{ width: `${summary.avgScore}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-white border border-gray-200 shadow-sm md:p-6 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] md:text-sm font-medium text-gray-500 uppercase md:normal-case">
                  Top Staff
                </p>
                <h3 className="text-sm md:text-2xl font-bold text-gray-900 mt-1 md:mt-2 truncate max-w-[80px] md:max-w-none">
                  {summary.topPerformer}
                </h3>
              </div>
              <div className="p-1.5 md:p-3 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg text-yellow-600">
                <Award className="w-4 h-4 md:w-6 md:h-6" />
              </div>
            </div>
            <div className="hidden mt-3 md:mt-4 md:block">
              {nurseStats.length > 0 && (
                <div className="h-2 overflow-hidden bg-gray-100 rounded-full">
                  <div
                    className={`h-full rounded-full ${getProgressBarColor(nurseStats[0]?.score || 0)}`}
                    style={{ width: `${nurseStats[0]?.score || 0}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Score Table - Flex-1 and Overflow Hidden to allow internal scroll */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 flex-[2] flex flex-col min-h-[400px] md:min-h-[500px] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 md:p-6 bg-gray-50 shrink-0">
            <h2 className="text-base font-bold text-gray-800 md:text-lg">
              Staff Rankings
            </h2>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 p-2 text-xs font-medium text-white transition-colors bg-blue-600 rounded-lg md:px-4 md:py-2 hover:bg-blue-700 md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span className="hidden md:inline">
                {isRefreshing ? "Refreshing..." : "Refresh Data"}
              </span>
            </button>
          </div>

          {/* Desktop View Table - Scrollable */}
          <div className="hidden md:block flex-1 overflow-auto">
            <table className="w-full text-left min-h-[400px]">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="w-16 px-6 py-4">Rank</th>
                  <th className="px-6 py-4">Nurse Name</th>
                  <th className="px-6 py-4">Assigned Shift</th>
                  <th className="px-6 py-4 text-center">Total</th>
                  <th className="px-6 py-4 text-center">Done</th>
                  <th className="px-6 py-4 text-center">Pending</th>
                  <th className="w-1/4 px-6 py-4">Score</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {nurseStats.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      No nurse data available.
                    </td>
                  </tr>
                ) : (
                  nurseStats.map((stat, index) => (
                    <tr
                      key={index}
                      className="transition-colors hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 font-bold text-gray-400">
                        #{index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">
                            {stat.name}
                          </span>
                          {index === 0 && (
                            <span className="text-[10px] bg-yellow-100 text-yellow-700 font-bold px-1 rounded">
                              TOP
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{stat.shifts}</td>
                      <td className="px-6 py-4 text-center">{stat.total}</td>
                      <td className="px-6 py-4 text-center text-green-600">
                        {stat.completed}
                      </td>
                      <td className="px-6 py-4 text-center text-orange-500">
                        {stat.pending}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 overflow-hidden bg-gray-100 rounded-full">
                            <div
                              className={`h-full ${getProgressBarColor(stat.score)}`}
                              style={{ width: `${stat.score}%` }}
                            ></div>
                          </div>
                          <span
                            className={`text-xs font-bold ${getScoreColor(stat.score).split(" ")[0]}`}
                          >
                            {stat.score}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleViewNurseTasks(stat.name)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - Scrollable */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 md:hidden scroll-container bg-gray-50">
            {nurseStats.length === 0 ? (
              <div className="p-8 text-sm text-center text-gray-500 bg-white">
                No nurse data available.
              </div>
            ) : (
              nurseStats.map((stat, index) => (
                <div
                  key={index}
                  className="p-4 space-y-4 bg-white border-gray-100 shadow-sm first:rounded-t-xl last:rounded-b-xl border-x"
                >
                  <div className="flex items-center justify-between pb-2 mb-1 border-b border-gray-50">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0 border border-gray-200">
                        {index + 1}
                      </div>
                      <span className="font-bold text-gray-900 truncate">
                        {stat.name}
                      </span>
                      {index === 0 && (
                        <Award className="w-4 h-4 text-yellow-500 shrink-0" />
                      )}
                    </div>
                    <div
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm shrink-0 ${getScoreColor(stat.score)}`}
                    >
                      {stat.score}%
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 p-3 border border-gray-100 bg-gray-50 rounded-xl">
                    <div className="flex flex-col items-center">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                        Total
                      </p>
                      <p className="text-lg font-black text-gray-700">
                        {stat.total}
                      </p>
                    </div>
                    <div className="flex flex-col items-center px-2 border-gray-200 border-x">
                      <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider mb-1">
                        Done
                      </p>
                      <p className="text-lg font-black text-green-600">
                        {stat.completed}
                      </p>
                    </div>
                    <div className="flex flex-col items-center">
                      <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mb-1">
                        Wait
                      </p>
                      <p className="text-lg font-black text-orange-600">
                        {stat.pending}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50/50">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <Clock className="w-3 h-3 text-blue-400 shrink-0" />
                      <span className="text-[11px] text-blue-600 font-medium truncate">
                        {stat.shifts}
                      </span>
                    </div>
                    <button
                      onClick={() => handleViewNurseTasks(stat.name)}
                      className="flex items-center gap-1 ml-2 text-xs font-bold text-blue-600 hover:text-blue-700 shrink-0"
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

export default ScoreDashboard;
