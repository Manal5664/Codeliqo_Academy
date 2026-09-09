import { ArrowUpRight } from 'lucide-react';
import { env } from '../lib/env';
import { classNames } from '../lib/utils';

export function ApplyLink({ className, children = 'Apply Now' }: { className?: string; children?: React.ReactNode }) {
  const common = classNames('btn-primary', className);
  if (!env.admissionFormUrl) return <a href="/admissions#apply" className={common}>{children}<ArrowUpRight size={16} /></a>;
  return <a href={env.admissionFormUrl} target="_blank" rel="noreferrer" className={common}>{children}<ArrowUpRight size={16} /></a>;
}
