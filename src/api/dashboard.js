import supabase from '../SupabaseClient';

/**
 * Fetches dashboard statistics including patient counts, 
 * hospital staff metrics, and distribution data.
 */
export const getDashboardStats = async () => {
  // 1. Parallel fetch of all primary tables
  const [patientRes, ipdRes, docRes, nurseRes, rmoRes, otRes] = await Promise.all([
    supabase.from("patient_admission").select("gender, timestamp"),
    supabase.from("ipd_admissions").select("ward_type, department, planned1, actual1"),
    supabase.from("doctors").select("*", { count: "exact", head: true }),
    supabase.from("all_staff").select("*", { count: "exact", head: true }).eq("designation", "Staff Nurse"),
    supabase.from("all_staff").select("*", { count: "exact", head: true }).eq("designation", "RMO"),
    supabase.from("all_staff").select("*", { count: "exact", head: true }).eq("designation", "OT STAFF")
  ]);

  if (patientRes.error) throw patientRes.error;
  if (ipdRes.error) throw ipdRes.error;

  // 2. Process counts
  const patientAdmissionCount = patientRes.data?.length || 0;
  const ipdAdmissionCount = ipdRes.data?.length || 0;
  const doctorCount = docRes.count || 0;
  const nurseCount = nurseRes.count || 0;
  const rmoCount = rmoRes.count || 0;
  const otStaffCount = otRes.count || 0;

  // 3. Process distributions
  const calculatePercentage = (value, total) => total > 0 ? Math.round((value / total) * 100) : 0;
  
  const processDistribution = (data, field) => {
    const counts = {};
    data?.forEach(item => {
      const val = item[field];
      if (val) counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      percentage: calculatePercentage(count, data?.length || 0)
    })).sort((a, b) => b.count - a.count);
  };

  const wardDistribution = processDistribution(ipdRes.data?.filter(i => i.ward_type), "ward_type");
  const departmentDistribution = processDistribution(ipdRes.data?.filter(i => i.department), "department");
  const genderDistribution = processDistribution(patientRes.data?.filter(p => p.gender), "gender");

  // 4. Process active/discharged
  const activePatients = ipdRes.data?.filter(p => p.planned1 && !p.actual1).length || 0;
  const dischargedPatients = ipdRes.data?.filter(p => p.planned1 && p.actual1).length || 0;

  // 5. Admission Trends
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const dailyCounts = {};
  patientRes.data?.forEach(adm => {
    const date = adm.timestamp?.split('T')[0];
    if (date) dailyCounts[date] = (dailyCounts[date] || 0) + 1;
  });

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const admissionTrends = dates.map(date => {
    const d = new Date(date);
    return {
      date: `${days[d.getDay()]} ${d.getDate()}`,
      count: dailyCounts[date] || 0
    };
  });

  return {
    patientAdmissionCount,
    ipdAdmissionCount,
    wardDistribution,
    departmentDistribution,
    genderDistribution,
    admissionTrends,
    activePatients,
    dischargedPatients,
    doctorCount,
    nurseCount,
    rmoCount,
    otStaffCount
  };
};
