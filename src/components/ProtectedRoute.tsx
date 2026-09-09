import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingState } from './ui';
import { useAuth } from '../features/auth/AuthContext';
import { loginPath, roleForProtectedPath } from '../features/auth/authPolicy';

export function ProtectedRoute() {
  const { user, loading, accountStatus, accountMessage } = useAuth();
  const location = useLocation();
  const requestedRole = roleForProtectedPath(location.pathname);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-8"><LoadingState label="Restoring your session" /></div>;
  }

  if (!user || accountStatus !== 'ready') {
    return <Navigate
      to={loginPath(requestedRole)}
      replace
      state={{ from: location, message: accountMessage }}
    />;
  }

  return <Outlet />;
}
