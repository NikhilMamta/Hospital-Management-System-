import { useState, useEffect, useMemo, useCallback } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  LineChart,
  History,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Pill,
  UserCheck,
  User,
  Users,
  Stethoscope,
  Building,
  Bed,
  FileText,
  ClipboardList,
  CheckSquare,
  BarChart3,
  UserCog,
  Shield,
  Scissors,
  Clock,
  Key,
  Calendar,
  Trash2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Footer from "../components/Footer";

// Icon mapping
const iconComponents = {
  Activity,
  LayoutDashboard,
  User,
  FileText,
  LineChart,
  History,
  Scissors,
  Clock,
  UserCog,
  ClipboardList,
  CheckSquare,
  BarChart3,
  Shield,
  FlaskConical,
  Pill,
  UserCheck,
  Users,
  Stethoscope,
  Building,
  Bed,
  Key,
  Calendar,
  Trash2,
};

const AdminLayout = () => {
  const {
    user,
    logout,
    getAccessibleSidebarItems,
    getAccessibleGroupRoutes,
    hasPageAccess,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [tabs, setTabs] = useState([
    { key: "/admin/dashboard", label: "Dashboard", path: "/admin/dashboard" },
  ]);

  // Get accessible pages - memoized
  const sidebarItems = useMemo(
    () => getAccessibleSidebarItems(),
    [getAccessibleSidebarItems],
  );

  // Memoize group routes
  const groupRoutes = useMemo(() => {
    const routes = {};
    sidebarItems.forEach((item) => {
      if (item.type === "group") {
        routes[item.key] = getAccessibleGroupRoutes(item.key);
      }
    });
    return routes;
  }, [sidebarItems, getAccessibleGroupRoutes]);

  // Initialize expanded groups based on current path
  useEffect(() => {
    const currentPath = location.pathname;
    const newExpandedGroups = {};

    sidebarItems.forEach((item) => {
      if (item.type === "group") {
        const children = groupRoutes[item.key] || [];
        const shouldExpand = children.some((child) =>
          currentPath.startsWith(child.path),
        );
        if (shouldExpand) {
          newExpandedGroups[item.key] = true;
        }
      }
    });

    setExpandedGroups(newExpandedGroups);
  }, [location.pathname, sidebarItems, groupRoutes]);

  // Helper to get label for path
  const getLabelForPath = useCallback(
    (path) => {
      for (const item of sidebarItems) {
        if (item.type === "single" && item.path === path) {
          return item.label;
        }
        if (item.type === "group") {
          const children = groupRoutes[item.key] || [];
          const child = children.find((c) => c.path === path);
          if (child) return child.label;
        }
      }
      // Fallback: format path
      const segments = path.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      return lastSegment
        ? lastSegment.charAt(0).toUpperCase() +
            lastSegment.slice(1).replace(/-/g, " ")
        : "Page";
    },
    [sidebarItems, groupRoutes],
  );

  // Update tabs on location change
  useEffect(() => {
    const currentPath = location.pathname;
    // Don't add auth or login pages to tabs if they happen to be accessed
    if (currentPath.startsWith("/login")) return;

    setTabs((prevTabs) => {
      const exists = prevTabs.some((tab) => tab.path === currentPath);
      if (exists) return prevTabs;

      const label = getLabelForPath(currentPath);
      return [...prevTabs, { key: currentPath, label, path: currentPath }];
    });
  }, [location.pathname, getLabelForPath]);

  // Close sidebar on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const toggleGroup = useCallback((groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }, []);

  const isActive = useCallback(
    (path) => {
      return location.pathname === path;
    },
    [location.pathname],
  );

  const getIcon = useCallback((iconName) => {
    const IconComponent = iconComponents[iconName];
    return IconComponent ? (
      <IconComponent size={20} className="shrink-0" />
    ) : null;
  }, []);

  // Function to get accessible children for a group
  const getGroupChildren = useCallback(
    (groupKey) => {
      return groupRoutes[groupKey] || [];
    },
    [groupRoutes],
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-t border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between max-w-full">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={toggleSidebar}
              className="hidden text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-md p-2 transition-colors"
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link
              to="/admin/dashboard"
              className="flex items-center gap-2 sm:gap-3 min-w-0"
            >
              <span className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 truncate">
                HMS
              </span>
              <span className="text-xs sm:text-sm bg-green-600 text-white px-2 sm:px-3 py-1 rounded whitespace-nowrap capitalize">
                {user?.role || "admin"}
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {user && (
              <Link
                to="/admin/profile"
                className="flex items-center gap-2 sm:gap-3 min-w-0 hover:bg-gray-50 rounded-lg p-2 transition-colors"
              >
                <img
                  src={user.image}
                  alt={user.name}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src =
                      "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=600";
                  }}
                />
                <div className="hidden md:block">
                  <span className="text-sm sm:text-base font-medium text-gray-700 truncate max-w-32 lg:max-w-none block">
                    {user.name}
                  </span>
                  <span className="text-xs text-gray-500 truncate max-w-32 lg:max-w-none block capitalize">
                    {user.role}
                  </span>
                </div>
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 sm:gap-2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-md px-2 sm:px-3 py-1.5 sm:py-2 transition-colors"
            >
              <LogOut size={16} className="sm:w-5 sm:h-5" />
              <span className="hidden sm:inline-block text-sm">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16 pb-28 lg:pb-12">
        {" "}
        {/* Added pb-12 for footer space */}
        {/* Sidebar */}
        <aside
          className={`w-64 lg:w-16 lg:hover:w-64 bg-white border-r border-gray-200 fixed top-16 bottom-12 left-0 z-40 transform transition-all duration-300 ease-in-out lg:translate-x-0 shadow-lg lg:shadow-none group ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="h-full overflow-y-auto">
            <nav className="p-4 space-y-1">
              {sidebarItems.map((item) => {
                if (item.type === "single") {
                  // Render single page link
                  return (
                    <Link
                      key={item.key}
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium lg:justify-center lg:group-hover:justify-start ${
                        isActive(item.path)
                          ? "bg-green-50 text-green-600 border-r-4 border-green-600"
                          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                      onClick={closeSidebar}
                    >
                      {getIcon(item.icon)}
                      <span className="truncate lg:hidden lg:group-hover:inline">{item.label}</span>
                    </Link>
                  );
                } else if (item.type === "group") {
                  // Render group with dropdown
                  const children = getGroupChildren(item.key);
                  const isExpanded = expandedGroups[item.key];
                  const isActiveGroup = children.some((child) =>
                    isActive(child.path),
                  );

                  return (
                    <div key={item.key} className="space-y-1">
                      <button
                        onClick={() => toggleGroup(item.key)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium lg:justify-center lg:group-hover:justify-start ${
                          isActiveGroup
                            ? "bg-green-50 text-green-600"
                            : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {getIcon(item.icon)}
                          <span className="truncate lg:hidden lg:group-hover:inline">{item.label}</span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown size={16} className="shrink-0 lg:hidden lg:group-hover:block" />
                        ) : (
                          <ChevronRight size={16} className="shrink-0 lg:hidden lg:group-hover:block" />
                        )}
                      </button>

                      {/* Dropdown content */}
                      <div
                        className={`overflow-hidden transition-all duration-300 ${
                          isExpanded ? "max-h-96" : "max-h-0"
                        } lg:hidden lg:group-hover:block`}
                      >
                        <div className="ml-4 pl-2 border-l-2 border-gray-200 space-y-1 pb-1">
                          {" "}
                          {/* Added pb-1 for bottom padding */}
                          {children.map((child) => (
                            <Link
                              key={child.key}
                              to={child.path}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-xs font-medium ${
                                isActive(child.path)
                                  ? "bg-green-50 text-green-600"
                                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                              }`}
                              onClick={closeSidebar}
                            >
                              {child.icon && getIcon(child.icon)}
                              <span className="truncate">{child.label}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </nav>
          </div>
        </aside>
        {/* Main content */}
        <main className="flex-1 ml-0 lg:ml-16 overflow-auto">
          {/* Tabs Bar */}
          <div className="hidden lg:block bg-white border-b border-gray-200 sticky top-0 z-10 overflow-x-auto">
            <div className="flex items-center text-sm gap-1 px-2 pt-1">
              {tabs.map((tab) => (
                <div
                  key={tab.key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer transition-colors ${
                    location.pathname === tab.path
                      ? "bg-gray-50 text-green-600 font-medium border-t border-l border-r border-gray-200"
                      : "text-gray-600 hover:bg-gray-50 border border-transparent"
                  }`}
                  onClick={() => navigate(tab.path)}
                >
                  <span className="whitespace-nowrap">{tab.label}</span>
                  {tab.path !== "/admin/dashboard" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newTabs = tabs.filter((t) => t.key !== tab.key);
                        setTabs(newTabs);
                        if (location.pathname === tab.path) {
                          const index = tabs.findIndex(
                            (t) => t.key === tab.key,
                          );
                          const nextTab =
                            newTabs[index - 1] || newTabs[0] || tabs[0];
                          navigate(nextTab.path);
                        }
                      }}
                      className="text-gray-400 hover:text-gray-600 rounded-full p-0.5 hover:bg-gray-200 transition-colors"
                      aria-label="Close tab"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 sm:p-6 lg:p-8 min-h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Fixed Footer */}
      <Footer />

      {/* Bottom Nav for Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex justify-around items-center h-16 shadow-lg">
        <Link
          to="/admin/dashboard"
          className={`flex flex-col items-center gap-1 text-xs font-medium ${
            isActive("/admin/dashboard") ? "text-green-600" : "text-gray-600"
          }`}
          onClick={() => {
            closeSidebar();
            setMobileMenuOpen(false);
          }}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </Link>
        <Link
          to="/admin/patient-profile"
          className={`flex flex-col items-center gap-1 text-xs font-medium ${
            isActive("/admin/patient-profile")
              ? "text-green-600"
              : "text-gray-600"
          }`}
          onClick={() => {
            closeSidebar();
            setMobileMenuOpen(false);
          }}
        >
          <User size={20} />
          <span>Patient Profile</span>
        </Link>
        {hasPageAccess("pharmacy-track-store-out") && (
          <Link
            to="/admin/pharmacy/track-store-out"
            className={`flex flex-col items-center gap-1 text-xs font-medium ${
              isActive("/admin/pharmacy/track-store-out")
                ? "text-green-600"
                : "text-gray-600"
            }`}
            onClick={() => {
              closeSidebar();
              setMobileMenuOpen(false);
            }}
          >
            <Pill size={20} />
            <span>Track Out</span>
          </Link>
        )}
        <button
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className={`flex flex-col items-center gap-1 text-xs font-medium ${
            mobileMenuOpen ? "text-green-600" : "text-gray-600"
          }`}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          <span>Menu</span>
        </button>
      </nav>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Mobile Grid Menu Modal */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-white z-40 lg:hidden pt-16 pb-16 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Navigation
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sidebarItems.map((item) => {
                if (item.type === "single") {
                  return (
                    <Link
                      key={item.key}
                      to={item.path}
                      className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-green-50 transition-colors border border-gray-100"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="text-green-600 mb-2">
                        {getIcon(item.icon)}
                      </div>
                      <span className="text-xs font-medium text-gray-700 text-center">
                        {item.label}
                      </span>
                    </Link>
                  );
                } else if (item.type === "group") {
                  const children = getGroupChildren(item.key);
                  return (
                    <div
                      key={item.key}
                      className="col-span-2 sm:col-span-3 mt-2"
                    >
                      <h3 className="text-sm font-medium text-gray-500 mb-2 px-1">
                        {item.label}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {children.map((child) => (
                          <Link
                            key={child.key}
                            to={child.path}
                            className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-green-50 transition-colors border border-gray-100"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <div className="text-green-600 mb-2">
                              {child.icon
                                ? getIcon(child.icon)
                                : getIcon(item.icon)}
                            </div>
                            <span className="text-xs font-medium text-gray-700 text-center">
                              {child.label}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLayout;
