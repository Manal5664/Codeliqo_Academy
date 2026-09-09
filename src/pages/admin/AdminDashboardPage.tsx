import { BadgeCheck, CalendarDays, CreditCard, GraduationCap, Megaphone, UserPlus, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PortalPage } from '../../components/PortalPage';
import { EmptyState, ErrorState, LoadingState, StatCard } from '../../components/ui';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { loadAdminOverview, type AdminRecord } from '../../services/adminService';
import { formatDate, formatPkr, titleCase } from '../../lib/utils';

export function AdminDashboardPage() {
  const overview = useSupabaseQuery(loadAdminOverview, []);
  if (overview.loading) return <LoadingState label="Loading academy overview" />;
  if (overview.error || !overview.data) return <ErrorState message={overview.error ?? 'Unable to load the academy overview.'} onRetry={overview.reload} />;
  const paidTotal = overview.data.payments.filter((item) => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  return <PortalPage
    title="Admin Dashboard"
    description="Monitor enrollment, learning operations, verified payments and certificate activity."
    actions={<Link to="/admin/students?create=1" className="btn-primary"><UserPlus size={17} />Create Student Account</Link>}
  >
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Students" value={overview.data.students} icon={UsersRound} />
      <StatCard label="Active enrollments" value={overview.data.activeEnrollments} icon={GraduationCap} />
      <StatCard label="Active batches" value={overview.data.batches} icon={CalendarDays} />
      <StatCard label="Issued certificates" value={overview.data.issuedCertificates} icon={BadgeCheck} />
      <StatCard label="Recorded payments" value={formatPkr(paidTotal)} icon={CreditCard} />
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <DashboardList title="Recent payment records" icon={CreditCard} action="/admin/payments">
        {!overview.data.payments.length ? <EmptyState title="No payment records" message="Verified payments will appear here." /> : overview.data.payments.slice(0, 5).map((payment) => <div key={payment.id} className="flex items-center justify-between gap-4 border-b border-slate-100 py-4 last:border-0">
          <div><p className="font-semibold">{studentName(payment)}</p><p className="mt-1 text-xs text-slate-500">{String(payment.receipt_number ?? 'Receipt pending')} · {formatDate(payment.paid_at as string | null)}</p></div>
          <div className="text-right"><p className="font-bold">{formatPkr(Number(payment.amount ?? 0))}</p><span className="badge mt-1">{titleCase(String(payment.status ?? 'pending'))}</span></div>
        </div>)}
      </DashboardList>
      <DashboardList title="Latest announcements" icon={Megaphone} action="/admin/announcements">
        {!overview.data.announcements.length ? <EmptyState title="No announcements" message="Published updates will appear here." /> : overview.data.announcements.slice(0, 5).map((announcement) => <div key={announcement.id} className="border-b border-slate-100 py-4 last:border-0">
          <div className="flex items-center justify-between gap-3"><p className="font-semibold">{String(announcement.title)}</p><span className="badge">{titleCase(String(announcement.priority ?? 'normal'))}</span></div>
          <p className="mt-1 text-xs text-slate-500">{formatDate(announcement.published_at as string | null)} · {announcement.active ? 'Active' : 'Inactive'}</p>
        </div>)}
      </DashboardList>
    </div>
  </PortalPage>;
}

function DashboardList({ title, icon: Icon, action, children }: { title: string; icon: typeof CreditCard; action: string; children: React.ReactNode }) {
  return <section className="card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon size={19} /></span><h3 className="font-bold">{title}</h3></div><Link to={action} className="text-sm font-semibold text-brand-700">Manage</Link></div><div className="mt-3">{children}</div></section>;
}

function studentName(payment: AdminRecord) {
  const student = payment.student as { profile?: { full_name?: string | null } | Array<{ full_name?: string | null }> } | null;
  const profile = Array.isArray(student?.profile) ? student.profile[0] : student?.profile;
  return profile?.full_name || 'Student record';
}
