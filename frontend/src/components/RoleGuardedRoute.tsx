import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface RoleGuardedRouteProps {
  allowedRoles: string[];
}

function RoleGuardedRoute({ allowedRoles }: RoleGuardedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const role = user?.role ?? 'user';

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default RoleGuardedRoute;
