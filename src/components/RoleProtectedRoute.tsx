import { Navigate, Outlet } from 'react-router-dom';
import type { UserRole } from '../types';
import { LoadingState } from './ui';
import { useAuth } from '../features/auth/AuthContext';
import { roleRouteDestination } from '../features/auth/authPolicy';

export function RoleProtectedRoute({ role: requiredRole }: { role: UserRole }) {
  const { role, accountStatus, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-8"><LoadingState label="Checking access" /></div>;
  }

  const destination = roleRouteDestination(requiredRole, role, accountStatus);
  if (destination) return <Navigate to={destination} replace />;
  return <Outlet />;
}
