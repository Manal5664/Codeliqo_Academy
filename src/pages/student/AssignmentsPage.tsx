import { type FormEvent, useState } from 'react';
import { Calendar, Clock3, Download, ExternalLink, FileUp, MessageSquareText, Paperclip, RotateCcw, Send } from 'lucide-react';
import { PortalPage } from '../../components/PortalPage';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { useStudentContext } from '../../hooks/useStudentContext';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { createAssignmentFileUrl, getAssignments, submitAssignment } from '../../services/studentService';
import { formatDate, titleCase } from '../../lib/utils';
import type { Assignment, AssignmentSubmission, AssignmentSubmissionType } from '../../types';

const acceptedFiles = '.pdf,.docx,.pptx,.xlsx,.zip,.png,.jpg,.jpeg';
const acceptedExtensions = new Set(['pdf', 'docx', 'pptx', 'xlsx', 'zip', 'png', 'jpg', 'jpeg']);

export function AssignmentsPage() {
  const context = useStudentContext();
  const assignments = useSupabaseQuery(getAssignments, []);
  const [saving, setSaving] = useState('');
  const [openingFile, setOpeningFile] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, string>>({});
  const [resubmitting, setResubmitting] = useState<Record<string, boolean>>({});

  const submit = async (event: FormEvent<HTMLFormElement>, assignment: Assignment) => {
    event.preventDefault();
    if (!context.data || saving) return;
    const form = new FormData(event.currentTarget);
    const fileValue = form.get('submission_file');
    const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
    const submissionUrl = String(form.get('submission_url') ?? '').trim();
    const notes = String(form.get('notes') ?? '').trim();
    const existingFile = assignment.assignment_submissions?.[0]?.file_path;

    const validation = validateSubmission(assignment, submissionUrl, file, Boolean(existingFile));
    if (validation) {
      setErrors((current) => ({ ...current, [assignment.id]: validation }));
      return;
    }

    setSaving(assignment.id);
    setErrors((current) => ({ ...current, [assignment.id]: '' }));
    try {
      await submitAssignment({ assignmentId: assignment.id, submissionUrl, file, notes });
      await assignments.reload();
      setSelectedFiles((current) => ({ ...current, [assignment.id]: '' }));
      setResubmitting((current) => ({ ...current, [assignment.id]: false }));
    } catch (value) {
      setErrors((current) => ({ ...current, [assignment.id]: value instanceof Error ? value.message : 'Unable to submit this assignment.' }));
    } finally {
      setSaving('');
    }
  };

  const openFile = async (submission: AssignmentSubmission, download: boolean) => {
    if (!submission.file_path || openingFile) return;
    setOpeningFile(submission.id);
    try {
      const url = await createAssignmentFileUrl(submission, download);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (value) {
      setErrors((current) => ({ ...current, [submission.assignment_id]: value instanceof Error ? value.message : 'Unable to open the submitted file.' }));
    } finally {
      setOpeningFile('');
    }
  };

  if (context.loading || assignments.loading) return <LoadingState label="Loading assignments" />;
  if (context.error || assignments.error) return <ErrorState message={context.error || assignments.error || undefined} onRetry={assignments.reload} />;

  return <PortalPage title="Assignments" description="Review instructions, track feedback, and submit the requested link or file before the due date.">
    {!assignments.data?.length
      ? <EmptyState title="No assignments yet" message="Published assignments relevant to your enrollment will appear here." />
      : <div className="space-y-4">{assignments.data.map((assignment) => {
        const submission = assignment.assignment_submissions?.[0];
        const submitted = hasSubmitted(submission);
        const noSubmission = assignment.submission_type === 'no_submission';
        const formVisible = !noSubmission && (!submitted || Boolean(resubmitting[assignment.id]));
        const acceptsLink = assignment.submission_type === 'link_only' || assignment.submission_type === 'link_or_file';
        const acceptsFile = assignment.submission_type === 'file_only' || assignment.submission_type === 'link_or_file';
        const currentError = errors[assignment.id];

        return <article key={assignment.id} className="card p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge bg-brand-50 text-brand-700">Week {assignment.week}</span>
                <span className="badge">{noSubmission ? 'No submission required' : titleCase(submission?.status || 'not_started')}</span>
                {!noSubmission && <span className="badge bg-slate-100 text-slate-600">{submissionTypeLabel(assignment.submission_type)}</span>}
              </div>
              <h3 className="mt-3 text-lg font-bold">{assignment.title}</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{assignment.instructions}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-2"><Calendar size={14} />Due {formatDate(assignment.due_date)}</span>
                {acceptsFile && <span>Files up to {assignment.max_file_size_mb} MB</span>}
              </div>
            </div>
            {submitted && assignment.allow_resubmission && !resubmitting[assignment.id] && <button type="button" onClick={() => { setResubmitting((current) => ({ ...current, [assignment.id]: true })); setErrors((current) => ({ ...current, [assignment.id]: '' })); }} className="btn-secondary shrink-0 self-start"><RotateCcw size={15} />Resubmit</button>}
          </div>

          {noSubmission && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">No link or file is needed for this assignment.</div>}

          {submitted && submission && <SubmittedDetails submission={submission} opening={openingFile === submission.id} onOpenFile={openFile} />}

          {submission?.feedback && <div className="mt-5 flex gap-3 rounded-xl bg-brand-50 p-4">
            <MessageSquareText className="shrink-0 text-brand-600" size={18} />
            <div><p className="text-xs font-bold text-brand-700">INSTRUCTOR FEEDBACK</p><p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">{submission.feedback}</p></div>
          </div>}

          {submitted && !assignment.allow_resubmission && <p className="mt-4 text-xs text-slate-500">This assignment accepts one submission. Contact your instructor if a correction is needed.</p>}

          {formVisible && <form onSubmit={(event) => void submit(event, assignment)} className="mt-5 space-y-4 border-t border-slate-100 pt-5">
            {submitted && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Resubmitting updates the submitted time and returns the review status to Submitted. Leave the file empty to keep the current uploaded file.</div>}
            <div className={`grid gap-4 ${acceptsLink && acceptsFile ? 'lg:grid-cols-2' : ''}`}>
              {acceptsLink && <div>
                <label className="label" htmlFor={`submission-url-${assignment.id}`}>Submission URL {assignment.submission_type === 'link_or_file' && <span className="font-normal text-slate-400">(URL or file required)</span>}</label>
                <input id={`submission-url-${assignment.id}`} name="submission_url" type="url" className="input" defaultValue={submission?.submission_url ?? ''} placeholder="https://github.com/… or another project URL" required={assignment.submission_type === 'link_only'} />
                <p className="mt-1.5 text-xs leading-5 text-slate-500">GitHub, Google Drive, a deployed project, or another valid http(s) URL.</p>
              </div>}
              {acceptsFile && <div>
                <label className="label" htmlFor={`submission-file-${assignment.id}`}>File upload {assignment.submission_type === 'link_or_file' && <span className="font-normal text-slate-400">(URL or file required)</span>}</label>
                <label htmlFor={`submission-file-${assignment.id}`} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 hover:border-brand-300 hover:bg-brand-50">
                  <FileUp size={18} className="shrink-0 text-brand-600" />
                  <span className="min-w-0 truncate">{selectedFiles[assignment.id] || (submission?.file_name ? `Keep current: ${submission.file_name}` : 'Choose a supported file')}</span>
                </label>
                <input id={`submission-file-${assignment.id}`} name="submission_file" type="file" accept={acceptedFiles} className="sr-only" required={assignment.submission_type === 'file_only' && !submission?.file_path} onChange={(event) => setSelectedFiles((current) => ({ ...current, [assignment.id]: event.target.files?.[0]?.name ?? '' }))} />
                <p className="mt-1.5 text-xs leading-5 text-slate-500">PDF, DOCX, PPTX, XLSX, ZIP, PNG, JPG, or JPEG · maximum {assignment.max_file_size_mb} MB.</p>
              </div>}
            </div>
            <div>
              <label className="label" htmlFor={`submission-notes-${assignment.id}`}>Submission notes <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea id={`submission-notes-${assignment.id}`} name="notes" defaultValue={submission?.notes ?? ''} maxLength={4000} className="input min-h-24 resize-y" placeholder="Add context, setup instructions, or anything your instructor should know." />
            </div>
            {currentError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{currentError}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              {submitted && <button type="button" className="btn-secondary" disabled={saving === assignment.id} onClick={() => { setResubmitting((current) => ({ ...current, [assignment.id]: false })); setSelectedFiles((current) => ({ ...current, [assignment.id]: '' })); }}>Cancel</button>}
              <button className="btn-primary" disabled={saving === assignment.id}><Send size={15} />{saving === assignment.id ? 'Submitting…' : submitted ? 'Confirm resubmission' : 'Submit assignment'}</button>
            </div>
          </form>}

          {!formVisible && currentError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{currentError}</p>}
        </article>;
      })}</div>}
  </PortalPage>;
}

function SubmittedDetails({ submission, opening, onOpenFile }: { submission: AssignmentSubmission; opening: boolean; onOpenFile: (submission: AssignmentSubmission, download: boolean) => Promise<void> }) {
  return <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="font-semibold text-navy-900">Your submitted work</p>
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={14} />{formatDateTime(submission.submitted_at)}</span>
    </div>
    <div className="mt-4 grid gap-3">
      {submission.submission_url && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"><div className="flex min-w-0 items-center gap-2 text-sm"><ExternalLink size={16} className="shrink-0 text-brand-600" /><span className="truncate">{submission.submission_url}</span></div><a href={submission.submission_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-700">Open link</a></div>}
      {submission.file_path && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"><div className="flex min-w-0 items-center gap-2"><Paperclip size={16} className="shrink-0 text-brand-600" /><div className="min-w-0"><p className="truncate text-sm font-medium">{submission.file_name || 'Submitted file'}</p>{submission.file_size && <p className="text-xs text-slate-400">{formatFileSize(submission.file_size)}</p>}</div></div><div className="flex gap-2"><button type="button" disabled={opening} onClick={() => void onOpenFile(submission, false)} className="text-sm font-semibold text-brand-700 disabled:opacity-50">View</button><button type="button" disabled={opening} onClick={() => void onOpenFile(submission, true)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 disabled:opacity-50"><Download size={14} />Download</button></div></div>}
      {submission.notes && <div className="rounded-xl bg-white p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Submission notes</p><p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">{submission.notes}</p></div>}
    </div>
  </div>;
}

function hasSubmitted(submission?: AssignmentSubmission) {
  return Boolean(submission && (submission.submitted_at || ['submitted', 'reviewed', 'approved', 'needs_revision'].includes(submission.status)));
}

function submissionTypeLabel(type: AssignmentSubmissionType) {
  if (type === 'link_only') return 'Link only';
  if (type === 'file_only') return 'File only';
  if (type === 'link_or_file') return 'Link or file';
  return 'No submission required';
}

function validateSubmission(assignment: Assignment, url: string, file: File | null, hasExistingFile: boolean) {
  if (url) {
    try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return 'Enter a valid http:// or https:// submission URL.'; }
    catch { return 'Enter a valid submission URL.'; }
  }
  if (file) {
    const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
    if (!acceptedExtensions.has(extension)) return 'Select a PDF, DOCX, PPTX, XLSX, ZIP, PNG, JPG, or JPEG file.';
    if (file.size > assignment.max_file_size_mb * 1024 * 1024) return `The selected file must be ${assignment.max_file_size_mb} MB or smaller.`;
  }
  if (assignment.submission_type === 'link_only' && !url) return 'This assignment requires a submission URL.';
  if (assignment.submission_type === 'file_only' && !file && !hasExistingFile) return 'This assignment requires a file.';
  if (assignment.submission_type === 'link_or_file' && !url && !file && !hasExistingFile) return 'Add a submission URL or choose a file.';
  return '';
}

function formatDateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Time unavailable';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
