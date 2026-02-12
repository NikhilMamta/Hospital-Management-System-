import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    Scissors
} from 'lucide-react';
import supabase from '../../../SupabaseClient';
import { useNotification } from '../../../contexts/NotificationContext';
import useRealtimeTable from '../../../hooks/useRealtimeTable';

// Separate OtCompletionModal component to prevent re-renders
const OtCompletionModal = React.memo(({
    show,
    taskToComplete,
    onClose,
    onSubmit,
    completionOtType,
    setCompletionOtType,
    completionOtDate,
    setCompletionOtDate,
    completionOtTime,
    setCompletionOtTime,
    completionOtDescription,
    setCompletionOtDescription
}) => {
    const textareaRef = useRef(null);

    if (!show || !taskToComplete) return null;

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            onSubmit();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-emerald-100">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Scissors className="w-6 h-6 text-green-600" />
                        Complete OT Information Task
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="space-y-4">
                        {/* <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Task Information</h3>
                            <div className="space-y-1 text-sm text-gray-600">
                                <div className="flex justify-between">
                                    <span className="font-medium">Task ID:</span>
                                    <span className="text-blue-600">{taskToComplete.taskNo}</span>
                                </div>
                            </div>
                        </div> */}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                OT Type <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setCompletionOtType('surgical')}
                                    className={`p-4 rounded-lg border-2 transition-all ${completionOtType === 'surgical'
                                        ? 'bg-red-50 border-red-500 text-red-700'
                                        : 'bg-white border-gray-200 hover:border-red-300'}`}
                                >
                                    <div className="font-medium">Surgical</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCompletionOtType('non-surgical')}
                                    className={`p-4 rounded-lg border-2 transition-all ${completionOtType === 'non-surgical'
                                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                                        : 'bg-white border-gray-200 hover:border-blue-300'}`}
                                >
                                    <div className="font-medium">Non-Surgical</div>
                                </button>
                            </div>
                        </div>

                        {/* Additional fields for surgical type */}
                        {/* {completionOtType === 'surgical' && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Date of Surgery <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={completionOtDate}
                                            onChange={(e) => setCompletionOtDate(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Time of Surgery <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={completionOtTime}
                                            onChange={(e) => setCompletionOtTime(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        OT Description
                                    </label>
                                    <textarea
                                        ref={textareaRef}
                                        value={completionOtDescription}
                                        onChange={(e) => setCompletionOtDescription(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32"
                                        placeholder="Enter OT procedure details..."
                                        maxLength={500}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        {completionOtDescription.length}/500 characters (Optional)
                                    </p>
                                </div>
                            </>
                        )} */}

                        {/* <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                            <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-yellow-600 mt-0.5" />
                                <p className="text-xs text-yellow-700">
                                    {completionOtType === 'surgical' 
                                        ? 'This will mark the task as completed and update the actual1 timestamp, ot_information, and surgical details.'
                                        : 'This will mark the task as completed and update the actual1 timestamp and ot_information.'}
                                </p>
                            </div>
                        </div> */}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSubmit}
                        disabled={completionOtType === 'surgical' && (!completionOtDate || !completionOtTime)}
                        className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CheckCircle className="w-4 h-4" />
                        Complete Task
                    </button>
                </div>
            </div>
        </div>
    );
});

// Separate OtInformationModal component
const OtInformationModal = React.memo(({
    show,
    onClose,
    onSubmit,
    otInformationType,
    setOtInformationType
}) => {
    if (!show) return null;

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-cyan-100">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Scissors className="w-6 h-6 text-blue-600" />
                        Select OT Type
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                OT Type
                                <span className="text-red-500 ml-1">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setOtInformationType('surgical')}
                                    className={`p-4 rounded-lg border-2 transition-all ${otInformationType === 'surgical'
                                        ? 'bg-red-50 border-red-500 text-red-700'
                                        : 'bg-white border-gray-200 hover:border-red-300'}`}
                                >
                                    <div className="font-medium">Surgical</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOtInformationType('non-surgical')}
                                    className={`p-4 rounded-lg border-2 transition-all ${otInformationType === 'non-surgical'
                                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                                        : 'bg-white border-gray-200 hover:border-blue-300'}`}
                                >
                                    <div className="font-medium">Non-Surgical</div>
                                </button>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                            <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                                <p className="text-xs text-blue-700">
                                    This will store the OT type in the database. Only surgical/non-surgical classification is required.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSubmit}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 shadow-sm"
                    >
                        <Save className="w-4 h-4" />
                        Add OT Type
                    </button>
                </div>
            </div>
        </div>
    );
});

