import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { isSupabaseConfigured } from '../../lib/env';
import type { Profile, UserRole } from '../../types';
import { accountStatusMessage, isUserRole, type AccountStatus } from './authPolicy';

interface AuthSnapshot {
  session: Session | null;
  profile: Profile | null;
  studentStatus: string | null;
  accountStatus: AccountStatus;
  accountMessage: string | null;
}

interface SignInResult {
  error: string | null;
  role: UserRole | null;
}

interface AuthState extends AuthSnapshot {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

interface AccountResolution {
  profile: Profile | null;
  studentStatus: string | null;
  accountStatus: AccountStatus;
  accountMessage: string | null;
}

const signedOutSnapshot: AuthSnapshot = {
  session: null,
  profile: null,
  studentStatus: null,
  accountStatus: 'signed_out',
  accountMessage: null,
};

const AuthContext = createContext<AuthState | undefined>(undefined);

function friendlyAuthError(error: { message?: string; status?: number } | null) {
  const normalized = error?.message?.toLowerCase() ?? '';
  if (normalized.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (normalized.includes('email not confirmed')) {
    return 'This account is not ready for sign-in. Check your invitation email or contact the academy.';
  }
  if (error?.status === 429 || normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Too many sign-in attempts. Please wait a moment and try again.';
  }
  return 'Unable to sign in right now. Please try again.';
}

async function resolveAccount(userId: string): Promise<AccountResolution> {
  const profileResult = await supabase
    .from('profiles')
    .select('id, full_name, email, role, avatar_url, phone')
    .eq('id', userId)
    .maybeSingle();

  if (profileResult.error) return resolution('unavailable');
  if (!profileResult.data) return resolution('missing_profile');
  if (!isUserRole(profileResult.data.role)) return resolution('invalid_role');

  const profile = profileResult.data as Profile;
  if (profile.role === 'admin') {
    return { profile, studentStatus: null, accountStatus: 'ready', accountMessage: null };
  }

  const studentResult = await supabase
    .from('students')
    .select('status')
    .eq('profile_id', userId)
    .maybeSingle();

  if (studentResult.error) return resolution('unavailable', null, profile);
  if (!studentResult.data) return resolution('missing_student', null, profile);

  const studentStatus = typeof studentResult.data.status === 'string' ? studentResult.data.status : null;
  if (studentStatus !== 'active') return resolution('inactive_student', studentStatus, profile);

  return { profile, studentStatus, accountStatus: 'ready', accountMessage: null };
}

function resolution(
  accountStatus: AccountStatus,
  studentStatus: string | null = null,
  profile: Profile | null = null,
): AccountResolution {
  return {
    profile,
    studentStatus,
    accountStatus,
    accountMessage: accountStatusMessage(accountStatus, studentStatus),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthSnapshot>(() => ({
    ...signedOutSnapshot,
    accountStatus: isSupabaseConfigured ? 'loading' : 'signed_out',
  }));
  const requestId = useRef(0);

  const hydrateSession = useCallback(async (nextSession: Session | null, verifySession: boolean) => {
    const currentRequest = ++requestId.current;
    setAuth((previous) => ({ ...previous, accountStatus: 'loading', accountMessage: null }));

    if (!nextSession) {
      const result = resolution('signed_out');
      if (currentRequest === requestId.current) setAuth(signedOutSnapshot);
      return result;
    }

    if (verifySession) {
      const { data, error } = await supabase.auth.getUser(nextSession.access_token);
      if (error || !data.user || data.user.id !== nextSession.user.id) {
        if (currentRequest === requestId.current) setAuth(signedOutSnapshot);
        void supabase.auth.signOut({ scope: 'local' });
        return resolution('signed_out');
      }
    }

    const result = await resolveAccount(nextSession.user.id);
    if (currentRequest === requestId.current) setAuth({ session: nextSession, ...result });
    return result;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    void supabase.auth.getSession().then(({ data }) => hydrateSession(data.session, true));
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      window.setTimeout(() => {
        void hydrateSession(nextSession, event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED');
      }, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, [hydrateSession]);

  const signOut = useCallback(async () => {
    ++requestId.current;
    setAuth(signedOutSnapshot);
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    if (!isSupabaseConfigured) {
      return { error: 'Portal access is not configured. Please contact the academy.', role: null };
    }

    setAuth((previous) => ({ ...previous, accountStatus: 'loading', accountMessage: null }));
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      setAuth(signedOutSnapshot);
      return { error: friendlyAuthError(error), role: null };
    }

    const account = await hydrateSession(data.session, false);
    if (account.accountStatus !== 'ready' || !account.profile) {
      const message = account.accountMessage ?? 'This account cannot access the academy portal. Please contact the academy.';
      await signOut();
      return { error: message, role: null };
    }

    return { error: null, role: account.profile.role };
  }, [hydrateSession, signOut]);

  const resetPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) return { error: 'Portal access is not configured. Please contact the academy.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/student/accept-invite`,
    });
    if (!error) return { error: null };
    const normalized = error.message.toLowerCase();
    return {
      error: error.status === 429 || normalized.includes('rate limit')
        ? 'Too many password reset requests. Please wait a moment and try again.'
        : 'Unable to request a password reset right now. Please try again.',
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (auth.session) await hydrateSession(auth.session, true);
  }, [auth.session, hydrateSession]);

  const value = useMemo<AuthState>(() => ({
    ...auth,
    user: auth.session?.user ?? null,
    role: auth.profile?.role ?? null,
    loading: auth.accountStatus === 'loading',
    configured: isSupabaseConfigured,
    signIn,
    signOut,
    resetPassword,
    refreshProfile,
  }), [auth, refreshProfile, resetPassword, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
