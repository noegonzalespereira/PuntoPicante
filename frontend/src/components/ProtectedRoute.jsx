import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ roles = [] }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (roles.length && (!user?.rol || !roles.includes(user.rol))) {
    // sin permiso -> a login o a una página 403
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
