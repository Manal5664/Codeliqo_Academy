import { AdminResourcePage, type AdminColumn, type AdminField } from '../../components/AdminResourcePage';
import type { AdminRecord } from '../../services/adminService';
import { formatDate, formatPkr, titleCase } from '../../lib/utils';

const statuses = (values: string[]) => values.map((value) => ({ value, label: titleCase(value) }));
const text = (row: AdminRecord, key: string) => String(row[key] ?? '—');
const related = (row: AdminRecord, key: string, label: string) => {
  const value = row[key]; const record = (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | null;
  return record?.[label] ? String(record[label]) : '—';
};
const badge = (value: unknown) => <span className="badge">{titleCase(String(value ?? 'not set'))}</span>;
const bool = (value: unknown, yes: string, no: string) => <span className={`badge ${value ? 'bg-emerald-50 text-emerald-700' : ''}`}>{value ? yes : no}</span>;

const batchFields: AdminField[] = [
  { key: 'name', label: 'Batch name', required: true }, { key: 'program_id', label: 'Program', type: 'select', required: true, reference: { table: 'programs', label: 'title' } },
  { key: 'start_date', label: 'Start date', type: 'date' }, { key: 'end_date', label: 'End date', type: 'date' },
  { key: 'live_day', label: 'Live class day' }, { key: 'start_time', label: 'Start time', type: 'time' },
  { key: 'timezone', label: 'Timezone', required: true, placeholder: 'Asia/Karachi' }, { key: 'status', label: 'Status', type: 'select', required: true, options: statuses(['planned', 'active', 'completed', 'cancelled']) },
];
const batchColumns: AdminColumn[] = [
  { key: 'name', header: 'Batch', render: (row) => <strong>{text(row, 'name')}</strong> }, { key: 'program', header: 'Program', render: (row) => related(row, 'program', 'title') },
  { key: 'schedule', header: 'Schedule', render: (row) => <div>{text(row, 'live_day')} · {text(row, 'start_time')}<p className="text-xs text-slate-500">{text(row, 'timezone')}</p></div> },
  { key: 'start', header: 'Start date', render: (row) => formatDate(row.start_date as string | null) }, { key: 'status', header: 'Status', render: (row) => badge(row.status) },
];
export function AdminBatchesPage() { return <AdminResourcePage title="Batches" description="Schedule cohorts and connect them to an academy program." singular="Batch" table="batches" fields={batchFields} columns={batchColumns} select="*, program:programs(title)" orderBy="start_date" />; }

const enrollmentFields: AdminField[] = [{ key: 'student_id', label: 'Student', type: 'select', required: true, reference: { table: 'students', label: 'enrollment_id' } }, { key: 'program_id', label: 'Program', type: 'select', required: true, reference: { table: 'programs', label: 'title' } }, { key: 'batch_id', label: 'Batch (optional)', type: 'select', reference: { table: 'batches', label: 'name', match: { field: 'program_id', foreignKey: 'program_id' } } }, { key: 'status', label: 'Status', type: 'select', required: true, options: statuses(['active', 'paused', 'completed', 'withdrawn']) }, { key: 'progress_percentage', label: 'Progress percentage', type: 'number', required: true }, { key: 'current_week', label: 'Current week', type: 'number', required: true }];
const enrollmentColumns: AdminColumn[] = [{ key: 'student', header: 'Student', render: (row) => related(relatedRecord(row, 'student'), 'profile', 'full_name') }, { key: 'program', header: 'Program', render: (row) => related(row, 'program', 'title') }, { key: 'batch', header: 'Batch', render: (row) => related(row, 'batch', 'name') }, { key: 'progress', header: 'Progress', render: (row) => `${text(row, 'progress_percentage')}% · Week ${text(row, 'current_week')}` }, { key: 'status', header: 'Status', render: (row) => badge(row.status) }];
export function AdminEnrollmentsPage() { return <AdminResourcePage title="Enrollments" description="Enrollments are created automatically during student onboarding. Update program, batch, status, and progress here when circumstances change." singular="Enrollment" table="enrollments" fields={enrollmentFields} columns={enrollmentColumns} select="*, student:students(enrollment_id, profile:profiles(full_name)), program:programs(title), batch:batches(name)" />; }

const contentBase: AdminField[] = [
  { key: 'program_id', label: 'Program', type: 'select', required: true, reference: { table: 'programs', label: 'title' } },
  { key: 'batch_id', label: 'Batch (optional)', type: 'select', reference: { table: 'batches', label: 'name', match: { field: 'program_id', foreignKey: 'program_id' } } },
  { key: 'title', label: 'Title', required: true }, { key: 'week', label: 'Week', type: 'number', required: true },
];
const contentColumns: AdminColumn[] = [
  { key: 'title', header: 'Title', render: (row) => <div><p className="font-semibold">{text(row, 'title')}</p><p className="mt-1 text-xs text-slate-500">Week {text(row, 'week')}</p></div> },
  { key: 'program', header: 'Program', render: (row) => related(row, 'program', 'title') }, { key: 'batch', header: 'Batch', render: (row) => related(row, 'batch', 'name') },
  { key: 'published', header: 'Visibility', render: (row) => bool(row.published, 'Published', 'Draft') },
];
const contentSelect = '*, program:programs(title), batch:batches(name)';

const lessonFields: AdminField[] = [...contentBase, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'resource_links', label: 'Resource links (JSON array)', type: 'json', help: 'Example: ["https://docs.example.com"]' }, { key: 'file_url', label: 'Lesson file URL', type: 'url' }, { key: 'video_url', label: 'Video URL', type: 'url' }, { key: 'github_url', label: 'GitHub URL', type: 'url' }, { key: 'published', label: 'Published', type: 'checkbox' }];
export function AdminLessonsPage() { return <AdminResourcePage title="Lessons" description="Publish lesson notes and trusted resource links for enrolled students." singular="Lesson" table="lessons" fields={lessonFields} columns={contentColumns} select={contentSelect} orderBy="week" />; }

