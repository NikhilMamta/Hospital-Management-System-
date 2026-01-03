import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Save, X, Stethoscope, User, AlertCircle, Calendar, Clock, RefreshCw, ClipboardList, Check, CheckCircle, CalendarDays, LogOut, ChevronDown, ChevronUp, Phone, MapPin, Bed } from 'lucide-react';
import supabase from '../SupabaseClient';
import { useNotification } from '../contexts/NotificationContext';

const PMS = () => {
    const [patients, setPatients] = useState([]);
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [assignments, setAssignments] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { showNotification } = useNotification();

    // Tab states
    const [activeTab, setActiveTab] = useState('rmo');
    const [rmoTasks, setRmoTasks] = useState([]);
    const [nurseTasks, setNurseTasks] = useState([]);
    const [rmoStaffList, setRmoStaffList] = useState([]);
    const [nurseStaffList, setNurseStaffList] = useState([]);
    const [assignedRmoTasks, setAssignedRmoTasks] = useState([]);
    const [assignedNurseTasks, setAssignedNurseTasks] = useState([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [otStatus, setOtStatus] = useState(null);
    const [isInformToRMOCompleted, setIsInformToRMOCompleted] = useState(false);
    const [isCheckingRMOCompletion, setIsCheckingRMOCompletion] = useState(false);
    const [isLoadingOTStatus, setIsLoadingOTStatus] = useState(false);
    const [dischargeStatus, setDischargeStatus] = useState(null);
    const [expandedPatient, setExpandedPatient] = useState(null);

    // Task assignment form data
    const [assignmentFormData, setAssignmentFormData] = useState({
        shift: '',
        assign_staff: '',
        reminder: 'No',
        start_date: '',
        patient_name: '',
        ipd_number: '',
        admission_no: ''
    });

    // Shifts options
    const shifts = ['Shift A', 'Shift B', 'Shift C'];
    const reminderOptions = ['Yes', 'No'];

    // Fetch IPD admissions from database
    useEffect(() => {
        fetchIPDAdmissions();
        fetchStaffLists();

        const storedAssignments = localStorage.getItem('pmsStaffAssignments');
        if (storedAssignments) {
            setAssignments(JSON.parse(storedAssignments));
        }
    }, []);

    // Load patient data when modal opens
    useEffect(() => {
        if (selectedPatient && showModal) {
            console.log('Modal opened, loading patient data...');
            loadPatientData();
        }
    }, [selectedPatient, showModal]);

    // Load RMO tasks when completion status changes
    useEffect(() => {
        if (selectedPatient && showModal) {
            if (isInformToRMOCompleted) {
                fetchRmoTasks();
            } else {
                setRmoTasks([]);
            }
        }
    }, [isInformToRMOCompleted, selectedPatient, showModal]);

    // Load nurse tasks when OT status or discharge status changes
    useEffect(() => {
        if (selectedPatient && showModal && (otStatus !== null || dischargeStatus !== null)) {
            console.log('OT status or discharge status updated, fetching nurse tasks:', { otStatus, dischargeStatus });
            fetchNurseTasks();
        }
    }, [otStatus, dischargeStatus, selectedPatient, showModal]);

    const loadPatientData = async () => {
        setTasksLoading(true);
        console.log('Starting to load ALL patient data...');

        try {
            console.log('Step 1: Checking OT status...');
            await checkOTStatus();

            console.log('Step 2: Checking discharge status...');
            await checkDischargeStatus();

            console.log('Step 3: Checking Inform To RMO completion...');
            await checkInformToRMOCompletion();

            console.log('Step 4: Fetching nurse tasks...');
            await fetchNurseTasks();

            console.log('Step 5: Fetching assigned tasks...');
            await fetchAssignedTasks();

            console.log('All patient data loaded successfully!');
        } catch (err) {
            console.error('Error loading patient data:', err);
        } finally {
            setTasksLoading(false);
        }
    };

    const fetchIPDAdmissions = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('ipd_admissions')
                .select('*')
                .is('actual1', null)
                .not('planned1', 'is', null)
                .order('timestamp', { ascending: false });

            if (fetchError) throw fetchError;

            setPatients(data || []);
            setFilteredPatients(data || []);
        } catch (err) {
            console.error('Error fetching IPD admissions:', err);
            setError('Failed to load patient data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const fetchStaffLists = async () => {
        try {
            const { data: rmoData, error: rmoError } = await supabase
                .from('all_staff')
                .select('name')
                .eq('designation', 'RMO')
                .order('name');

            if (!rmoError && rmoData) {
                setRmoStaffList(rmoData.map(staff => staff.name));
            }

            const { data: nurseData, error: nurseError } = await supabase
                .from('all_staff')
                .select('name')
                .eq('designation', 'Staff Nurse')
                .order('name');

            if (!nurseError && nurseData) {
                setNurseStaffList(nurseData.map(staff => staff.name));
            }
        } catch (err) {
            console.error('Error fetching staff lists:', err);
        }
    };

    const checkOTStatus = async () => {
        if (!selectedPatient) return;

        try {
            setIsLoadingOTStatus(true);
            console.log('Checking OT status for IPD:', selectedPatient.ipd_number);

            setOtStatus(null);

            const { data, error } = await supabase
                .from('ot_information')
                .select('actual2, planned2')
                .eq('ipd_number', selectedPatient.ipd_number)
                .maybeSingle();

            console.log('OT Status check result:', data);

            if (!error && data) {
                if (data.actual2 && data.planned2) {
                    console.log('POST-OT status detected for patient');
                    setOtStatus('post-ot');
                }
                else if (!data.actual2 && data.planned2) {
                    console.log('PRE-OT status detected for patient');
                    setOtStatus('pre-ot');
                }
                else {
                    console.log('NO OT status for patient');
                    setOtStatus(null);
                }
            } else {
                console.log('No OT record found for patient');
                setOtStatus(null);
            }
        } catch (err) {
            console.error('Error checking OT status:', err);
            setOtStatus(null);
        } finally {
            setIsLoadingOTStatus(false);
        }
    };

    const checkDischargeStatus = async () => {
        if (!selectedPatient) {
            setDischargeStatus(null);
            return;
        }

        try {
            console.log('Checking discharge status for IPD:', selectedPatient.ipd_number);

            setDischargeStatus(null);

            const { data, error } = await supabase
                .from('discharge')
                .select('planned5, actual5')
                .eq('ipd_number', selectedPatient.ipd_number)
                .maybeSingle();

            console.log('Discharge Status check result:', data);

            if (!error && data) {
                if (data.planned5 && data.actual5) {
                    console.log('DISCHARGE status detected for patient');
                    setDischargeStatus('discharge');
                } else {
                    console.log('No valid discharge status for patient');
                    setDischargeStatus(null);
                }
            } else {
                console.log('No discharge record found for patient or error:', error);
                setDischargeStatus(null);
            }
        } catch (err) {
            console.error('Error checking discharge status:', err);
            setDischargeStatus(null);
        }
    };

    const checkInformToRMOCompletion = async () => {
        if (!selectedPatient) {
            setIsInformToRMOCompleted(false);
            return;
        }

        try {
            setIsCheckingRMOCompletion(true);
            console.log('Checking Inform To RMO completion for IPD:', selectedPatient.ipd_number);

            const { data, error } = await supabase
                .from('nurse_assign_task')
                .select('planned1, actual1')
                .eq('Ipd_number', selectedPatient.ipd_number)
                .eq('task', 'Inform To RMO')
                .not('planned1', 'is', null)
                .not('actual1', 'is', null)
                .maybeSingle();

            if (error) {
                console.error('Error checking Inform To RMO completion:', error);
                setIsInformToRMOCompleted(false);
                return;
            }

            console.log('Inform To RMO check result:', data);

            if (data && data.planned1 && data.actual1) {
                console.log('Inform To RMO task is COMPLETED for patient:', selectedPatient.ipd_number);
                setIsInformToRMOCompleted(true);
            } else {
                console.log('Inform To RMO task is NOT completed for patient:', selectedPatient.ipd_number);
                setIsInformToRMOCompleted(false);
            }
        } catch (err) {
            console.error('Error checking Inform To RMO completion:', err);
            setIsInformToRMOCompleted(false);
        } finally {
            setIsCheckingRMOCompletion(false);
        }
    };

    const fetchRmoTasks = async () => {
        try {
            console.log('Fetching RMO tasks... isInformToRMOCompleted:', isInformToRMOCompleted);

            if (!isInformToRMOCompleted) {
                console.log('Not fetching RMO tasks - Inform To RMO not completed');
                setRmoTasks([]);
                return;
            }

            const { data: rmoTasksData, error: rmoError } = await supabase
                .from('pre_defined_task')
                .select('*')
                .eq('staff', 'rmo')
                .eq('ot_task', 'normal');

            if (!rmoError && rmoTasksData) {
                console.log('RMO tasks fetched:', rmoTasksData.length);
                setRmoTasks(rmoTasksData);
            } else {
                console.log('No RMO tasks found or error:', rmoError);
                setRmoTasks([]);
            }
        } catch (err) {
            console.error('Error fetching RMO tasks:', err);
            setRmoTasks([]);
        }
    };

    const fetchNurseTasks = async () => {
        try {
            console.log('Fetching nurse tasks with status:', { otStatus, dischargeStatus });

            let allNurseTasks = [];

            console.log('Fetching regular nurse tasks...');
            const { data: normalNurseTasksData, error: normalNurseError } = await supabase
                .from('pre_defined_task')
                .select('*')
                .eq('staff', 'nurse')
                .eq('ot_task', 'normal');

            if (!normalNurseError && normalNurseTasksData) {
                allNurseTasks = [...normalNurseTasksData];
                console.log('Regular nurse tasks found:', normalNurseTasksData.length);
            } else {
                console.log('No regular nurse tasks found or error:', normalNurseError);
            }

            if (otStatus === 'pre-ot') {
                console.log('Fetching pre-OT nurse tasks...');
                const { data: preOTNurseTasksData, error: preOTError } = await supabase
                    .from('pre_defined_task')
                    .select('*')
                    .eq('staff', 'nurse')
                    .eq('ot_task', 'pre OT');

                if (!preOTError && preOTNurseTasksData) {
                    allNurseTasks = [...allNurseTasks, ...preOTNurseTasksData];
                    console.log('Pre-OT nurse tasks added:', preOTNurseTasksData.length);
                } else {
                    console.log('No pre-OT tasks found or error:', preOTError);
                }
            }
            else if (otStatus === 'post-ot') {
                console.log('Fetching post-OT nurse tasks...');
                const { data: postOTNurseTasksData, error: postOTError } = await supabase
                    .from('pre_defined_task')
                    .select('*')
                    .eq('staff', 'nurse')
                    .eq('ot_task', 'post OT');

                if (!postOTError && postOTNurseTasksData) {
                    allNurseTasks = [...allNurseTasks, ...postOTNurseTasksData];
                    console.log('Post-OT nurse tasks added:', postOTNurseTasksData.length);
                } else {
                    console.log('No post-OT tasks found or error:', postOTError);
                }
            }

            if (dischargeStatus === 'discharge') {
                console.log('Fetching discharge nurse tasks...');
                const { data: dischargeNurseTasksData, error: dischargeError } = await supabase
                    .from('pre_defined_task')
                    .select('*')
                    .eq('staff', 'nurse')
                    .eq('ot_task', 'discharge');

                if (!dischargeError && dischargeNurseTasksData) {
                    allNurseTasks = [...allNurseTasks, ...dischargeNurseTasksData];
                    console.log('Discharge nurse tasks added:', dischargeNurseTasksData.length);
                } else {
                    console.log('No discharge tasks found or error:', dischargeError);
                }
            }

            console.log('Total nurse tasks to display:', allNurseTasks.length);
            setNurseTasks(allNurseTasks);

        } catch (err) {
            console.error('Error fetching nurse tasks:', err);
            setNurseTasks([]);
        }
    };

    const fetchAssignedTasks = async () => {
        if (!selectedPatient) return;

        try {
            const { data: assignedRmoData, error: rmoError } = await supabase
                .from('rmo_assign_task')
                .select('task')
                .eq('ipd_number', selectedPatient.ipd_number);

            if (!rmoError && assignedRmoData) {
                setAssignedRmoTasks(assignedRmoData.map(item => item.task));
            }

            const { data: assignedNurseData, error: nurseError } = await supabase
                .from('nurse_assign_task')
                .select('task')
                .eq('Ipd_number', selectedPatient.ipd_number);

            if (!nurseError && assignedNurseData) {
                setAssignedNurseTasks(assignedNurseData.map(item => item.task));
            }
        } catch (err) {
            console.error('Error fetching assigned tasks:', err);
        }
    };

    const handleAssignClick = (patient) => {
        console.log('Opening modal for patient:', patient.ipd_number);

        setIsInformToRMOCompleted(false);
        setRmoTasks([]);
        setNurseTasks([]);
        setAssignedRmoTasks([]);
        setAssignedNurseTasks([]);
        setOtStatus(null);
        setDischargeStatus(null);

        setSelectedPatient(patient);
        setShowModal(true);
        setActiveTab('nurse');

        setAssignmentFormData({
            shift: '',
            assign_staff: '',
            reminder: 'No',
            start_date: new Date().toISOString().split('T')[0],
            patient_name: patient.patient_name,
            ipd_number: patient.ipd_number,
            admission_no: patient.admission_no
        });
    };

    const handleAssignAllTasks = async (e) => {
        e.preventDefault();

        if (!selectedPatient) return;

        if (!assignmentFormData.assign_staff) {
            showNotification(`Please select a ${activeTab === 'rmo' ? 'RMO' : 'Nurse'}`, 'info');
            return;
        }

        if (!assignmentFormData.shift) {
            showNotification('Please select a shift', 'info');
            return;
        }

        try {
            const currentTasks = activeTab === 'rmo' ? rmoTasks : nurseTasks;
            const alreadyAssignedTasks = activeTab === 'rmo' ? assignedRmoTasks : assignedNurseTasks;

            const tasksToAssign = currentTasks.filter(task =>
                !alreadyAssignedTasks.includes(task.task)
            );

            if (tasksToAssign.length === 0) {
                showNotification(`All ${activeTab === 'rmo' ? 'RMO' : 'Nurse'} tasks are already assigned for this patient.`, 'info');
                return;
            }

            const assignmentsToInsert = tasksToAssign.map(task => {
                const baseData = {
                    timestamp: new Date().toLocaleString("en-CA", {
                        timeZone: "Asia/Kolkata",
                        hour12: false
                    }).replace(',', ''),
                    patient_name: selectedPatient.patient_name,
                    patient_location: selectedPatient.bed_location || selectedPatient.ward_type || '',
                    ward_type: selectedPatient.ward_type || '',
                    room: selectedPatient.room || '',
                    bed_no: selectedPatient.bed_no || '',
                    shift: assignmentFormData.shift,
                    reminder: assignmentFormData.reminder,
                    start_date: assignmentFormData.start_date,
                    task: task.task,
                    planned1: new Date().toLocaleString("en-CA", {
                        timeZone: "Asia/Kolkata",
                        hour12: false
                    }).replace(',', ''),
                };

                if (activeTab === 'rmo') {
                    baseData.ipd_number = selectedPatient.ipd_number;
                    baseData.assign_rmo = assignmentFormData.assign_staff;
                    baseData.staff = 'regular';
                } else {
                    baseData.Ipd_number = selectedPatient.ipd_number;
                    baseData.assign_nurse = assignmentFormData.assign_staff;

                    if (task.ot_task === 'pre OT') {
                        baseData.staff = 'pre ot';
                    } else if (task.ot_task === 'post OT') {
                        baseData.staff = 'post ot';
                    } else if (task.ot_task === 'discharge') {
                        baseData.staff = 'discharge';
                    } else {
                        baseData.staff = 'regular';
                    }
                }

                return baseData;
            });

            const tableName = activeTab === 'rmo' ? 'rmo_assign_task' : 'nurse_assign_task';
            const { error } = await supabase
                .from(tableName)
                .insert(assignmentsToInsert);

            if (error) {
                console.error('Error inserting tasks:', error);
                throw error;
            }

            if (activeTab === 'rmo') {
                setAssignedRmoTasks(prev => [...prev, ...tasksToAssign.map(task => task.task)]);
            } else {
                setAssignedNurseTasks(prev => [...prev, ...tasksToAssign.map(task => task.task)]);

                const hasInformToRMOTask = tasksToAssign.some(task => task.task === "Inform To RMO");
                if (hasInformToRMOTask) {
                    console.log('"Inform To RMO" task was assigned. Will check completion in 2 seconds...');
                    setTimeout(() => {
                        loadPatientData();
                    }, 2000);
                }
            }

            showNotification(`${tasksToAssign.length} tasks assigned successfully to ${assignmentFormData.assign_staff}`, 'success');

        } catch (err) {
            console.error('Error assigning tasks:', err);
            showNotification('Failed to assign tasks. Please try again.', 'error');
        }
    };

    const refreshPatientData = async () => {
        if (selectedPatient && showModal) {
            await loadPatientData();
        }
    };

    const filteredPatientsList = patients.filter(patient =>
        patient.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.ipd_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.admission_no?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatPlannedDate = (dateString) => {
        if (!dateString) return 'Not Scheduled';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN') + ' ' + date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getAvailableTasks = () => {
        const allTasks = activeTab === 'rmo' ? rmoTasks : nurseTasks;
        const alreadyAssigned = activeTab === 'rmo' ? assignedRmoTasks : assignedNurseTasks;

        return allTasks.filter(task => !alreadyAssigned.includes(task.task));
    };

    const getOTTaskCount = () => {
        if (otStatus === 'pre-ot') {
            return nurseTasks.filter(task => task.ot_task === 'pre OT').length;
        } else if (otStatus === 'post-ot') {
            return nurseTasks.filter(task => task.ot_task === 'post OT').length;
        }
        return 0;
    };

    const getDischargeTaskCount = () => {
        if (dischargeStatus === 'discharge') {
            return nurseTasks.filter(task => task.ot_task === 'discharge').length;
        }
        return 0;
    };

    const getRegularNurseTaskCount = () => {
        return nurseTasks.filter(task => task.ot_task === 'normal').length;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading patient data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-3 md:p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Patient Staff Assignment</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Assign tasks to RMO and Nursing staff for IPD patients
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search patients..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <button
                                onClick={fetchIPDAdmissions}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 text-sm"
                            >
                                <RefreshCw className="w-4 h-4" />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm">
                            <div className="flex items-start">
                                <AlertCircle className="w-4 h-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                                <p className="text-red-700">{error}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Patient Cards - Mobile View */}
            <div className="md:hidden space-y-3">
                {filteredPatientsList.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
                        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-base font-medium text-gray-600 mb-2">No patients found</p>
                        <p className="text-sm text-gray-500">
                            {searchTerm ? 'No patients match your search' : 'No planned IPD admissions pending'}
                        </p>
                    </div>
                ) : (
                    filteredPatientsList.map((patient) => {
                        const assignment = assignments[patient.ipd_number];
                        const isExpanded = expandedPatient === patient.ipd_number;

                        return (
                            <div key={patient.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                {/* Card Header */}
                                <div className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-900 text-sm">{patient.patient_name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                                                    IPD: {patient.ipd_number || 'N/A'}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${assignment ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {assignment ? 'Assigned' : 'Pending'}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setExpandedPatient(isExpanded ? null : patient.ipd_number)}
                                            className="text-gray-500 p-1"
                                        >
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <p className="text-xs text-gray-500">Admission No</p>
                                            <p className="font-medium">{patient.admission_no || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Department</p>
                                            <p className="font-medium">{patient.department || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="border-t px-4 py-3 bg-gray-50">
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                                        <Bed className="w-3 h-3" /> Bed No
                                                    </p>
                                                    <p className="text-sm font-medium">{patient.bed_no || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Ward Type</p>
                                                    <p className="text-sm font-medium">{patient.ward_type || 'N/A'}</p>
                                                </div>
                                            </div>

                                            <div>
                                                <p className="text-xs text-gray-500">Planned Admission</p>
                                                <p className="text-sm font-medium">{formatPlannedDate(patient.planned1)}</p>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Stethoscope className="w-4 h-4 text-green-600" />
                                                        <span className="text-sm font-medium">RMO</span>
                                                    </div>
                                                    <span className={`text-sm ${assignment?.rmoName ? 'text-green-700 font-medium' : 'text-gray-400 italic'}`}>
                                                        {assignment?.rmoName || 'Not Assigned'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4 text-blue-600" />
                                                        <span className="text-sm font-medium">Nurse</span>
                                                    </div>
                                                    <span className={`text-sm ${assignment?.nurseName ? 'text-blue-700 font-medium' : 'text-gray-400 italic'}`}>
                                                        {assignment?.nurseName || 'Not Assigned'}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleAssignClick(patient)}
                                                className="w-full mt-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 text-sm"
                                            >
                                                <UserPlus className="w-4 h-4" />
                                                Assign Tasks
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Patient Details</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Admission Info</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Assigned RMO</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Assigned Nurse</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredPatientsList.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Calendar className="w-12 h-12 text-gray-300 mb-4" />
                                            <p className="text-lg font-medium text-gray-600 mb-2">No patients found</p>
                                            <p className="text-gray-500">
                                                {searchTerm ? 'No patients match your search' : 'No planned IPD admissions pending'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredPatientsList.map((patient) => {
                                    const assignment = assignments[patient.ipd_number];
                                    return (
                                        <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-900">{patient.patient_name}</span>
                                                    <div className="flex flex-col text-sm text-gray-500 mt-1">
                                                        <span>IPD: {patient.ipd_number || 'N/A'}</span>
                                                        <span>Age: {patient.age || 'N/A'}, {patient.gender || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-gray-900">{patient.department || 'N/A'}</span>
                                                    <span className="text-xs text-gray-500">
                                                        Adm No: {patient.admission_no || 'N/A'}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        Bed: {patient.bed_no || 'N/A'} | Ward: {patient.ward_type || 'N/A'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {assignment?.rmoName ? (
                                                    <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1 rounded-full w-fit">
                                                        <Stethoscope className="w-3 h-3" />
                                                        <span className="text-sm font-medium">{assignment.rmoName}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400 italic">Not Assigned</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {assignment?.nurseName ? (
                                                    <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-3 py-1 rounded-full w-fit">
                                                        <User className="w-3 h-3" />
                                                        <span className="text-sm font-medium">{assignment.nurseName}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400 italic">Not Assigned</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${assignment ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {assignment ? 'Staff Assigned' : 'Pending'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleAssignClick(patient)}
                                                    className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center justify-end gap-1 ml-auto"
                                                >
                                                    <UserPlus className="w-4 h-4" />
                                                    Assign Tasks
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Task Assignment Modal */}
            {showModal && selectedPatient && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 md:p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl overflow-hidden max-h-[90vh] flex flex-col">
                        {/* Modal Header - Mobile Optimized */}
                        <div className="bg-blue-600 text-white p-4 flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold truncate pr-2">Assign Tasks</h2>
                                        <p className="text-sm text-blue-100 truncate">
                                            Patient: {selectedPatient.patient_name}
                                        </p>
                                        <p className="text-xs text-blue-200">
                                            IPD: {selectedPatient.ipd_number}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                        <button
                                            onClick={refreshPatientData}
                                            className="p-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-sm flex items-center"
                                            disabled={tasksLoading}
                                        >
                                            <RefreshCw className={`w-3 h-3 ${tasksLoading ? 'animate-spin' : ''}`} />
                                        </button>
                                        <button
                                            onClick={() => setShowModal(false)}
                                            className="text-white hover:text-blue-100 p-1"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Status Indicators - Mobile Stacked */}
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {isLoadingOTStatus ? (
                                        <div className="flex items-center gap-1 bg-blue-700 px-2 py-1 rounded text-xs">
                                            <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-white"></div>
                                            <span>Checking OT...</span>
                                        </div>
                                    ) : otStatus === 'pre-ot' ? (
                                        <div className="flex items-center gap-1 bg-purple-700 px-2 py-1 rounded text-xs">
                                            <CalendarDays className="w-3 h-3" />
                                            <span>Pre-OT</span>
                                        </div>
                                    ) : otStatus === 'post-ot' ? (
                                        <div className="flex items-center gap-1 bg-green-700 px-2 py-1 rounded text-xs">
                                            <CalendarDays className="w-3 h-3" />
                                            <span>Post-OT</span>
                                        </div>
                                    ) : null}

                                    {dischargeStatus === 'discharge' && (
                                        <div className="flex items-center gap-1 bg-red-600 px-2 py-1 rounded text-xs">
                                            <LogOut className="w-3 h-3" />
                                            <span>Discharge</span>
                                        </div>
                                    )}

                                    {isCheckingRMOCompletion ? (
                                        <div className="flex items-center gap-1 bg-blue-700 px-2 py-1 rounded text-xs">
                                            <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-white"></div>
                                            <span>Checking RMO...</span>
                                        </div>
                                    ) : (
                                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${isInformToRMOCompleted ? 'bg-green-700' : 'bg-yellow-600'
                                            }`}>
                                            {isInformToRMOCompleted ? (
                                                <>
                                                    <CheckCircle className="w-3 h-3" />
                                                    <span>RMO Available</span>
                                                </>
                                            ) : (
                                                <>
                                                    <AlertCircle className="w-3 h-3" />
                                                    <span>Waiting for Nurse</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tabs - Mobile Optimized */}
                        <div className="border-b border-gray-200">
                            <nav className="flex">
                                <button
                                    onClick={() => setActiveTab('rmo')}
                                    className={`flex-1 py-3 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'rmo'
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex flex-col items-center gap-1">
                                        <Stethoscope className="w-4 h-4" />
                                        <span className="text-xs">RMO Tasks</span>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setActiveTab('nurse')}
                                    className={`flex-1 py-3 px-1 text-center border-b-2 font-medium text-sm ${activeTab === 'nurse'
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex flex-col items-center gap-1">
                                        <User className="w-4 h-4" />
                                        <span className="text-xs">Nurse Tasks</span>
                                    </div>
                                </button>
                            </nav>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 md:p-6">
                            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 md:gap-6">
                                {/* Left side - Task List */}
                                <div className="lg:col-span-2">
                                    <div className="mb-4 md:mb-6 bg-blue-50 p-3 md:p-4 rounded-lg">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-blue-800 text-sm md:text-base">Patient Information</h3>
                                                <div className="grid grid-cols-2 gap-2 md:gap-4 mt-2">
                                                    <div>
                                                        <span className="text-xs text-blue-600">Planned Admission:</span>
                                                        <p className="text-xs md:text-sm font-medium truncate">{formatPlannedDate(selectedPatient.planned1)}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-blue-600">Department:</span>
                                                        <p className="text-xs md:text-sm font-medium truncate">{selectedPatient.department || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-blue-600">Ward:</span>
                                                        <p className="text-xs md:text-sm font-medium truncate">{selectedPatient.ward_type || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-blue-600">Bed:</span>
                                                        <p className="text-xs md:text-sm font-medium truncate">{selectedPatient.bed_no || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-3">
                                                    {tasksLoading ? (
                                                        <div className="flex items-center gap-2 p-2 bg-blue-100 rounded">
                                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                                            <span className="text-xs text-blue-700">Loading patient tasks...</span>
                                                        </div>
                                                    ) : otStatus === 'pre-ot' ? (
                                                        <div className="p-2 bg-purple-50 border border-purple-200 rounded">
                                                            <div className="flex items-center gap-2">
                                                                <CalendarDays className="w-3 h-3 text-purple-600 flex-shrink-0" />
                                                                <div>
                                                                    <p className="text-xs font-medium text-purple-700">
                                                                        This patient has OT Planned
                                                                    </p>
                                                                    <p className="text-xs text-purple-600 mt-0.5">
                                                                        {getOTTaskCount()} pre-OT tasks available
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : otStatus === 'post-ot' ? (
                                                        <div className="p-2 bg-green-50 border border-green-200 rounded">
                                                            <div className="flex items-center gap-2">
                                                                <CalendarDays className="w-3 h-3 text-green-600 flex-shrink-0" />
                                                                <div>
                                                                    <p className="text-xs font-medium text-green-700">
                                                                        This patient has Completed OT
                                                                    </p>
                                                                    <p className="text-xs text-green-600 mt-0.5">
                                                                        {getOTTaskCount()} post-OT tasks available
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : dischargeStatus === 'discharge' ? (
                                                        <div className="p-2 bg-red-50 border border-red-200 rounded">
                                                            <div className="flex items-center gap-2">
                                                                <LogOut className="w-3 h-3 text-red-600 flex-shrink-0" />
                                                                <div>
                                                                    <p className="text-xs font-medium text-red-700">
                                                                        This patient has Discharge Scheduled
                                                                    </p>
                                                                    <p className="text-xs text-red-600 mt-0.5">
                                                                        {getDischargeTaskCount()} discharge tasks available
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="p-2 bg-gray-50 border border-gray-200 rounded">
                                                            <div className="flex items-center gap-2">
                                                                <AlertCircle className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                                <p className="text-xs font-medium text-gray-700">
                                                                    No special status detected
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <ClipboardList className="w-6 h-6 md:w-8 md:h-8 text-blue-400 flex-shrink-0 ml-2" />
                                        </div>
                                    </div>

                                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                        <div className="bg-gray-50 px-3 md:px-4 py-3 border-b border-gray-200">
                                            <div>
                                                <h3 className="font-semibold text-gray-900 text-sm md:text-base">
                                                    {activeTab === 'rmo' ? 'RMO' : 'Nurse'} Tasks List
                                                </h3>
                                                <p className="text-xs md:text-sm text-gray-500 mt-1">
                                                    {activeTab === 'rmo' && !isInformToRMOCompleted ? (
                                                        <span className="text-yellow-600">
                                                            RMO tasks unlock after nurse completes "Inform To RMO"
                                                        </span>
                                                    ) : (
                                                        <>
                                                            {getAvailableTasks().length} available tasks
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="overflow-y-auto max-h-[300px] md:max-h-[400px]">
                                            {tasksLoading ? (
                                                <div className="flex justify-center items-center py-8">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                                    <span className="ml-3 text-sm text-gray-600">Loading tasks...</span>
                                                </div>
                                            ) : activeTab === 'rmo' && !isInformToRMOCompleted ? (
                                                <div className="px-4 py-8 text-center">
                                                    <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                                                    <p className="text-gray-600 font-medium text-sm">RMO Tasks Not Available Yet</p>
                                                    <p className="text-gray-500 text-xs mt-2 max-w-md mx-auto">
                                                        RMO tasks unlock after nurse completes "Inform To RMO" task.
                                                    </p>
                                                    <button
                                                        onClick={() => setActiveTab('nurse')}
                                                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                                                    >
                                                        Go to Nurse Tab
                                                    </button>
                                                </div>
                                            ) : getAvailableTasks().length === 0 ? (
                                                <div className="px-4 py-8 text-center">
                                                    <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-4" />
                                                    <p className="text-gray-600 font-medium text-sm">All tasks assigned!</p>
                                                    <p className="text-gray-500 text-xs mt-1">
                                                        No more {activeTab === 'rmo' ? 'RMO' : 'Nurse'} tasks available.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-gray-200">
                                                    {getAvailableTasks().map((task, index) => (
                                                        <div key={task.id} className="p-3 md:p-4 hover:bg-gray-50">
                                                            <div className="flex items-start gap-3">
                                                                <div className="flex items-center justify-center w-6 h-6 md:w-8 md:h-8 bg-blue-100 text-blue-600 rounded-full font-medium text-xs md:text-sm flex-shrink-0">
                                                                    {task.task_no || index + 1}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-medium text-gray-900 truncate">{task.task}</p>
                                                                            {task.description && (
                                                                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex-shrink-0 ml-2">
                                                                            {task.ot_task === 'pre OT' ? (
                                                                                <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-medium">
                                                                                    Pre-OT
                                                                                </span>
                                                                            ) : task.ot_task === 'post OT' ? (
                                                                                <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                                                                                    Post-OT
                                                                                </span>
                                                                            ) : task.ot_task === 'discharge' ? (
                                                                                <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">
                                                                                    Discharge
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                                                                                    Regular
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right side - Assignment Form */}
                                <div>
                                    <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6 sticky top-0">
                                        <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4">
                                            Assign All {activeTab === 'rmo' ? 'RMO' : 'Nurse'} Tasks
                                        </h3>

                                        <form onSubmit={handleAssignAllTasks} className="space-y-3 md:space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Select {activeTab === 'rmo' ? 'RMO' : 'Nurse'}
                                                </label>
                                                <select
                                                    value={assignmentFormData.assign_staff}
                                                    onChange={(e) => setAssignmentFormData({
                                                        ...assignmentFormData,
                                                        assign_staff: e.target.value
                                                    })}
                                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    required
                                                    disabled={activeTab === 'rmo' && !isInformToRMOCompleted}
                                                >
                                                    <option value="">Select {activeTab === 'rmo' ? 'RMO' : 'Nurse'}</option>
                                                    {(activeTab === 'rmo' ? rmoStaffList : nurseStaffList).map((staff, index) => (
                                                        <option key={index} value={staff}>{staff}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                                                <select
                                                    value={assignmentFormData.shift}
                                                    onChange={(e) => setAssignmentFormData({
                                                        ...assignmentFormData,
                                                        shift: e.target.value
                                                    })}
                                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    required
                                                    disabled={activeTab === 'rmo' && !isInformToRMOCompleted}
                                                >
                                                    <option value="">Select Shift</option>
                                                    {shifts.map((shift) => (
                                                        <option key={shift} value={shift}>{shift}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={assignmentFormData.start_date}
                                                    onChange={(e) => setAssignmentFormData({
                                                        ...assignmentFormData,
                                                        start_date: e.target.value
                                                    })}
                                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    required
                                                    disabled={activeTab === 'rmo' && !isInformToRMOCompleted}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Reminder</label>
                                                <select
                                                    value={assignmentFormData.reminder}
                                                    onChange={(e) => setAssignmentFormData({
                                                        ...assignmentFormData,
                                                        reminder: e.target.value
                                                    })}
                                                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    disabled={activeTab === 'rmo' && !isInformToRMOCompleted}
                                                >
                                                    {reminderOptions.map((option) => (
                                                        <option key={option} value={option}>{option}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className={`border rounded-lg p-3 md:p-4 mt-4 md:mt-6 ${activeTab === 'rmo' && !isInformToRMOCompleted
                                                    ? 'bg-gray-100 border-gray-300'
                                                    : 'bg-yellow-50 border-yellow-200'
                                                }`}>
                                                <div className="flex items-start gap-2 md:gap-3">
                                                    <AlertCircle className={`w-4 h-4 md:w-5 md:h-5 flex-shrink-0 ${activeTab === 'rmo' && !isInformToRMOCompleted
                                                            ? 'text-gray-400'
                                                            : 'text-yellow-600'
                                                        }`} />
                                                    <div className="flex-1 min-w-0">
                                                        {activeTab === 'rmo' && !isInformToRMOCompleted ? (
                                                            <>
                                                                <p className="text-xs md:text-sm font-medium text-gray-700">
                                                                    RMO Tasks Not Available
                                                                </p>
                                                                <p className="text-xs text-gray-600 mt-0.5">
                                                                    Complete "Inform To RMO" in Nurse tab first.
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="text-xs md:text-sm font-medium text-yellow-800">
                                                                    Assigning {getAvailableTasks().length} tasks
                                                                </p>
                                                                <p className="text-xs text-yellow-700 mt-0.5">
                                                                    Already assigned tasks are excluded
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                className={`w-full mt-3 md:mt-4 px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 text-sm ${activeTab === 'rmo' && !isInformToRMOCompleted
                                                        ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                                                        : getAvailableTasks().length === 0
                                                            ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                                    }`}
                                                disabled={getAvailableTasks().length === 0 || (activeTab === 'rmo' && !isInformToRMOCompleted)}
                                            >
                                                <Save className="w-4 h-4 md:w-5 md:h-5" />
                                                {activeTab === 'rmo' && !isInformToRMOCompleted
                                                    ? 'RMO Tasks Not Available'
                                                    : `Assign ${getAvailableTasks().length} Tasks`
                                                }
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PMS;