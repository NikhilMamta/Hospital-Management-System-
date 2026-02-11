import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, Trash2, Edit, Filter, Search, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import supabase from '../../../SupabaseClient'; // Adjust the path to your supabase client
import PatientCard from '../../../components/PatientCard';

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
    const [statusFilter, setStatusFilter] = useState('Active');
    const [doctorTab, setDoctorTab] = useState('active');

    const location = useLocation();

    const getShiftTimeRange = () => {
        const now = new Date();
        const hour = now.getHours();

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000)
            .toISOString()
            .split('T')[0];

        if (hour >= 8 && hour < 14) {
            // Shift A
            return {
                shift: 'A',
                start: `${today} 08:00:00`,
                end: `${today} 14:00:00`
            };
        }

        if (hour >= 14 && hour < 20) {
            // Shift B
            return {
                shift: 'B',
                start: `${today} 14:00:00`,
                end: `${today} 20:00:00`
            };
        }

        // Shift C (Night shift)
        if (hour >= 20) {
            return {
                shift: 'C',
                start: `${today} 20:00:00`,
                end: `${today} 23:59:59`
            };
        }

        // Between 12 AM – 8 AM (belongs to previous night shift)
        return {
            shift: 'C',
            start: `${yesterday} 20:00:00`,
            end: `${today} 08:00:00`
        };
    };
    const currentUser = JSON.parse(localStorage.getItem('mis_user'));
    const userRole = currentUser?.role?.toLowerCase();
    const userName = currentUser?.name?.trim();
    // Load patients from Supabase
    const fetchPatients = useCallback(async () => {
        try {
            setLoading(true);
            setIsRefreshing(true);

            const { start, end } = getShiftTimeRange();

            let ipdNumbers = [];
            let shouldFilter = false;

            // ============================
            // NURSE / OT / OT STAFF
            // ============================
            if (['nurse', 'ot', 'ot staff'].includes(userRole)) {
                shouldFilter = true;

                const { data, error } = await supabase
                    .from('nurse_assign_task')
                    .select('Ipd_number, actual1, status')
                    .eq('assign_nurse', userName)
                    .gte('planned1', start)
                    .lte('planned1', end)

                if (!error && data) {
                    ipdNumbers = data.map(t => t.Ipd_number);
                }
            }

            // ============================
            // RMO
            // ============================
            else if (userRole === 'rmo') {
                shouldFilter = true;

                const { data, error } = await supabase
                    .from('rmo_assign_task')
                    .select('ipd_number')
                    .eq('assign_rmo', userName)
                    .gte('planned1', start)
                    .lte('planned1', end);

                if (!error && data) {
                    ipdNumbers = data.map(t => t.ipd_number);
                }
            }
            // ============================
            // DRESSING STAFF
            // ============================
            // else if (userRole === 'dressing staff') {
            //     shouldFilter = true;

            //     const { data, error } = await supabase
            //         .from('dressing')   // 👈 your table name
            //         .select('ipd_number')
            //         .eq('assign_staff', userName)   // 👈 column holding staff name
            //         .gte('planned1', start)
            //         .lte('planned1', end);

            //     if (!error && data) {
            //         ipdNumbers = data.map(t => t.ipd_number);
            //     }
            // }

            // ============================
            // FETCH PATIENTS
            // ============================
            let query = supabase
                .from('ipd_admissions')
                .select('*')
                .order('timestamp', { ascending: false });

            if (userRole === 'doctor') {
                if (doctorTab === 'active' || doctorTab === 'discharged') {
                    // Only assigned to this doctor
                    query = query.eq('consultant_dr', userName);
                }
            }
            if (shouldFilter) {
                if (ipdNumbers.length > 0) {
                    query = query.in('ipd_number', ipdNumbers);
                } else {
                    query = query.eq('id', -1); // no patients
                }
            }

            const { data, error } = await query;

            if (!error) {
                setPatientsData(data || []);
            } else {
                console.error(error);
                setPatientsData([]);
            }

        } catch (err) {
            console.error('fetchPatients error:', err);
            setPatientsData([]);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
            setLastUpdated(new Date().toLocaleTimeString());
        }
    }, [doctorTab, userRole, userName]);

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients, location.key]);

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

        let matchesStatus = true;

        // ✅ Doctor tab logic
        if (userRole === 'doctor') {
            if (doctorTab === 'active') {
                matchesStatus = !patient.actual1; // not discharged
            } else if (doctorTab === 'discharged') {
                matchesStatus = !!patient.actual1; // discharged
            }
            // doctorTab === 'all' → no status filter
        } else {
            // Existing status filter for other roles
            matchesStatus =
                statusFilter === 'All' ||
                (statusFilter === 'Active' && !patient.actual1) ||
                (statusFilter === 'Discharged' && patient.actual1);
        }

        return matchesSearch && matchesWard && matchesCategory && matchesStatus;
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

                {/* Status Tabs */}
                <div className="flex gap-8 mb-4 px-4 lg:px-6 border-b">
                    {['All', 'Active', 'Discharged'].map((status) => {
                        const key = status.toLowerCase(); // 'all' | 'active' | 'discharged'

                        const isActive =
                            userRole === 'doctor'
                                ? doctorTab === key
                                : statusFilter === status;

                        return (
                            <button
                                key={status}
                                onClick={() => {
                                    if (userRole === 'doctor') {
                                        setDoctorTab(key);
                                    } else {
                                        setStatusFilter(status);
                                    }
                                }}
                                className={`pb-2 text-sm font-semibold transition-all relative
                    ${isActive
                                        ? 'text-green-600'
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {status}

                                {/* Underline */}
                                {isActive && (
                                    <span className="absolute left-0 bottom-0 w-full h-[2px] bg-green-600 rounded-full"></span>
                                )}
                            </button>
                        );
                    })}
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