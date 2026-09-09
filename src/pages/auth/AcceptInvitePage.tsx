import { type FormEvent, useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark } from '../../components/BrandMark';
import { useAuth } from '../../features/auth/AuthContext';
import { usePageMeta } from '../../hooks/usePageMeta';
import { supabase } from '../../lib/supabase';

export function AcceptInvitePage() {
  usePageMeta('Student Account Setup', 'Securely create or reset your Codeliqo Academy student password.');
  const { user, role, loading, configured, accountStatus, accountMessage, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (password.length < 10) {
      setError('Password must contain at least 10 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setBusy(false);
      setError('Unable to save your password right now. Please request a new setup link or contact the academy.');
      return;
    }
    if (role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
    if (accountStatus !== 'ready') {
      const message = accountMessage ?? 'Your student account is not active. Please contact the academy.';
      await signOut();
      navigate('/student/login', { replace: true, state: { message } });
      return;
    }
    navigate('/student/dashboard', { replace: true });
  };

  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
    <div className="w-full max-w-lg">
      <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-700"><ArrowLeft size={16} />Back to website</Link>
      <div className="card p-7 sm:p-9">
        <BrandMark />
        <div className="mt-8 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><CheckCircle2 size={22} /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-brand-600">Secure account setup</p>
            <h1 className="mt-1 text-2xl font-extrabold">Create your password</h1>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-600">Choose a password to finish activating or recovering your academy account. Your student record and enrollment are linked automatically.</p>

        {loading
          ? <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Verifying your invitation…</p>
          : !configured
            ? <p role="alert" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Student services are not configured.</p>
            : !user || !role
              ? <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">
                  This account setup link is invalid or has expired. Ask the academy administrator to resend access, or request a new link from the student login page.
                </div>
              : <form onSubmit={submit} className="mt-7 space-y-5">
                  <div>
                    <label className="label" htmlFor="invite-password">New password</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-3.5 text-slate-400" size={17} />
                      <input id="invite-password" type="password" className="input pl-10" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} required autoComplete="new-password" />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="invite-password-confirmation">Confirm password</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-3.5 text-slate-400" size={17} />
                      <input id="invite-password-confirmation" type="password" className="input pl-10" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={10} required autoComplete="new-password" />
                    </div>
                  </div>
                  {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                  <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving password…' : 'Save password'}</button>
                </form>}
      </div>
    </div>
  </main>;
}
