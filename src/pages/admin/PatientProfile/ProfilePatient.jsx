import React, { useState, useEffect, useCallback } from 'react';
import { Eye, Trash2, Edit, Filter, Search, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import supabase from '../../../SupabaseClient'; // Adjust the path to your supabase client

// Status Badge Component
const StatusBadge = ({ status }) => {
    const getColors = () => {
        const statusUpper = (status || '').toUpperCase();
        if (statusUpper.includes('PRIVATE') || statusUpper === 'VIP') {
            return 'bg-purple-100 text-purple-700';
        } else if (statusUpper.includes('INSURANCE') || statusUpper.includes('CORPORATE')) {
            return 'bg-blue-100 text-blue-700';
        } else if (statusUpper.includes('AYUSHMAN') || statusUpper.includes('GJAY')) {
            return 'bg-green-100 text-green-700';
        }
        return 'bg-gray-100 text-gray-700';
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getColors()}`}>
            {status}
        </span>
    );
};

// Patient Card Component
const PatientCard = ({ patient, onViewDetails, onEdit, onDelete }) => {
    const patientName = patient.patient_name || patient.name || 'N/A';
    const consultantDr = patient.consultant_dr || patient.doctor || 'N/A';
    const age = patient.age || 'N/A';
    const bedLocation = patient.bed_location || patient.location_status || patient.ward || 'N/A';
    const bedNo = patient.bed_no || patient.bedNumber || 'N/A';
    const ipdNo = patient.ipd_number || patient.admission_no || 'N/A';
    const patCategory = patient.pat_category || patient.patientCategory || 'General';
    const timeInWard = patient.time_in_ward || calculateTimeInWard(patient.admission_date) || 'N/A';
    const mobileNumber = patient.phone_no || patient.mobileNumber || 'N/A';
    const wardType = patient.ward_type || 'N/A';
    const roomNo = patient.room || patient.room_no || 'N/A';
    const department = patient.department || 'N/A';

    // Function to calculate time in ward
    const calculateTimeInWard = (admissionDate) => {
        if (!admissionDate) return 'N/A';
        try {
            const admitted = new Date(admissionDate);
            const now = new Date();
            const diffMs = now - admitted;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);
            const remainingHours = diffHours % 24;

            if (diffDays > 0) {
                return `${diffDays}d ${remainingHours}h`;
            } else if (diffHours > 0) {
                return `${diffHours}h`;
            } else {
                return 'Less than 1h';
            }
        } catch (error) {
            return 'N/A';
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-md hover:shadow-lg border border-gray-200 p-5 transition-all duration-300 hover:scale-[1.02]">
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{patientName}</h3>
                    <p className="text-sm text-gray-600">{consultantDr}</p>
                    <p className="text-xs text-gray-500 mt-1">{department}</p>
                </div>
                <div className="bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold flex-shrink-0">
                    {age}
                </div>
            </div>

            <div className="space-y-2 mb-4 border-t pt-3">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ward/Bed:</span>
                    <span className="font-semibold text-gray-900">{bedLocation} / {bedNo}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IPD No:</span>
                    <span className="font-semibold text-gray-900">{ipdNo}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Mobile:</span>
                    <span className="font-semibold text-gray-900">{mobileNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ward Type:</span>
                    <span className="font-semibold text-blue-600">{wardType}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Room:</span>
                    <span className="font-semibold text-gray-900">{roomNo}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Time in Ward:</span>
                    <span className="font-semibold text-green-600">{timeInWard}</span>
                </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t mb-4">
                <StatusBadge status={patCategory} />
                {/* <span className="text-xs text-gray-500">ID: {patient.id}</span> */}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
                <button
                    onClick={() => onViewDetails(patient)}
                    className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg transition-colors font-medium text-sm"
                >
                    <Eye className="w-4 h-4" />
                    View Details
                </button>
                {/* <button
                    onClick={() => onEdit(patient.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                    title="Edit"
                >
                    <Edit className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(patient.id)}
                    className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                    title="Delete"
                >
                    <Trash2 className="w-4 h-4" />
                </button> */}
            </div>
        </div>
    );
};

// Main Component
export default function PatientProfile() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [wardFilter, setWardFilter] = useState('All Patients');
    const [patientsData, setPatientsData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('');

    // Load patients from Supabase
    const fetchPatients = useCallback(async () => {
        try {
            setLoading(true);
            setIsRefreshing(true);

            // Get current user details
            const currentUser = JSON.parse(localStorage.getItem('mis_user'));
            const userRole = currentUser?.role?.toLowerCase();
            const userName = currentUser?.name;

            let ipdNumbers = null;
            let shouldFilter = false;

            // Role-based filtering logic
            if (userRole === 'nurse' || userRole === 'ot' || userRole === 'ot staff') {
                shouldFilter = true;
                // Fetch assigned tasks for Nurse or OT Staff
                const { data: tasks, error: taskError } = await supabase
                    .from('nurse_assign_task')
                    .select('Ipd_number') // Column name is case-sensitive "Ipd_number"
                    .eq('assign_nurse', userName)
                    .not('planned1', 'is', null)
                    .is('actual1', null);

                if (taskError) {
                    console.error('Error fetching nurse/ot tasks:', taskError);
                } else if (tasks) {
                    ipdNumbers = tasks.map(t => t.Ipd_number);
                }
            } else if (userRole === 'rmo') {
                shouldFilter = true;
                // Fetch assigned tasks for RMO
                const { data: tasks, error: taskError } = await supabase
                    .from('rmo_assign_task')
                    .select('ipd_number') // Column name is "ipd_number"
                    .eq('assign_rmo', userName)
                    .not('planned1', 'is', null)
                    .is('actual1', null);

                if (taskError) {
                    console.error('Error fetching rmo tasks:', taskError);
                } else if (tasks) {
                    ipdNumbers = tasks.map(t => t.ipd_number);
                }
            }

            // Build the main query
            let query = supabase
                .from('ipd_admissions')
                .select('*')
                .order('timestamp', { ascending: false });

            // Apply filter if applicable
            if (shouldFilter && ipdNumbers) {
                if (ipdNumbers.length > 0) {
                    query = query.in('ipd_number', ipdNumbers); // Assuming ipd_admissions uses ipd_number
                } else {
                    // Start an impossible query to return empty result if no tasks assigned
                    query = query.eq('id', -1);
                }
            } else if (shouldFilter && !ipdNumbers) {
                query = query.eq('id', -1);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching patients:', error);
                setPatientsData([]);
            } else {
                setPatientsData(data || []);
            }
        } catch (error) {
            console.error('Error in fetchPatients:', error);
            setPatientsData([]);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
            setLastUpdated(new Date().toLocaleTimeString());
        }
    }, []);

    useEffect(() => {
        // Initial fetch only
        fetchPatients();
    }, [fetchPatients]);

    const wardFilters = [
        'All Patients',
        'General Male Ward',
        'General Female Ward',
        'ICU',
        'Private Ward',
        'PICU',
        'NICU',
        'Emergency',
        'HDU',
        'General Ward(5th floor)'
    ];

    // Get unique ward types from data for dynamic filters
    const dynamicWardFilters = Array.from(
        new Set(patientsData.map(p => p.ward_type).filter(Boolean))
    ).sort();

    // Combine static and dynamic filters
    const allWardFilters = [...wardFilters, ...dynamicWardFilters.filter(w => !wardFilters.includes(w))];

    const filteredPatients = patientsData.filter(patient => {
        const patientName = patient.patient_name || '';
        const ipdNo = patient.ipd_number || patient.admission_no || '';
        const consultantDr = patient.consultant_dr || '';
        const bedLocation = patient.bed_location || patient.location_status || patient.ward || '';
        const patCategory = patient.pat_category || '';
        const wardType = patient.ward_type || '';
        const department = patient.department || '';

        const matchesSearch = patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ipdNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            consultantDr.toLowerCase().includes(searchTerm.toLowerCase()) ||
            department.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesWard = wardFilter === 'All Patients' ||
            bedLocation === wardFilter ||
            wardType === wardFilter;
        const matchesCategory = filterCategory === 'All' || patCategory === filterCategory;

        return matchesSearch && matchesWard && matchesCategory;
    });

    const handleViewDetails = (patient) => {
        navigate(`/admin/patient-profile/${patient.id}`, { state: { patient } });
    };

    const handleEdit = async (patientId) => {
        // Find the patient to edit
        const patient = patientsData.find(p => p.id === patientId);
        if (patient) {
            alert(`Edit functionality for patient: ${patient.patient_name}\nID: ${patientId}`);
            // You can implement an edit modal here
        }
    };

    const handleDelete = async (patientId) => {
        if (window.confirm('Are you sure you want to delete this patient record? This action cannot be undone.')) {
            try {
                const { error } = await supabase
                    .from('ipd_admissions')
                    .delete()
                    .eq('id', patientId);

                if (error) {
                    console.error('Error deleting patient:', error);
                    alert('Failed to delete patient record.');
                    return;
                }

                // Refresh the list
                await fetchPatients();
                alert('Patient record deleted successfully!');
            } catch (error) {
                console.error('Error deleting patient:', error);
                alert('Failed to delete patient record.');
            }
        }
    };

    // Check if any filter is active
    const hasActiveFilters = wardFilter !== 'All Patients' || filterCategory !== 'All';

    const handleManualRefresh = () => {
        if (!isRefreshing) {
            fetchPatients();
        }
    };

    if (loading && patientsData.length === 0) {
        return (
            <div className="h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading patient data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header with Quick Actions */}
                <div className="flex-shrink-0 p-4 lg:p-6 bg-gray-50">
                    <div className="max-w-full mx-auto">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Patient Profiles</h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    Total Patients: {patientsData.length} | Showing: {filteredPatients.length}
                                    {lastUpdated && <span className="ml-2 text-gray-500">Last updated: {lastUpdated}</span>}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1 lg:min-w-[350px]">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search by name, IPD No, doctor, or department..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                                    />
                                </div>
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <Filter className="w-4 h-4" />
                                    <span className="hidden sm:inline">Filters</span>
                                    {hasActiveFilters && (
                                        <span className="px-1.5 py-0.5 text-xs font-semibold text-white bg-green-600 rounded-full">
                                            ●
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={handleManualRefresh}
                                    disabled={isRefreshing}
                                    className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                    <span className="text-sm">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ward Filter Buttons */}
                {showFilters && (
                    <div className="flex-shrink-0 px-4 lg:px-6 pb-4 bg-gray-50">
                        <div className="max-w-full mx-auto">
                            <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Filter by Ward/Location</h3>
                                    <button
                                        onClick={() => {
                                            setWardFilter('All Patients');
                                            setFilterCategory('All');
                                        }}
                                        className="text-xs text-green-600 hover:text-green-700 transition-colors"
                                    >
                                        Clear All
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 justify-start max-h-40 overflow-y-auto p-1">
                                    {allWardFilters.map((filter) => (
                                        <button
                                            key={filter}
                                            onClick={() => setWardFilter(filter)}
                                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${wardFilter === filter
                                                ? 'bg-green-600 text-white shadow-md'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {filter}
                                        </button>
                                    ))}
                                </div>

                                {/* Patient Category Filter */}
                                <div className="mt-6 pt-4 border-t">
                                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Patient Category</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {['All', 'General', 'Private', 'VIP', 'Insurance', 'Corporate', 'Ayushman', 'GJAY'].map((category) => (
                                            <button
                                                key={category}
                                                onClick={() => setFilterCategory(category)}
                                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${filterCategory === category
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {category}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Patients Grid - Scrollable */}
                <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-4 lg:pb-6">
                    <div className="max-w-full mx-auto">
                        {isRefreshing && patientsData.length > 0 && (
                            <div className="mb-4 text-center">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                    Updating patient data...
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredPatients.length > 0 ? (
                                filteredPatients.map(patient => (
                                    <PatientCard
                                        key={patient.id}
                                        patient={patient}
                                        onViewDetails={handleViewDetails}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                    />
                                ))
                            ) : (
                                <div className="col-span-full text-center py-12 bg-white rounded-lg shadow-md">
                                    <div className="flex flex-col gap-2 items-center">
                                        <Filter className="w-12 h-12 text-gray-400" />
                                        <p className="text-gray-500 text-lg mb-2">No patients found</p>
                                        <p className="text-gray-400 text-sm">No patients match your search criteria</p>
                                        {hasActiveFilters && (
                                            <button
                                                onClick={() => {
                                                    setWardFilter('All Patients');
                                                    setFilterCategory('All');
                                                    setSearchTerm('');
                                                }}
                                                className="mt-4 text-sm text-green-600 hover:text-green-700"
                                            >
                                                Clear filters to see all patients
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Show total count */}
                        {filteredPatients.length > 0 && (
                            <div className="mt-6 text-center text-sm text-gray-500">
                                Showing {filteredPatients.length} of {patientsData.length} patients
                                {wardFilter !== 'All Patients' && ` in ${wardFilter}`}
                                {lastUpdated && ` • Last updated: ${lastUpdated}`}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}