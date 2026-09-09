import type { UserRole } from '../../types';

export type AccountStatus =
  | 'loading'
  | 'signed_out'
  | 'ready'
  | 'missing_profile'
  | 'invalid_role'
  | 'missing_student'
  | 'inactive_student'
  | 'unavailable';

export function isUserRole(value: unknown): value is UserRole {
  return value === 'student' || value === 'admin';
}

export function dashboardPath(role: UserRole) {
  return role === 'admin' ? '/admin/dashboard' : '/student/dashboard';
}

export function loginPath(role: UserRole) {
  return role === 'admin' ? '/admin/login' : '/student/login';
}

export function roleForProtectedPath(pathname: string): UserRole {
  return pathname.startsWith('/admin') ? 'admin' : 'student';
}

export function portalRoleError(portal: UserRole, actualRole: UserRole) {
  if (portal === 'admin' && actualRole === 'student') {
    return 'This account does not have administrator access.';
  }
  if (portal === 'student' && actualRole === 'admin') {
    return 'This account is registered as an administrator. Please use Admin Login.';
  }
  return null;
}

export function accountStatusMessage(status: AccountStatus, studentStatus: string | null = null) {
  switch (status) {
    case 'missing_profile':
      return 'This account is not fully registered. Please contact the academy.';
    case 'invalid_role':
      return 'This account does not have a valid portal role. Please contact the academy.';
    case 'missing_student':
      return 'Your student account setup is incomplete. Please contact the academy.';
    case 'inactive_student':
      return studentStatus === 'inactive'
        ? 'This student account is inactive. Please contact the academy.'
        : 'This student account is not active. Please contact the academy.';
    case 'unavailable':
      return 'We could not verify this account right now. Please try again.';
    default:
      return null;
  }
}

export function roleRouteDestination(
  requiredRole: UserRole,
  actualRole: UserRole | null,
  accountStatus: AccountStatus,
) {
  if (accountStatus !== 'ready' || !actualRole) return loginPath(requiredRole);
  return actualRole === requiredRole ? null : dashboardPath(actualRole);
}
