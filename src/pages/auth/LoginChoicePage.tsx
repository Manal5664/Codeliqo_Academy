import type { ReactNode } from 'react';
import { ArrowLeft, GraduationCap, ShieldCheck } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { BrandMark } from '../../components/BrandMark';
import { LoadingState } from '../../components/ui';
import { useAuth } from '../../features/auth/AuthContext';
import { dashboardPath } from '../../features/auth/authPolicy';
import { usePageMeta } from '../../hooks/usePageMeta';

export function LoginChoicePage() {
  usePageMeta('Portal Login', 'Choose the secure Codeliqo Academy portal for your account.');
  const { role, accountStatus, loading } = useAuth();

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-8"><LoadingState label="Checking your session" /></main>;
  }
  if (role && accountStatus === 'ready') return <Navigate to={dashboardPath(role)} replace />;

  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
    <div className="w-full max-w-2xl">
      <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-700">
        <ArrowLeft size={16} />Back to website
      </Link>
      <section className="card p-7 sm:p-10">
        <BrandMark />
        <p className="mt-8 text-sm font-bold uppercase tracking-[.14em] text-brand-600">Secure portal access</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Choose your login</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Use the portal that matches the account issued to you by Codeliqo Academy.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <PortalOption
            to="/student/login"
            icon={<GraduationCap size={24} />}
            title="Student Login"
            description="Access lessons, assignments, progress, payments and certificates."
          />
          <PortalOption
            to="/admin/login"
            icon={<ShieldCheck size={24} />}
            title="Admin Login"
            description="Access academy administration and learning management tools."
          />
        </div>
      </section>
    </div>
  </main>;
}

function PortalOption({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return <Link to={to} className="group rounded-2xl border border-slate-200 p-5 transition hover:border-brand-400 hover:bg-brand-50/50">
    <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">{icon}</span>
    <h2 className="mt-4 text-lg font-bold">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
  </Link>;
}
