import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  User,
  Lock,
  Mail,
  Phone,
  Users,
  Check,
  X,
  Upload,
  Eye,
  EyeOff,
  Key,
  Shield,
  Stethoscope,
  Pill,
  FlaskConical,
  Building,
  Bed,
  FileText,
  ClipboardList,
  CheckSquare,
  BarChart3,
  UserCog,
  Scissors,
  Clock,
  History,
  LineChart,
  UserCheck,
  LayoutDashboard,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle,
  Save,
  Camera,
  Heart,
  Activity,
  Thermometer,
  AlertCircle,
  Package,
  Calendar,
  Syringe
} from 'lucide-react';
import supabase from '../../../SupabaseClient';
import { useNotification } from '../../../contexts/NotificationContext';
import { ALL_PAGES } from '../../../contexts/AuthContext';

// Icon mapping for sidebar items
const sidebarIcons = {
  LayoutDashboard,
  User,
  LineChart,
  History,
  Scissors,
  UserCog,
  Shield,
  FlaskConical,
  Pill,
  UserCheck,
  Users,
  ClipboardList,
  CheckSquare,
  BarChart3,
  FileText,
  Activity,
  Clock,
  Building,
  Bed,
  Stethoscope,
  Key,
  Calendar
};

// Get all page keys (excluding groups)
const ALL_PAGE_KEYS = ALL_PAGES.filter(page => page.type !== 'group').map(page => page.key);


