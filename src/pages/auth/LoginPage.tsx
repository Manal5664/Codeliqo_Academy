import { type FormEvent, useState } from 'react';
import { ArrowLeft, KeyRound, Mail, ShieldAlert } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from '../../components/BrandMark';
import { LoadingState } from '../../components/ui';
import { useAuth } from '../../features/auth/AuthContext';
import { dashboardPath, portalRoleError } from '../../features/auth/authPolicy';
import type { UserRole } from '../../types';
import { usePageMeta } from '../../hooks/usePageMeta';

interface LoginLocationState {
  message?: string | null;
}

export function LoginPage({ portal }: { portal: UserRole }) {
  const portalName = portal === 'admin' ? 'Admin' : 'Student';
  usePageMeta(`${portalName} Login`, 'Secure Codeliqo Academy portal access.');
  const {
    user,
    role,
    loading,
    accountStatus,
    accountMessage,
    signIn,
    signOut,
    resetPassword,
    configured,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const locationMessage = (location.state as LoginLocationState | null)?.message;

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-8"><LoadingState label="Verifying your account" /></main>;
  }

  if (!busy && user && role && accountStatus === 'ready') {
    return <Navigate to={dashboardPath(role)} replace />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    if (forgot) {
      const result = await resetPassword(email);
      setBusy(false);
      if (result.error) setError(result.error);
      else setNotice('If an account exists for this email, a password reset link has been sent.');
      return;
    }

    const result = await signIn(email, password);
    if (result.error || !result.role) {
      setBusy(false);
      setError(result.error ?? 'This account cannot access the academy portal.');
      return;
    }

    const roleError = portalRoleError(portal, result.role);
    if (roleError) {
      await signOut();
      setBusy(false);
      setError(roleError);
      return;
    }

    navigate(dashboardPath(result.role), { replace: true });
  };

  const switchPortal = portal === 'admin' ? '/student/login' : '/admin/login';
  const switchLabel = portal === 'admin' ? 'Student Login' : 'Admin Login';
  const invalidAuthenticatedAccount = Boolean(user && accountStatus !== 'ready');

  return <main className="grid min-h-screen lg:grid-cols-2">
    <section className="hidden hero-grid bg-navy-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <BrandMark large />
      <div>
        <p className="text-sm font-bold uppercase tracking-[.18em] text-brand-500">
          {portal === 'admin' ? 'Academy administration' : 'Student learning portal'}
        </p>
        <h1 className="mt-5 max-w-lg text-5xl font-extrabold leading-tight text-white">
          Learn. Build.<br /><span className="text-brand-500">Innovate.</span>
        </h1>
        <p className="mt-5 max-w-lg leading-7 text-slate-400">
          Secure access to Codeliqo Academy&apos;s {portal === 'admin'
            ? 'operations and learning management tools.'
            : 'lessons, assignments, projects and progress records.'}
        </p>
      </div>
      <p className="text-xs text-slate-600">Accounts are issued by the academy. Public signup is disabled.</p>
    </section>

    <section className="flex items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-700">
          <ArrowLeft size={16} />Back to website
        </Link>
        <div className="card p-7 sm:p-8">
          <div className="lg:hidden"><BrandMark /></div>
          <p className="mt-7 text-sm font-bold text-brand-600 lg:mt-0">{portalName.toUpperCase()} ACCESS</p>

          {invalidAuthenticatedAccount
            ? <div className="mt-5">
                <ShieldAlert className="text-amber-600" size={34} />
                <h2 className="mt-4 text-3xl font-extrabold">Account access unavailable</h2>
                <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  {accountMessage ?? locationMessage ?? 'This account cannot access this portal. Please contact the academy.'}
                </p>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="btn-secondary mt-6 w-full"
                >
                  Sign out and try another account
                </button>
              </div>
            : <>
                <h2 className="mt-2 text-3xl font-extrabold">{forgot ? 'Reset your password' : 'Welcome back'}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {forgot ? 'Enter the email linked to your academy account.' : 'Sign in using the account issued by the academy.'}
                </p>

                <form onSubmit={submit} className="mt-7 space-y-5">
                  <div>
                    <label className="label" htmlFor={`${portal}-email`}>Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 text-slate-400" size={17} />
                      <input
                        id={`${portal}-email`}
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="input pl-10"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  {!forgot && <div>
                    <label className="label" htmlFor={`${portal}-password`}>Password</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-3.5 text-slate-400" size={17} />
                      <input
                        id={`${portal}-password`}
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="input pl-10"
                        required
                        autoComplete="current-password"
                      />
                    </div>
                  </div>}
                  {(error || locationMessage) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error || locationMessage}
                  </p>}
                  {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
                  {!configured && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    Portal access is unavailable until Supabase environment variables are configured.
                  </p>}
                  <button className="btn-primary w-full" disabled={busy || !configured}>
                    {busy ? 'Please wait…' : forgot ? 'Send reset link' : 'Sign in'}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => { setForgot(!forgot); setError(''); setNotice(''); }}
                  className="mt-5 w-full text-center text-sm font-semibold text-brand-700"
                >
                  {forgot ? 'Return to sign in' : 'Forgot Password?'}
                </button>
                <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
                  Looking for the other portal? <Link to={switchPortal} className="font-semibold text-brand-700 hover:text-brand-800">{switchLabel}</Link>
                </div>
              </>}
        </div>
      </div>
    </section>
  </main>;
}
