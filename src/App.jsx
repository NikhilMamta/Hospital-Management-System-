import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { useEffect } from "react";

import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/Dashboard/Dashboard";
import AdminLabAdvice from "./pages/admin/Lab/Labadvice";
import Admission from "./pages/admin/Admission/Admission";
import DepartmentSelection from "./pages/admin/Admission/DepartmentSelection";
import IPDAdmission from "./pages/admin/IPD/IPDAdmission";
import LabPaymentSlip from "./pages/admin/Lab/Labpaymentslip";
import ReceiveSample from "./pages/admin/Lab/ReceiveSample";
import LabXray from "./pages/admin/Lab/Labxray";
import LabCT from "./pages/admin/Lab/LabCT";
import LabUSG from "./pages/admin/Lab/Labusg";
import AdminLayout from "./layouts/AdminLayout";
import NotFound from "./pages/NotFound";
import Pathology from "./pages/admin/Lab/Pathology";
import PharmacyIndent from "./pages/admin/Pharmacy/PharmacyIndent";
import PharmacyApproval from "./pages/admin/Pharmacy/PharmacyApproval";
import PharmacyStore from "./pages/admin/Pharmacy/PharmacyStore";
import DischargePatient from "./pages/admin/Discharge/Dischargepatient";
import InitiationRMO from "./pages/admin/Discharge/InitiationRMO";
import CompleteFileWork from "./pages/admin/Discharge/CompleteFileWork";
import ConcernDepartment from "./pages/admin/Discharge/ConcernDepartment";
import ConcernAuthority from "./pages/admin/Discharge/ConcernAuthority";
import DischargeBill from "./pages/admin/Discharge/DischargeBill";
import ProfilePatient from "./pages/admin/PatientProfile/ProfilePatient";
import ProfilePatientDetails from "./pages/admin/PatientProfile/ProfilePatientDetails";
import Treatment from "./pages/admin/PatientProfile/Treatment";
import RMOTask from "./pages/admin/PatientProfile/RMOTask";
import Nursing from "./pages/admin/PatientProfile/Nursing";
import Lab from "./pages/admin/PatientProfile/Lab";
import Pharmacy from "./pages/admin/PatientProfile/Pharmacy";
import OT from "./pages/admin/PatientProfile/OT";

// Masters Components
import AllStaff from "./pages/admin/masters/AllStaff";
import Medicine from "./pages/admin/masters/Medicine";
import Department from "./pages/admin/masters/Department";
import Tests from "./pages/admin/masters/Tests";
import FloorBed from "./pages/admin/masters/FloorBed";
import Doctors from "./pages/admin/masters/Doctors";
import ManageUsers from "./pages/admin/masters/ManageUsers";

// Nurse Station Components
import AssignTask from "./pages/admin/nurseStation/AssignTask";
import TaskList from "./pages/admin/nurseStation/TaskList";
import ScoreDashboard from "./pages/admin/nurseStation/ScoreDashboard";

// RMO Components
import RMOAssignTask from "./pages/admin/rmo/RMOAssignTask";
import RMOTaskList from "./pages/admin/rmo/RMOTaskList";
import RMOScoreDashboard from "./pages/admin/rmo/RMOScoreDashboard";

// OT Components
import AssignOtTime from "./pages/admin/OT/AssignOtTime";

// Patient Profile Components
import PatientOverview from "./pages/admin/PatientProfile/PatientOverview";
import GivenTask from "./pages/admin/PatientProfile/GivenTask";
// Protected Route Component
import ProtectedRoute from "./components/ProtectedRoute";
import Dressing from "./pages/admin/PatientProfile/Dressing";
import Roster from "./pages/Roster";

