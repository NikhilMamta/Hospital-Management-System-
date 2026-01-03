import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNotification } from '../../../contexts/NotificationContext';
import {
    ClipboardList,
    Search,
    Calendar,
    User,
    AlertCircle,
    Edit,
    Save,
    X,
    Trash2,
    Plus,
    CheckCircle,
    Info,
    XCircle,
    Bed,
    Users,
    Clock,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import supabase from '../../../SupabaseClient';

const TaskList = () => {
    const [activeTab, setActiveTab] = useState('Pending');
    const [tasks, setTasks] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingTask, setEditingTask] = useState(null);
    const [predefinedTasks, setPredefinedTasks] = useState([]);
    const [customTaskInput, setCustomTaskInput] = useState('');
    const [showCustomTaskInput, setShowCustomTaskInput] = useState(false);
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [savingNewTask, setSavingNewTask] = useState(false);
    const { showNotification } = useNotification();
    const [availableNurses, setAvailableNurses] = useState([]);
    const [nurseSearchQuery, setNurseSearchQuery] = useState('');
    const [showNurseDropdown, setShowNurseDropdown] = useState(false);
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [occupiedBeds, setOccupiedBeds] = useState([]);
    const [selectedBed, setSelectedBed] = useState('');
    const [selectedPatientInfo, setSelectedPatientInfo] = useState(null);
    const [newTaskData, setNewTaskData] = useState({
        shift: 'Shift A',
        assignNurse: '',
        tasks: [''],
        reminder: 'No',
        startDate: new Date().toISOString().split('T')[0]
    });
    const [showCustomTaskModal, setShowCustomTaskModal] = useState(false);
    const [newCustomTask, setNewCustomTask] = useState('');
    const [addingCustomTask, setAddingCustomTask] = useState(false);
    const [expandedCard, setExpandedCard] = useState(null); // For mobile card expansion

    // Vitals Check Modal State
    const [showVitalsModal, setShowVitalsModal] = useState(false);
    const [selectedVitalsTask, setSelectedVitalsTask] = useState(null);
    const [vitalsData, setVitalsData] = useState({
        bloodPressure: '',
        pulseRate: '',
        temperature: '',
        spo2: '',
        rr: ''
    });

    const [userRole, setUserRole] = useState('');
    const [userName, setUserName] = useState('');

    const tableRef = useRef(null);
    const refreshIntervalRef = useRef(null);
    const nurseInputRef = useRef(null);
    const editNurseInputRef = useRef(null);
    const customTaskInputRef = useRef(null);
    const contentContainerRef = useRef(null);

    // Add CSS animation to document head
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slide-in {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            .animate-slide-in {
                animation: slide-in 0.3s ease-out;
            }
            @keyframes fade-in {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .animate-fade-in {
                animation: fade-in 0.3s ease-out;
            }
            .ot-staff-row {
                background-color: #fff7ed !important;
                border-left: 4px solid #f97316 !important;
            }
            .ot-staff-row:hover {
                background-color: #ffedd5 !important;
            }
            .ot-staff-badge {
                background-color: #fed7aa;
                color: #9a3412;
                border: 1px solid #fdba74;
            }
            @media (max-width: 768px) {
                .mobile-card {
                    transition: all 0.3s ease;
                }
                .mobile-card-expanded {
                    margin-bottom: 1rem;
                }
            }
            .scroll-container {
                scrollbar-width: thin;
                scrollbar-color: #cbd5e0 #f7fafc;
            }
            .scroll-container::-webkit-scrollbar {
                width: 6px;
                height: 6px;
            }
            .scroll-container::-webkit-scrollbar-track {
                background: #f7fafc;
                border-radius: 3px;
            }
            .scroll-container::-webkit-scrollbar-thumb {
                background-color: #cbd5e0;
                border-radius: 3px;
            }
        `;
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // Load user role and name from localStorage
    useEffect(() => {
        const storedUser = localStorage.getItem('mis_user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                setUserRole(user.role || '');
                setUserName(user.name || '');
            } catch (error) {
                console.error('Error parsing user from localStorage:', error);
            }
        }
    }, []);



    // Load available nurses from all_staff table
    const loadAvailableNurses = useCallback(async () => {
        try {
            const { data: nursesData, error } = await supabase
                .from('all_staff')
                .select('name')
                .eq('designation', 'Staff Nurse')
                .order('name');

            if (error) throw error;

            if (nursesData && nursesData.length > 0) {
                const nurses = nursesData
                    .filter(nurse => nurse.name && nurse.name.trim() !== '')
                    .map(nurse => ({
                        value: nurse.name,
                        label: nurse.name
                    }));

                setAvailableNurses(nurses);
            } else {
                // Fallback if no nurses found
                const defaultNurses = [
                    { value: 'John Doe', label: 'John Doe' },
                    { value: 'Jane Smith', label: 'Jane Smith' },
                    { value: 'Robert Johnson', label: 'Robert Johnson' },
                    { value: 'Sarah Williams', label: 'Sarah Williams' },
                    { value: 'Michael Brown', label: 'Michael Brown' }
                ];
                setAvailableNurses(defaultNurses);
            }
        } catch (error) {
            console.error('Error loading available nurses:', error);
            // Set default nurses on error
            const defaultNurses = [
                { value: 'John Doe', label: 'John Doe' },
                { value: 'Jane Smith', label: 'Jane Smith' },
                { value: 'Robert Johnson', label: 'Robert Johnson' },
                { value: 'Sarah Williams', label: 'Sarah Williams' },
                { value: 'Michael Brown', label: 'Michael Brown' }
            ];
            setAvailableNurses(defaultNurses);
        }
    }, []);

    // Load occupied beds from nurse_assign_task table
    const loadOccupiedBeds = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('nurse_assign_task')
                .select('bed_no, patient_name, Ipd_number, patient_location, ward_type, room')
                .not('bed_no', 'is', null)
                .neq('bed_no', '')
                .order('timestamp', { ascending: false });

            if (error) throw error;

            if (data) {
                // Get unique beds with latest patient info
                const bedMap = new Map();
                data.forEach(record => {
                    if (record.bed_no) {
                        if (!bedMap.has(record.bed_no) ||
                            (record.timestamp && bedMap.get(record.bed_no).timestamp < record.timestamp)) {
                            bedMap.set(record.bed_no, {
                                bedNo: record.bed_no,
                                patientName: record.patient_name || 'Unknown',
                                ipdNumber: record.Ipd_number || 'N/A',
                                location: record.patient_location || 'N/A',
                                wardType: record.ward_type || 'N/A',
                                room: record.room || 'N/A'
                            });
                        }
                    }
                });

                setOccupiedBeds(Array.from(bedMap.values()));
            }
        } catch (error) {
            console.error('Error loading occupied beds:', error);
            showNotification('Error loading bed information', 'error');
        }
    }, []);

    // Load predefined tasks from Supabase master table
    const loadPredefinedTasks = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('master')
                .select('nurse_task')
                .not('nurse_task', 'is', null)
                .neq('nurse_task', '')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data && data.length > 0) {
                const taskNames = data
                    .map(item => item.nurse_task)
                    .filter(task => task && task.trim() !== '');

                const uniqueTasks = [...new Set(taskNames)].sort();
                setPredefinedTasks(uniqueTasks);
            } else {
                const defaultTasks = [
                    'Vitals Check (BP, Pulse, Temp)',
                    'Medication Administration',
                    'IV Fluid Replacement',
                    'Dressing Change',
                    'Sponge Bath',
                    'Feeding (Ryles Tube / Oral)',
                    'Catheter Care',
                    'Position Changing',
                    'Nebulization',
                    'Insulin Administration',
                    'Blood Sugar Monitoring',
                    'Sample Collection',
                    'Doctor Rounds Assistance',
                    'Patient Hygiene Care',
                    'ECG Monitoring'
                ];
                setPredefinedTasks(defaultTasks);
            }
        } catch (error) {
            console.error('Error loading predefined tasks:', error);
            const defaultTasks = [
                'Vitals Check (BP, Pulse, Temp)',
                'Medication Administration',
                'IV Fluid Replacement',
                'Dressing Change',
                'Sponge Bath',
                'Feeding (Ryles Tube / Oral)',
                'Catheter Care',
                'Position Changing',
                'Nebulization',
                'Insulin Administration',
                'Blood Sugar Monitoring',
                'Sample Collection',
                'Doctor Rounds Assistance',
                'Patient Hygiene Care',
                'ECG Monitoring'
            ];
            setPredefinedTasks(defaultTasks);
        }
    }, []);

    // Function to add custom task to Supabase master table
    const addCustomTaskToDatabase = async (taskName) => {
        try {
            setAddingCustomTask(true);

            const { data, error } = await supabase
                .from('master')
                .insert([
                    {
                        nurse_task: taskName,
                        created_at: new Date().toLocaleString("en-CA", {
                            timeZone: "Asia/Kolkata",
                            hour12: false
                        }).replace(',', '')
                    }
                ])
                .select();

            if (error) throw error;

            // Update local predefined tasks
            setPredefinedTasks(prev => {
                const newTasks = [...prev, taskName];
                return [...new Set(newTasks)].sort();
            });

            showNotification(`Task "${taskName}" added to database!`, 'success');
            return true;
        } catch (error) {
            console.error('Error saving new task to Supabase:', error);
            throw error;
        } finally {
            setAddingCustomTask(false);
        }
    };

    // Handle adding custom task
    const handleAddCustomTask = async () => {
        if (!newCustomTask.trim()) {
            showNotification('Please enter a task name', 'error');
            return;
        }

        const taskName = newCustomTask.trim();

        // Check if task already exists
        if (predefinedTasks.includes(taskName)) {
            showNotification('This task already exists in the list!', 'info');
            setNewCustomTask('');
            setShowCustomTaskModal(false);
            return;
        }

        try {
            await addCustomTaskToDatabase(taskName);

            // Update the current task in new task form if we're in add task modal
            if (showAddTaskModal) {
                const updatedTasks = [...newTaskData.tasks];
                const lastIndex = updatedTasks.length - 1;
                if (lastIndex >= 0 && updatedTasks[lastIndex] === '') {
                    updatedTasks[lastIndex] = taskName;
                } else {
                    updatedTasks.push(taskName);
                }
                setNewTaskData(prev => ({
                    ...prev,
                    tasks: updatedTasks
                }));
            }

            setNewCustomTask('');
            setShowCustomTaskModal(false);
        } catch (error) {
            console.error('Error adding custom task:', error);
            showNotification('Error adding custom task. Please try again.', 'error');
        }
    };

    // Load tasks from database
    const loadTasks = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);

            let query = supabase
                .from('nurse_assign_task')
                .select('*');

            // Apply role-based filtering
            if (userRole && (userRole.toLowerCase().includes('nurse') || userRole.toLowerCase().includes('ot')) && userName) {
                query = query.ilike('assign_nurse', userName);
            }

            const { data, error } = await query
                .order('timestamp', { ascending: false })
                .order('id', { ascending: false });

            if (error) throw error;

            if (data) {
                const transformedTasks = data.map(task => {
                    let taskNames = [];
                    if (task.task && Array.isArray(task.task)) {
                        taskNames = task.task;
                    } else if (typeof task.task === 'string') {
                        taskNames = [task.task];
                    }

                    // Determine status based on planned1 and actual1
                    let status = 'Pending';
                    let displayStatus = 'Pending';

                    if (task.planned1 && !task.actual1) {
                        status = 'Pending';
                        displayStatus = 'Pending';
                    } else if (task.planned1 && task.actual1) {
                        status = 'Completed';
                        displayStatus = 'Completed';
                    } else {
                        status = 'Pending';
                        displayStatus = 'Pending';
                    }

                    return {
                        id: task.id,
                        taskId: task.task_no || `TASK-${task.id.toString().padStart(4, '0')}`,
                        status: status,
                        displayStatus: displayStatus,
                        taskStartDate: task.start_date || 'N/A',
                        ipdNumber: task.Ipd_number || 'N/A',
                        patientName: task.patient_name || 'N/A',
                        patientLocation: task.patient_location || 'N/A',
                        bedNo: task.bed_no || 'N/A',
                        assignNurse: task.assign_nurse || 'N/A',
                        shift: task.shift || 'N/A',
                        taskNames: taskNames,
                        reminder: task.reminder || 'No',
                        wardType: task.ward_type || 'N/A',
                        room: task.room || 'N/A',
                        timestamp: task.timestamp,
                        planned1: task.planned1,
                        planned1Date: task.planned1 ? new Date(task.planned1).toLocaleDateString('en-GB') : 'N/A',
                        planned1Time: task.planned1 ? new Date(task.planned1).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        }) : 'N/A',
                        actual1: task.actual1,
                        actual1Date: task.actual1 ? new Date(task.actual1).toLocaleDateString('en-GB') : 'N/A',
                        actual1Time: task.actual1 ? new Date(task.actual1).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        }) : 'N/A',
                        tasksJson: task.task,
                        staff: task.staff || 'Regular' // Add staff field with default value
                    };
                });
                setTasks(transformedTasks);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            showNotification('Error loading tasks from database', 'error');
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [userRole, userName]);

    // Handle bed selection
    const handleBedSelect = (bedInfo) => {
        setSelectedBed(bedInfo.bedNo);
        setSelectedPatientInfo(bedInfo);
    };

    // Handle new task data changes
    const handleNewTaskChange = useCallback((field, value) => {
        setNewTaskData(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    // Handle task item change
    const handleTaskItemChange = useCallback((index, value) => {
        const updatedTasks = [...newTaskData.tasks];
        if (value === '__custom__') {
            // Open custom task modal
            setShowCustomTaskModal(true);
        } else {
            updatedTasks[index] = value;
            setNewTaskData(prev => ({
                ...prev,
                tasks: updatedTasks
            }));
        }
    }, [newTaskData.tasks]);

    // Add task row in new task form
    const addNewTaskRow = useCallback(() => {
        if (newTaskData.tasks.length < 15) {
            setNewTaskData(prev => ({
                ...prev,
                tasks: [...prev.tasks, '']
            }));
        }
    }, [newTaskData.tasks.length]);

    // Remove task row in new task form
    const removeNewTaskRow = useCallback((index) => {
        if (newTaskData.tasks.length > 1) {
            const updatedTasks = [...newTaskData.tasks];
            updatedTasks.splice(index, 1);
            setNewTaskData(prev => ({
                ...prev,
                tasks: updatedTasks
            }));
        }
    }, [newTaskData.tasks.length]);

    // Submit new task
    const submitNewTask = async () => {
        try {
            if (!selectedPatientInfo) {
                showNotification('Please select a bed/patient', 'error');
                return;
            }

            if (!newTaskData.assignNurse.trim()) {
                showNotification('Please select a nurse', 'error');
                return;
            }

            const validTasks = newTaskData.tasks.filter(task => task.trim());
            if (validTasks.length === 0) {
                showNotification('Please add at least one task', 'error');
                return;
            }

            // Get current timestamp
            const now = new Date().toLocaleString("en-CA", {
                timeZone: "Asia/Kolkata",
                hour12: false
            }).replace(',', '');

            // Get the last task number to generate sequential numbers
            const { data: lastTask } = await supabase
                .from('nurse_assign_task')
                .select('task_no')
                .order('id', { ascending: false })
                .limit(1);

            let baseTaskNumber = 1;
            if (lastTask && lastTask[0]?.task_no) {
                const lastNum = parseInt(lastTask[0].task_no.replace('TASK-', ''));
                baseTaskNumber = lastNum + 1;
            }

            // Prepare task data array - one entry per task
            const taskEntries = validTasks.map((taskName, index) => {
                const taskNumber = `TASK-${(baseTaskNumber + index).toString().padStart(4, '0')}`;

                return {
                    // task_no: taskNumber,
                    timestamp: now,
                    planned1: now,
                    actual1: null,
                    Ipd_number: selectedPatientInfo.ipdNumber,
                    patient_name: selectedPatientInfo.patientName,
                    patient_location: selectedPatientInfo.location,
                    ward_type: selectedPatientInfo.wardType,
                    room: selectedPatientInfo.room,
                    bed_no: selectedPatientInfo.bedNo,
                    shift: newTaskData.shift,
                    assign_nurse: newTaskData.assignNurse.trim(),
                    reminder: newTaskData.reminder,
                    start_date: newTaskData.startDate,
                    task: taskName,
                    staff: 'Regular' // Default staff type when creating new task
                };
            });

            // Insert all tasks in separate rows
            const { data, error } = await supabase
                .from('nurse_assign_task')
                .insert(taskEntries)
                .select();

            if (error) throw error;

            showNotification(`${validTasks.length} task(s) added successfully!`, 'success');

            // Reset form
            setNewTaskData({
                shift: 'Shift A',
                assignNurse: '',
                tasks: [''],
                reminder: 'No',
                startDate: new Date().toISOString().split('T')[0]
            });
            setSelectedBed('');
            setSelectedPatientInfo(null);
            setShowAddTaskModal(false);

            // Refresh tasks
            loadTasks();

        } catch (error) {
            console.error('Error adding new tasks:', error);
            showNotification('Error adding new tasks', 'error');
        }
    };

    // Reset add task form
    const resetAddTaskForm = useCallback(() => {
        setNewTaskData({
            shift: 'Shift A',
            assignNurse: '',
            tasks: [''],
            reminder: 'No',
            startDate: new Date().toISOString().split('T')[0]
        });
        setSelectedBed('');
        setSelectedPatientInfo(null);
        setShowAddTaskModal(false);
    }, []);

    // Filter predefined tasks based on search query
    const filteredPredefinedTasks = taskSearchQuery
        ? predefinedTasks.filter(task =>
            task.toLowerCase().includes(taskSearchQuery.toLowerCase())
        )
        : predefinedTasks;

    useEffect(() => {
        if (!userRole) return;
        loadTasks(true); // Initial load with spinner
        loadPredefinedTasks();
        loadAvailableNurses();

        // Refresh every 2 minutes without showing loading spinner
        refreshIntervalRef.current = setInterval(() => {
            loadTasks(false);
        }, 120000);

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [loadTasks, loadPredefinedTasks, loadAvailableNurses, userRole, userName]);

    // Load occupied beds when add task modal opens
    useEffect(() => {
        if (showAddTaskModal) {
            loadOccupiedBeds();
        }
    }, [showAddTaskModal, loadOccupiedBeds]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'Completed': return 'bg-green-100 text-green-800 border-green-200';
            case 'Overdue': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const handleStatusUpdate = async (taskId, taskNo, newStatus) => {
        // Check if this is a Vitals Check task
        const taskToCheck = tasks.find(t => t.id === taskId);
        const isVitalsTask = taskToCheck?.taskNames?.some(name =>
            name.toLowerCase().includes("vitals check") ||
            name.toLowerCase().includes("bp, pulse, temp")
        );

        if (newStatus === 'Completed' && isVitalsTask) {
            setSelectedVitalsTask(taskToCheck);
            setVitalsData({
                bloodPressure: '',
                pulseRate: '',
                temperature: '',
                spo2: '',
                rr: ''
            });
            setShowVitalsModal(true);
            return; // Stop standard status update
        }

        try {
            const now = new Date().toLocaleString("en-CA", {
                timeZone: "Asia/Kolkata",
                hour12: false
            }).replace(',', '');

            const { error } = await supabase
                .from('nurse_assign_task')
                .update({
                    actual1: newStatus === 'Completed' ? now : null,
                    submitted_by: newStatus === 'Completed' ? userName : null
                })
                .eq('task_no', taskNo);

            if (error) throw error;

            // Update local state without reloading all data
            setTasks(prevTasks =>
                prevTasks.map(task =>
                    task.id === taskId
                        ? {
                            ...task,
                            status: newStatus,
                            displayStatus: newStatus,
                            actual1: newStatus === 'Completed' ? now : null
                        }
                        : task
                )
            );
            showNotification('Task marked as completed!', 'success');
        } catch (error) {
            console.error('Error updating task status:', error);
            showNotification('Error updating task status', 'error');
        }
    };

    // Handle Vitals Form Submission
    const handleSubmitVitals = async () => {
        if (!selectedVitalsTask) return;

        // Validate that at least one field is filled
        const hasAnyValue = Object.values(vitalsData).some(value => value.trim() !== '');
        if (!hasAnyValue) {
            showNotification('Please enter at least one vital sign value', 'error');
            return;
        }

        try {
            setLoading(true);

            const now = new Date().toLocaleString("en-CA", {
                timeZone: "Asia/Kolkata",
                hour12: false
            }).replace(',', '');

            const { error } = await supabase
                .from('nurse_assign_task')
                .update({
                    check_up: vitalsData,
                    actual1: now,
                    submitted_by: userName
                })
                .eq('task_no', selectedVitalsTask.taskId);

            if (error) throw error;

            // Update local state
            setTasks(prevTasks =>
                prevTasks.map(task =>
                    task.id === selectedVitalsTask.id
                        ? {
                            ...task,
                            status: 'Completed',
                            displayStatus: 'Completed',
                            actual1: now
                        }
                        : task
                )
            );

            showNotification('Vitals Check saved successfully!', 'success');
            setShowVitalsModal(false);
            setSelectedVitalsTask(null);
        } catch (error) {
            console.error('Error saving vitals:', error);
            showNotification('Failed to save vitals. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVitalsCheckboxChange = (field) => {
        setVitalsData(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    // Handle edit task - now includes shift and staff fields
    const handleEditTask = (task) => {
        setEditingTask({
            id: task.id,
            taskNo: task.taskId,
            assignNurse: task.assignNurse,
            shift: task.shift,
            staff: task.staff || 'Regular'
        });
        setNurseSearchQuery('');
        setShowNurseDropdown(false);
    };

    // Filter nurses based on search query
    const filteredNurses = nurseSearchQuery
        ? availableNurses.filter(nurse =>
            nurse.label.toLowerCase().includes(nurseSearchQuery.toLowerCase()) ||
            nurse.value.toLowerCase().includes(nurseSearchQuery.toLowerCase())
        )
        : availableNurses;

    // Filter tasks based on active tab
    const filteredTasks = tasks.filter(task => {
        const matchesSearch =
            task.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.ipdNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.taskId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.taskNames?.some(taskName =>
                taskName.toLowerCase().includes(searchTerm.toLowerCase())
            );

        const matchesDate = filterDate ? task.taskStartDate === filterDate : true;

        if (!matchesSearch || !matchesDate) return false;

        // Filter based on planned1 and actual1 conditions
        if (activeTab === 'Pending') {
            // Show tasks where planned1 is not null AND actual1 is null
            return task.planned1 && !task.actual1;
        } else if (activeTab === 'History') {
            // Show tasks where planned1 is not null AND actual1 is not null
            return task.planned1 && task.actual1;
        }

        return false;
    });

    // Toggle card expansion on mobile
    const toggleCardExpansion = (taskId) => {
        if (expandedCard === taskId) {
            setExpandedCard(null);
        } else {
            setExpandedCard(taskId);
        }
    };

    // Mobile Task Card Component
    const MobileTaskCard = ({ task }) => {
        const isExpanded = expandedCard === task.id;
        const isOTStaff = task.staff === 'OT Staff';

        return (
            <div
                className={`mobile-card bg-white rounded-xl shadow-sm border ${isOTStaff ? 'border-orange-200' : 'border-gray-200'} mb-3 overflow-hidden ${isExpanded ? 'mobile-card-expanded shadow-md' : ''
                    } ${isOTStaff ? 'ot-staff-row' : ''}`}
            >
                {/* Card Header - Always Visible */}
                <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleCardExpansion(task.id)}
                >
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(task.displayStatus)}`}>
                                    {task.displayStatus}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${task.staff === 'OT Staff'
                                    ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                    }`}>
                                    {task.staff || 'Staff Nurse'}
                                </span>
                            </div>

                            <h3 className="font-bold text-gray-800 text-base mb-1">{task.patientName}</h3>

                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <div className="flex items-center gap-1 text-sm text-gray-600">
                                    <span className="font-medium">IPD:</span>
                                    <span className="text-gray-800">{task.ipdNumber}</span>
                                </div>
                                <div className="flex items-center gap-1 text-sm text-gray-600">
                                    <span className="font-medium">Bed:</span>
                                    <span className="text-gray-800">{task.bedNo}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-700">{task.assignNurse}</span>
                                </div>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card Body - Expanded Content */}
                {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-4 animate-fade-in">
                        {/* Action Buttons for Pending Tasks */}
                        {activeTab === 'Pending' && (
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleStatusUpdate(task.id, task.taskId, 'Completed');
                                    }}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-3 rounded-lg text-sm transition-colors"
                                >
                                    Mark Done
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditTask(task);
                                    }}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-1"
                                >
                                    <Edit className="w-4 h-4" />
                                    Edit
                                </button>
                            </div>
                        )}

                        {/* Task Details */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Task ID</label>
                                    <span className="text-sm font-medium text-blue-600">{task.taskId}</span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Shift</label>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${task.shift === 'Shift A' ? 'bg-blue-100 text-blue-800' :
                                        task.shift === 'Shift B' ? 'bg-green-100 text-green-800' :
                                            task.shift === 'Shift C' ? 'bg-purple-100 text-purple-800' :
                                                'bg-gray-100 text-gray-800'
                                        }`}>
                                        {task.shift}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Planned Task</label>
                                <div className="flex items-center gap-1 font-medium text-gray-700">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm">{task.planned1Date} {task.planned1Time}</span>
                                </div>
                            </div>

                            {activeTab === 'History' && (
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Actual Task</label>
                                    <div className="flex items-center gap-1 font-medium text-green-700">
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                        <span className="text-sm">{task.actual1Date} {task.actual1Time}</span>
                                    </div>
                                </div>
                            )}

                            <div className="bg-gray-50 p-3 rounded-lg">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-700">{task.taskStartDate}</span>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                                <span className="text-sm text-gray-700">{task.patientLocation}</span>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg">
                                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center justify-between">
                                    <span>Tasks</span>
                                    <span className="text-xs text-gray-400">{task.taskNames.length} task(s)</span>
                                </label>
                                <div className="space-y-2 mt-2">
                                    {task.taskNames.map((taskName, index) => (
                                        <div key={index} className="flex items-start gap-2">
                                            <span className="text-xs text-gray-400 mt-0.5">{index + 1}.</span>
                                            <span className="text-sm text-gray-700 flex-1">{taskName}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg">
                                <label className="block text-xs font-medium text-gray-500 mb-1">Reminder</label>
                                <div className="flex items-center gap-1">
                                    {task.reminder === 'Yes' ? (
                                        <>
                                            <AlertCircle className="w-4 h-4 text-orange-600" />
                                            <span className="text-sm text-orange-600">Yes</span>
                                        </>
                                    ) : (
                                        <span className="text-sm text-gray-600">No</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Custom Task Modal Component - Fixed with useCallback to prevent re-renders
    const CustomTaskModal = useCallback(() => {
        const [localTask, setLocalTask] = useState(newCustomTask);

        useEffect(() => {
            setLocalTask(newCustomTask);
        }, [newCustomTask]);

        useEffect(() => {
            // Focus input when modal opens
            if (showCustomTaskModal && customTaskInputRef.current) {
                setTimeout(() => {
                    customTaskInputRef.current?.focus();
                }, 100);
            }
        }, [showCustomTaskModal]);

        if (!showCustomTaskModal) return null;

        const handleLocalChange = (e) => {
            setLocalTask(e.target.value);
        };

        const handleSave = () => {
            setNewCustomTask(localTask);
            handleAddCustomTask();
        };

        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            }
        };

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-purple-50 to-purple-100">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Plus className="w-6 h-6 text-purple-600" />
                            Add Custom Task
                        </h2>
                        <button
                            onClick={() => {
                                setShowCustomTaskModal(false);
                                setNewCustomTask('');
                            }}
                            className="p-2 hover:bg-gray-100 rounded-full transition"
                            disabled={addingCustomTask}
                        >
                            <X className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>

                    <div className="p-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Enter New Task Name
                                    <span className="text-red-500 ml-1">*</span>
                                </label>
                                <input
                                    ref={customTaskInputRef}
                                    type="text"
                                    value={localTask}
                                    onChange={handleLocalChange}
                                    onKeyPress={handleKeyPress}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="e.g., New Patient Assessment"
                                    disabled={addingCustomTask}
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    This task will be saved to the database for future use.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setShowCustomTaskModal(false);
                                setNewCustomTask('');
                            }}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                            disabled={addingCustomTask}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!localTask.trim() || addingCustomTask}
                            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {addingCustomTask ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" />
                                    Add Task
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }, [showCustomTaskModal, newCustomTask, addingCustomTask, handleAddCustomTask, setNewCustomTask, setShowCustomTaskModal]);

    // Edit Modal Component - Allows editing shift, assign_nurse, and staff
    const EditModal = () => {
        const [showNurseDropdownEdit, setShowNurseDropdownEdit] = useState(false);
        const [nurseSearchQueryEdit, setNurseSearchQueryEdit] = useState('');

        const filteredNursesEdit = nurseSearchQueryEdit
            ? availableNurses.filter(nurse =>
                nurse.label.toLowerCase().includes(nurseSearchQueryEdit.toLowerCase()) ||
                nurse.value.toLowerCase().includes(nurseSearchQueryEdit.toLowerCase())
            )
            : availableNurses;

        const handleEditChange = (field, value) => {
            setEditingTask({
                ...editingTask,
                [field]: value
            });
        };

        const saveEdit = async () => {
            try {
                if (!editingTask.assignNurse || editingTask.assignNurse.trim() === '') {
                    showNotification('Please select a nurse', 'error');
                    return;
                }

                if (!editingTask.shift || editingTask.shift.trim() === '') {
                    showNotification('Please select a shift', 'error');
                    return;
                }

                const updates = {
                    assign_nurse: editingTask.assignNurse.trim(),
                    shift: editingTask.shift,
                    staff: editingTask.staff
                };

                const { error } = await supabase
                    .from('nurse_assign_task')
                    .update(updates)
                    .eq('task_no', editingTask.taskNo);

                if (error) throw error;

                // Update local state without reloading all data
                setTasks(prevTasks =>
                    prevTasks.map(task =>
                        task.id === editingTask.id
                            ? {
                                ...task,
                                assignNurse: editingTask.assignNurse.trim(),
                                shift: editingTask.shift,
                                staff: editingTask.staff
                            }
                            : task
                    )
                );

                showNotification('Task updated successfully!', 'success');
                setEditingTask(null);
                setNurseSearchQueryEdit('');
                setShowNurseDropdownEdit(false);
            } catch (error) {
                console.error('Error updating task:', error);
                showNotification('Error updating task', 'error');
            }
        };

        if (!editingTask) return null;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-visible animate-fade-in">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-blue-100">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Edit className="w-6 h-6 text-blue-600" />
                            Edit Task Details
                        </h2>

                        <button
                            onClick={() => {
                                setEditingTask(null);
                                setNurseSearchQueryEdit('');
                                setShowNurseDropdownEdit(false);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-full transition"
                        >
                            <X className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-4">

                        {/* Task Info */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Task Details</h3>
                            <div className="space-y-2 text-sm text-gray-600">
                                <div className="flex justify-between">
                                    <span className="font-medium">Task ID:</span>
                                    <span className="text-blue-600 font-semibold">{editingTask.taskNo}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium">Current Nurse:</span>
                                    <span className="text-gray-800">{editingTask.assignNurse || 'Not assigned'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium">Current Shift:</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${editingTask.shift === 'Shift A' ? 'bg-blue-100 text-blue-800' :
                                        editingTask.shift === 'Shift B' ? 'bg-green-100 text-green-800' :
                                            editingTask.shift === 'Shift C' ? 'bg-purple-100 text-purple-800' :
                                                'bg-gray-100 text-gray-800'
                                        }`}>
                                        {editingTask.shift || 'Not assigned'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-medium">Staff Type:</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${editingTask.staff === 'OT Staff' ? 'bg-orange-100 text-orange-800 ot-staff-badge' :
                                        'bg-gray-100 text-gray-800'
                                        }`}>
                                        {editingTask.staff || 'Regular'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Edit Fields */}
                        <div className="space-y-4">
                            {/* Staff Type Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Staff Type
                                    <span className="text-red-500 ml-1">*</span>
                                </label>
                                <div className="flex gap-2">
                                    {['Regular', 'OT Staff'].map((staffOption) => (
                                        <button
                                            key={staffOption}
                                            type="button"
                                            onClick={() => handleEditChange('staff', staffOption)}
                                            className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-all ${editingTask.staff === staffOption
                                                ? staffOption === 'OT Staff'
                                                    ? 'bg-orange-100 text-orange-700 border-orange-300 ot-staff-badge'
                                                    : 'bg-blue-100 text-blue-700 border-blue-300'
                                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            {staffOption}
                                            {staffOption === 'OT Staff' && (
                                                <span className="ml-1 text-xs">(Over Time)</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    OT Staff rows will be highlighted in orange color in the table
                                </p>
                            </div>

                            {/* Shift Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Shift
                                    <span className="text-red-500 ml-1">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['Shift A', 'Shift B', 'Shift C', 'General'].map((shiftOption) => (
                                        <button
                                            key={shiftOption}
                                            type="button"
                                            onClick={() => handleEditChange('shift', shiftOption)}
                                            className={`px-3 py-2 text-sm rounded-lg border transition-all ${editingTask.shift === shiftOption
                                                ? shiftOption === 'Shift A'
                                                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                                                    : shiftOption === 'Shift B'
                                                        ? 'bg-green-100 text-green-700 border-green-300'
                                                        : shiftOption === 'Shift C'
                                                            ? 'bg-purple-100 text-purple-700 border-purple-300'
                                                            : 'bg-gray-100 text-gray-700 border-gray-300'
                                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            {shiftOption === 'Shift A' ? 'Shift A (Morning)' :
                                                shiftOption === 'Shift B' ? 'Shift B (Evening)' :
                                                    shiftOption === 'Shift C' ? 'Shift C (Night)' : shiftOption}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Nurse Search Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Assign Nurse
                                    <span className="text-red-500">*</span>
                                </label>

                                <div className="relative">
                                    <input
                                        ref={editNurseInputRef}
                                        type="text"
                                        value={editingTask.assignNurse || ''}
                                        onChange={(e) => {
                                            handleEditChange('assignNurse', e.target.value);
                                            setNurseSearchQueryEdit(e.target.value);
                                            setShowNurseDropdownEdit(true);
                                        }}
                                        onFocus={() => setShowNurseDropdownEdit(true)}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Search or select nurse..."
                                    />
                                    <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />

                                    {/* Nurse Dropdown */}
                                    {showNurseDropdownEdit && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-0"
                                                onClick={() => setShowNurseDropdownEdit(false)}
                                            />
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                                                {/* Search box inside dropdown */}
                                                <div className="sticky top-0 bg-white p-2 border-b border-gray-200">
                                                    <input
                                                        type="text"
                                                        value={nurseSearchQueryEdit}
                                                        onChange={(e) => setNurseSearchQueryEdit(e.target.value)}
                                                        placeholder="Search nurses..."
                                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        autoFocus
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>

                                                {/* Nurse List */}
                                                <div className="py-1">
                                                    {filteredNursesEdit.length > 0 ? (
                                                        filteredNursesEdit.map((nurse) => (
                                                            <button
                                                                key={nurse.value}
                                                                type="button"
                                                                className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm flex items-center border-b border-gray-100 last:border-b-0"
                                                                onClick={() => {
                                                                    handleEditChange('assignNurse', nurse.value);
                                                                    setNurseSearchQueryEdit('');
                                                                    setShowNurseDropdownEdit(false);
                                                                }}
                                                            >
                                                                <User className="w-4 h-4 text-blue-500 mr-3" />
                                                                <span>{nurse.label}</span>
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                            No nurses found
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                        <button
                            onClick={() => {
                                setEditingTask(null);
                                setNurseSearchQueryEdit('');
                                setShowNurseDropdownEdit(false);
                            }}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium"
                        >
                            Cancel
                        </button>

                        <button
                            onClick={saveEdit}
                            disabled={!editingTask.assignNurse || editingTask.assignNurse.trim() === '' || !editingTask.shift || !editingTask.staff}
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            Update Task
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Add Task Modal Component - Updated to include staff field
    const AddTaskModal = () => {
        const [showNewNurseDropdown, setShowNewNurseDropdown] = useState(false);
        const [newNurseSearchQuery, setNewNurseSearchQuery] = useState('');

        const filteredNewNurses = newNurseSearchQuery
            ? availableNurses.filter(nurse =>
                nurse.label.toLowerCase().includes(newNurseSearchQuery.toLowerCase()) ||
                nurse.value.toLowerCase().includes(newNurseSearchQuery.toLowerCase())
            )
            : availableNurses;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-6xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-fade-in">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-emerald-100">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Plus className="w-6 h-6 text-green-600" />
                            Add New Task
                        </h2>
                        <button
                            onClick={resetAddTaskForm}
                            className="p-2 hover:bg-gray-100 rounded-full transition"
                        >
                            <X className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 space-y-6">
                        {/* Bed Selection - Only show if no bed selected */}
                        {!selectedPatientInfo ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Bed className="w-5 h-5 text-blue-600" />
                                    <h3 className="text-lg font-semibold text-gray-800">Select Occupied Bed</h3>
                                </div>

                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-2">
                                        {occupiedBeds.length === 0 ? (
                                            <div className="col-span-full text-center py-4 text-gray-500">
                                                <Bed className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                                <p>No occupied beds found</p>
                                                <p className="text-sm">Please assign patients to beds first</p>
                                            </div>
                                        ) : (
                                            occupiedBeds.map((bed) => (
                                                <button
                                                    key={bed.bedNo}
                                                    type="button"
                                                    onClick={() => handleBedSelect(bed)}
                                                    className={`p-3 rounded-lg border transition-all text-left ${selectedBed === bed.bedNo
                                                        ? 'bg-blue-100 border-blue-500 shadow-sm'
                                                        : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-medium text-gray-800">Bed: {bed.bedNo}</span>
                                                        {selectedBed === bed.bedNo && (
                                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                                        )}
                                                    </div>
                                                    <div className="space-y-1 text-sm text-gray-600">
                                                        <p><span className="font-medium">Patient:</span> {bed.patientName}</p>
                                                        <p><span className="font-medium">IPD:</span> {bed.ipdNumber}</p>
                                                        <p><span className="font-medium">Ward:</span> {bed.wardType}</p>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Patient Information */}
                                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Users className="w-5 h-5 text-green-600" />
                                        <h3 className="text-lg font-semibold text-gray-800">Patient Information</h3>
                                        <button
                                            onClick={() => {
                                                setSelectedBed('');
                                                setSelectedPatientInfo(null);
                                            }}
                                            className="ml-auto text-sm text-blue-600 hover:text-blue-800"
                                        >
                                            Change Bed
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Patient Name</label>
                                            <input
                                                type="text"
                                                value={selectedPatientInfo.patientName}
                                                readOnly
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">IPD Number</label>
                                            <input
                                                type="text"
                                                value={selectedPatientInfo.ipdNumber}
                                                readOnly
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                                            <input
                                                type="text"
                                                value={selectedPatientInfo.location}
                                                readOnly
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">Bed Number</label>
                                            <input
                                                type="text"
                                                value={selectedPatientInfo.bedNo}
                                                readOnly
                                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Task Details */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <ClipboardList className="w-5 h-5 text-purple-600" />
                                        <h3 className="text-lg font-semibold text-gray-800">Task Details</h3>
                                    </div>

                                    <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {/* Staff Type Selection */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Staff Type
                                                    <span className="text-red-500 ml-1">*</span>
                                                </label>
                                                <select
                                                    value={newTaskData.staff || 'Regular'}
                                                    onChange={(e) => handleNewTaskChange('staff', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="Regular">Regular Staff</option>
                                                    <option value="OT Staff">OT Staff</option>
                                                </select>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    OT Staff rows will be highlighted in orange
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Shift
                                                    <span className="text-red-500 ml-1">*</span>
                                                </label>
                                                <select
                                                    value={newTaskData.shift}
                                                    onChange={(e) => handleNewTaskChange('shift', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="Shift A">Shift A (Morning)</option>
                                                    <option value="Shift B">Shift B (Evening)</option>
                                                    <option value="Shift C">Shift C (Night)</option>
                                                    <option value="General">General</option>
                                                </select>
                                            </div>

                                            <div className="relative">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Assign Nurse
                                                    <span className="text-red-500 ml-1">*</span>
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={newTaskData.assignNurse}
                                                        onChange={(e) => {
                                                            handleNewTaskChange('assignNurse', e.target.value);
                                                            setNewNurseSearchQuery(e.target.value);
                                                            setShowNewNurseDropdown(true);
                                                        }}
                                                        onFocus={() => setShowNewNurseDropdown(true)}
                                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                        placeholder="Search or select nurse..."
                                                    />
                                                    <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />

                                                    {/* Nurse Dropdown for Add Task */}
                                                    {showNewNurseDropdown && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-0"
                                                                onClick={() => setShowNewNurseDropdown(false)}
                                                            />
                                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                                                                <div className="sticky top-0 bg-white p-2 border-b border-gray-200">
                                                                    <input
                                                                        type="text"
                                                                        value={newNurseSearchQuery}
                                                                        onChange={(e) => setNewNurseSearchQuery(e.target.value)}
                                                                        placeholder="Search nurses..."
                                                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                        autoFocus
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                </div>
                                                                <div className="py-1">
                                                                    {filteredNewNurses.length > 0 ? (
                                                                        filteredNewNurses.map((nurse) => (
                                                                            <button
                                                                                key={nurse.value}
                                                                                type="button"
                                                                                className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm flex items-center border-b border-gray-100 last:border-b-0"
                                                                                onClick={() => {
                                                                                    handleNewTaskChange('assignNurse', nurse.value);
                                                                                    setNewNurseSearchQuery('');
                                                                                    setShowNewNurseDropdown(false);
                                                                                }}
                                                                            >
                                                                                <User className="w-4 h-4 text-blue-500 mr-3" />
                                                                                <span>{nurse.label}</span>
                                                                            </button>
                                                                        ))
                                                                    ) : (
                                                                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                                            No nurses found
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Reminder
                                                </label>
                                                <select
                                                    value={newTaskData.reminder}
                                                    onChange={(e) => handleNewTaskChange('reminder', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="No">No</option>
                                                    <option value="Yes">Yes</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Start Date
                                                    <span className="text-red-500 ml-1">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    value={newTaskData.startDate}
                                                    onChange={(e) => handleNewTaskChange('startDate', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                        </div>

                                        {/* Tasks List */}
                                        <div>
                                            <div className="flex justify-between items-center mb-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Tasks
                                                        <span className="text-red-500 ml-1">*</span>
                                                    </label>
                                                    <p className="text-xs text-gray-500">
                                                        Add tasks for the selected patient
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={addNewTaskRow}
                                                    disabled={newTaskData.tasks.length >= 15}
                                                    className="inline-flex items-center gap-1 text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition disabled:opacity-50"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Add Task
                                                </button>
                                            </div>

                                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-60 overflow-y-auto space-y-3">
                                                {newTaskData.tasks.map((task, index) => (
                                                    <div key={index} className="flex gap-3 items-center">
                                                        <span className="text-gray-500 text-sm font-medium w-6">{index + 1}.</span>
                                                        <div className="flex-1">
                                                            <div className="relative">
                                                                <select
                                                                    value={task}
                                                                    onChange={(e) => handleTaskItemChange(index, e.target.value)}
                                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none pr-10"
                                                                >
                                                                    <option value="">Select a task...</option>
                                                                    <optgroup label="Predefined Tasks">
                                                                        {filteredPredefinedTasks.map((taskOption) => (
                                                                            <option key={taskOption} value={taskOption}>
                                                                                {taskOption}
                                                                            </option>
                                                                        ))}
                                                                    </optgroup>
                                                                    <optgroup label="Add New">
                                                                        <option value="__custom__" className="text-purple-600 font-medium">
                                                                            Add Custom Task
                                                                        </option>
                                                                    </optgroup>
                                                                </select>
                                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {newTaskData.tasks.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeNewTaskRow(index)}
                                                                className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition shrink-0"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                        <button
                            onClick={resetAddTaskForm}
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>

                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">
                                {selectedPatientInfo ? `Bed: ${selectedBed}` : 'No bed selected'}
                            </span>
                            <button
                                onClick={submitNewTask}
                                disabled={!selectedPatientInfo || !newTaskData.assignNurse.trim() || newTaskData.tasks.filter(t => t.trim()).length === 0}
                                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" />
                                Create Task
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen flex flex-col max-w-full overflow-x-hidden">
            {/* Notification Popup logic handled by global NotificationProvider */}

            <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col min-w-0">
                {/* Header with Add Task Button - Fixed at top */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4 mb-3 md:mb-6 w-full overflow-hidden">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <ClipboardList className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
                            Nurse Tasks
                        </h1>
                        <p className="text-gray-500 text-sm mt-1 hidden md:block">Manage and track patient care tasks</p>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 w-full md:w-auto">
                        <div className="flex bg-white rounded-lg p-0.5 md:p-1 shadow-sm border border-gray-200">
                            <button
                                onClick={() => setActiveTab('Pending')}
                                className={`px-2.5 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium rounded-md transition-all ${activeTab === 'Pending'
                                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                Pending
                            </button>
                            <button
                                onClick={() => setActiveTab('History')}
                                className={`px-2.5 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium rounded-md transition-all ${activeTab === 'History'
                                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                History
                            </button>
                        </div>

                        {/* Add Task Button */}
                        <button
                            onClick={() => setShowAddTaskModal(true)}
                            className="inline-flex items-center gap-1 md:gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-1.5 px-3 md:py-2 md:px-4 rounded-lg transition-colors duration-200 shadow-sm text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add Task
                        </button>
                    </div>
                </div>

                {/* Filters - Fixed below header */}
                <div className="bg-white p-2 md:p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-2 md:gap-4 mb-3 md:mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 md:pl-10 pr-4 py-1.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>
                    <div className="relative w-full md:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="w-full pl-9 md:pl-10 pr-4 py-1.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>
                </div>

                {/* Main Content Area - Scrollable Section */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    {/* Loading State */}
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            <p className="ml-4 text-gray-600">Loading tasks...</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View - Scrollable within container */}
                            <div className="hidden md:block flex-1 min-h-0 overflow-hidden w-full">
                                <div ref={contentContainerRef} className="bg-white rounded-xl shadow-lg border border-gray-200 h-full flex flex-col">
                                    <div ref={tableRef} className="overflow-auto flex-1 scroll-container">
                                        <table className="w-full whitespace-nowrap">
                                            <thead className="bg-gray-50 border-b border-gray-200 text-left sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    {activeTab === 'Pending' && (
                                                        <>
                                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Edit</th>
                                                        </>
                                                    )}
                                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Task ID</th>
                                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff Type</th>
                                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Date</th>
                                                    {activeTab === 'Pending' ? (
                                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Planned Task</th>
                                                    ) : (
                                                        <>
                                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Planned Task</th>
                                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actual Task</th>
                                                        </>
                                                    )}
                                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">IPD No.</th>
                                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient Name</th>
                                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned Nurse</th>
                                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Shift</th>
                                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tasks</th>
                                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reminder</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 text-sm">
                                                {filteredTasks.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={activeTab === 'Pending' ? 14 : 13} className="px-6 py-8 text-center text-gray-500">
                                                            <div className="flex flex-col items-center justify-center">
                                                                <ClipboardList className="w-12 h-12 text-gray-300 mb-2" />
                                                                <p>No {activeTab.toLowerCase()} tasks found</p>
                                                                <p className="text-xs text-gray-400 mt-1">
                                                                    {activeTab === 'Pending'
                                                                        ? 'Tasks with planned date but not yet completed'
                                                                        : 'Tasks that have been completed'}
                                                                </p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredTasks.map((task) => (
                                                        <tr
                                                            key={task.id}
                                                            className={`hover:bg-gray-50 transition-colors ${task.staff === 'OT Staff' ? 'ot-staff-row' : ''}`}
                                                        >
                                                            {activeTab === 'Pending' && (
                                                                <>
                                                                    <td className="px-6 py-4">
                                                                        <button
                                                                            onClick={() => handleStatusUpdate(task.id, task.taskId, 'Completed')}
                                                                            className="text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs transition"
                                                                        >
                                                                            Mark Done
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <button
                                                                            onClick={() => handleEditTask(task)}
                                                                            className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
                                                                        >
                                                                            <Edit className="w-4 h-4" />
                                                                        </button>
                                                                    </td>
                                                                </>
                                                            )}
                                                            <td className="px-6 py-4 font-medium text-blue-600">{task.taskId}</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(task.displayStatus)}`}>
                                                                    {task.displayStatus}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-1 rounded text-xs font-medium ${task.staff === 'OT Staff'
                                                                    ? 'bg-green-100 text-green-800 border border-green-200'
                                                                    : 'bg-red-100 text-gray-800'
                                                                    }`}>
                                                                    {task.staff || 'Staff Nurse'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-700">
                                                                <div className="flex items-center gap-1">
                                                                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                                    {task.taskStartDate}
                                                                </div>
                                                            </td>
                                                            {activeTab === 'Pending' ? (
                                                                <td className="px-6 py-4 text-gray-700 font-medium">
                                                                    {task.planned1Date} {task.planned1Time}
                                                                </td>
                                                            ) : (
                                                                <>
                                                                    <td className="px-6 py-4 text-gray-700 font-medium">
                                                                        {task.planned1Date} {task.planned1Time}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-green-700 font-medium">
                                                                        {task.actual1Date} {task.actual1Time}
                                                                    </td>
                                                                </>
                                                            )}
                                                            <td className="px-6 py-4 text-gray-900 font-medium">{task.ipdNumber}</td>
                                                            <td className="px-6 py-4 text-gray-700">{task.patientName}</td>
                                                            <td className="px-6 py-4 text-gray-500">
                                                                <div className="flex flex-col">
                                                                    <span>{task.patientLocation}</span>
                                                                    <span className="text-xs text-gray-400">Bed: {task.bedNo}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-700 flex items-center gap-1.5">
                                                                <User className="w-3.5 h-3.5 text-gray-400" />
                                                                {task.assignNurse}
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-700">
                                                                <span className={`px-2 py-1 rounded text-xs font-medium ${task.shift === 'Shift A' ? 'bg-blue-100 text-blue-800' :
                                                                    task.shift === 'Shift B' ? 'bg-green-100 text-green-800' :
                                                                        task.shift === 'Shift C' ? 'bg-purple-100 text-purple-800' :
                                                                            'bg-gray-100 text-gray-800'
                                                                    }`}>
                                                                    {task.shift}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-700">
                                                                <div className="max-w-xs">
                                                                    {task.taskNames.map((taskName, index) => (
                                                                        <div key={index} className="text-sm mb-1">
                                                                            {taskName}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-500">
                                                                {task.reminder === 'Yes' ? (
                                                                    <span className="flex items-center gap-1 text-orange-600">
                                                                        <AlertCircle className="w-3.5 h-3.5" /> Yes
                                                                    </span>
                                                                ) : 'No'}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Card View - Scrollable within container */}
                            <div className="md:hidden flex-1 min-h-0 overflow-hidden">
                                <div ref={contentContainerRef} className="h-full overflow-y-auto scroll-container pb-4">
                                    {filteredTasks.length === 0 ? (
                                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                                            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                            <p className="text-gray-500 mb-1">No {activeTab.toLowerCase()} tasks found</p>
                                            <p className="text-xs text-gray-400">
                                                {activeTab === 'Pending'
                                                    ? 'Tasks with planned date but not yet completed'
                                                    : 'Tasks that have been completed'}
                                            </p>
                                        </div>
                                    ) : (
                                        filteredTasks.map((task) => (
                                            <MobileTaskCard key={task.id} task={task} />
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Edit Modal - Now allows editing shift, assign_nurse, and staff */}
            {editingTask && <EditModal />}

            {/* Add Task Modal */}
            {showAddTaskModal && <AddTaskModal />}

            {/* Custom Task Modal - Fixed with local state */}
            <CustomTaskModal />

            {/* Vitals Check Modal */}
            {showVitalsModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-fade-in overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-green-50 to-emerald-100">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                                <h3 className="font-bold text-lg text-gray-800">Vitals Check</h3>
                            </div>
                            <button
                                onClick={() => setShowVitalsModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition"
                                disabled={loading}
                            >
                                <X className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600 font-medium italic">Record performed vitals:</p>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Blood Pressure
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., 120/80"
                                        value={vitalsData.bloodPressure}
                                        onChange={(e) => setVitalsData(prev => ({ ...prev, bloodPressure: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        disabled={loading}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Pulse Rate (bpm)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., 72"
                                        value={vitalsData.pulseRate}
                                        onChange={(e) => setVitalsData(prev => ({ ...prev, pulseRate: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        disabled={loading}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Temperature (°F)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., 98.6"
                                        value={vitalsData.temperature}
                                        onChange={(e) => setVitalsData(prev => ({ ...prev, temperature: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        disabled={loading}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        SPO2 (%)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., 98"
                                        value={vitalsData.spo2}
                                        onChange={(e) => setVitalsData(prev => ({ ...prev, spo2: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        disabled={loading}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Respiratory Rate (breaths/min)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., 16"
                                        value={vitalsData.rr}
                                        onChange={(e) => setVitalsData(prev => ({ ...prev, rr: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t flex gap-3 bg-gray-50">
                            <button
                                onClick={() => setShowVitalsModal(false)}
                                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitVitals}
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm transition-all shadow-sm disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Submit</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskList;