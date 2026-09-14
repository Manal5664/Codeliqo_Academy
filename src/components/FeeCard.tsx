import { CheckCircle2 } from 'lucide-react';
import type { Program } from '../types';
import { formatPkr } from '../lib/utils';
import { ApplyLink } from './ApplyLink';

export function FeeCard({ program, compact = false }: { program: Program; compact?: boolean }) {
  const hasInstallmentBreakdown = program.registrationFee > 0 || program.months > 1;
  return <div className="card p-6"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-brand-700">Fee structure</p>{!compact && <h3 className="mt-1 text-xl font-bold">{program.shortTitle}</h3>}</div><CheckCircle2 className="text-brand-600" /></div><dl className="mt-5 divide-y divide-slate-100 text-sm">{hasInstallmentBreakdown && <><FeeRow label="Registration fee" value={formatPkr(program.registrationFee)} /><FeeRow label="Monthly fee" value={`${formatPkr(program.monthlyFee)} × ${program.months}`} /><FeeRow label="Course tuition" value={formatPkr(program.tuition)} /></>}<FeeRow label="Total program cost" value={formatPkr(program.total)} strong /></dl>{!compact && <ApplyLink className="mt-5 w-full">Apply for this program</ApplyLink>}</div>;
}
function FeeRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-4 py-3"><dt className={strong ? 'font-bold text-navy-900' : 'text-slate-500'}>{label}</dt><dd className={strong ? 'text-base font-extrabold text-brand-700' : 'font-semibold text-slate-800'}>{value}</dd></div>; }
