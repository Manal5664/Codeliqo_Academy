import { supabase } from '../lib/supabase';
import type { ProgramStatus } from '../types';

export const COURSE_OUTLINE_BUCKET = 'course-outlines';
export const MAX_COURSE_OUTLINE_BYTES = 10 * 1024 * 1024;

export interface ManagedProgram {
  id: string;
  slug: string;
  code: string;
  title: string;
  short_title: string;
  description: string;
  full_description: string;
  duration: string;
  duration_weeks: number;
  live_hours: number;
  registration_fee: number;
  monthly_fee: number;
  installment_months: number;
  tuition_fee: number;
  total_fee: number;
  status: ProgramStatus;
  display_order: number;
  course_outline_path: string | null;
  course_outline_name: string | null;
}

export interface CourseInput {
  title: string;
  duration: string;
  liveHours: number;
  fee: number;
  description: string;
  status: ProgramStatus;
  outline?: File | null;
}

const managedProgramSelect = [
  'id', 'slug', 'code', 'title', 'short_title', 'description', 'full_description', 'duration',
  'duration_weeks', 'live_hours', 'registration_fee', 'monthly_fee',
  'installment_months', 'tuition_fee', 'total_fee', 'status', 'display_order',
  'course_outline_path', 'course_outline_name',
].join(', ');

function fail(error: { message: string } | null, fallback: string): void {
  if (!error) return;
  const normalized = error.message.toLowerCase();
  if (normalized.includes('bucket not found')) {
    throw new Error(`Course outline storage is not configured. Apply the Supabase migration that creates the "${COURSE_OUTLINE_BUCKET}" bucket.`);
  }
  if (normalized.includes('row-level security') || normalized.includes('permission denied')) {
    throw new Error('Your administrator session is not authorized to manage courses.');
  }
  if (normalized.includes('programs_slug')) throw new Error('A course with the generated URL already exists. Please try a more specific course name.');
  if (normalized.includes('programs_code')) throw new Error('A course with the generated short code already exists. Please try a more specific course name.');
  throw new Error(error.message || fallback);
}

export async function listManagedPrograms(): Promise<ManagedProgram[]> {
  const { data, error } = await supabase
    .from('programs')
    .select(managedProgramSelect)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  fail(error, 'Unable to load courses.');
  return ((data ?? []) as unknown as ManagedProgram[]).map(normalizeManagedProgram);
}

export function validateCourseOutline(file: File): void {
  if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
    throw new Error('Course outlines must be PDF files.');
  }
  if (file.size <= 0) throw new Error('The selected PDF is empty.');
  if (file.size > MAX_COURSE_OUTLINE_BYTES) throw new Error('The course outline PDF must be 10 MB or smaller.');
}