// Separate CustomTaskModal component
const CustomTaskModal = React.memo(({
    show,
    onClose,
    onSubmit,
    newCustomTask,
    setNewCustomTask,
    addingCustomTask
}) => {
    const [localTask, setLocalTask] = useState(newCustomTask);
    const customTaskInputRef = useRef(null);

    useEffect(() => {
        setLocalTask(newCustomTask);
    }, [newCustomTask]);

    useEffect(() => {
        // Focus input when modal opens
        if (show && customTaskInputRef.current) {
            setTimeout(() => {
                customTaskInputRef.current?.focus();
            }, 100);
        }
    }, [show]);

    if (!show) return null;

    const handleLocalChange = (e) => {
        setLocalTask(e.target.value);
    };

    const handleSave = () => {
        setNewCustomTask(localTask);
        onSubmit();
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
                        Add Custom RMO Task
                    </h2>
                    <button
                        onClick={onClose}
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
                                Enter New RMO Task Name
                                <span className="text-red-500 ml-1">*</span>
                            </label>
                            <input
                                ref={customTaskInputRef}
                                type="text"
                                value={localTask}
                                onChange={handleLocalChange}
                                onKeyPress={handleKeyPress}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="e.g., Patient Assessment, Medication Review, etc."
                                disabled={addingCustomTask}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                This RMO task will be saved to the database for future use.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
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
                                Add RMO Task
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
});

const RMOTaskList = () => {
    const [activeTab, setActiveTab] = useState('Pending');
    const [tasks, setTasks] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingTask, setEditingTask] = useState(null);
    const [predefinedTasks, setPredefinedTasks] = useState([]);
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const { showNotification } = useNotification();
    const [availableRmos, setAvailableRmos] = useState([]);
    const [rmoSearchQuery, setRmoSearchQuery] = useState('');
    const [showRmoDropdown, setShowRmoDropdown] = useState(false);
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [occupiedBeds, setOccupiedBeds] = useState([]);
    const [selectedBed, setSelectedBed] = useState('');
    const [selectedPatientInfo, setSelectedPatientInfo] = useState(null);
    const [newTaskData, setNewTaskData] = useState({
        shift: 'Shift-A',
        assignRmo: '',
        tasks: [''],
        reminder: 'No',
        startDate: new Date().toISOString().split('T')[0]
    });
    const [showCustomTaskModal, setShowCustomTaskModal] = useState(false);
    const [newCustomTask, setNewCustomTask] = useState('');
    const [addingCustomTask, setAddingCustomTask] = useState(false);

    // OT Information state for adding new tasks
    const [showOtInformationModal, setShowOtInformationModal] = useState(false);
    const [currentTaskIndex, setCurrentTaskIndex] = useState(null);
    const [otInformationType, setOtInformationType] = useState('surgical');

    // OT Information state for completing tasks
    const [showOtCompletionModal, setShowOtCompletionModal] = useState(false);
    const [taskToComplete, setTaskToComplete] = useState(null);
    const [completionOtType, setCompletionOtType] = useState('surgical');
    const [completionOtDate, setCompletionOtDate] = useState(new Date().toISOString().split('T')[0]);
    const [completionOtTime, setCompletionOtTime] = useState('09:00');
    const [completionOtDescription, setCompletionOtDescription] = useState('');

    const [userRole, setUserRole] = useState('');
    const [userName, setUserName] = useState('');

    const tableRef = useRef(null);
    const refreshIntervalRef = useRef(null);
    const rmoInputRef = useRef(null);
    const editRmoInputRef = useRef(null);

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

    // Function to check if a task requires OT Information
    const requiresOtInformation = (taskName) => {
        return taskName && taskName.toLowerCase().includes('ot information');
    };

    // Load available RMOs from all_staff table
    const loadAvailableRmos = useCallback(async () => {
        try {
            const { data: rmosData, error } = await supabase
                .from('all_staff')
                .select('name')
                .eq('designation', 'RMO')
                .order('name');

            if (error) throw error;

            if (rmosData && rmosData.length > 0) {
                const rmos = rmosData
                    .filter(rmo => rmo.name && rmo.name.trim() !== '')
                    .map(rmo => ({
                        value: rmo.name,
                        label: rmo.name
                    }));

                setAvailableRmos(rmos);
            } else {
                // Fallback if no RMOs found
                const defaultRmos = [
                    { value: 'Dr. John Doe', label: 'Dr. John Doe' },
                    { value: 'Dr. Jane Smith', label: 'Dr. Jane Smith' },
                    { value: 'Dr. Robert Johnson', label: 'Dr. Robert Johnson' },
                    { value: 'Dr. Sarah Williams', label: 'Dr. Sarah Williams' },
                    { value: 'Dr. Michael Brown', label: 'Dr. Michael Brown' }
                ];
                setAvailableRmos(defaultRmos);
            }
        } catch (error) {
            console.error('Error loading available RMOs:', error);
            // Set default RMOs on error
            const defaultRmos = [
                { value: 'Dr. John Doe', label: 'Dr. John Doe' },
                { value: 'Dr. Jane Smith', label: 'Dr. Jane Smith' },
                { value: 'Dr. Robert Johnson', label: 'Dr. Robert Johnson' },
                { value: 'Dr. Sarah Williams', label: 'Dr. Sarah Williams' },
                { value: 'Dr. Michael Brown', label: 'Dr. Michael Brown' }
            ];
            setAvailableRmos(defaultRmos);
        }
    }, []);

    // Load occupied beds from rmo_assign_task table
    const loadOccupiedBeds = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('rmo_assign_task')
                .select('bed_no, patient_name, ipd_number, patient_location, ward_type, room')
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
                                ipdNumber: record.ipd_number || 'N/A',
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

    // Load predefined tasks from Supabase master table - RMO tasks
    const loadPredefinedTasks = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('master')
                .select('rmo_task')
                .not('rmo_task', 'is', null)
                .neq('rmo_task', '')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data && data.length > 0) {
                const taskNames = data
                    .map(item => item.rmo_task)
                    .filter(task => task && task.trim() !== '');

                const uniqueTasks = [...new Set(taskNames)].sort();
                setPredefinedTasks(uniqueTasks);
            } else {
                const defaultTasks = [
                    'Patient Assessment',
                    'Medication Review',
                    'Treatment Plan Update',
                    'Progress Note',
                    'Consultation',
                    'Procedure Assistance',
                    'Patient Education',
                    'Discharge Planning',
                    'Follow-up Evaluation',
                    'Emergency Response',
                    'Lab Result Review',
                    'Diagnostic Review',
                    'Patient Monitoring',
                    'Pain Management',
                    'Therapy Adjustment',
                    'OT Information'
                ];
                setPredefinedTasks(defaultTasks);
            }
        } catch (error) {
            console.error('Error loading predefined RMO tasks:', error);
            const defaultTasks = [
                'Patient Assessment',
                'Medication Review',
                'Treatment Plan Update',
                'Progress Note',
                'Consultation',
                'Procedure Assistance',
                'Patient Education',
                'Discharge Planning',
                'Follow-up Evaluation',
                'Emergency Response',
                'Lab Result Review',
                'Diagnostic Review',
                'Patient Monitoring',
                'Pain Management',
                'Therapy Adjustment',
                'OT Information'
            ];
            setPredefinedTasks(defaultTasks);
        }
    }, []);

    // Function to add custom RMO task to Supabase master table
    const addCustomTaskToDatabase = async (taskName) => {
        try {
            setAddingCustomTask(true);

            const { data, error } = await supabase
                .from('master')
                .insert([
                    {
                        rmo_task: taskName,
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

            showNotification(`RMO Task "${taskName}" added to database!`, 'success');
            return true;
        } catch (error) {
            console.error('Error saving new RMO task to Supabase:', error);
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
            showNotification('This RMO task already exists in the list!', 'info');
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
            console.error('Error adding custom RMO task:', error);
            showNotification('Error adding custom RMO task. Please try again.', 'error');
        }
    };

    const loadTasks = useCallback(async () => {
        try {
            setLoading(true);

            let query = supabase
                .from('rmo_assign_task')
                .select('*');

            // Apply role-based filtering
            if (userRole && userRole.toLowerCase().includes('rmo') && userName) {
                query = query.ilike('assign_rmo', userName);
            }

            const { data, error } = await query
                .order('timestamp', { ascending: false });

            if (error) throw error;

            if (data) {
                const transformedTasks = data.map(task => {
                    let taskNames = [];
                    let otInformation = null;

                    // Handle OT Information tasks
                    if (task.task === 'OT Information' && task.ot_information) {
                        // ot_information is stored as a plain string, not JSON
                        const otType = task.ot_information; // This will be 'surgical' or 'non-surgical'
                        taskNames = [`OT Information (${otType})`];

                        // Store as simple object with type
                        otInformation = {
                            type: otType
                        };
                    } else if (task.task && Array.isArray(task.task)) {
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
                        ipdNumber: task.ipd_number || 'N/A',
                        patientName: task.patient_name || 'N/A',
                        patientLocation: task.patient_location || 'N/A',
                        bedNo: task.bed_no || 'N/A',
                        assignRmo: task.assign_rmo || 'N/A',
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
                        otInformation: otInformation,
                        otInformationType: task.ot_information, // This is the plain string
                        otDate: task.ot_date,
                        otTime: task.ot_time,
                        otDescription: task.ot_description
                    };
                });
                setTasks(transformedTasks);
            }
        } catch (error) {
            console.error('Error loading RMO tasks:', error);
            showNotification('Error loading RMO tasks from database', 'error');
        } finally {
            setLoading(false);
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
        } else if (requiresOtInformation(value)) {
            // If OT Information is selected, open OT Information modal
            setCurrentTaskIndex(index);
            setOtInformationType('surgical');
            setShowOtInformationModal(true);
        } else {
            updatedTasks[index] = value;
            setNewTaskData(prev => ({
                ...prev,
                tasks: updatedTasks
            }));
        }
    }, [newTaskData.tasks]);

    // Handle OT Information submission for new tasks
    const handleOtInformationSubmit = useCallback(() => {
        const updatedTasks = [...newTaskData.tasks];
        updatedTasks[currentTaskIndex] = `OT Information (${otInformationType})`;

        setNewTaskData(prev => ({
            ...prev,
            tasks: updatedTasks
        }));

        setShowOtInformationModal(false);
        showNotification('OT Information added successfully!', 'success');
    }, [currentTaskIndex, newTaskData.tasks, otInformationType]);

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

    // Submit new RMO task
    const submitNewTask = async () => {
        try {
            if (!selectedPatientInfo) {
                showNotification('Please select a bed/patient', 'error');
                return;
            }

            if (!newTaskData.assignRmo.trim()) {
                showNotification('Please select an RMO', 'error');
                return;
            }

            const validTasks = newTaskData.tasks.filter(task => task.trim());
            if (validTasks.length === 0) {
                showNotification('Please add at least one RMO task', 'error');
                return;
            }

            // Get current timestamp
            const now = new Date().toLocaleString("en-CA", {
                timeZone: "Asia/Kolkata",
                hour12: false
            }).replace(',', '');

            // Get the last task number to generate sequential numbers
            const { data: lastTask } = await supabase
                .from('rmo_assign_task')
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

                // Check if this is an OT Information task
                const isOtInformation = taskName.toLowerCase().includes('ot information');
                let otInformationData = null;

                if (isOtInformation) {
                    // Extract OT Information type from the task string
                    const otMatch = taskName.match(/OT Information \((surgical|non-surgical)\)/);
                    if (otMatch) {
                        otInformationData = JSON.stringify({
                            type: otMatch[1],
                            created_at: now
                        });
                    }
                }

                return {
                    timestamp: now,
                    planned1: now,
                    actual1: null,
                    ipd_number: selectedPatientInfo.ipdNumber,
                    patient_name: selectedPatientInfo.patientName,
                    patient_location: selectedPatientInfo.location,
                    ward_type: selectedPatientInfo.wardType,
                    room: selectedPatientInfo.room,
                    bed_no: selectedPatientInfo.bedNo,
                    shift: newTaskData.shift,
                    assign_rmo: newTaskData.assignRmo.trim(),
                    reminder: newTaskData.reminder,
                    start_date: newTaskData.startDate,
                    task: isOtInformation ? 'OT Information' : taskName,
                    ot_information: otInformationData,
                    ot_information_type: otInformationData ? otMatch[1] : null
                };
            });

            // Insert all tasks in separate rows
            const { data, error } = await supabase
                .from('rmo_assign_task')
                .insert(taskEntries)
                .select();

            if (error) throw error;

            showNotification(`${validTasks.length} RMO task(s) added successfully!`, 'success');

            // Reset form
            setNewTaskData({
                shift: 'Shift-A',
                assignRmo: '',
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
            console.error('Error adding new RMO tasks:', error);
            showNotification('Error adding new RMO tasks', 'error');
        }
    };

    // Reset add task form
    const resetAddTaskForm = useCallback(() => {
        setNewTaskData({
            shift: 'Shift-A',
            assignRmo: '',
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

    // Real-time sync: refresh task list when any user modifies rmo_assign_task
    useRealtimeTable('rmo_assign_task', loadTasks);

    useEffect(() => {
        if (!userRole) return;
        loadTasks();
        loadPredefinedTasks();
        loadAvailableRmos();

        // Refresh every 2 minutes instead of 30 seconds
        refreshIntervalRef.current = setInterval(() => {
            loadTasks();
        }, 120000);

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [loadTasks, loadPredefinedTasks, loadAvailableRmos, userRole, userName]);

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
        try {
            // Find the task to check if it's OT Information
            const taskToUpdate = tasks.find(task => task.id === taskId);
            const isOtInformation = taskToUpdate?.taskNames?.some(taskName =>
                requiresOtInformation(taskName)
            );

            if (isOtInformation && newStatus === 'Completed') {
                // For OT Information tasks, show completion modal
                setTaskToComplete({
                    id: taskId,
                    taskNo: taskNo,
                    existingOtInfo: taskToUpdate.otInformation
                });
                setCompletionOtType('surgical');
                setCompletionOtDate(new Date().toISOString().split('T')[0]);
                setCompletionOtTime('09:00');
                setCompletionOtDescription('');
                setShowOtCompletionModal(true);
                return;
            }

            // For non-OT tasks, update directly
            const now = new Date().toLocaleString("en-CA", {
                timeZone: "Asia/Kolkata",
                hour12: false
            }).replace(',', '');

            const { error } = await supabase
                .from('rmo_assign_task')
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
            showNotification('RMO Task marked as completed!', 'success');
        } catch (error) {
            console.error('Error updating RMO task status:', error);
            showNotification('Error updating RMO task status', 'error');
        }
    };

    // Handle OT Information completion
    // Handle OT Information completion
    const handleOtCompletion = async () => {
        try {
            const now = new Date().toLocaleString("en-CA", {
                timeZone: "Asia/Kolkata",
                hour12: false
            }).replace(',', '');

            // Prepare update data for rmo_assign_task table
            let updateData = {
                actual1: now,
                ot_information: completionOtType,
                // ot_information_type: completionOtType // Remove if not needed
                submitted_by: userName
            };

            // For surgical type, add additional fields and post to ot_information table
            if (completionOtType === 'surgical') {
                if (!completionOtDate) {
                    showNotification('Please select surgery date', 'error');
                    return;
                }
                if (!completionOtTime) {
                    showNotification('Please select surgery time', 'error');
                    return;
                }

                // Get the task details to populate ot_information table
                const taskToUpdate = tasks.find(task => task.id === taskToComplete.id);

                // First update the rmo_assign_task table
                updateData = {
                    ...updateData,
                    // ot_date: completionOtDate,
                    // ot_time: completionOtTime,
                    // ot_description: completionOtDescription || null
                };

                // Then insert into ot_information table
                const otInformationData = {
                    timestamp: now, // actual1 timestamp from rmo_assign_task
                    // ot_number: null, // As per your requirement, don't post ot_number
                    ipd_number: taskToUpdate.ipdNumber || null,
                    patient_name: taskToUpdate.patientName || null,
                    patient_location: taskToUpdate.patientLocation || null,
                    ward_type: taskToUpdate.wardType || null,
                    room: taskToUpdate.room || null,
                    bed_no: taskToUpdate.bedNo || null,
                    planned1: now, // actual1 timestamp from rmo_assign_task
                    // ot_information: completionOtDescription || null,
                    // ot_date: completionOtDate,
                    // ot_time: completionOtTime,
                    // ot_description: completionOtDescription || null,
                    submitted_by: userName
                };

                // Insert into ot_information table
                const { error: otError } = await supabase
                    .from('ot_information')
                    .insert([otInformationData]);

                if (otError) throw otError;
            }

            // Update the rmo_assign_task table
            const { error } = await supabase
                .from('rmo_assign_task')
                .update(updateData)
                .eq('task_no', taskToComplete.taskNo);

            if (error) throw error;

            // Update local state
            setTasks(prevTasks =>
                prevTasks.map(task =>
                    task.id === taskToComplete.id
                        ? {
                            ...task,
                            status: 'Completed',
                            displayStatus: 'Completed',
                            actual1: now,
                            otInformation: {
                                type: completionOtType,
                                completed_at: now
                            },
                            otInformationType: completionOtType,
                            otDate: completionOtType === 'surgical' ? completionOtDate : null,
                            otTime: completionOtType === 'surgical' ? completionOtTime : null,
                            otDescription: completionOtType === 'surgical' ? completionOtDescription : null,
                            taskNames: [`OT Information (${completionOtType})`]
                        }
                        : task
                )
            );

            showNotification('OT Information task completed successfully!', 'success');

            // Reset modal
            setShowOtCompletionModal(false);
            setTaskToComplete(null);
            setCompletionOtType('surgical');
            setCompletionOtDate(new Date().toISOString().split('T')[0]);
            setCompletionOtTime('09:00');
            setCompletionOtDescription('');

        } catch (error) {
            console.error('Error completing OT task:', error);
            showNotification('Error completing OT task', 'error');
        }
    };

    const handleEditTask = (task) => {
        setEditingTask({
            id: task.id,
            taskNo: task.taskId,
            assignRmo: task.assignRmo,
        });
        setRmoSearchQuery('');
        setShowRmoDropdown(false);
    };

    const handleEditChange = (field, value) => {
        setEditingTask({
            ...editingTask,
            [field]: value
        });
    };

    // Filter RMOs based on search query
    const filteredRmos = rmoSearchQuery
        ? availableRmos.filter(rmo =>
            rmo.label.toLowerCase().includes(rmoSearchQuery.toLowerCase()) ||
            rmo.value.toLowerCase().includes(rmoSearchQuery.toLowerCase())
        )
        : availableRmos;

    const saveEdit = async () => {
        try {
            if (!editingTask.assignRmo || editingTask.assignRmo.trim() === '') {
                showNotification('Please select an RMO', 'error');
                return;
            }

            const { error } = await supabase
                .from('rmo_assign_task')
                .update({
                    assign_rmo: editingTask.assignRmo.trim()
                })
                .eq('task_no', editingTask.taskNo);

            if (error) throw error;

            // Update local state without reloading all data
            setTasks(prevTasks =>
                prevTasks.map(task =>
                    task.id === editingTask.id
                        ? {
                            ...task,
                            assignRmo: editingTask.assignRmo.trim()
                        }
                        : task
                )
            );

            showNotification('RMO assignment updated successfully!', 'success');
            setEditingTask(null);
            setRmoSearchQuery('');
            setShowRmoDropdown(false);
        } catch (error) {
            console.error('Error updating RMO assignment:', error);
            showNotification('Error updating RMO assignment', 'error');
        }
    };

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

    // Simplified Edit Modal Component - Only allows editing assign_rmo
    const EditModal = () => (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-visible animate-fade-in">
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-blue-100">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Edit className="w-6 h-6 text-blue-600" />
                        Edit Assigned RMO
                    </h2>

                    <button
                        onClick={() => {
                            setEditingTask(null);
                            setRmoSearchQuery('');
                            setShowRmoDropdown(false);
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
                        <h3 className="text-sm font-medium text-gray-700 mb-2">RMO Task Details</h3>
                        <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex justify-between">
                                <span className="font-medium">Task ID:</span>
                                <span className="text-blue-600 font-semibold">{editingTask.taskNo}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-medium">Current RMO:</span>
                                <span className="text-gray-800">{editingTask.assignRmo || 'Not assigned'}</span>
                            </div>
                        </div>
                    </div>

                    {/* RMO Search Field */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Assign New RMO <span className="text-red-500">*</span>
                        </label>

                        <div className="relative">
                            <input
                                ref={editRmoInputRef}
                                type="text"
                                value={editingTask.assignRmo || ''}
                                onChange={(e) => {
                                    handleEditChange('assignRmo', e.target.value);
                                    setRmoSearchQuery(e.target.value);
                                    setShowRmoDropdown(true);
                                }}
                                onFocus={() => setShowRmoDropdown(true)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Search or select RMO..."
                            />
                            <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />

                            {/* RMO Dropdown */}
                            {showRmoDropdown && (
                                <div className="absolute z-[999] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                                    {/* Search box inside dropdown */}
                                    <div className="sticky top-0 bg-white p-2 border-b border-gray-200">
                                        <input
                                            type="text"
                                            value={rmoSearchQuery}
                                            onChange={(e) => setRmoSearchQuery(e.target.value)}
                                            placeholder="Search RMOs..."
                                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>

                                    {/* RMO List */}
                                    <div className="py-1">
                                        {filteredRmos.length > 0 ? (
                                            filteredRmos.map((rmo) => (
                                                <button
                                                    key={rmo.value}
                                                    type="button"
                                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm flex items-center border-b border-gray-100 last:border-b-0"
                                                    onClick={() => {
                                                        handleEditChange('assignRmo', rmo.value);
                                                        setRmoSearchQuery('');
                                                        setShowRmoDropdown(false);
                                                    }}
                                                >
                                                    <User className="w-4 h-4 text-blue-500 mr-3" />
                                                    <span>{rmo.label}</span>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                No RMOs found
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={() => {
                            setEditingTask(null);
                            setRmoSearchQuery('');
                            setShowRmoDropdown(false);
                        }}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={saveEdit}
                        disabled={!editingTask.assignRmo || editingTask.assignRmo.trim() === ''}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        Update RMO
                    </button>
                </div>
            </div>
        </div>
    );

    // Add Task Modal Component
    const AddTaskModal = () => {
        const [showNewRmoDropdown, setShowNewRmoDropdown] = useState(false);
        const [newRmoSearchQuery, setNewRmoSearchQuery] = useState('');

        const filteredNewRmos = newRmoSearchQuery
            ? availableRmos.filter(rmo =>
                rmo.label.toLowerCase().includes(newRmoSearchQuery.toLowerCase()) ||
                rmo.value.toLowerCase().includes(newRmoSearchQuery.toLowerCase())
            )
            : availableRmos;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-6xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-fade-in">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-emerald-100">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Plus className="w-6 h-6 text-green-600" />
                            Add New RMO Task
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
                                        <h3 className="text-lg font-semibold text-gray-800">RMO Task Details</h3>
                                    </div>

                                    <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                                    <option value="Shift-A">Shift-A (Morning)</option>
                                                    <option value="Shift-B">Shift-B (Evening)</option>
                                                    <option value="Shift-C">Shift-C (Night)</option>
                                                    <option value="General">General</option>
                                                </select>
                                            </div>

                                            <div className="relative">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Assign RMO
                                                    <span className="text-red-500 ml-1">*</span>
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={newTaskData.assignRmo}
                                                        onChange={(e) => {
                                                            handleNewTaskChange('assignRmo', e.target.value);
                                                            setNewRmoSearchQuery(e.target.value);
                                                            setShowNewRmoDropdown(true);
                                                        }}
                                                        onFocus={() => setShowNewRmoDropdown(true)}
                                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                        placeholder="Search or select RMO..."
                                                    />
                                                    <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />

                                                    {/* RMO Dropdown for Add Task */}
                                                    {showNewRmoDropdown && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-0"
                                                                onClick={() => setShowNewRmoDropdown(false)}
                                                            />
                                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                                                                <div className="sticky top-0 bg-white p-2 border-b border-gray-200">
                                                                    <input
                                                                        type="text"
                                                                        value={newRmoSearchQuery}
                                                                        onChange={(e) => setNewRmoSearchQuery(e.target.value)}
                                                                        placeholder="Search RMOs..."
                                                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                        autoFocus
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                </div>
                                                                <div className="py-1">
                                                                    {filteredNewRmos.length > 0 ? (
                                                                        filteredNewRmos.map((rmo) => (
                                                                            <button
                                                                                key={rmo.value}
                                                                                type="button"
                                                                                className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm flex items-center border-b border-gray-100 last:border-b-0"
                                                                                onClick={() => {
                                                                                    handleNewTaskChange('assignRmo', rmo.value);
                                                                                    setNewRmoSearchQuery('');
                                                                                    setShowNewRmoDropdown(false);
                                                                                }}
                                                                            >
                                                                                <User className="w-4 h-4 text-blue-500 mr-3" />
                                                                                <span>{rmo.label}</span>
                                                                            </button>
                                                                        ))
                                                                    ) : (
                                                                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                                            No RMOs found
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
                                                        RMO Tasks
                                                        <span className="text-red-500 ml-1">*</span>
                                                    </label>
                                                    <p className="text-xs text-gray-500">
                                                        Add RMO tasks for the selected patient
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={addNewTaskRow}
                                                    disabled={newTaskData.tasks.length >= 15}
                                                    className="inline-flex items-center gap-1 text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition disabled:opacity-50"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Add RMO Task
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
                                                                    <option value="">Select an RMO task...</option>
                                                                    <optgroup label="Predefined RMO Tasks">
                                                                        {filteredPredefinedTasks.map((taskOption) => (
                                                                            <option key={taskOption} value={taskOption}>
                                                                                {taskOption} {requiresOtInformation(taskOption) ? '(Requires OT Type)' : ''}
                                                                            </option>
                                                                        ))}
                                                                    </optgroup>
                                                                    <optgroup label="Add New">
                                                                        <option value="__custom__" className="text-purple-600 font-medium">
                                                                            Add Custom RMO Task
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
                                disabled={!selectedPatientInfo || !newTaskData.assignRmo.trim() || newTaskData.tasks.filter(t => t.trim()).length === 0}
                                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" />
                                Create RMO Task
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };



    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header with Add Task Button */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <ClipboardList className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                            RMO Tasks
                        </h1>
                        <p className="text-gray-500 text-xs sm:text-sm mt-1">Manage and track RMO tasks</p>
                    </div>

                    <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3 w-full sm:w-auto">
                        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200 w-full xs:w-auto">
                            <button
                                onClick={() => setActiveTab('Pending')}
                                className={`flex-1 xs:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${activeTab === 'Pending'
                                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                Pending
                            </button>
                            <button
                                onClick={() => setActiveTab('History')}
                                className={`flex-1 xs:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${activeTab === 'History'
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
                            className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 shadow-sm text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add Task
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search by Task ID, Patient Name, IPD No..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="relative w-full md:w-64">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <p className="ml-4 text-gray-600">Loading RMO tasks...</p>
                    </div>
                )}

                {/* Table & Card View */}
                {!loading && (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden lg:block bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-280px)]">
                            <div ref={tableRef} className="overflow-auto flex-1">
                                <table className="w-full whitespace-nowrap">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-left sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            {activeTab === 'Pending' && (
                                                <>
                                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Edit RMO</th>
                                                </>
                                            )}
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Task ID</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
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
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned RMO</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Shift</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">RMO Tasks</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reminder</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 text-sm">
                                        {filteredTasks.length === 0 ? (
                                            <tr>
                                                <td colSpan={activeTab === 'Pending' ? 13 : 12} className="px-6 py-8 text-center text-gray-500">
                                                    <div className="flex flex-col items-center justify-center">
                                                        <ClipboardList className="w-12 h-12 text-gray-300 mb-2" />
                                                        <p>No {activeTab.toLowerCase()} RMO tasks found</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredTasks.map((task) => (
                                                <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                                                    {activeTab === 'Pending' && (
                                                        <>
                                                            <td className="px-6 py-4">
                                                                <button
                                                                    onClick={() => handleStatusUpdate(task.id, task.taskId, 'Completed')}
                                                                    className={`px-3 py-1 rounded text-xs transition ${task.taskNames.some(t => requiresOtInformation(t))
                                                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                                                        }`}
                                                                >
                                                                    {task.taskNames.some(t => requiresOtInformation(t))
                                                                        ? 'Complete OT Task'
                                                                        : 'Mark Done'
                                                                    }
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
                                                        {task.assignRmo}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-700">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${task.shift === 'Shift-A' ? 'bg-blue-100 text-blue-800' : task.shift === 'Shift-B' ? 'bg-green-100 text-green-800' : task.shift === 'Shift-C' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                                            {task.shift}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-700">
                                                        <div className="max-w-xs overflow-hidden text-ellipsis">
                                                            {task.taskNames.map((taskName, index) => (
                                                                <div key={index} className="text-sm border-b border-gray-100 last:border-0 py-0.5">
                                                                    {taskName}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {task.reminder === 'Yes' ? (
                                                            <span className="text-orange-500"><AlertCircle size={16} /></span>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-4">
                            {filteredTasks.length === 0 ? (
                                <div className="bg-white p-8 rounded-xl border border-gray-200 text-center shadow-sm">
                                    <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                    <p className="text-gray-500 font-medium">No tasks found</p>
                                </div>
                            ) : (
                                filteredTasks.map((task) => (
                                    <div key={task.id} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform">
                                        {/* Card Header */}
                                        <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{task.taskId}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(task.displayStatus)}`}>
                                                    {task.displayStatus}
                                                </span>
                                            </div>
                                            {task.reminder === 'Yes' && (
                                                <AlertCircle className="w-4 h-4 text-orange-500 animate-pulse" />
                                            )}
                                        </div>

                                        {/* Card Body */}
                                        <div className="p-4 space-y-4">
                                            {/* Patient & Location */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="space-y-1">
                                                    <h3 className="font-bold text-gray-800 leading-tight">{task.patientName}</h3>
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded">IPD: {task.ipdNumber}</span>
                                                        <span className="text-gray-300">|</span>
                                                        <span>{task.patientLocation}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="block text-[10px] uppercase tracking-tighter text-gray-400 font-bold">Bed No</span>
                                                    <span className="text-sm font-bold text-gray-700 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100">{task.bedNo}</span>
                                                </div>
                                            </div>

                                            {/* Assignment & Time */}
                                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-50">
                                                <div className="space-y-1 text-xs">
                                                    <span className="text-gray-400 font-bold uppercase tracking-tighter">Assigned RMO</span>
                                                    <div className="flex items-center gap-1.5 font-semibold text-gray-700">
                                                        <User className="w-3.5 h-3.5 text-blue-500" />
                                                        <span className="truncate max-w-[100px]">{task.assignRmo}</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1 text-xs text-right">
                                                    <span className="text-gray-400 font-bold uppercase tracking-tighter">Shift</span>
                                                    <div>
                                                        <span className={`inline-block px-2 py-0.5 rounded font-bold ${task.shift === 'Shift-A' ? 'bg-blue-50 text-blue-600' : task.shift === 'Shift-B' ? 'bg-green-50 text-green-600' : 'bg-purple-50 text-purple-600'}`}>
                                                            {task.shift}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Tasks List Content */}
                                            <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100 space-y-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">RMO Task List</span>
                                                {task.taskNames.map((taskName, index) => {
                                                    const isOtInfo = requiresOtInformation(taskName);
                                                    return (
                                                        <div key={index} className="flex items-start gap-2 text-sm">
                                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></div>
                                                            <div className="flex-1">
                                                                {isOtInfo ? (
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="font-bold text-gray-700">OT Information:</span>
                                                                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${task.otInformationType === 'surgical' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-sky-50 text-sky-600 border border-sky-100'}`}>
                                                                                {task.otInformationType || 'N/A'}
                                                                            </span>
                                                                        </div>
                                                                        {task.otDate && (
                                                                            <p className="text-[11px] text-gray-500 italic">
                                                                                Scheduled: {task.otDate} {task.otTime && `at ${task.otTime}`}
                                                                            </p>
                                                                        )}
                                                                        {task.otDescription && (
                                                                            <p className="text-[11px] text-gray-500 leading-tight line-clamp-2">"{task.otDescription}"</p>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-700 font-medium">{taskName}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Task Dates Mapping */}
                                            <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <span className="text-[9px] uppercase font-bold text-gray-400">Planned Date</span>
                                                    <div className="flex items-center gap-1 text-[11px] font-bold text-gray-700">
                                                        <Calendar className="w-3 h-3 text-gray-400" />
                                                        {task.planned1Date}
                                                        <span className="text-gray-300 ml-1">|</span>
                                                        <Clock className="w-3 h-3 text-gray-400 ml-1" />
                                                        {task.planned1Time}
                                                    </div>
                                                </div>
                                                {activeTab === 'History' && task.actual1 && (
                                                    <div className="text-right space-y-0.5 border-l border-gray-100 pl-3">
                                                        <span className="text-[9px] uppercase font-bold text-emerald-500">Completed Date</span>
                                                        <div className="flex items-center justify-end gap-1 text-[11px] font-bold text-emerald-600">
                                                            <CheckCircle className="w-3 h-3" />
                                                            {task.actual1Date}
                                                            <span className="text-emerald-200 ml-1">|</span>
                                                            {task.actual1Time}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Buttons (Mobile) */}
                                            {activeTab === 'Pending' && (
                                                <div className="grid grid-cols-2 gap-3 pt-2">
                                                    <button
                                                        onClick={() => handleEditTask(task)}
                                                        className="flex items-center justify-center gap-2 py-2.5 bg-white border border-blue-200 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors shadow-sm"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                        Edit RMO
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusUpdate(task.id, task.taskId, 'Completed')}
                                                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all ${task.taskNames.some(t => requiresOtInformation(t))
                                                            ? 'bg-blue-600 hover:bg-blue-700'
                                                            : 'bg-green-600 hover:bg-green-700'
                                                            }`}
                                                    >
                                                        {task.taskNames.some(t => requiresOtInformation(t)) ? (
                                                            <>
                                                                <Scissors className="w-3.5 h-3.5" />
                                                                Complete OT
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CheckCircle className="w-3.5 h-3.5" />
                                                                Mark Done
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Edit Modal - Simplified to only edit assign_rmo */}
            {editingTask && <EditModal />}

            {/* Add Task Modal */}
            {showAddTaskModal && <AddTaskModal />}

            {/* Custom Task Modal */}
            <CustomTaskModal
                show={showCustomTaskModal}
                onClose={() => {
                    setShowCustomTaskModal(false);
                    setNewCustomTask('');
                }}
                onSubmit={handleAddCustomTask}
                newCustomTask={newCustomTask}
                setNewCustomTask={setNewCustomTask}
                addingCustomTask={addingCustomTask}
            />

            {/* OT Information Modal (for adding new OT tasks) */}
            <OtInformationModal
                show={showOtInformationModal}
                onClose={() => setShowOtInformationModal(false)}
                onSubmit={handleOtInformationSubmit}
                otInformationType={otInformationType}
                setOtInformationType={setOtInformationType}
            />

            {/* OT Completion Modal (for completing OT tasks) */}
            <OtCompletionModal
                show={showOtCompletionModal}
                taskToComplete={taskToComplete}
                onClose={() => {
                    setShowOtCompletionModal(false);
                    setTaskToComplete(null);
                    setCompletionOtDescription('');
                }}
                onSubmit={handleOtCompletion}
                completionOtType={completionOtType}
                setCompletionOtType={setCompletionOtType}
                completionOtDate={completionOtDate}
                setCompletionOtDate={setCompletionOtDate}
                completionOtTime={completionOtTime}
                setCompletionOtTime={setCompletionOtTime}
                completionOtDescription={completionOtDescription}
                setCompletionOtDescription={setCompletionOtDescription}
            />
        </div>
    );
};

export default RMOTaskList;