import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredPage }) => {
  const { user, hasPageAccess } = useAuth();

  // If no user, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If requiredPage is provided, check if user has access
  if (requiredPage && !hasPageAccess(requiredPage)) {
    // You can redirect to dashboard or show unauthorized page
    console.warn(`User does not have access to: ${requiredPage}`);
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;