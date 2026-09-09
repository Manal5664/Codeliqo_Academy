import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, Mail, Pencil, Plus, Save, ShieldCheck, UserPlus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { DataTable, type Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PortalPage } from '../../components/PortalPage';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import {
  listStudentDirectory,
  loadOnboardingOptions,
  onboardStudent,
  updateStudent,
  type AdminRecord,
  type OnboardStudentResult,
} from '../../services/adminService';
import { titleCase } from '../../lib/utils';

type DialogMode = 'onboard' | 'edit' | null;
type ProvisioningMode = 'invite' | 'temporary_password';

const studentStatuses = ['active', 'inactive', 'paused', 'completed', 'withdrawn'];
const enrollmentStatuses = ['active', 'paused', 'completed', 'withdrawn'];

export function AdminStudentsPage() {
  const students = useSupabaseQuery(listStudentDirectory, []);
  const options = useSupabaseQuery(loadOnboardingOptions, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<DialogMode>(null);
  const [editing, setEditing] = useState<AdminRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<OnboardStudentResult | null>(null);
  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [provisioningMode, setProvisioningMode] = useState<ProvisioningMode>('invite');

  useEffect(() => {
    if (searchParams.get('create') !== '1') return;
    setMode('onboard');
    setEditing(null);
    setCreated(null);
    setError('');
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const availableBatches = useMemo(
    () => (options.data?.batches ?? []).filter((batch) => batch.program_id === programId),
    [options.data?.batches, programId],
  );

  const columns: Column<AdminRecord>[] = [
    {
      key: 'student',
      header: 'Student',
      render: (row) => <div>
        <p className="font-semibold text-navy-900">{profile(row).full_name || 'Name not set'}</p>
        <p className="mt-1 text-xs text-slate-500">{profile(row).email || 'Email unavailable'}</p>
      </div>,
    },
    {
      key: 'references',
      header: 'Academy references',
      render: (row) => <div>
        <p className="font-medium">{String(row.enrollment_id ?? 'Enrollment ID pending')}</p>
        <p className="mt-1 text-xs text-slate-500">Application: {String(row.application_id ?? 'Not set')}</p>
      </div>,
    },
    {
      key: 'program',
      header: 'Program / Batch',
      render: (row) => <div>
        <p>{relation(enrollment(row)?.program, 'title') || 'Not assigned'}</p>
        <p className="mt-1 text-xs text-slate-500">{relation(enrollment(row)?.batch, 'name') || 'No batch'}</p>
      </div>,
    },
    { key: 'status', header: 'Student status', render: (row) => <StatusBadge status={String(row.status)} /> },
    {
      key: 'progress',
      header: 'Progress',
      render: (row) => `${Number(enrollment(row)?.progress_percentage ?? 0)}% · Week ${Number(enrollment(row)?.current_week ?? 0)}`,
    },
    {
      key: 'eligible',
      header: 'Certificate',
      render: (row) => row.certificate_eligible
        ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><ShieldCheck size={15} />Eligible</span>
        : <span className="text-slate-400">In progress</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => <button
        type="button"
        onClick={() => openEditor(row)}
        className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 hover:text-brand-700"
        aria-label={`Edit ${profile(row).full_name || 'student'}`}
      ><Pencil size={16} /></button>,
    },
  ];

  const openOnboarding = () => {
    setMode('onboard');
    setEditing(null);
    setCreated(null);
    setProgramId('');
    setBatchId('');
    setProvisioningMode('invite');
    setError('');
  };

  const openEditor = (row: AdminRecord) => {
    setMode('edit');
    setEditing(row);
    setCreated(null);
    setError('');
  };

  const closeDialog = () => {
    if (busy) return;
    setMode(null);
    setEditing(null);
    setCreated(null);
    setError('');
  };

  const submitOnboarding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const result = await onboardStudent({
        fullName: String(data.get('full_name') ?? '').trim(),
        email: String(data.get('email') ?? '').trim(),
        applicationId: String(data.get('application_id') ?? '').trim(),
        programId,
        batchId,
        studentStatus: String(data.get('student_status') ?? 'active'),
        enrollmentStatus: String(data.get('enrollment_status') ?? 'active'),
        enrollmentId: String(data.get('enrollment_id') ?? '').trim() || null,
        provisioningMode,
        temporaryPassword: provisioningMode === 'temporary_password'
          ? String(data.get('temporary_password') ?? '')
          : undefined,
      });
      setCreated(result);
      await students.reload();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to create the student account.');
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    const currentEnrollment = enrollment(editing);
    setBusy(true);
    setError('');
    try {
      await updateStudent(
        editing.id,
        String(editing.profile_id),
        { full_name: String(data.get('full_name') ?? '').trim() },
        {
          application_id: String(data.get('application_id') ?? '').trim(),
          status: String(data.get('status')),
          certificate_eligible: data.get('certificate_eligible') === 'on',
          enrollment_id: String(data.get('enrollment_id') ?? '').trim() || null,
        },
        currentEnrollment ? {
          id: String(currentEnrollment.id),
          status: String(data.get('enrollment_status')),
          progress_percentage: Number(data.get('progress_percentage')),
          current_week: Number(data.get('current_week')),
        } : undefined,
      );
      await students.reload();
      setMode(null);
      setEditing(null);
      setCreated(null);
      setError('');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to update the student.');
    } finally {
      setBusy(false);
    }
  };

  return <PortalPage
    title="Students"
    description="Create student accounts, maintain academy references, and control student access without handling technical account IDs."
    actions={<button type="button" className="btn-primary" onClick={openOnboarding}><UserPlus size={17} />Create Student Account</button>}
  >
    {students.loading
      ? <LoadingState label="Loading students" />
      : students.error
        ? <ErrorState message={students.error} onRetry={students.reload} />
        : <DataTable
            columns={columns}
            rows={students.data ?? []}
            empty={<EmptyState
              title="No students yet"
              message="Create an account and enrollment in one secure workflow."
              action={<button type="button" className="btn-primary" onClick={openOnboarding}><Plus size={16} />Create first student</button>}
            />}
          />}

    <Modal open={mode === 'onboard'} onClose={closeDialog} title={created ? 'Student account created' : 'Create Student Account'}>
      {created
        ? <OnboardingSuccess student={created} onCreateAnother={openOnboarding} onClose={closeDialog} />
        : <form onSubmit={submitOnboarding} className="space-y-5">
            <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-brand-900">
              Authentication, profile, student, and enrollment records will be created and linked automatically. No UUID is required.
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full Name" name="full_name" autoComplete="name" minLength={2} maxLength={120} />
              <Field label="Email" name="email" type="email" autoComplete="email" />
              <Field
                label="Application ID"
                name="application_id"
                pattern="[A-Za-z0-9][A-Za-z0-9/_-]{2,63}"
                maxLength={64}
                help="3–64 characters; letters, numbers, dashes, underscores, and slashes only."
              />
              <Field
                label="Enrollment ID (optional)"
                name="enrollment_id"
                required={false}
                pattern="[A-Za-z0-9][A-Za-z0-9/_-]{2,63}"
                maxLength={64}
                help="Leave blank to generate a unique Codeliqo enrollment ID."
              />
              <div>
                <label className="label" htmlFor="program_id">Program</label>
                <select
                  id="program_id"
                  className="input"
                  value={programId}
                  onChange={(event) => { setProgramId(event.target.value); setBatchId(''); }}
                  required
                  disabled={options.loading}
                >
                  <option value="">Select program</option>
                  {(options.data?.programs ?? []).map((program) => <option key={program.id} value={program.id}>{program.title} ({program.code})</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="batch_id">Batch</label>
                <select
                  id="batch_id"
                  className="input"
                  value={batchId}
                  onChange={(event) => setBatchId(event.target.value)}
                  required
                  disabled={!programId || options.loading}
                >
                  <option value="">{programId ? 'Select batch' : 'Select a program first'}</option>
                  {availableBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name} · {titleCase(batch.status)}</option>)}
                </select>
                {programId && !availableBatches.length && !options.loading && <p className="mt-1.5 text-xs text-amber-700">This program has no planned or active batches.</p>}
              </div>
              <Select label="Student Status" name="student_status" defaultValue="active" options={studentStatuses} />
              <Select label="Enrollment Status" name="enrollment_status" defaultValue="active" options={enrollmentStatuses} />
              <div className="sm:col-span-2">
                <label className="label" htmlFor="provisioning_mode">Account setup</label>
                <select
                  id="provisioning_mode"
                  className="input"
                  value={provisioningMode}
                  onChange={(event) => setProvisioningMode(event.target.value as ProvisioningMode)}
                >
                  <option value="invite">Send secure account invitation</option>
                  <option value="temporary_password">Set a temporary password</option>
                </select>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">
                  {provisioningMode === 'invite'
                    ? 'Supabase will email a one-time invitation. This is the recommended workflow.'
                    : 'Share the temporary password through a trusted channel and ask the student to reset it.'}
                </p>
              </div>
              {provisioningMode === 'temporary_password' && <div className="sm:col-span-2">
                <label className="label" htmlFor="temporary_password">Temporary Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  <input id="temporary_password" name="temporary_password" type="password" minLength={10} autoComplete="new-password" className="input pl-10" required />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">Use at least 10 characters. Passwords are sent only to the secure server function and are never stored in public tables.</p>
              </div>}
            </div>
            {options.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Unable to load programs and batches: {options.error}</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button type="button" className="btn-secondary" onClick={closeDialog} disabled={busy}>Cancel</button>
              <button className="btn-primary" disabled={busy || options.loading || Boolean(options.error)}><UserPlus size={16} />{busy ? 'Creating account…' : 'Create and enroll student'}</button>
            </div>
          </form>}
    </Modal>

    <Modal open={mode === 'edit' && Boolean(editing)} onClose={closeDialog} title="Update student">
      {editing && <form onSubmit={submitEdit} className="space-y-5">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="font-semibold">{profile(editing).full_name || 'Student'}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><Mail size={13} />{profile(editing).email || 'Account email unavailable'}</p>
          <p className="mt-2 text-xs text-slate-500">Account email is kept in sync with Supabase Authentication and is not edited from this record.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full Name" name="full_name" defaultValue={profile(editing).full_name || ''} minLength={2} maxLength={120} />
          <Field
            label="Application ID"
            name="application_id"
            defaultValue={String(editing.application_id ?? '')}
            pattern="[A-Za-z0-9][A-Za-z0-9/_-]{2,63}"
            maxLength={64}
          />
          <Field
            label="Enrollment ID"
            name="enrollment_id"
            defaultValue={String(editing.enrollment_id ?? '')}
            required={false}
            pattern="[A-Za-z0-9][A-Za-z0-9/_-]{2,63}"
            maxLength={64}
            help="3–64 characters; letters, numbers, dashes, underscores, and slashes only."
          />
          <Select label="Student Status" name="status" defaultValue={String(editing.status ?? 'active')} options={studentStatuses} />
          {enrollment(editing) && <>
            <Select label="Enrollment Status" name="enrollment_status" defaultValue={String(enrollment(editing)?.status ?? 'active')} options={enrollmentStatuses} />
            <Field label="Current Week" name="current_week" type="number" min="0" defaultValue={String(enrollment(editing)?.current_week ?? 0)} />
            <Field label="Progress Percentage" name="progress_percentage" type="number" min="0" max="100" defaultValue={String(enrollment(editing)?.progress_percentage ?? 0)} />
          </>}
          <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 p-3 text-sm font-semibold">
            <input name="certificate_eligible" type="checkbox" defaultChecked={Boolean(editing.certificate_eligible)} className="size-4" />Certificate eligible
          </label>
        </div>
        <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          Setting Student Status to Inactive disables access to student-owned LMS data through RLS. Set it back to Active to restore access.
        </p>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button type="button" className="btn-secondary" onClick={closeDialog} disabled={busy}>Cancel</button>
          <button className="btn-primary" disabled={busy}><Save size={16} />{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>}
    </Modal>
  </PortalPage>;
}

function OnboardingSuccess({ student, onCreateAnother, onClose }: { student: OnboardStudentResult; onCreateAnother: () => void; onClose: () => void }) {
  const details = [
    ['Student name', student.fullName],
    ['Email', student.email],
    ['Application ID', student.applicationId],
    ['Enrollment ID', student.enrollmentId],
    ['Program', student.program],
    ['Batch', student.batch],
    ['Account status', student.accountStatus],
  ];
  return <div>
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
      <CheckCircle2 className="mx-auto text-emerald-600" size={34} />
      <h3 className="mt-3 text-lg font-bold text-emerald-950">Student created and enrolled</h3>
      <p className="mt-1 text-sm text-emerald-800">All account and academy records were linked automatically.</p>
    </div>
    <dl className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
      {details.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[150px_1fr]">
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
        <dd className="break-words text-sm font-medium text-navy-900">{value}</dd>
      </div>)}
    </dl>
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button type="button" className="btn-secondary" onClick={onClose}>Done</button>
      <button type="button" className="btn-primary" onClick={onCreateAnother}><Plus size={16} />Create another</button>
    </div>
  </div>;
}

function StatusBadge({ status }: { status: string }) {
  const color = status === 'active'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'inactive'
      ? 'bg-red-50 text-red-700'
      : '';
  return <span className={`badge ${color}`}>{titleCase(status)}</span>;
}

function profile(row: AdminRecord) {
  const value = row.profile as {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | Array<{
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  }> | null;
  return (Array.isArray(value) ? value[0] : value) ?? {};
}

function enrollment(row: AdminRecord) {
  const values = row.enrollments as AdminRecord[] | null;
  return values?.find((item) => item.status === 'active') ?? values?.[0];
}

function relation(value: unknown, key: string) {
  const record = (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | null;
  return record?.[key] ? String(record[key]) : '';
}

interface FieldProps {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  min?: string;
  max?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  autoComplete?: string;
  help?: string;
  required?: boolean;
}

function Field({
  label,
  name,
  defaultValue = '',
  type = 'text',
  min,
  max,
  minLength,
  maxLength,
  pattern,
  autoComplete,
  help,
  required = true,
}: FieldProps) {
  return <div>
    <label className="label" htmlFor={name}>{label}</label>
    <input
      id={name}
      name={name}
      type={type}
      min={min}
      max={max}
      minLength={minLength}
      maxLength={maxLength}
      pattern={pattern}
      autoComplete={autoComplete}
      defaultValue={defaultValue}
      className="input"
      required={required}
    />
    {help && <p className="mt-1.5 text-xs leading-5 text-slate-500">{help}</p>}
  </div>;
}

function Select({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: string[] }) {
  return <div>
    <label className="label" htmlFor={name}>{label}</label>
    <select id={name} name={name} defaultValue={defaultValue} className="input">
      {options.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}
    </select>
  </div>;
}
