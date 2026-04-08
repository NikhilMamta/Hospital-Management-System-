import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { useParams, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPatientDetails } from '../../../api/patientProfile';
import useRealtimeQuery from '../../../hooks/useRealtimeQuery';

// Calculate days in hospital
const calculateDaysInHospital = (admissionDate) => {
  if (!admissionDate) return '0';
  try {
    const admitted = new Date(admissionDate);
    const now = new Date();
    const diffTime = Math.abs(now - admitted);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays.toString();
  } catch (error) {
    return '0';
  }
};

// Main Component
export default function PatientProfileDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- React Query ---
  const { 
    data, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['patient-details', id],
    queryFn: () => fetchPatientDetails(id),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Real-time updates for this specific patient
  useRealtimeQuery(['public', 'ipd_admissions'], ['patient-details', id]);
  useRealtimeQuery(['public', 'pharmacy'], ['patient-details', id]);

  // Get all tabs
  const tabs = useMemo(() => {
    return [
      { key: 'overview', label: 'Overview' },
      { key: 'rmo', label: 'RMO Task' },
      { key: 'nursing', label: 'Nursing Task' },
      { key: 'dressing', label: 'Dressing' },
      { key: 'lab', label: 'Lab' },
      { key: 'pharmacy', label: 'Pharmacy' },
      { key: 'ot', label: 'OT Task' },
      { key: 'assign-tasks', label: 'Assign Tasks' },
    ];
  }, []);

  // Determine active tab
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    
    if (lastPart === id || lastPart === '') {
      setActiveTab('overview');
    } else {
      const isTabAllowed = tabs.some(tab => tab.key === lastPart);
      if (isTabAllowed) {
        setActiveTab(lastPart);
      } else {
        setActiveTab('overview');
        navigate(`/admin/patient-profile/${id}`, { replace: true });
      }
    }
  }, [location.pathname, id, tabs, navigate]);

  // Handle tab click for mobile
  const handleTabClick = (tabKey) => {
    const newPath = tabKey === 'overview' 
      ? `/admin/patient-profile/${id}`
      : `/admin/patient-profile/${id}/${tabKey}`;
    
    navigate(newPath);
    setMobileMenuOpen(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Loading Patient Data...</h1>
          <p className="text-gray-600">Please wait while we fetch the patient information</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Patient Not Found</h1>
          <p className="text-gray-600 mb-4">
            {error?.message || "The patient you're looking for doesn't exist."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/admin/patient-profile')}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Back to Patients
            </button>
            <button
              onClick={() => refetch()}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header Container */}
        <div className="z-30 bg-white shadow-md">
          {/* Back Button & Mobile Menu Toggle */}
          <div className="bg-white px-4 md:px-6 py-3 border-b border-gray-200 flex items-center justify-between">
            <button
              onClick={() => navigate('/admin/patient-profile')}
              className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Patients</span>
              <span className="sm:hidden">Back</span>
            </button>
            
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 relative z-40"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Header - Green Theme */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 md:p-6 lg:p-8">
            {/* Mobile Header Summary */}
            <div className="md:hidden mb-4">
              <h1 className="text-lg font-bold truncate">{data.personalInfo.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <div>
                  <p className="opacity-90 text-[10px] uppercase tracking-wider">UHID</p>
                  <p className="font-semibold">{data.personalInfo.uhid}</p>
                </div>
                <div>
                  <p className="opacity-90 text-[10px] uppercase tracking-wider">IPD</p>
                  <p className="font-semibold">{data.personalInfo.ipd}</p>
                </div>
                <div>
                  <p className="opacity-90 text-[10px] uppercase tracking-wider">Days</p>
                  <p className="font-semibold">{calculateDaysInHospital(data.admissionInfo.admissionDate)}</p>
                </div>
              </div>
            </div>

            {/* Desktop Grid Header */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { label: 'Name', value: data.personalInfo.name, bold: true },
                { label: 'Admission Type', value: data.admissionInfo.admissionType },
                { label: 'UHID', value: data.personalInfo.uhid },
                { label: 'IPD No', value: data.personalInfo.ipd },
                { label: 'Age', value: `${data.personalInfo.age} Years` },
                { label: 'Consultant', value: data.personalInfo.consultantDr },
                { label: 'Department', value: data.departmentInfo.department },
                { label: 'Ward', value: data.departmentInfo.ward },
                { label: 'Bed Number', value: data.departmentInfo.bedNumber },
                { label: 'Days in Hospital', value: `${calculateDaysInHospital(data.admissionInfo.admissionDate)} Days` },
              ].map((item, idx) => (
                <div key={idx} className="min-w-0">
                  <p className="text-xs opacity-80 mb-1 uppercase tracking-wider font-medium">{item.label}</p>
                  <p className={`text-sm md:text-base truncate ${item.bold ? 'font-black' : 'font-bold'}`}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* Mobile Additional Info */}
            <div className="md:hidden mt-4 overflow-x-auto pb-2 custom-scrollbar">
              <div className="flex gap-6 min-w-max">
                {[
                  { label: 'Admission Type', value: data.admissionInfo.admissionType },
                  { label: 'Consultant', value: data.personalInfo.consultantDr },
                  { label: 'Department', value: data.departmentInfo.department },
                  { label: 'Ward', value: data.departmentInfo.ward },
                  { label: 'Bed No.', value: data.departmentInfo.bedNumber },
                ].map((item, idx) => (
                  <div key={idx} className="flex-shrink-0">
                    <p className="text-[10px] opacity-80 mb-1 uppercase tracking-wider font-medium">{item.label}</p>
                    <p className="text-xs font-bold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Menu Sidebar */}
          <div className={`md:hidden fixed inset-0 z-50 transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            {mobileMenuOpen && <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />}
            <div className="absolute right-0 top-0 h-full bg-white shadow-2xl w-72 flex flex-col">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-bold text-gray-900 tracking-tight">Patient Sections</h3>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-full hover:bg-gray-200 transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => handleTabClick(tab.key)}
                    className={`w-full text-left px-5 py-4 rounded-xl font-bold transition-all flex items-center gap-4 ${
                      activeTab === tab.key ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'text-gray-600 hover:bg-gray-50 hover:text-green-600'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeTab === tab.key ? 'bg-white' : 'bg-gray-300'}`} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Desktop Tab Navigation */}
          <div className="hidden md:block bg-white border-b border-gray-100 overflow-x-auto px-6 py-4">
            <nav className="flex gap-2 min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabClick(tab.key)}
                  className={`px-6 py-2.5 rounded-xl font-bold transition-all border ${
                    activeTab === tab.key
                      ? 'bg-green-600 text-white border-green-600 shadow-md shadow-green-100'
                      : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-white hover:text-green-600 hover:border-green-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content Sections */}
        <div className="p-4 md:p-8">
          <Outlet context={{ 
            data, 
            calculateDaysInHospital, 
            refetchPatientData: refetch,
            ipdNumber: data?.personalInfo?.ipd 
          }} />
        </div>
      </div>
    </div>
  );
}