const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [selectedPages, setSelectedPages] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    user_name: '',
    name: '',
    email: '',
    phone_no: '',
    role: '',
    password: '',
    profile_image: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const { showNotification } = useNotification();

  // Fetch users from Supabase
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Get current user from local storage
      const currentUser = JSON.parse(localStorage.getItem('mis_user'));
      const currentUserRole = currentUser?.role;
      const currentUserName = currentUser?.name;

      let filteredData = data;

      // Filter based on role: if not admin, only show own data
      if (currentUserRole !== 'admin') {
        filteredData = data.filter(user => user.name === currentUserName);
      }

      // Parse pages from string to array for each user
      const usersWithParsedPages = filteredData.map(user => {
        let pages = [];

        if (user.pages) {
          if (user.pages === 'all') {
            // User has access to all pages
            pages = ALL_PAGE_KEYS;
          } else {
            try {
              // Try to parse as JSON
              pages = JSON.parse(user.pages);
            } catch (parseError) {
              console.warn('Error parsing pages for user:', user.id, parseError);
              // If parsing fails, try to handle as comma-separated string
              if (typeof user.pages === 'string') {
                pages = user.pages.split(',').map(p => p.trim()).filter(p => p);
              }
            }
          }
        }

        return {
          ...user,
          pages: pages || []
        };
      });
      setUsers(usersWithParsedPages);
    } catch (error) {
      console.error('Error fetching users:', error);
      showNotification('Failed to fetch users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setFormData({
      user_name: '',
      name: '',
      email: '',
      phone_no: '',
      role: '',
      password: '',
      profile_image: ''
    });
    setEditingUser(null);
    setSelectedPages([]);
    setSelectAll(false);
    setShowPassword(false);
    setImageFile(null);
    setModalVisible(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      user_name: user.user_name || '',
      name: user.name || '',
      email: user.email || '',
      phone_no: user.phone_no || '',
      role: user.role || '',
      password: '',
      profile_image: user.profile_image || ''
    });

    // Check if user has all pages access
    const hasAllPages = user.pages && user.pages.length === ALL_PAGE_KEYS.length;
    setSelectAll(hasAllPages);
    setSelectedPages(user.pages || []);
    setShowPassword(false);
    setImageFile(null);
    setModalVisible(true);
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', userId);

        if (error) throw error;

        showNotification('User deleted successfully', 'success');
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Failed to delete user', 'error');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const uploadImageToSupabase = async (file) => {
    try {
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage bucket 'profile_image'
      const { error: uploadError } = await supabase.storage
        .from('profile_image')
        .upload(filePath, file);

      if (uploadError) {
        // If bucket doesn't exist, try to create it
        if (uploadError.message.includes('bucket') && uploadError.message.includes('not found')) {
          showNotification('Please create a "profile_image" bucket in Supabase Storage first.', 'warning');
          return null;
        }
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('profile_image')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image to Supabase:', error);
      throw error;
    }
  };

  const handleModalSubmit = async () => {
    try {
      // Basic validation
      if (!formData.user_name || !formData.name || !formData.email || !formData.role) {
        showNotification('Please fill all required fields', 'error');
        return;
      }

      if (!editingUser && !formData.password) {
        showNotification('Please enter password for new user', 'error');
        return;
      }

      // If a new image is selected, upload it first
      let profileImageUrl = formData.profile_image;
      if (imageFile) {
        setUploading(true);
        try {
          profileImageUrl = await uploadImageToSupabase(imageFile);
          if (!profileImageUrl) {
            setUploading(false);
            return;
          }
        } catch (error) {
          setUploading(false);
          showNotification('Failed to upload image. Please try again.', 'error');
          return;
        }
      }

      // Determine what to store in the pages field
      let pagesToStore;
      if (selectAll) {
        // Store 'all' if all pages are selected
        pagesToStore = 'all';
      } else {
        // Store as JSON array
        pagesToStore = JSON.stringify(selectedPages);
      }

      const userData = {
        user_name: formData.user_name,
        name: formData.name,
        email: formData.email,
        phone_no: formData.phone_no,
        role: formData.role,
        pages: pagesToStore,
        profile_image: profileImageUrl,
        timestamp: new Date().toISOString()
      };

      // Only include password if provided (for new users or when changing password)
      if (formData.password) {
        userData.password = formData.password;
      }

      if (editingUser) {
        // Update existing user
        const { error } = await supabase
          .from('users')
          .update(userData)
          .eq('id', editingUser.id);

        if (error) throw error;
        showNotification('User updated successfully', 'success');
      } else {
        // Create new user
        const { error } = await supabase
          .from('users')
          .insert([userData]);

        if (error) throw error;
        showNotification('User created successfully', 'success');
      }

      setUploading(false);
      setModalVisible(false);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      setUploading(false);
      showNotification(error.message || 'Failed to save user', 'error');
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showNotification('File size must be less than 2MB', 'error');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showNotification('Please upload an image file', 'error');
      return;
    }

    // Store the file for later upload
    setImageFile(file);

    // Create a preview URL for display
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({
        ...prev,
        profile_image: reader.result // This is a data URL for preview
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setFormData(prev => ({
      ...prev,
      profile_image: ''
    }));
  };

  const handlePageToggle = (pageKey) => {
    setSelectedPages(prev => {
      if (prev.includes(pageKey)) {
        return prev.filter(key => key !== pageKey);
      } else {
        return [...prev, pageKey];
      }
    });
    setSelectAll(false); // Uncheck "Select All" when manually selecting pages
  };

  const handleSelectAll = () => {
    if (selectAll) {
      // If already selected, deselect all
      setSelectedPages([]);
      setSelectAll(false);
    } else {
      // Select all pages
      setSelectedPages([...ALL_PAGE_KEYS]);
      setSelectAll(true);
    }
  };

  const filteredUsers = users.filter(user =>
    (user.user_name && user.user_name.toLowerCase().includes(searchText.toLowerCase())) ||
    (user.email && user.email.toLowerCase().includes(searchText.toLowerCase())) ||
    (user.name && user.name.toLowerCase().includes(searchText.toLowerCase())) ||
    (user.role && user.role.toLowerCase().includes(searchText.toLowerCase()))
  );

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'doctor': return 'bg-blue-100 text-blue-800';
      case 'nurse': return 'bg-green-100 text-green-800';
      case 'lab': return 'bg-orange-100 text-orange-800';
      case 'pharmacy': return 'bg-purple-100 text-purple-800';
      case 'receptionist': return 'bg-cyan-100 text-cyan-800';
      case 'rmo': return 'bg-indigo-100 text-indigo-800';
      case 'ot': return 'bg-pink-100 text-pink-800'; // OT role color
      case 'dressing staff': return 'bg-teal-100 text-teal-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Shield size={14} />;
      case 'doctor': return <Stethoscope size={14} />;
      case 'nurse': return <UserCog size={14} />;
      case 'lab': return <FlaskConical size={14} />;
      case 'pharmacy': return <Pill size={14} />;
      case 'rmo': return <Activity size={14} />;
      case 'ot': return <Scissors size={14} />; // OT role icon
      case 'dressing staff': return <Syringe size={14} />;
      default: return <User size={14} />;
    }
  };

  // Enhanced function to get page display info
  const getPageDisplayInfo = (pageKey) => {
    const page = ALL_PAGES.find(p => p.key === pageKey);
    if (!page) return {
      label: pageKey,
      description: '',
      icon: null
    };

    const IconComponent = sidebarIcons[page.icon];
    const icon = IconComponent ? <IconComponent size={16} /> : null;

    return {
      label: page.label,
      description: page.description || '',
      icon: icon
    };
  };

  const roles = [
    { value: 'admin', label: 'Administrator', icon: <Shield size={16} /> },
    { value: 'doctor', label: 'Doctor', icon: <Stethoscope size={16} /> },
    { value: 'nurse', label: 'Nurse', icon: <UserCog size={16} /> },
    { value: 'lab', label: 'Lab Technician', icon: <FlaskConical size={16} /> },
    { value: 'pharmacy', label: 'Pharmacist', icon: <Pill size={16} /> },
    { value: 'receptionist', label: 'Receptionist', icon: <User size={16} /> },
    { value: 'rmo', label: 'RMO', icon: <Activity size={16} /> },
    { value: 'ot', label: 'OT Staff', icon: <Scissors size={16} /> },
    { value: 'dressing staff', label: 'Dressing Staff', icon: <Syringe size={16} /> },
  ];

  // Check if user has all pages access
  const hasAllPagesAccess = (userPages) => {
    return userPages && userPages.length === ALL_PAGE_KEYS.length;
  };

  // Function to categorize pages by department for better organization
  const getPagesByDepartment = () => {
    const categories = {};
    const groups = ALL_PAGES.filter(p => p.type === 'group');

    ALL_PAGES.filter(page => page.type !== 'group').forEach(page => {
      let category = 'General';
      if (page.parent) {
        const parentGroup = groups.find(g => g.key === page.parent);
        if (parentGroup) category = parentGroup.label;
      }

      if (!categories[category]) categories[category] = [];
      categories[category].push(page);
    });

    return categories;
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                <Users size={20} className="text-white md:w-6 md:h-6" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">User Management</h1>
                <p className="hidden md:block text-gray-600">Manage system users and their permissions</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleAddUser}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg text-sm md:text-base"
          >
            <Plus size={18} className="md:w-5 md:h-5" />
            Add New User
          </button>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="mb-4 md:mb-6 bg-white rounded-xl border border-gray-200 p-3 md:p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search users..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm md:text-base"
              />
            </div>
          </div>
          <div className="flex items-center justify-between md:justify-start gap-4">
            <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
              <span className="text-xs md:text-sm text-gray-600">
                <span className="font-bold text-gray-900">{filteredUsers.length}</span>/
                <span className="font-bold text-gray-900">{users.length}</span> users
              </span>
            </div>
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Mobile View: Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white p-12 text-center rounded-xl border border-gray-200 shadow-sm">
            <RefreshCw className="animate-spin text-green-600 mx-auto" size={24} />
            <p className="mt-2 text-gray-500 text-sm">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-gray-200 shadow-sm">
            <Users className="mx-auto text-gray-400" size={32} />
            <p className="mt-2 text-gray-500 text-sm">No users found</p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm p-3">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {user.profile_image ? (
                      <img
                        src={user.profile_image}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyNCIgY3k9IjI0IiByPSIyNCIgZmlsbD0iI0VFRUVFRSIvPjxwYXRoIGQ9Ik0zMSAyMUMzMSAyNS40MTgzIDI4LjQxODMgMjggMjQgMjhDMTkuNTgxNyAyOCAxNyAyNS40MTgzIDE3IDIxQzE3IDE2LjU4MTcgMTkuNTgxNyAxNCAyNCAxNEMyOC40MTgzIDE0IDMxIDE2LjU4MTcgMzEgMjFaIiBmaWxsPSIjOTk5OTk5Ii8+PC9zdmc+';
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                        <User size={18} className="text-blue-600" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{user.name || user.user_name || 'No Name'}</h3>
                    <p className="text-[10px] text-gray-500 font-medium">@{user.user_name || 'No Username'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleEditUser(user)}
                    className="p-1.5 text-blue-600 bg-blue-50 rounded-lg"
                    title="Edit"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="p-1.5 text-red-600 bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2.5 border-t border-gray-50 mt-1">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold italic mb-1">Role</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${getRoleColor(user.role)}`}>
                      {user.role || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase font-bold italic mb-1">Contact</p>
                  <p className="text-[11px] text-gray-800 font-medium truncate">{user.email || 'No Email'}</p>
                </div>
              </div>

              <div className="pt-2.5 border-t border-gray-50">
                <p className="text-[10px] text-gray-500 uppercase font-bold italic mb-1.5">Access Control</p>
                {hasAllPagesAccess(user.pages) ? (
                  <div className="flex items-center gap-1.5 text-green-600 text-[10px] font-bold bg-green-50 px-2 py-1 rounded-md inline-flex">
                    <CheckCircle size={12} />
                    FULL ACCESS
                  </div>
                ) : user.pages && user.pages.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {user.pages.slice(0, 3).map((page) => {
                      const pageInfo = getPageDisplayInfo(page);
                      return (
                        <span key={page} className="bg-gray-50 text-gray-600 px-2 py-0.5 rounded border border-gray-100 text-[10px] font-medium">
                          {pageInfo.label}
                        </span>
                      );
                    })}
                    {user.pages.length > 3 && (
                      <span className="text-[9px] text-gray-400 font-bold self-center">
                        +{user.pages.length - 3} MORE
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-400 italic">No pages assigned</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop View: Table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">User Info</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Access Pages</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Profile Image</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <RefreshCw className="animate-spin text-blue-600" size={24} />
                    </div>
                    <p className="mt-2 text-gray-500">Loading users...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <Users className="mx-auto text-gray-400" size={48} />
                    <p className="mt-2 text-gray-500">No users found</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate max-w-[150px]">
                          {user.name || user.user_name || 'No Name'}
                        </div>
                        <div className="text-sm text-gray-500 truncate max-w-[150px]">
                          {user.user_name || 'No Username'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail size={14} className="text-gray-400" />
                          <span className="truncate max-w-[180px]">{user.email || 'N/A'}</span>
                        </div>
                        {user.phone_no && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Phone size={14} className="text-gray-400" />
                            <span className="truncate max-w-[180px]">{user.phone_no}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(user.role)}
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          {user.role === 'rmo' ? 'RMO' :
                            user.role === 'nurse' ? 'Nurse' :
                              user.role === 'ot' ? 'OT Staff' :
                                user.role === 'dressing staff' ? 'Dressing Staff' :
                                  user.role || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        {hasAllPagesAccess(user.pages) ? (
                          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg">
                            <CheckCircle size={14} />
                            <span className="text-sm font-medium">All Pages Access</span>
                          </div>
                        ) : user.pages && user.pages.length > 0 ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              {user.pages.slice(0, 3).map((page) => {
                                const pageInfo = getPageDisplayInfo(page);
                                return (
                                  <div
                                    key={page}
                                    className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 group relative"
                                    title={pageInfo.description}
                                  >
                                    {pageInfo.icon && React.cloneElement(pageInfo.icon, { size: 12, className: 'text-gray-500' })}
                                    <span className="truncate max-w-[100px]">
                                      {pageInfo.label}
                                    </span>
                                    {pageInfo.description && (
                                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded p-2 whitespace-nowrap z-10">
                                        <div className="font-medium mb-1">{pageInfo.label}</div>
                                        <div className="text-gray-300">{pageInfo.description}</div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {user.pages.length > 3 && (
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <ChevronRight size={12} />
                                <span>+{user.pages.length - 3} more pages</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">No pages assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        {user.profile_image ? (
                          <div className="relative group">
                            <img
                              src={user.profile_image}
                              alt={`${user.name || user.user_name}'s profile`}
                              className="w-12 h-12 rounded-full object-cover border border-gray-300 shadow-sm transition-transform duration-200 group-hover:scale-110"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyNCIgY3k9IjI0IiByPSIyNCIgZmlsbD0iI0VFRUVFRSIvPjxwYXRoIGQ9Ik0zMSAyMUMzMSAyNS40MTgzIDI4LjQxODMgMjggMjQgMjhDMTkuNTgxNyAyOCAxNyAyNS40MTgzIDE3IDIxQzE3IDE2LjU4MTcgMTkuNTgxNyAxNCAyNCAxNEMyOC40MTgzIDE0IDMxIDE2LjU4MTcgMzEgMjFaIiBmaWxsPSIjOTk5OTk5Ii8+PC9zdmc+';
                              }}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-full transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <Camera size={16} className="text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 border border-blue-200 flex items-center justify-center">
                            <User size={24} className="text-blue-600" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit user"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete user"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      {modalVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${editingUser ? 'bg-blue-100' : 'bg-green-100'}`}>
                    {editingUser ? (
                      <Edit size={24} className="text-blue-600" />
                    ) : (
                      <Plus size={24} className="text-green-600" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {editingUser ? 'Edit User' : 'Add New User'}
                    </h2>
                    <p className="text-gray-500">
                      {editingUser ? 'Update user details and permissions' : 'Create a new user account'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalVisible(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-gray-400" />
                      <span>Username *</span>
                    </div>
                  </label>
                  <input
                    type="text"
                    name="user_name"
                    value={formData.user_name}
                    onChange={handleInputChange}
                    placeholder="Enter username"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter full name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-gray-400" />
                      <span>Email *</span>
                    </div>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-gray-400" />
                      <span>Phone Number *</span>
                    </div>
                  </label>
                  <input
                    type="tel"
                    name="phone_no"
                    value={formData.phone_no}
                    onChange={handleInputChange}
                    placeholder="Enter phone number"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-gray-400" />
                      <span>Role *</span>
                    </div>
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select role</option>
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Password (for new users) */}
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <Lock size={16} className="text-gray-400" />
                        <span>Password *</span>
                      </div>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Enter password"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Profile Image - Now spans full width for better display */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon size={16} className="text-gray-400" />
                      <span>Profile Image</span>
                    </div>
                  </label>
                  <div className="flex flex-col md:flex-row items-center gap-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-shrink-0">
                      {formData.profile_image ? (
                        <div className="relative">
                          <img
                            src={formData.profile_image}
                            alt="Profile preview"
                            className="w-32 h-32 rounded-lg object-cover border border-gray-300 shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
                          <User size={48} className="text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="space-y-4">
                        <div>
                          <label className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium transition-colors cursor-pointer hover:bg-gray-50 hover:border-gray-400">
                            <Upload size={20} />
                            <span>{uploading ? 'Uploading...' : 'Choose Profile Image'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="hidden"
                              disabled={uploading}
                            />
                          </label>
                          <p className="text-xs text-gray-500 mt-2 text-center">Recommended: Square image, JPG or PNG, max 2MB</p>
                        </div>
                        {imageFile && (
                          <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded border border-blue-200">
                            <div className="flex items-center gap-2">
                              <Check size={16} />
                              <span>Selected: {imageFile.name}</span>
                            </div>
                            <p className="text-xs text-blue-500 mt-1">Image will be uploaded when you save the user</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Access Permissions Section */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Key size={20} className="text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Access Permissions</h3>
                </div>
                <p className="text-gray-600 mb-4">Select which pages this user can access</p>

                {/* Select All Checkbox */}
                <div className="mb-4">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <CheckCircle size={18} className="text-blue-600" />
                      <span className="font-medium text-blue-700">Select All Pages (Full Access)</span>
                    </div>
                  </label>
                </div>

                {!selectAll && (
                  <>
                    <p className="text-sm text-gray-600 mb-3">Or select individual pages by department:</p>
                    <div className="space-y-4">
                      {Object.entries(getPagesByDepartment()).map(([department, pages]) => (
                        <div key={department} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                              {department === 'Nurse Station' && <UserCog size={16} className="text-green-600" />}
                              {department === 'RMO' && <Activity size={16} className="text-indigo-600" />}
                              {department === 'OT' && <Scissors size={16} className="text-pink-600" />} {/* OT department icon */}
                              {department === 'Laboratory' && <FlaskConical size={16} className="text-orange-600" />}
                              {department === 'Pharmacy' && <Pill size={16} className="text-purple-600" />}
                              {department === 'General' && <Users size={16} className="text-gray-600" />}
                              <span className="font-semibold text-gray-700">{department}</span>
                              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                {pages.length} pages
                              </span>
                            </div>
                          </div>
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {pages.map((page) => (
                              <label
                                key={page.key}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedPages.includes(page.key)
                                  ? 'bg-blue-50 border-blue-200'
                                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedPages.includes(page.key)}
                                  onChange={() => handlePageToggle(page.key)}
                                  className="mt-1 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    {page.icon && sidebarIcons[page.icon] && React.createElement(sidebarIcons[page.icon], { size: 14, className: 'text-gray-500' })}
                                    <span className="text-sm font-medium text-gray-700">
                                      {page.label}
                                    </span>
                                  </div>
                                  {page.description && (
                                    <p className="text-xs text-gray-500">{page.description}</p>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Selected Pages Summary */}
                {(selectAll || selectedPages.length > 0) && (
                  <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckSquare size={18} className="text-blue-600" />
                        <span className="font-medium text-blue-800">
                          {selectAll ? 'All Pages Selected' : `Selected Pages (${selectedPages.length})`}
                        </span>
                      </div>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {selectAll ? 'All Access' : `${selectedPages.length} pages`}
                      </span>
                    </div>
                    {selectAll ? (
                      <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                        <CheckCircle size={16} />
                        <span className="text-sm font-medium">User will have access to all system pages</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {selectedPages.slice(0, 6).map((page) => {
                            const pageInfo = getPageDisplayInfo(page);
                            const isNurse = page.startsWith('nurse-station-');
                            const isRMO = page.startsWith('rmo-');
                            const isOT = page.startsWith('ot-'); // Check for OT pages

                            return (
                              <div key={page} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm" style={{
                                borderColor: isNurse ? '#d1fae5' : isRMO ? '#e0e7ff' : isOT ? '#fce7f3' : '#dbeafe'
                              }}>
                                {pageInfo.icon && React.cloneElement(pageInfo.icon, {
                                  size: 14,
                                  className: isNurse ? 'text-green-600' : isRMO ? 'text-indigo-600' : isOT ? 'text-pink-600' : 'text-blue-600'
                                })}
                                <span className="text-sm font-medium text-gray-700">
                                  {pageInfo.label}
                                </span>
                              </div>
                            );
                          })}
                          {selectedPages.length > 6 && (
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-blue-100 shadow-sm">
                              <span className="text-sm font-medium text-blue-600">
                                +{selectedPages.length - 6} more
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Department Summary */}
                        <div className="mt-3 text-sm text-gray-600">
                          <div className="flex flex-wrap gap-3">
                            {selectedPages.some(p => p.startsWith('nurse-station-')) && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span>Nurse Station</span>
                              </div>
                            )}
                            {selectedPages.some(p => p.startsWith('rmo-')) && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                <span>RMO</span>
                              </div>
                            )}
                            {selectedPages.some(p => p.startsWith('ot-')) && ( // OT department summary
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                                <span>OT (Operation Theater)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setModalVisible(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModalSubmit}
                  disabled={uploading}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : editingUser ? (
                    <>
                      <Save size={18} />
                      Update User
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;