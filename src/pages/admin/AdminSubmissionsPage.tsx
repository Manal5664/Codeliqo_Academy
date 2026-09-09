import { type FormEvent, useState } from 'react';
import { ExternalLink, MessageSquareText, Save } from 'lucide-react';
import { DataTable, type Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PortalPage } from '../../components/PortalPage';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { listRecords, saveRecord, type AdminRecord } from '../../services/adminService';
import { formatDate, titleCase } from '../../lib/utils';

type ReviewKind = 'assignment' | 'project';
type ReviewItem = { kind: ReviewKind; row: AdminRecord };

export function AdminSubmissionsPage() {
  const submissions = useSupabaseQuery(async () => {
    const [assignments, projects] = await Promise.all([
      listRecords('assignment_submissions', '*, student:students(enrollment_id, profile:profiles(full_name)), assignment:assignments(title, week)', 'created_at'),
      listRecords('project_submissions', '*, student:students(enrollment_id, profile:profiles(full_name)), project:projects(title)', 'created_at'),
    ]);
    return { assignments, projects };
  }, []);
  const [editing, setEditing] = useState<ReviewItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (submissions.loading) return <LoadingState label="Loading submissions" />;
  if (submissions.error || !submissions.data) return <ErrorState message={submissions.error ?? 'Unable to load submissions.'} onRetry={submissions.reload} />;
  const rows = [
    ...submissions.data.assignments.map((row) => ({ id: `assignment-${row.id}`, kind: 'assignment' as const, row })),
    ...submissions.data.projects.map((row) => ({ id: `project-${row.id}`, kind: 'project' as const, row })),
  ];
  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'student', header: 'Student', render: (item) => studentName(item.row) },
    { key: 'work', header: 'Submitted work', render: (item) => <div><p className="font-semibold">{workTitle(item)}</p><p className="mt-1 text-xs text-slate-500">{titleCase(item.kind)} · {formatDate(item.row.submitted_at as string | null)}</p></div> },
    { key: 'links', header: 'Links', render: (item) => <div className="flex flex-wrap gap-2">{links(item).map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">{label}<ExternalLink size={13} /></a>)}</div> },
    { key: 'status', header: 'Status', render: (item) => <span className="badge">{titleCase(String(item.row.status))}</span> },
    { key: 'review', header: 'Review', render: (item) => <button type="button" onClick={() => { setEditing(item); setError(''); }} className="btn-secondary min-h-0 px-3 py-2"><MessageSquareText size={15} />Review</button> },
  ];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!editing) return;
    const data = new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      await saveRecord(editing.kind === 'assignment' ? 'assignment_submissions' : 'project_submissions', {
        status: String(data.get('status')),
        feedback: String(data.get('feedback') || '') || null,
        reviewed_at: new Date().toISOString(),
      }, editing.row.id);
      await submissions.reload(); setEditing(null);
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to save this review.'); }
    finally { setBusy(false); }
  };

  return <PortalPage title="Submission Review" description="Review student assignment and project submissions, update their status and leave actionable feedback.">
    <DataTable columns={columns} rows={rows} empty={<EmptyState title="No submissions yet" message="Student assignment and project submissions will appear here." />} />
    <Modal open={Boolean(editing)} onClose={() => { if (!busy) setEditing(null); }} title="Review submission">
      {editing && <form onSubmit={submit} className="space-y-5"><div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">{workTitle(editing)}</p><p className="mt-1 text-sm text-slate-500">Submitted by {studentName(editing.row)}</p></div><div><label className="label" htmlFor="review-status">Review status</label><select id="review-status" name="status" defaultValue={String(editing.row.status)} className="input">{(editing.kind === 'project' ? ['submitted', 'reviewed', 'completed'] : ['submitted', 'reviewed']).map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></div><div><label className="label" htmlFor="review-feedback">Feedback</label><textarea id="review-feedback" name="feedback" defaultValue={String(editing.row.feedback ?? '')} className="input min-h-36 resize-y" placeholder="Explain what is working and what the student should improve." /></div>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" disabled={busy}><Save size={16} />{busy ? 'Saving…' : 'Save review'}</button></div></form>}
    </Modal>
  </PortalPage>;
}

function nested(row: AdminRecord, key: string) { const value = row[key]; return ((Array.isArray(value) ? value[0] : value) ?? {}) as AdminRecord; }
function studentName(row: AdminRecord) { const student = nested(row, 'student'); const profile = nested(student, 'profile'); return String(profile.full_name ?? student.enrollment_id ?? 'Student record'); }
function workTitle(item: ReviewItem) { const work = nested(item.row, item.kind); return String(work.title ?? 'Submitted work'); }
function links(item: ReviewItem): Array<[string, string]> { const values: Array<[string, string | null]> = item.kind === 'assignment' ? [['Submission', item.row.submission_url as string | null]] : [['GitHub', item.row.github_url as string | null], ['Live demo', item.row.live_demo_url as string | null]]; return values.filter((value): value is [string, string] => Boolean(value[1])); }
