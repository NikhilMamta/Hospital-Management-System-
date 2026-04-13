import React from "react";
import {
  Users,
  UserCheck,
  Home,
  Building,
  Activity,
  Calendar,
  UserCog,
  Stethoscope,
  UserPlus,
  ClipboardCheck,
  Trophy,
  MessageSquarePlus,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboardStats } from "../../../api/dashboard";
import useRealtimeQuery from "../../../hooks/useRealtimeQuery";
import CongratulationsFeed from "./CongratulationsFeed";
import NewPostModal from "./NewPostModal";
import { useAuth } from "../../../contexts/AuthContext";
import { getCongratulationsPosts } from "../../../api/congratulations";

export default function Dashboard() {
  // Fetch dashboard data
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
  });

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const isAdmin = user?.role === 'admin';

  // Fetch congratulations posts
  const { data: congratsPosts, isLoading: isLoadingCongrats } = useQuery({
    queryKey: ['congratulations-posts'],
    queryFn: getCongratulationsPosts,
  });

  const hasActiveCongrats = congratsPosts && congratsPosts.length > 0;

  // Real-time synchronization
  useRealtimeQuery("patient_admission", ['dashboard']);
  useRealtimeQuery("ipd_admissions", ['dashboard']);


  // Calculate percentage for progress bars
  const calculatePercentage = (value, total) => {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };

  // Function to get color based on index
  const getChartColor = (index) => {
    const colors = [
      "#10B981", // Green
      "#3B82F6", // Blue
      "#8B5CF6", // Purple
      "#EF4444", // Red
      "#F59E0B", // Yellow
      "#EC4899", // Pink
      "#06B6D4", // Cyan
      "#84CC16", // Lime
    ];
    return colors[index % colors.length];
  };

  // Calculate pie chart segments for gender distribution
  const calculatePieChartSegments = (genderDistribution = []) => {
    const total = genderDistribution.reduce(
      (sum, gender) => sum + gender.percentage,
      0,
    );
    let accumulatedPercentage = 0;

    return genderDistribution.map((gender, index) => {
      const segment = {
        name: gender.name,
        count: gender.count,
        percentage: gender.percentage,
        start: accumulatedPercentage,
        end: accumulatedPercentage + (gender.percentage / total) * 360,
      };
      accumulatedPercentage = segment.end;
      return segment;
    });
  };

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // Calculate pie chart segments for gender distribution
  const pieSegments = calculatePieChartSegments(stats.genderDistribution);

  return (
    <div className="p-3  md:p-6 md:pt-0 space-y-3 md:space-y-6">
      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
        {[
          {
            label: "Total Patients",
            count: stats.patientAdmissionCount,
            icon: <Users size={14} />,
            color: "blue",
            desc: "Admission Log",
          },
          {
            label: "IPD Patients",
            count: stats.ipdAdmissionCount,
            icon: <UserCheck size={14} />,
            color: "green",
            desc: "IPD Log",
          },
          {
            label: "Active",
            count: stats.activePatients,
            icon: <Activity size={14} />,
            color: "purple",
            progress: calculatePercentage(
              stats.activePatients,
              stats.ipdAdmissionCount,
            ),
          },
          {
            label: "Discharged",
            count: stats.dischargedPatients,
            icon: <Home size={14} />,
            color: "orange",
            progress: calculatePercentage(
              stats.dischargedPatients,
              stats.ipdAdmissionCount,
            ),
          },
        ].map((item) => (
          <div
            key={item.label}
            className="group bg-white/70 backdrop-blur-md rounded-2xl border border-gray-100 p-4 md:p-6 shadow-sm hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex items-center justify-center bg-${item.color}-50/50 p-3 rounded-2xl group-hover:scale-110 transition-transform duration-300`}
              >
                {React.cloneElement(item.icon, {
                  size: 20,
                  className: `text-${item.color}-600 md:w-6 md:h-6`,
                })}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest leading-none">
                    {item.label}
                  </p>
                </div>
                <p className="text-xl md:text-3xl font-black text-gray-900 mt-2 leading-none tracking-tighter">
                  {item.count.toLocaleString()}
                </p>
                {item.progress !== undefined ? (
                  <div className="w-full bg-gray-100/50 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${item.color === "green" || item.color === "purple" ? "bg-gradient-to-r from-emerald-500 to-green-600" : "bg-gradient-to-r from-blue-500 to-indigo-600"}`}
                      style={{ width: `${item.progress}%` }}
                    ></div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-3">
                    <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span>
                    <p className="text-[9px] text-green-600 font-bold uppercase tracking-tighter">
                      Live Updates
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Wall of Praise Section - Conditionally visible */}
      {(hasActiveCongrats || isAdmin) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-6 bg-green-600 rounded-full"></div>
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">
                Wall of Praise
              </h3>
            </div>
            {isAdmin && (
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-green-500/20"
              >
                <MessageSquarePlus size={14} />
                <span>New Post</span>
              </button>
            )}
          </div>
          
          <CongratulationsFeed 
            posts={congratsPosts} 
            isLoading={isLoadingCongrats} 
            isAdmin={isAdmin} 
          />
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
        {/* Ward Distribution Chart */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 md:p-6">
          <div className="flex items-center justify-between mb-3 md:mb-6">
            <div>
              <h3 className="text-sm md:text-lg font-black text-gray-900 uppercase tracking-tighter">
                Ward View
              </h3>
              <p className="text-[10px] md:text-sm text-gray-400 font-bold italic">
                Patient spread
              </p>
            </div>
            <div className="bg-green-50/50 p-1.5 rounded-lg">
              <Building className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            </div>
          </div>

          {stats.wardDistribution.length > 0 ? (
            <div className="space-y-2 md:space-y-4">
              {stats.wardDistribution.map((ward, index) => (
                <div key={ward.name} className="space-y-1 md:space-y-2">
                  <div className="flex justify-between text-[11px] md:text-sm leading-none">
                    <span className="font-bold text-gray-700 truncate mr-2">
                      {ward.name}
                    </span>
                    <span className="font-black text-gray-900 flex-shrink-0">
                      {ward.count}{" "}
                      <span className="text-[9px] md:text-[11px] text-gray-400 ml-1">
                        {ward.percentage}%
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-50 rounded-full h-1.5 md:h-3 border border-gray-100">
                    <div
                      className="h-1.5 md:h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${ward.percentage}%`,
                        backgroundColor: getChartColor(index),
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Building className="w-8 h-8 md:w-12 md:h-12 mx-auto text-gray-200 mb-2" />
              <p className="text-gray-400 font-bold text-[10px]">
                No ward records
              </p>
            </div>
          )}
        </div>

        {/* Department Distribution Chart */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 md:p-6">
          <div className="flex items-center justify-between mb-3 md:mb-6">
            <div>
              <h3 className="text-sm md:text-lg font-black text-gray-900 uppercase tracking-tighter">
                Dept View
              </h3>
              <p className="text-[10px] md:text-sm text-gray-400 font-bold italic">
                Case distribution
              </p>
            </div>
            <div className="bg-blue-50/50 p-1.5 rounded-lg">
              <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            </div>
          </div>

          {stats.departmentDistribution.length > 0 ? (
            <div className="space-y-2 md:space-y-4">
              {stats.departmentDistribution.slice(0, 5).map((dept, index) => (
                <div key={dept.name} className="space-y-1 md:space-y-2">
                  <div className="flex justify-between text-[11px] md:text-sm leading-none">
                    <span className="font-bold text-gray-700 truncate mr-2">
                      {dept.name}
                    </span>
                    <span className="font-black text-gray-900 flex-shrink-0">
                      {dept.count}{" "}
                      <span className="text-[9px] md:text-[11px] text-gray-400 ml-1">
                        {dept.percentage}%
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-50 rounded-full h-1.5 md:h-3 border border-gray-100">
                    <div
                      className="h-1.5 md:h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${dept.percentage}%`,
                        backgroundColor: getChartColor(index + 2),
                      }}
                    ></div>
                  </div>
                </div>
              ))}
              {stats.departmentDistribution.length > 5 && (
                <div className="text-center pt-2">
                  <p className="text-[9px] md:text-xs text-gray-400 font-black italic tracking-widest leading-none">
                    +{stats.departmentDistribution.length - 5} MORE
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Users className="w-8 h-8 md:w-12 md:h-12 mx-auto text-gray-200 mb-2" />
              <p className="text-gray-400 font-bold text-[10px]">
                No department data
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Staff Summary Section */}
      <div className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 rounded-lg p-3 md:p-6 text-white shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Activity size={100} />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
          <div className="min-w-0">
            <h3 className="text-sm md:text-xl font-black uppercase tracking-tighter">
              Team Overview
            </h3>
            <p className="opacity-70 text-[9px] md:text-sm mt-0.5 font-bold italic truncate">
              Hospital Strength Across Roles
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded border border-white/20 p-2 md:p-4 text-center md:text-right min-w-[70px]">
            <p className="text-lg md:text-3xl font-black leading-none">
              {stats.doctorCount +
                stats.nurseCount +
                stats.rmoCount +
                stats.otStaffCount}
            </p>
            <p className="text-[8px] md:text-xs font-black uppercase tracking-widest opacity-60 mt-1">
              Total
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 md:gap-4 mt-4 relative z-10">
          {[
            {
              label: "Doc",
              count: stats.doctorCount,
              icon: <Stethoscope size={10} />,
            },
            {
              label: "Nur",
              count: stats.nurseCount,
              icon: <UserPlus size={10} />,
            },
            {
              label: "RMO",
              count: stats.rmoCount,
              icon: <UserCog size={10} />,
            },
            {
              label: "OT",
              count: stats.otStaffCount,
              icon: <Activity size={10} />,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white/5 hover:bg-white/10 transition-colors rounded p-1.5 md:p-3 border border-white/5 flex flex-col items-center"
            >
              <div className="flex items-center gap-1 mb-0.5 opacity-60">
                {item.icon}
                <p className="text-[8px] md:text-xs font-black uppercase tracking-tighter">
                  {item.label}
                </p>
              </div>
              <p className="text-[14px] md:text-2xl font-black leading-none">
                {item.count}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* New Post Modal */}
      {isAdmin && (
        <NewPostModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          userName={user?.name || "Admin"}
          onSuccess={() => {
            queryClient.invalidateQueries(['congratulations-posts']);
          }}
        />
      )}
    </div>
  );
}
