import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { useParams, useNavigate, useLocation, Outlet } from 'react-router-dom';
import supabase from '../../../SupabaseClient';
import { useAuth } from '../../../contexts/AuthContext';

// Predefined Tasks Template
const getDefaultTasks = () => ({
  nurseTasks: [
    { id: 1, task: 'Vital Signs Monitoring', status: 'Pending', time: 'N/A', assignedTo: 'Nurse on Duty', dueDate: new Date().toISOString().split('T')[0] },
    { id: 2, task: 'Medication Administration', status: 'Pending', time: 'N/A', assignedTo: 'Nurse on Duty', dueDate: new Date().toISOString().split('T')[0] },
    { id: 3, task: 'Blood Sample Collection', status: 'Pending', time: 'N/A', assignedTo: 'Nurse on Duty', dueDate: new Date().toISOString().split('T')[0] },
    { id: 4, task: 'Wound Dressing', status: 'Pending', time: 'N/A', assignedTo: 'Nurse on Duty', dueDate: new Date().toISOString().split('T')[0] },
    { id: 5, task: 'Patient Hygiene Care', status: 'Pending', time: 'N/A', assignedTo: 'Nurse on Duty', dueDate: new Date().toISOString().split('T')[0] },
    { id: 6, task: 'ECG Monitoring Setup', status: 'Pending', time: 'N/A', assignedTo: 'Nurse on Duty', dueDate: new Date().toISOString().split('T')[0] },
  ],
  labTests: [
    {
      name: 'Complete Blood Count (CBC)',
      type: 'Pathology',
      status: 'Pending',
      requestDate: new Date().toISOString().split('T')[0],
      reportDate: 'N/A',
      results: 'Awaiting sample collection',
    },
    {
      name: 'Blood Glucose',
      type: 'Pathology',
      status: 'Pending',
      requestDate: new Date().toISOString().split('T')[0],
      reportDate: 'N/A',
      results: 'Awaiting sample collection',
    },
    {
      name: 'Chest X-Ray',
      type: 'Radiology',
      status: 'Pending',
      requestDate: new Date().toISOString().split('T')[0],
      reportDate: 'N/A',
      results: 'Awaiting scan',
    },
  ],
  pharmacyIndent: [
    {
      date: new Date().toISOString().split('T')[0],
      medicineName: 'To be prescribed',
      quantity: 0,
      status: 'Pending',
      approvedBy: 'Pending',
    },
  ],
  treatmentPlan: {
    diagnosis: 'To be diagnosed by doctor',
    procedures: [
      { name: 'Initial Assessment', date: new Date().toISOString().split('T')[0], status: 'Scheduled', notes: 'Pending doctor review' },
    ],
    medications: [],
  },
  vitalsMonitoring: {
    lastUpdated: new Date().toLocaleString(),
    bloodPressure: 'N/A',
    heartRate: 'N/A',
    temperature: 'N/A',
    respiratoryRate: 'N/A',
    oxygenSaturation: 'N/A',
    status: 'Pending Assessment',
  },
  staffAssigned: {
    rmo: {
      name: 'To be assigned',
      designation: 'Resident Medical Officer',
      contact: 'N/A',
      assignedDate: new Date().toISOString().split('T')[0],
    },
    nurses: [
      { name: 'To be assigned', shift: 'Morning (6 AM - 2 PM)', assignedDate: new Date().toISOString().split('T')[0] },
      { name: 'To be assigned', shift: 'Evening (2 PM - 10 PM)', assignedDate: new Date().toISOString().split('T')[0] },
      { name: 'To be assigned', shift: 'Night (10 PM - 6 AM)', assignedDate: new Date().toISOString().split('T')[0] },
    ],
  },
});

// Helper function to format address
const formatAddress = (patient) => {
  const addressParts = [
    patient.house_street || patient.houseStreet,
    patient.area_colony || patient.areaColony,
    patient.city,
    patient.state,
    patient.pincode ? `Pincode: ${patient.pincode}` : null
  ].filter(Boolean);
  
  return addressParts.length > 0 ? addressParts.join(', ') : 'N/A';
};