export function courseOutlineUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(COURSE_OUTLINE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function saveCourse(input: CourseInput, existing: ManagedProgram | null): Promise<void> {
  const title = input.title.trim();
  const duration = input.duration.trim();
  const description = input.description.trim();
  if (!title) throw new Error('Course Name is required.');
  if (!duration) throw new Error('Duration is required.');
  if (!Number.isInteger(input.liveHours) || input.liveHours < 0) throw new Error('Live Hours must be a whole number of 0 or greater.');
  if (!Number.isFinite(input.fee) || input.fee < 0) throw new Error('Course Fees must be a valid amount of 0 or greater.');
  if (!description) throw new Error('About the Course is required.');
  if (!['draft', 'published'].includes(input.status)) throw new Error('Status must be Draft or Published.');

  const id = existing?.id ?? crypto.randomUUID();
  let outlinePath: string | null = null;
  let outlineName: string | null = null;
  if (input.outline) {
    validateCourseOutline(input.outline);
    const originalStem = input.outline.name.replace(/\.pdf$/i, '');
    const safeStem = originalStem
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'course-outline';
    const safeName = `${safeStem}.pdf`;
    outlinePath = `${id}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage
      .from(COURSE_OUTLINE_BUCKET)
      .upload(outlinePath, input.outline, { contentType: 'application/pdf', upsert: false });
    fail(error, 'Unable to upload the course outline PDF.');
    outlineName = input.outline.name;
  }

  const durationWeeks = weeksFromDuration(duration);
  if (existing) {
    const registrationFee = Number(existing.registration_fee) || 0;
    const installmentMonths = Math.max(1, Number(existing.installment_months) || 1);
    const tuitionFee = Math.max(0, input.fee - registrationFee);
    const values: Record<string, unknown> = {
      title,
      description,
      duration,
      duration_weeks: durationWeeks,
      live_hours: input.liveHours,
      total_fee: input.fee,
      tuition_fee: tuitionFee,
      monthly_fee: tuitionFee / installmentMonths,
      status: input.status,
    };
    // Preserve the original compact card title when only another field changed.
    // An intentional name edit updates both public title variants.
    if (title !== existing.title) values.short_title = title;
    // The original six use the same text for both descriptions. Keep those in
    // sync, but preserve a genuinely separate legacy long description.
    if (existing.full_description.trim() === existing.description.trim()) values.full_description = description;
    // Omitting these keys is what preserves the current PDF on ordinary edits.
    if (outlinePath && outlineName) {
      values.course_outline_path = outlinePath;
      values.course_outline_name = outlineName;
    }
    const { error } = await supabase.from('programs').update(values).eq('id', existing.id).select('id').single();
    if (error) {
      if (outlinePath) await removeCourseOutlineQuietly(outlinePath);
      fail(error, 'Unable to update the course.');
    }
    // The database now points at the replacement. Removing the old object only
    // after that commit ensures a cleanup failure can never break the course link.
    if (outlinePath && existing.course_outline_path && existing.course_outline_path !== outlinePath) {
      await removeCourseOutlineQuietly(existing.course_outline_path);
    }
    return;
  }

  const technical = await createTechnicalValues(title);
  const values = {
    id,
    slug: technical.slug,
    code: technical.code,
    title,
    short_title: title,
    category: 'career-program',
    description,
    full_description: description,
    duration,
    duration_weeks: durationWeeks,
    live_hours: input.liveHours,
    level: 'Open enrollment',
    registration_fee: 0,
    monthly_fee: input.fee,
    installment_months: 1,
    tuition_fee: input.fee,
    total_fee: input.fee,
    tools: [],
    outcomes: [],
    prerequisites: [],
    audience: [],
    curriculum: [],
    portfolio: [],
    capstone: '',
    included: [],
    excluded: [],
    display_order: technical.displayOrder,
    status: input.status,
    active: true,
    course_outline_path: outlinePath,
    course_outline_name: outlineName,
  };
  const { error } = await supabase.from('programs').insert(values).select('id').single();
  if (error) {
    if (outlinePath) await removeCourseOutlineQuietly(outlinePath);
    fail(error, 'Unable to create the course.');
  }
}

async function removeCourseOutlineQuietly(path: string): Promise<void> {
  // Cleanup is best-effort: a newly committed course must remain usable even
  // if Storage temporarily refuses deletion of an object it no longer uses.
  try {
    await supabase.storage.from(COURSE_OUTLINE_BUCKET).remove([path]);
  } catch {
    // A later maintenance pass can remove an unreferenced object safely.
  }
}

async function createTechnicalValues(title: string): Promise<{ slug: string; code: string; displayOrder: number }> {
  const { data, error } = await supabase.from('programs').select('slug, code, display_order');
  fail(error, 'Unable to prepare the new course.');
  const rows = (data ?? []) as { slug: string; code: string; display_order: number }[];
  const slugs = new Set(rows.map((row) => row.slug.toLowerCase()));
  const codes = new Set(rows.map((row) => row.code.toLowerCase()));
  const slug = uniqueValue(slugify(title), slugs, '-');
  const code = uniqueValue(shortCode(title), codes, '');
  const maxOrder = rows.reduce((maximum, row) => Math.max(maximum, Number(row.display_order) || 0), 0);
  return { slug, code, displayOrder: maxOrder + 1 };
}

function uniqueValue(base: string, used: Set<string>, separator: string): string {
  if (!used.has(base.toLowerCase())) return base;
  let suffix = 2;
  while (used.has(`${base}${separator}${suffix}`.toLowerCase())) suffix += 1;
  return `${base}${separator}${suffix}`;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'course';
}

function shortCode(value: string): string {
  const words = value.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const acronym = words.map((word) => word[0]).join('').slice(0, 8);
  return acronym || 'COURSE';
}

function weeksFromDuration(value: string): number {
  const amount = Number(value.match(/\d+/)?.[0] ?? 1);
  if (!Number.isFinite(amount) || amount < 1) return 1;
  if (/year/i.test(value)) return Math.max(1, Math.round(amount * 52));
  if (/month/i.test(value)) return Math.max(1, Math.round(amount * 4));
  return Math.max(1, Math.round(amount));
}

function normalizeManagedProgram(row: ManagedProgram): ManagedProgram {
  return {
    ...row,
    duration_weeks: Number(row.duration_weeks),
    live_hours: Number(row.live_hours),
    registration_fee: Number(row.registration_fee),
    monthly_fee: Number(row.monthly_fee),
    installment_months: Number(row.installment_months),
    tuition_fee: Number(row.tuition_fee),
    total_fee: Number(row.total_fee),
    display_order: Number(row.display_order),
  };
}