const assignmentFields: AdminField[] = [
  ...contentBase,
  { key: 'instructions', label: 'Instructions', type: 'textarea', required: true },
  { key: 'due_date', label: 'Due date', type: 'date' },
  { key: 'submission_type', label: 'Submission type', type: 'select', required: true, defaultValue: 'link_only', options: [{ value: 'link_only', label: 'Link only' }, { value: 'file_only', label: 'File only' }, { value: 'link_or_file', label: 'Link or File' }, { value: 'no_submission', label: 'No submission required' }] },
  { key: 'max_file_size_mb', label: 'Maximum File Size (MB)', type: 'number', required: true, defaultValue: 10, min: 1, max: 50, step: 1, showWhen: { field: 'submission_type', values: ['file_only', 'link_or_file'] }, help: 'Allowed range: 1–50 MB.' },
  { key: 'allow_resubmission', label: 'Allow resubmission', type: 'checkbox', defaultValue: true },
  { key: 'published', label: 'Published', type: 'checkbox' },
];
const assignmentColumns: AdminColumn[] = [
  ...contentColumns,
  { key: 'submission_type', header: 'Submission', render: (row) => <div><span className="badge">{titleCase(String(row.submission_type ?? 'link_only'))}</span>{row.submission_type !== 'no_submission' && <p className="mt-1 text-xs text-slate-500">{text(row, 'max_file_size_mb')} MB max · {row.allow_resubmission ? 'Resubmission allowed' : 'One submission'}</p>}</div> },
];
export function AdminAssignmentsPage() { return <AdminResourcePage title="Assignments" description="Create weekly assignments and configure whether students submit a link, file, either, or no response." singular="Assignment" table="assignments" fields={assignmentFields} columns={assignmentColumns} select={contentSelect} orderBy="week" />; }

const projectFields: AdminField[] = [{ key: 'program_id', label: 'Program', type: 'select', required: true, reference: { table: 'programs', label: 'title' } }, { key: 'batch_id', label: 'Batch (optional)', type: 'select', reference: { table: 'batches', label: 'name', match: { field: 'program_id', foreignKey: 'program_id' } } }, { key: 'title', label: 'Title', required: true }, { key: 'description', label: 'Description', type: 'textarea', required: true }, { key: 'technologies', label: 'Technologies (JSON array)', type: 'json', help: 'Example: ["React", "TypeScript"]' }, { key: 'requirements', label: 'Requirements', type: 'textarea' }, { key: 'published', label: 'Published', type: 'checkbox' }];
const projectColumns: AdminColumn[] = [{ key: 'title', header: 'Project', render: (row) => <div><p className="font-semibold">{text(row, 'title')}</p><p className="mt-1 text-xs text-slate-500">{Array.isArray(row.technologies) ? row.technologies.join(', ') : 'No technologies listed'}</p></div> }, ...contentColumns.slice(1)];
export function AdminProjectsPage() { return <AdminResourcePage title="Projects" description="Manage portfolio briefs, technical requirements and publishing status." singular="Project" table="projects" fields={projectFields} columns={projectColumns} select={contentSelect} />; }