// Helper function to format emergency contact
const formatEmergencyContact = (patient) => {
  const name = patient.kin_name || patient.kinName || 'N/A';
  const mobile = patient.kin_mobile || patient.kinMobile || 'N/A';
  const relation = patient.kin_relation || patient.kinRelation;
  
  let contact = `${name} - ${mobile}`;
  if (relation) {
    contact += ` (${relation})`;
  }
  return contact;
};

// Get consultant doctor from patient data
const getConsultantDoctor = (patient) => {
  return (
    patient.consultant_dr || 
    patient.primary_doctor || 
    patient.refer_by_dr || 
    'To be assigned'
  );
};

// Fetch UHID from pharmacy table by matching ipd_number
const fetchUhidFromPharmacy = async (ipdNumber) => {
  if (!ipdNumber || ipdNumber === 'N/A') return null;
  
  try {
    const { data, error } = await supabase
     .from('pharmacy')
  .select('uhid_number')
  .eq('ipd_number', ipdNumber)
  .order('timestamp', { ascending: false })
  .limit(1)
  .single();
     
    if (error) {
      console.warn('Error fetching UHID from pharmacy:', error);
      return null;
    }
console.log('Fetched UHID from pharmacy:', data);
    return data?.uhid_number || null;
  } catch (error) {
    console.warn('Error in fetchUhidFromPharmacy:', error);
    return null;
  }
};

