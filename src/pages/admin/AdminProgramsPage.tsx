import { type FormEvent, useState } from 'react';
import { ExternalLink, FileText, Pencil, Plus, Save } from 'lucide-react';
import { DataTable, type Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PortalPage } from '../../components/PortalPage';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { formatPkr, titleCase } from '../../lib/utils';
import {
  courseOutlineUrl,
  listManagedPrograms,
  saveCourse,
  validateCourseOutline,
  type ManagedProgram,
} from '../../services/programAdminService';
import type { ProgramStatus } from '../../types';

export function AdminProgramsPage() {
  const programs = useSupabaseQuery(listManagedPrograms, []);
  const [editing, setEditing] = useState<ManagedProgram | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const columns: Column<ManagedProgram>[] = [
    {
      key: 'course',
      header: 'Course Name',
      render: (program) => <p className="font-semibold text-navy-900">{program.title}</p>,
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (program) => <div>{program.duration}<p className="mt-1 text-xs text-slate-500">{program.live_hours} Live Hours</p></div>,
    },
    { key: 'fee', header: 'Fees', render: (program) => <strong>{formatPkr(program.total_fee)}</strong> },
    {
      key: 'status',
      header: 'Status',
      render: (program) => <span className={`badge ${program.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{titleCase(program.status)}</span>,
    },
    {
      key: 'edit',
      header: 'Edit',
      render: (program) => <button type="button" onClick={() => showEdit(program)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50" aria-label={`Edit ${program.title}`}><Pencil size={15}/>Edit</button>,
    },
  ];

  function showAdd() {
    setEditing(null);
    setFormError('');
    setSuccess('');
    setOpen(true);
  }

  function showEdit(program: ManagedProgram) {
    setEditing(program);
    setFormError('');
    setSuccess('');
    setOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    setSuccess('');
    try {
      const data = new FormData(event.currentTarget);
      const outline = data.get('course_outline');
      const file = outline instanceof File && outline.size > 0 ? outline : null;
      if (file) validateCourseOutline(file);
      await saveCourse({
        title: String(data.get('title') ?? ''),
        duration: String(data.get('duration') ?? ''),
        liveHours: Number(data.get('live_hours')),
        fee: Number(data.get('total_fee')),
        description: String(data.get('description') ?? ''),
        status: String(data.get('status') ?? 'draft') as ProgramStatus,
        outline: file,
      }, editing);
      await programs.reload();
      setOpen(false);
      setSuccess(`Course ${editing ? 'updated' : 'created'} successfully.`);
      setEditing(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save the course.');
    } finally {
      setBusy(false);
    }
  }

  const currentOutlineUrl = courseOutlineUrl(editing?.course_outline_path);

  return <PortalPage
    title="Manage Programs"
    description="Add and edit courses using the same catalog shown on the public website. Draft courses remain private."
    actions={<button type="button" className="btn-primary" onClick={showAdd}><Plus size={16}/>Add New Course</button>}
  >
    {success && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
    {programs.loading
      ? <LoadingState label="Loading programs"/>
      : programs.error
        ? <ErrorState message={programs.error} onRetry={programs.reload}/>
        : <DataTable columns={columns} rows={programs.data ?? []} empty={<EmptyState title="No courses yet" message="Add the first course to get started."/>}/>
    }

    <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title={`${editing ? 'Edit' : 'Add'} Course`}>
      <form key={editing?.id ?? 'new-course'} onSubmit={submit} className="space-y-5">
        <CourseField label="Course Name" name="title" defaultValue={editing?.title} placeholder="Applied Data Science & ML" required/>
        <div className="grid gap-5 sm:grid-cols-2">
          <CourseField label="Duration" name="duration" defaultValue={editing?.duration} placeholder="6 Months" required/>
          <CourseField label="Live Hours / Class Time" name="live_hours" type="number" defaultValue={editing?.live_hours} placeholder="72" min={0} step={1} required/>
        </div>
        <CourseField label="Course Fees" name="total_fee" type="number" defaultValue={editing?.total_fee} placeholder="40000" min={0} step={1} required/>
        <div>
          <label className="label" htmlFor="course-description">About the Course / Description</label>
          <textarea id="course-description" name="description" className="input min-h-36 resize-y" defaultValue={editing?.description ?? ''} placeholder="Course description goes here..." maxLength={5000} required/>
        </div>
        <div>
          <label className="label" htmlFor="course-outline">Course Outline PDF</label>
          {editing?.course_outline_name && currentOutlineUrl && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><span className="inline-flex min-w-0 items-center gap-2 font-semibold text-slate-700"><FileText size={17} className="shrink-0 text-brand-600"/><span className="truncate">Current: {editing.course_outline_name}</span></span><a href={currentOutlineUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-brand-700">View<ExternalLink size={14}/></a></div>}
          <input id="course-outline" name="course_outline" type="file" accept="application/pdf,.pdf" className="input file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700"/>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">PDF only, up to 10 MB. Choose a file only when you want to add or replace the current outline.</p>
        </div>
        <div>
          <label className="label" htmlFor="course-status">Status</label>
          <select id="course-status" name="status" className="input" defaultValue={editing?.status ?? 'draft'} required>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        {formError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
          <button className="btn-primary" disabled={busy}><Save size={16}/>{busy ? 'Saving…' : 'Save Course'}</button>
        </div>
      </form>
    </Modal>
  </PortalPage>;
}

function CourseField({ label, name, type = 'text', defaultValue, placeholder, required, min, step }: {
  label: string;
  name: string;
  type?: 'text' | 'number';
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  min?: number;
  step?: number;
}) {
  const id = `course-${name}`;
  return <div><label className="label" htmlFor={id}>{label}</label><input id={id} name={name} type={type} className="input" defaultValue={defaultValue ?? ''} placeholder={placeholder} required={required} min={min} step={step}/></div>;
}