const attendanceFields: AdminField[] = [{ key: 'student_id', label: 'Student enrollment', type: 'select', required: true, reference: { table: 'students', label: 'enrollment_id' } }, { key: 'batch_id', label: 'Batch', type: 'select', reference: { table: 'batches', label: 'name' } }, { key: 'class_date', label: 'Class date', type: 'date', required: true }, { key: 'status', label: 'Status', type: 'select', required: true, options: statuses(['present', 'absent', 'late', 'excused']) }, { key: 'notes', label: 'Notes', type: 'textarea' }];
const attendanceColumns: AdminColumn[] = [{ key: 'student', header: 'Student', render: (row) => related(relatedRecord(row, 'student'), 'profile', 'full_name') }, { key: 'batch', header: 'Batch', render: (row) => related(row, 'batch', 'name') }, { key: 'date', header: 'Class date', render: (row) => formatDate(row.class_date as string | null) }, { key: 'status', header: 'Status', render: (row) => badge(row.status) }, { key: 'notes', header: 'Notes', render: (row) => text(row, 'notes') }];
export function AdminAttendancePage() { return <AdminResourcePage title="Attendance" description="Record class attendance used in student progress and certificate eligibility review." singular="Attendance record" table="attendance" fields={attendanceFields} columns={attendanceColumns} select="*, student:students(enrollment_id, profile:profiles(full_name)), batch:batches(name)" orderBy="class_date" />; }

const paymentFields: AdminField[] = [{ key: 'student_id', label: 'Student enrollment', type: 'select', required: true, reference: { table: 'students', label: 'enrollment_id' } }, { key: 'payment_type', label: 'Payment type', type: 'select', required: true, options: statuses(['registration', 'installment', 'other']) }, { key: 'amount', label: 'Amount (PKR)', type: 'number', required: true }, { key: 'method', label: 'Payment method' }, { key: 'paid_at', label: 'Payment date', type: 'date' }, { key: 'receipt_number', label: 'Receipt number' }, { key: 'receipt_url', label: 'Receipt URL', type: 'url' }, { key: 'status', label: 'Status', type: 'select', required: true, options: statuses(['pending', 'paid', 'rejected', 'refunded']) }, { key: 'notes', label: 'Internal notes', type: 'textarea' }];
const paymentColumns: AdminColumn[] = [{ key: 'student', header: 'Student', render: (row) => related(relatedRecord(row, 'student'), 'profile', 'full_name') }, { key: 'type', header: 'Type', render: (row) => titleCase(text(row, 'payment_type')) }, { key: 'amount', header: 'Amount', render: (row) => <strong>{formatPkr(Number(row.amount ?? 0))}</strong> }, { key: 'date', header: 'Paid at', render: (row) => formatDate(row.paid_at as string | null) }, { key: 'status', header: 'Status', render: (row) => badge(row.status) }];
export function AdminPaymentsPage() { return <AdminResourcePage title="Payments" description="Record and reconcile verified registration and tuition payments. No payment processing occurs here." singular="Payment" table="payments" fields={paymentFields} columns={paymentColumns} select="*, student:students(enrollment_id, profile:profiles(full_name))" />; }

const announcementFields: AdminField[] = [{ key: 'title', label: 'Title', required: true }, { key: 'message', label: 'Message', type: 'textarea', required: true }, { key: 'program_id', label: 'Program (optional)', type: 'select', reference: { table: 'programs', label: 'title' } }, { key: 'batch_id', label: 'Batch (optional)', type: 'select', reference: { table: 'batches', label: 'name', match: { field: 'program_id', foreignKey: 'program_id' } } }, { key: 'priority', label: 'Priority', type: 'select', required: true, options: statuses(['normal', 'important', 'urgent']) }, { key: 'published_at', label: 'Publish date', type: 'date', required: true }, { key: 'active', label: 'Active', type: 'checkbox' }];
const announcementColumns: AdminColumn[] = [{ key: 'title', header: 'Announcement', render: (row) => <div><p className="font-semibold">{text(row, 'title')}</p><p className="mt-1 max-w-md truncate text-xs text-slate-500">{text(row, 'message')}</p></div> }, { key: 'audience', header: 'Audience', render: (row) => related(row, 'batch', 'name') !== '—' ? related(row, 'batch', 'name') : related(row, 'program', 'title') !== '—' ? related(row, 'program', 'title') : 'All students' }, { key: 'priority', header: 'Priority', render: (row) => badge(row.priority) }, { key: 'date', header: 'Published', render: (row) => formatDate(row.published_at as string | null) }, { key: 'active', header: 'Status', render: (row) => bool(row.active, 'Active', 'Inactive') }];
export function AdminAnnouncementsPage() { return <AdminResourcePage title="Announcements" description="Publish academy-wide, program-specific or batch-specific student updates." singular="Announcement" table="announcements" fields={announcementFields} columns={announcementColumns} select="*, program:programs(title), batch:batches(name)" orderBy="published_at" />; }

function relatedRecord(row: AdminRecord, key: string): AdminRecord { const value = row[key]; return ((Array.isArray(value) ? value[0] : value) ?? {}) as AdminRecord; }