// Transform IPD patient data to match the display format
const transformPatientData = async (patient) => {
  const defaultTasks = getDefaultTasks();

  // Get IPD number from patient data
  const ipdNumber = patient.ipd_number || patient.ipdNumber || patient.admission_number;
  
  // Fetch UHID from pharmacy table
  let uhidFromPharmacy = null;
  if (ipdNumber && ipdNumber !== 'N/A') {
    uhidFromPharmacy = await fetchUhidFromPharmacy(ipdNumber);
  }

  return {
    personalInfo: {
      name: patient.patient_name || patient.patientName || 'N/A',
      uhid: uhidFromPharmacy || patient.uhid || patient.admission_number || 'N/A', // Priority: pharmacy > ipd_admissions
      ipd: ipdNumber || 'N/A',
      age: patient.age || 'N/A',
      gender: patient.gender || 'N/A',
      phone: patient.mobile_number || patient.phone_number || patient.mobileNumber || 'N/A',
      address: formatAddress(patient),
      consultantDr: getConsultantDoctor(patient),
      allergies: patient.allergies || 'None reported',
      emergencyContact: formatEmergencyContact(patient),
    },
    admissionInfo: {
      admissionDate: patient.admission_date || patient.timestamp || new Date().toLocaleString(),
      admissionType: patient.admission_type || patient.patient_case || 'General',
      admissionMode: patient.admission_mode || patient.medical_surgical || 'N/A',
      reasonForAdmission: patient.reason_for_admission || patient.admission_purpose || 'N/A',
      status: patient.status || 'Active',
    },
    departmentInfo: {
      department: patient.department || 'N/A',
      ward: patient.ward || patient.bed_location || patient.location_status || 'N/A',
      bedNumber: patient.bed_number || patient.bed_no || 'N/A',
      room: patient.room|| 'N/A',
      ward_type: patient.ward_type||'N/A',
      bedStatus: patient.bed_status || 'Occupied',
    },
    doctorInfo: {
      primaryDoctor: getConsultantDoctor(patient),
      specialty: patient.specialty || patient.department || 'N/A',
      consultants: patient.consultants || (patient.refer_by_dr ? [patient.refer_by_dr] : []),
      doctorPhone: patient.doctor_phone || 'N/A',
      officeHours: patient.office_hours || '10:00 AM - 4:00 PM',
    },
    billing: {
      totalBilledAmount: parseFloat(patient.total_billed_amount || patient.advance_amount || 0),
      outstandingAmount: parseFloat(patient.outstanding_amount || 0),
      paymentMode: patient.payment_mode || patient.pat_category || 'N/A',
      insuranceCompany: patient.insurance_company || patient.pat_category || 'N/A',
    },
    // Use predefined tasks
    ...defaultTasks,
  };
};

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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth(); // Get user from AuthContext

  // Get all tabs - SHOW ALL TABS TO ALL USERS
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
  }, []); // Removed user?.role dependency

  // Determine active tab
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    
    // Reset to overview if we're at the main patient profile page
    if (lastPart === id || lastPart === '') {
      setActiveTab('overview');
    } else {
      // Check if the current tab is allowed (all tabs are allowed now)
      const isTabAllowed = tabs.some(tab => tab.key === lastPart);
      if (isTabAllowed) {
        setActiveTab(lastPart);
      } else {
        // Redirect to overview if current tab is not found (shouldn't happen with all tabs allowed)
        setActiveTab('overview');
        navigate(`/admin/patient-profile/${id}`, {
          state: { patient: location.state?.patient },
          replace: true
        });
      }
    }
  }, [location.pathname, id, tabs, navigate, location.state?.patient]);

  // Fetch patient data
  useEffect(() => {
    fetchPatientData();
  }, [id]);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      setError(null);

      // First try to get data from navigation state
      if (location.state?.patient) {
        const transformedData = await transformPatientData(location.state.patient);
        setData(transformedData);
        setLoading(false);
        return;
      }

      // If no state, fetch from Supabase
      const { data: supabaseData, error: supabaseError } = await supabase
        .from('ipd_admissions')
        .select('*')
        .eq('id', id)
        .single();

      if (supabaseError) {
        throw supabaseError;
      }

      if (!supabaseData) {
        throw new Error('Patient not found in database');
      }

      // Transform the data with async UHID fetch
      const transformedData = await transformPatientData(supabaseData);
      setData(transformedData);
    } catch (err) {
      console.error('Error fetching patient data:', err);
      setError(err.message || 'Failed to fetch patient data');
      
      // Fallback to localStorage if Supabase fails
      try {
        const storedIpdRecords = localStorage.getItem('ipdAdmissionRecords');
        if (storedIpdRecords) {
          const records = JSON.parse(storedIpdRecords);
          const patient = records.find(p => p.id && p.id.toString() === id);
          if (patient) {
            console.log('Loaded patient from localStorage fallback:', patient);
            const transformedData = await transformPatientData(patient);
            setData(transformedData);
            setError(null);
          }
        }
      } catch (localStorageError) {
        console.error('Error loading from localStorage:', localStorageError);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle tab click for mobile
  const handleTabClick = (tabKey) => {
    const newPath = tabKey === 'overview' 
      ? `/admin/patient-profile/${id}`
      : `/admin/patient-profile/${id}/${tabKey}`;
    
    navigate(newPath, { 
      state: { patient: location.state?.patient } 
    });
    setMobileMenuOpen(false);
  };

  // Loading state
  if (loading) {
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
            {error || "The patient you're looking for doesn't exist."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/admin/patient-profile')}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Back to Patients
            </button>
            <button
              onClick={fetchPatientData}
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
        {/* Sticky Header Container */}
        <div className=" top-0 z-30 bg-white shadow-md">
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
            
            {/* Mobile Menu Toggle - Shows hamburger icon only when menu is closed */}
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
                  <p className="opacity-90">UHID</p>
                  <p className="font-semibold">{data.personalInfo.uhid}</p>
                </div>
                <div>
                  <p className="opacity-90">IPD</p>
                  <p className="font-semibold">{data.personalInfo.ipd}</p>
                </div>
                <div>
                  <p className="opacity-90">Days</p>
                  <p className="font-semibold">{calculateDaysInHospital(data.admissionInfo.admissionDate)}</p>
                </div>
              </div>
            </div>

            {/* Desktop Grid Header */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <p className="text-xs md:text-sm opacity-90 mb-1">Name</p>
                <p className="text-sm md:text-base font-bold truncate">{data.personalInfo.name}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm opacity-90 mb-1">Admission Type</p>
                <p className="text-sm md:text-base font-bold">{data.admissionInfo.admissionType}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm opacity-90 mb-1">UHID</p>
                <p className="text-sm md:text-base font-bold">{data.personalInfo.uhid}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm opacity-90 mb-1">IPD No</p>
                <p className="text-sm md:text-base font-bold">{data.personalInfo.ipd}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm opacity-90 mb-1">Age</p>
                <p className="text-sm md:text-base font-bold">{data.personalInfo.age} Years</p>
              </div>
              <div>
                <p className="text-xs md:text-sm opacity-90 mb-1">Consultant Dr.</p>
                <p className="text-sm md:text-base font-bold truncate">{data.personalInfo.consultantDr}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm opacity-90 mb-1">Department</p>
                <p className="text-sm md:text-base font-bold truncate">{data.departmentInfo.department}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm opacity-90 mb-1">Ward Name</p>
                <p className="text-sm md:text-base font-bold truncate">{data.departmentInfo.ward}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm opacity-90 mb-1">Bed Number</p>
                <p className="text-sm md:text-base font-bold">{data.departmentInfo.bedNumber}</p>
              </div>
              <div>
                <p className="text-xs md:text-sm opacity-90 mb-1">Days in Hospital</p>
                <p className="text-sm md:text-base font-bold">
                  {calculateDaysInHospital(data.admissionInfo.admissionDate)} Days
                </p>
              </div>
            </div>

            {/* Mobile Additional Info (Scrollable) */}
            <div className="md:hidden mt-4 overflow-x-auto pb-2">
              <div className="flex gap-4 min-w-max">
                <div className="flex-shrink-0">
                  <p className="text-xs opacity-90 mb-1">Admission Type</p>
                  <p className="text-sm font-bold">{data.admissionInfo.admissionType}</p>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-xs opacity-90 mb-1">Consultant Dr.</p>
                  <p className="text-sm font-bold truncate max-w-[120px]">{data.personalInfo.consultantDr}</p>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-xs opacity-90 mb-1">Department</p>
                  <p className="text-sm font-bold truncate max-w-[120px]">{data.departmentInfo.department}</p>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-xs opacity-90 mb-1">Ward</p>
                  <p className="text-sm font-bold">{data.departmentInfo.ward}</p>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-xs opacity-90 mb-1">Bed No.</p>
                  <p className="text-sm font-bold">{data.departmentInfo.bedNumber}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Menu Sidebar - Appears from top-right */}
          <div className={`md:hidden fixed inset-0 z-50 transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            {/* Overlay - Click to close */}
            {mobileMenuOpen && (
              <div 
                className="absolute inset-0 bg-black bg-opacity-50"
                onClick={() => setMobileMenuOpen(false)}
              />
            )}
            
            {/* Sidebar */}
            <div className="absolute right-0 top-0 h-auto bg-white shadow-xl w-64">
              {/* Sidebar Header with Cross Icon */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-gray-50">
                <div>
                  <h3 className="font-semibold text-gray-900">Patient Sections</h3>
                  <p className="text-sm text-gray-600 mt-1">Choose a tab to view</p>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              
              {/* Tab List */}
              <div className="px-2 py-4 space-y-1 max-h-[70vh] overflow-y-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => handleTabClick(tab.key)}
                    className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-3 ${
                      activeTab === tab.key
                        ? 'bg-green-50 text-green-700 border-l-4 border-green-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      activeTab === tab.key ? 'bg-green-600' : 'bg-gray-300'
                    }`} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Desktop Tab Navigation */}
          <div className="hidden md:block bg-white border-b border-gray-200 overflow-x-auto">
            <nav className="flex gap-1 px-6 py-3">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabClick(tab.key)}
                  className={`px-4 py-2 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Mobile Tab Navigation (Visible when menu is closed) */}
          {!mobileMenuOpen && (
            <div className="md:hidden bg-white border-b border-gray-200 overflow-x-auto px-4 py-3">
              <div className="flex items-center gap-2">
                {/* Current active tab indicator */}
                {/* <div className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium whitespace-nowrap">
                  {tabs.find(t => t.key === activeTab)?.label || 'Overview'}
                </div> */}
                
                {/* Menu dots to indicate more tabs */}
                <div className="flex items-center gap-1">
                  {/* <div className="flex gap-1">
                    {tabs
                      .filter(tab => tab.key !== activeTab)
                      .slice(0, 2)
                      .map((tab) => (
                        <div key={tab.key} className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      ))}
                  </div> */}
                  
                  {/* <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap flex items-center gap-1"
                  >
                    <Menu className="w-4 h-4" />
                    Menu
                  </button> */}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content Sections */}
        <div className="p-4 md:p-6 space-y-6">
          <Outlet context={{ 
            data, 
            calculateDaysInHospital, 
            refetchPatientData: fetchPatientData,
            ipdNumber: data?.personalInfo?.ipd // Pass IPD number to child components
          }} />
        </div>
      </div>
    </div>
  );
}