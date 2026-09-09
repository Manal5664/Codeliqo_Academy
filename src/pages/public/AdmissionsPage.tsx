import {
  AlertTriangle,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  ListChecks,
  UserRoundCheck,
} from 'lucide-react';
import { ApplyLink } from '../../components/ApplyLink';
import { PageHeader } from '../../components/ui';
import { usePageMeta } from '../../hooks/usePageMeta';
import { env } from '../../lib/env';

const steps = [
  ['Choose Program', 'Compare scope, prerequisites, duration and fees before choosing.', ListChecks],
  ['Submit Admission Form', 'Complete the external admission form accurately.', ClipboardCheck],
  ['Application Review', 'The academy reviews program fit and available batch capacity.', FileCheck2],
  ['Payment Instructions', 'Approved applicants receive private payment instructions.', CreditCard],
  ['Enrollment Confirmation', 'Enrollment is confirmed only after required verification.', UserRoundCheck],
  ['Student Onboarding', 'Confirmed students receive account and batch information.', UserRoundCheck],
] as const;

export function AdmissionsPage() {
  usePageMeta(
    'Admissions',
    'Understand the Codeliqo Academy application, review, payment and enrollment process.',
  );

  return <>
    <PageHeader
      eyebrow="Admissions"
      title="A clear path from application to onboarding"
      description="Admission is reviewed to help align applicants with the scope, prerequisites and available batch. Submitting an application does not automatically confirm enrollment."
    >
      <ApplyLink>Open Admission Form</ApplyLink>
    </PageHeader>

    <section className="section-pad">
      <div className="container-shell grid gap-12 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="mb-8 max-w-3xl sm:mb-10">
            <span className="eyebrow">How it works</span>
            <h2 className="section-title">Six steps to enrollment</h2>
          </div>
          <ol className="grid gap-4 md:grid-cols-2">
            {steps.map(([title, copy, Icon], index) => <li
              key={title}
              className="card flex min-w-0 items-start gap-4 p-5 shadow-sm transition duration-300 hover:border-brand-200 hover:shadow-card sm:p-6"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700">
                <Icon size={21} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold tracking-[0.1em] text-brand-600">STEP {index + 1}</p>
                <h3 className="mt-1.5 text-lg font-bold leading-6 text-navy-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
              </div>
            </li>)}
          </ol>
        </div>

        <aside>
          <div id="apply" className="card sticky top-28 p-6">
            <p className="text-sm font-bold text-brand-700">Registration fee</p>
            <p className="mt-2 text-3xl font-extrabold">PKR 1,000</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">A registration fee applies to each program and is separate from tuition installments. Payment account information is shared privately after application review.</p>
            <ApplyLink className="mt-6 w-full">Apply for Admission</ApplyLink>
            {!env.admissionFormUrl && <p className="mt-3 text-xs leading-5 text-amber-700">The admission form link has not been configured. Add VITE_ADMISSION_FORM_URL to enable the external form.</p>}
          </div>
          <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="shrink-0 text-amber-700" size={19} />
            <p className="text-xs leading-5 text-amber-900">Submitting an application does not automatically confirm enrollment. Wait for official confirmation before making arrangements.</p>
          </div>
        </aside>
      </div>
    </section>
  </>;
}
