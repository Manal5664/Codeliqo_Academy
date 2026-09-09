import { supabase } from '../lib/supabase';

export type AdminRecord = { id: string; [key: string]: unknown };

export interface OnboardingProgram {
  id: string;
  title: string;
  code: string;
}

export interface OnboardingBatch {
  id: string;
  program_id: string;
  name: string;
  status: string;
}

export interface OnboardStudentInput {
  fullName: string;
  email: string;
  applicationId: string;
  programId: string;
  batchId: string;
  studentStatus: string;
  enrollmentStatus: string;
  enrollmentId: string | null;
  provisioningMode: 'invite' | 'temporary_password';
  temporaryPassword?: string;
}

export interface OnboardStudentResult {
  fullName: string;
  email: string;
  applicationId: string;
  enrollmentId: string;
  program: string;
  batch: string;
  accountStatus: string;
}

function message(error: { message: string } | null) {
  if (!error) return;
  const normalized = error.message.toLowerCase();
  if (normalized.includes('invalid_full_name')) throw new Error('Enter the student\'s full name (2 to 120 characters).');
  if (normalized.includes('invalid_application_id')) throw new Error('Application ID must be 3 to 64 characters and use only letters, numbers, dashes, underscores, or slashes.');
  if (normalized.includes('invalid_enrollment_id')) throw new Error('Enrollment ID must be 3 to 64 characters and use only letters, numbers, dashes, underscores, or slashes.');
  if (normalized.includes('students_application_id_unique') || normalized.includes('application_id_exists')) throw new Error('A student with this Application ID already exists.');
  if (normalized.includes('students_enrollment_id_key') || normalized.includes('students_enrollment_id_case_insensitive_unique') || normalized.includes('enrollment_id_exists')) throw new Error('A student with this Enrollment ID already exists.');
  if (normalized.includes('profiles_email_unique')) throw new Error('A user with this email address already exists.');
  if (normalized.includes('duplicate_enrollment')) throw new Error('This student is already enrolled in the selected program and batch. Edit the existing enrollment instead.');
  if (normalized.includes('one_active_enrollment_per_student')) throw new Error('This student already has an active enrollment. Pause or complete it before creating another active enrollment.');
  if (normalized.includes('selected batch does not belong') || normalized.includes('program_batch_mismatch')) throw new Error('The selected batch does not belong to the selected program.');
  if (normalized.includes('invalid_progress')) throw new Error('Progress percentage must be between 0 and 100.');
  if (normalized.includes('invalid_current_week')) throw new Error('Current week cannot be negative.');
  if (normalized.includes('student_not_found') || normalized.includes('enrollment_not_found')) throw new Error('The student or enrollment no longer exists. Reload the page and try again.');
  if (normalized.includes('forbidden')) throw new Error('Your administrator session is not authorized to make this change.');
  throw new Error(error.message);
}

export async function listRecords(
  table: string,
  select = '*',
  orderBy = 'created_at',
): Promise<AdminRecord[]> {
  const { data, error } = await supabase.from(table).select(select).order(orderBy, { ascending: false });
  message(error);
  return (data ?? []) as unknown as AdminRecord[];
}

export async function saveRecord(table: string, values: Record<string, unknown>, id?: string) {
  const query = id
    ? supabase.from(table).update(values).eq('id', id)
    : supabase.from(table).insert(values);
  const { error } = await query.select('id').single();
  message(error);
}

export async function deleteRecord(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  message(error);
}

export async function loadAdminOverview() {
  const count = async (table: string, filter?: [string, string]) => {
    let query = supabase.from(table).select('id', { count: 'exact', head: true });
    if (filter) query = query.eq(filter[0], filter[1]);
    const { count: total, error } = await query;
    message(error);
    return total ?? 0;
  };

  const [students, activeEnrollments, batches, issuedCertificates, payments, announcements] = await Promise.all([
    count('students'),
    count('enrollments', ['status', 'active']),
    count('batches', ['status', 'active']),
    count('certificates', ['status', 'issued']),
    listRecords('payments', 'id, amount, status, paid_at, receipt_number, student:students(profile:profiles(full_name))', 'created_at'),
    listRecords('announcements', 'id, title, priority, published_at, active', 'published_at'),
  ]);

  return { students, activeEnrollments, batches, issuedCertificates, payments, announcements };
}

export async function listStudentDirectory(): Promise<AdminRecord[]> {
  return listRecords(
    'students',
    'id, profile_id, application_id, enrollment_id, status, certificate_eligible, created_at, profile:profiles(full_name, email, phone), enrollments(id, program_id, batch_id, status, progress_percentage, current_week, program:programs(title), batch:batches(name))',
    'created_at',
  );
}

export async function updateStudent(
  studentId: string,
  profileId: string,
  profileValues: { full_name: string },
  values: { application_id: string; status: string; certificate_eligible: boolean; enrollment_id: string | null },
  enrollment?: { id: string; status: string; progress_percentage: number; current_week: number },
) {
  const { error } = await supabase.rpc('update_student_records', {
    p_student_id: studentId,
    p_profile_id: profileId,
    p_full_name: profileValues.full_name,
    p_application_id: values.application_id,
    p_enrollment_id: values.enrollment_id,
    p_student_status: values.status,
    p_certificate_eligible: values.certificate_eligible,
    p_enrollment_uuid: enrollment?.id ?? null,
    p_enrollment_status: enrollment?.status ?? null,
    p_progress_percentage: enrollment?.progress_percentage ?? null,
    p_current_week: enrollment?.current_week ?? null,
  });
  message(error);
}

export async function loadOnboardingOptions(): Promise<{ programs: OnboardingProgram[]; batches: OnboardingBatch[] }> {
  const [programResult, batchResult] = await Promise.all([
    supabase.from('programs').select('id, title, code').eq('active', true).order('title'),
    supabase.from('batches').select('id, program_id, name, status').in('status', ['planned', 'active']).order('name'),
  ]);
  message(programResult.error);
  message(batchResult.error);
  return {
    programs: (programResult.data ?? []) as OnboardingProgram[],
    batches: (batchResult.data ?? []) as OnboardingBatch[],
  };
}

export async function onboardStudent(input: OnboardStudentInput): Promise<OnboardStudentResult> {
  const { data, error } = await supabase.functions.invoke('admin-onboard-student', { body: input });
  if (error) {
    let friendly = error.message || 'Unable to create the student account.';
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === 'string') friendly = payload.error;
      } catch {
        // Keep the transport error when the function did not return JSON.
      }
    }
    throw new Error(friendly);
  }
  const student = (data as { student?: OnboardStudentResult } | null)?.student;
  if (!student) throw new Error('The server did not return the newly created student.');
  return student;
}
