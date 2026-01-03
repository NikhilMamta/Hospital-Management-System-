import React, { useState, useEffect } from 'react';
import { Users, UserCheck, Home, Building, Activity, Calendar, UserCog, Stethoscope, UserPlus, ClipboardCheck } from 'lucide-react';
import supabase from '../../../SupabaseClient';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    patientAdmissionCount: 0,
    ipdAdmissionCount: 0,
    wardDistribution: [],
    departmentDistribution: [],
    genderDistribution: [],
    admissionTrends: [],
    activePatients: 0,
    dischargedPatients: 0,
    doctorCount: 0,
    nurseCount: 0,
    rmoCount: 0,
    otStaffCount: 0
  });

  // Function to get color based on index
  const getChartColor = (index) => {
    const colors = [
      '#10B981', // Green
      '#3B82F6', // Blue
      '#8B5CF6', // Purple
      '#EF4444', // Red
      '#F59E0B', // Yellow
      '#EC4899', // Pink
      '#06B6D4', // Cyan
      '#84CC16', // Lime
    ];
    return colors[index % colors.length];
  };

  // Calculate percentage for progress bars
  const calculatePercentage = (value, total) => {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };

  // Helper function to process distribution data
  const processDistributionData = (data, field) => {
    const distribution = {};

    data?.forEach(item => {
      const value = item[field];
      if (value) {
        distribution[value] = (distribution[value] || 0) + 1;
      }
    });

    return Object.entries(distribution).map(([name, count]) => ({
      name,
      count,
      percentage: calculatePercentage(count, data?.length || 0)
    }));
  };

  // Format date for display (e.g., "Mon 15")
  const formatDateForDisplay = (dateString) => {
    const date = new Date(dateString);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[date.getDay()]} ${date.getDate()}`;
  };

  // Get admission trends for last 7 days
  const getAdmissionTrends = async () => {
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6); // Last 7 days including today

      // Format dates for Supabase query
      const startDate = sevenDaysAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      // Get daily admissions from patient_admission
      const { data: patientAdmissions, error } = await supabase
        .from('patient_admission')
        .select('timestamp')
        .gte('timestamp', `${startDate}T00:00:00`)
        .lte('timestamp', `${endDate}T23:59:59`);

      if (error) throw error;

      // Generate dates for last 7 days
      const dates = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
      }

      // Count admissions per day
      const dailyCounts = {};
      patientAdmissions?.forEach(admission => {
        const date = admission.timestamp.split('T')[0];
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
      });

      // Format for chart
      return dates.map(date => ({
        date: formatDateForDisplay(date),
        count: dailyCounts[date] || 0
      }));

    } catch (error) {
      console.error('Error fetching admission trends:', error);
      return [];
    }
  };

  // Calculate pie chart segments for gender distribution
  const calculatePieChartSegments = (genderDistribution) => {
    const total = genderDistribution.reduce((sum, gender) => sum + gender.percentage, 0);
    let accumulatedPercentage = 0;

    return genderDistribution.map((gender, index) => {
      const segment = {
        name: gender.name,
        count: gender.count,
        percentage: gender.percentage,
        start: accumulatedPercentage,
        end: accumulatedPercentage + (gender.percentage / total * 360)
      };
      accumulatedPercentage = segment.end;
      return segment;
    });
  };

  // Fetch staff counts from all_staff table
  const fetchStaffCounts = async () => {
    try {
      // Fetch doctors count
      const { count: doctorCount, error: doctorError } = await supabase
        .from('doctors')
        .select('*', { count: 'exact', head: true })


      // Fetch nurses count
      const { count: nurseCount, error: nurseError } = await supabase
        .from('all_staff')
        .select('*', { count: 'exact', head: true })
        .eq('designation', 'Staff Nurse');

      // Fetch RMO count
      const { count: rmoCount, error: rmoError } = await supabase
        .from('all_staff')
        .select('*', { count: 'exact', head: true })
        .eq('designation', 'RMO');

      // Fetch OT staff count
      const { count: otStaffCount, error: otStaffError } = await supabase
        .from('all_staff')
        .select('*', { count: 'exact', head: true })
        .eq('designation', 'OT STAFF');

      if (doctorError || nurseError || rmoError || otStaffError) {
        console.error('Error fetching staff counts:', { doctorError, nurseError, rmoError, otStaffError });
        return { doctorCount: 0, nurseCount: 0, rmoCount: 0, otStaffCount: 0 };
      }

      return {
        doctorCount: doctorCount || 0,
        nurseCount: nurseCount || 0,
        rmoCount: rmoCount || 0,
        otStaffCount: otStaffCount || 0
      };

    } catch (error) {
      console.error('Error in fetchStaffCounts:', error);
      return { doctorCount: 0, nurseCount: 0, rmoCount: 0, otStaffCount: 0 };
    }
  };

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch patient_admission count
      const { count: patientAdmissionCount, error: patientError } = await supabase
        .from('patient_admission')
        .select('*', { count: 'exact', head: true });

      // Fetch ipd_admissions count
      const { count: ipdAdmissionCount, error: ipdError } = await supabase
        .from('ipd_admissions')
        .select('*', { count: 'exact', head: true });

      // Fetch ward distribution (from ipd_admissions)
      const { data: wardData, error: wardError } = await supabase
        .from('ipd_admissions')
        .select('ward_type')
        .not('ward_type', 'is', null);

      // Fetch department distribution (from ipd_admissions)
      const { data: departmentData, error: departmentError } = await supabase
        .from('ipd_admissions')
        .select('department')
        .not('department', 'is', null);

      // Fetch gender distribution (from patient_admission)
      const { data: genderData, error: genderError } = await supabase
        .from('patient_admission')
        .select('gender')
        .not('gender', 'is', null);

      // Fetch planned1 and actual1 for active/discharged patients (from ipd_admissions)
      const { data: ipdStatusData, error: ipdStatusError } = await supabase
        .from('ipd_admissions')
        .select('planned1, actual1');

      // Fetch staff counts
      const staffCounts = await fetchStaffCounts();

      if (
        patientError || ipdError || wardError ||
        departmentError || genderError || ipdStatusError
      ) {
        console.error('Error fetching dashboard data:', {
          patientError, ipdError, wardError, departmentError, genderError, ipdStatusError
        });
        return;
      }

      // Process ward distribution
      const wardDistribution = processDistributionData(wardData, 'ward_type');

      // Process department distribution
      const departmentDistribution = processDistributionData(departmentData, 'department');

      // Process gender distribution
      const genderDistribution = processDistributionData(genderData, 'gender');

      // Process active/discharged patients based on planned1 and actual1
      const activePatients = ipdStatusData?.filter(patient =>
        patient.planned1 && !patient.actual1
      ).length || 0;

      const dischargedPatients = ipdStatusData?.filter(patient =>
        patient.planned1 && patient.actual1
      ).length || 0;

      // Get admission trends (last 7 days)
      const admissionTrends = await getAdmissionTrends();

      setStats({
        patientAdmissionCount: patientAdmissionCount || 0,
        ipdAdmissionCount: ipdAdmissionCount || 0,
        wardDistribution: wardDistribution.sort((a, b) => b.count - a.count),
        departmentDistribution: departmentDistribution.sort((a, b) => b.count - a.count),
        genderDistribution,
        admissionTrends,
        activePatients,
        dischargedPatients,
        doctorCount: staffCounts.doctorCount,
        nurseCount: staffCounts.nurseCount,
        rmoCount: staffCounts.rmoCount,
        otStaffCount: staffCounts.otStaffCount
      });

    } catch (error) {
      console.error('Error in fetchDashboardData:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
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
    <div className="p-3 md:p-6 space-y-3 md:space-y-6">
      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
        {[
          { label: 'Total Patients', count: stats.patientAdmissionCount, icon: <Users size={14} />, color: 'blue', desc: 'Admission Log' },
          { label: 'IPD Patients', count: stats.ipdAdmissionCount, icon: <UserCheck size={14} />, color: 'green', desc: 'IPD Log' },
          { label: 'Active', count: stats.activePatients, icon: <Activity size={14} />, color: 'purple', progress: calculatePercentage(stats.activePatients, stats.ipdAdmissionCount) },
          { label: 'Discharged', count: stats.dischargedPatients, icon: <Home size={14} />, color: 'orange', progress: calculatePercentage(stats.dischargedPatients, stats.ipdAdmissionCount) }
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-lg border border-gray-100 p-2 md:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 md:gap-4">
              <div className={`flex items-center justify-center bg-${item.color}-50 p-2 md:p-3 rounded-lg md:rounded-full flex-shrink-0`}>
                {React.cloneElement(item.icon, { size: 16, className: `text-${item.color}-600 md:w-6 md:h-6` })}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] md:text-sm font-black text-gray-400 uppercase tracking-tighter truncate leading-none">{item.label}</p>
                <p className="text-[15px] md:text-3xl font-black text-gray-900 mt-1 leading-none">{item.count.toLocaleString()}</p>
                {item.progress !== undefined ? (
                  <div className="w-full bg-gray-50 rounded-full h-1 mt-2 border border-gray-100">
                    <div
                      className={`h-1 rounded-full shadow-[0_0_8px_rgba(22,163,74,0.4)] ${item.color === 'green' || item.color === 'purple' ? 'bg-green-600' : 'bg-blue-600'}`}
                      style={{ width: `${item.progress}%` }}
                    ></div>
                  </div>
                ) : (
                  <p className="hidden md:block text-[10px] text-gray-400 mt-2 font-bold italic">{item.desc}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
        {/* Ward Distribution Chart */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 md:p-6">
          <div className="flex items-center justify-between mb-3 md:mb-6">
            <div>
              <h3 className="text-sm md:text-lg font-black text-gray-900 uppercase tracking-tighter">Ward View</h3>
              <p className="text-[10px] md:text-sm text-gray-400 font-bold italic">Patient spread</p>
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
                    <span className="font-bold text-gray-700 truncate mr-2">{ward.name}</span>
                    <span className="font-black text-gray-900 flex-shrink-0">
                      {ward.count} <span className="text-[9px] md:text-[11px] text-gray-400 ml-1">{ward.percentage}%</span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-50 rounded-full h-1.5 md:h-3 border border-gray-100">
                    <div
                      className="h-1.5 md:h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${ward.percentage}%`,
                        backgroundColor: getChartColor(index)
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Building className="w-8 h-8 md:w-12 md:h-12 mx-auto text-gray-200 mb-2" />
              <p className="text-gray-400 font-bold text-[10px]">No ward records</p>
            </div>
          )}
        </div>

        {/* Department Distribution Chart */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 md:p-6">
          <div className="flex items-center justify-between mb-3 md:mb-6">
            <div>
              <h3 className="text-sm md:text-lg font-black text-gray-900 uppercase tracking-tighter">Dept View</h3>
              <p className="text-[10px] md:text-sm text-gray-400 font-bold italic">Case distribution</p>
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
                    <span className="font-bold text-gray-700 truncate mr-2">{dept.name}</span>
                    <span className="font-black text-gray-900 flex-shrink-0">
                      {dept.count} <span className="text-[9px] md:text-[11px] text-gray-400 ml-1">{dept.percentage}%</span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-50 rounded-full h-1.5 md:h-3 border border-gray-100">
                    <div
                      className="h-1.5 md:h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${dept.percentage}%`,
                        backgroundColor: getChartColor(index + 2)
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
              <p className="text-gray-400 font-bold text-[10px]">No department data</p>
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
            <h3 className="text-sm md:text-xl font-black uppercase tracking-tighter">Team Overview</h3>
            <p className="opacity-70 text-[9px] md:text-sm mt-0.5 font-bold italic truncate">Hospital Strength Across Roles</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded border border-white/20 p-2 md:p-4 text-center md:text-right min-w-[70px]">
            <p className="text-lg md:text-3xl font-black leading-none">
              {stats.doctorCount + stats.nurseCount + stats.rmoCount + stats.otStaffCount}
            </p>
            <p className="text-[8px] md:text-xs font-black uppercase tracking-widest opacity-60 mt-1">Total</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 md:gap-4 mt-4 relative z-10">
          {[
            { label: 'Doc', count: stats.doctorCount, icon: <Stethoscope size={10} /> },
            { label: 'Nur', count: stats.nurseCount, icon: <UserPlus size={10} /> },
            { label: 'RMO', count: stats.rmoCount, icon: <UserCog size={10} /> },
            { label: 'OT', count: stats.otStaffCount, icon: <Activity size={10} /> }
          ].map((item) => (
            <div key={item.label} className="bg-white/5 hover:bg-white/10 transition-colors rounded p-1.5 md:p-3 border border-white/5 flex flex-col items-center">
              <div className="flex items-center gap-1 mb-0.5 opacity-60">
                {item.icon}
                <p className="text-[8px] md:text-xs font-black uppercase tracking-tighter">{item.label}</p>
              </div>
              <p className="text-[14px] md:text-2xl font-black leading-none">{item.count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}