function App() {
  const { user, loading } = useAuth();

  // ── Global: phone-field enforcement & dropdown autofill suppression ──
  useEffect(() => {
    // Returns true if this input is a phone/mobile/contact field
    const isPhoneInput = (el) => {
      if (!(el instanceof HTMLInputElement)) return false;
      const type = el.type?.toLowerCase();
      const name = (el.name || "").toLowerCase();
      const placeholder = (el.placeholder || "").toLowerCase();
      const id = (el.id || "").toLowerCase();
      return (
        type === "tel" ||
        name.includes("phone") ||
        name.includes("mobile") ||
        name.includes("contact") ||
        placeholder.includes("phone") ||
        placeholder.includes("mobile") ||
        id.includes("phone") ||
        id.includes("mobile")
      );
    };

    // Patch a phone input: autocomplete off + maxlength 10
    const patchPhoneInput = (el) => {
      el.setAttribute("autocomplete", "off");
      el.setAttribute("maxlength", "10");
      el.setAttribute("inputmode", "numeric");
    };

    // Patch a select: autocomplete off
    const patchSelect = (el) => {
      el.setAttribute("autocomplete", "off");
    };

    // Patch all existing elements on load
    const patchAll = () => {
      document.querySelectorAll('input[type="tel"], input').forEach((el) => {
        if (isPhoneInput(el)) patchPhoneInput(el);
      });
      document.querySelectorAll("select").forEach(patchSelect);
    };
    patchAll();

    // Watch for new elements added dynamically (modals, forms rendered later)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const el = node;
          if (el.tagName === "INPUT" && isPhoneInput(el)) patchPhoneInput(el);
          if (el.tagName === "SELECT") patchSelect(el);
          el.querySelectorAll?.("input").forEach((inp) => {
            if (isPhoneInput(inp)) patchPhoneInput(inp);
          });
          el.querySelectorAll?.("select").forEach(patchSelect);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Global keydown: block non-digit keys on phone inputs
    const handleKeyDown = (e) => {
      const el = e.target;
      if (!isPhoneInput(el)) return;

      const allowedKeys = [
        "Backspace",
        "Delete",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Tab",
        "Home",
        "End",
      ];
      const isDigit = /^[0-9]$/.test(e.key);
      const isCtrl = e.ctrlKey || e.metaKey; // allow Ctrl+A, Ctrl+C, etc.

      if (!isDigit && !allowedKeys.includes(e.key) && !isCtrl) {
        e.preventDefault();
        return;
      }

      // Enforce 10-digit max (ignore if selection replaces text)
      if (isDigit && el.value.replace(/\D/g, "").length >= 10) {
        const selLen = Math.abs(
          (el.selectionEnd ?? 0) - (el.selectionStart ?? 0),
        );
        if (selLen === 0) {
          e.preventDefault();
        }
      }
    };

    // Global paste: strip non-digits and cap at 10 on phone inputs
    const handlePaste = (e) => {
      const el = e.target;
      if (!isPhoneInput(el)) return;
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 10);
      document.execCommand("insertText", false, pasted);
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("paste", handlePaste, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("paste", handlePaste, true);
    };
  }, []);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <NotificationProvider>
      <Routes>
        {/* Root Route - Redirect to Login or Dashboard */}
        <Route
          path="/"
          element={
            <Navigate to={user ? "/admin/dashboard" : "/login"} replace />
          }
        />

        {/* Public Routes */}
        <Route
          path="/login"
          element={
            user ? <Navigate to="/admin/dashboard" replace /> : <Login />
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />

          {/* Dashboard */}
          <Route
            path="dashboard"
            element={
              <ProtectedRoute requiredPage="dashboard">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Roster */}
          <Route
            path="roster"
            element={
              <ProtectedRoute requiredPage="roster">
                <Roster />
              </ProtectedRoute>
            }
          />

          {/* Patient Profile Routes */}
          <Route
            path="patient-profile"
            element={
              <ProtectedRoute requiredPage="patient-profile">
                <ProfilePatient />
              </ProtectedRoute>
            }
          />

          <Route
            path="patient-profile/:id"
            element={
              <ProtectedRoute requiredPage="patient-profile">
                <ProfilePatientDetails />
              </ProtectedRoute>
            }
          >
            <Route index element={<PatientOverview />} />
            <Route path="rmo" element={<RMOTask />} />
            <Route path="nursing" element={<Nursing />} />
            <Route path="lab" element={<Lab />} />
            <Route path="pharmacy" element={<Pharmacy />} />
            <Route path="ot" element={<OT />} />
            <Route path="assign-tasks" element={<GivenTask />} />
            <Route path="dressing" element={<Dressing />} />
          </Route>

          {/* Admission Routes */}
          <Route
            path="admission/add-patient"
            element={
              <ProtectedRoute requiredPage="admission-add-patient">
                <Admission />
              </ProtectedRoute>
            }
          />

          <Route
            path="admission/department-selection"
            element={
              <ProtectedRoute requiredPage="admission-department-selection">
                <DepartmentSelection />
              </ProtectedRoute>
            }
          />

          {/* IPD Routes */}
          <Route
            path="ipd/admission"
            element={
              <ProtectedRoute requiredPage="ipd-admission">
                <IPDAdmission />
              </ProtectedRoute>
            }
          />

          {/* OT Routes */}
          <Route
            path="ot/assign-ot-time"
            element={
              <ProtectedRoute requiredPage="ot-assign-ot-time">
                <AssignOtTime />
              </ProtectedRoute>
            }
          />

          {/* Nurse Station Routes */}
          <Route
            path="nurse-station/assign-task"
            element={
              <ProtectedRoute requiredPage="nurse-station-assign-task">
                <AssignTask />
              </ProtectedRoute>
            }
          />

          <Route
            path="nurse-station/task-list"
            element={
              <ProtectedRoute requiredPage="nurse-station-task-list">
                <TaskList />
              </ProtectedRoute>
            }
          />

          <Route
            path="nurse-station/score-dashboard"
            element={
              <ProtectedRoute requiredPage="nurse-station-score-dashboard">
                <ScoreDashboard />
              </ProtectedRoute>
            }
          />

          {/* RMO Routes */}
          <Route
            path="rmo/assign-task"
            element={
              <ProtectedRoute requiredPage="rmo-assign-task">
                <RMOAssignTask />
              </ProtectedRoute>
            }
          />

          <Route
            path="rmo/task-list"
            element={
              <ProtectedRoute requiredPage="rmo-task-list">
                <RMOTaskList />
              </ProtectedRoute>
            }
          />

          <Route
            path="rmo/score-dashboard"
            element={
              <ProtectedRoute requiredPage="rmo-score-dashboard">
                <RMOScoreDashboard />
              </ProtectedRoute>
            }
          />

          {/* Lab Routes */}
          <Route
            path="lab/advice"
            element={
              <ProtectedRoute requiredPage="lab-advice">
                <AdminLabAdvice />
              </ProtectedRoute>
            }
          />

          <Route
            path="lab/payment-slip"
            element={
              <ProtectedRoute requiredPage="lab-payment-slip">
                <LabPaymentSlip />
              </ProtectedRoute>
            }
          />

          <Route
            path="lab/receive-sample"
            element={
              <ProtectedRoute requiredPage="lab-receive-sample">
                <ReceiveSample />
              </ProtectedRoute>
            }
          />

          <Route
            path="lab/xray"
            element={
              <ProtectedRoute requiredPage="lab-xray">
                <LabXray />
              </ProtectedRoute>
            }
          />

          <Route
            path="lab/ct-scan"
            element={
              <ProtectedRoute requiredPage="lab-ct-scan">
                <LabCT />
              </ProtectedRoute>
            }
          />

          <Route
            path="lab/usg"
            element={
              <ProtectedRoute requiredPage="lab-usg">
                <LabUSG />
              </ProtectedRoute>
            }
          />

          <Route
            path="lab/pathology"
            element={
              <ProtectedRoute requiredPage="lab-pathology">
                <Pathology />
              </ProtectedRoute>
            }
          />

          {/* Pharmacy Routes */}
          <Route
            path="pharmacy/indent"
            element={
              <ProtectedRoute requiredPage="pharmacy-indent">
                <PharmacyIndent />
              </ProtectedRoute>
            }
          />

          <Route
            path="pharmacy/approval"
            element={
              <ProtectedRoute requiredPage="pharmacy-approval">
                <PharmacyApproval />
              </ProtectedRoute>
            }
          />

          <Route
            path="pharmacy/store"
            element={
              <ProtectedRoute requiredPage="pharmacy-store">
                <PharmacyStore />
              </ProtectedRoute>
            }
          />

          {/* Discharge Routes */}
          <Route
            path="discharge/patient"
            element={
              <ProtectedRoute requiredPage="discharge-patient">
                <DischargePatient />
              </ProtectedRoute>
            }
          />

          <Route
            path="discharge/initiation"
            element={
              <ProtectedRoute requiredPage="discharge-initiation">
                <InitiationRMO />
              </ProtectedRoute>
            }
          />

          <Route
            path="discharge/complete-file"
            element={
              <ProtectedRoute requiredPage="discharge-complete-file">
                <CompleteFileWork />
              </ProtectedRoute>
            }
          />

          <Route
            path="discharge/concern-department"
            element={
              <ProtectedRoute requiredPage="discharge-concern-department">
                <ConcernDepartment />
              </ProtectedRoute>
            }
          />

          <Route
            path="discharge/concern-authority"
            element={
              <ProtectedRoute requiredPage="discharge-concern-authority">
                <ConcernAuthority />
              </ProtectedRoute>
            }
          />

          <Route
            path="discharge/bill"
            element={
              <ProtectedRoute requiredPage="discharge-bill">
                <DischargeBill />
              </ProtectedRoute>
            }
          />

          {/* Masters Routes */}
          <Route
            path="masters/all-staff"
            element={
              <ProtectedRoute requiredPage="masters-all-staff">
                <AllStaff />
              </ProtectedRoute>
            }
          />

          <Route
            path="masters/medicine"
            element={
              <ProtectedRoute requiredPage="masters-medicine">
                <Medicine />
              </ProtectedRoute>
            }
          />

          <Route
            path="masters/department"
            element={
              <ProtectedRoute requiredPage="masters-department">
                <Department />
              </ProtectedRoute>
            }
          />

          <Route
            path="masters/tests"
            element={
              <ProtectedRoute requiredPage="masters-tests">
                <Tests />
              </ProtectedRoute>
            }
          />

          <Route
            path="masters/floor-bed"
            element={
              <ProtectedRoute requiredPage="masters-floor-bed">
                <FloorBed />
              </ProtectedRoute>
            }
          />

          <Route
            path="masters/doctors"
            element={
              <ProtectedRoute requiredPage="masters-doctors">
                <Doctors />
              </ProtectedRoute>
            }
          />

          <Route
            path="masters/manage-users"
            element={
              <ProtectedRoute requiredPage="masters-manage-users">
                <ManageUsers />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch-all route for admin - redirect to dashboard if route not found */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </NotificationProvider>
  );
}

export default App;
