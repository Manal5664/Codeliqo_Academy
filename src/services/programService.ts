import { supabase } from '../lib/supabase';
import type { CurriculumModule, Program, ProgramCategory, ProgramStatus } from '../types';
import { courseOutlineUrl } from './programAdminService';

interface ProgramRow {
  id: string;
  slug: string;
  code: string;
  title: string;
  short_title: string;
  category: string;
  description: string;
  full_description: string;
  duration: string;
  duration_weeks: number;
  live_hours: number;
  level: string;
  registration_fee: number | string;
  monthly_fee: number | string;
  installment_months: number;
  tuition_fee: number | string;
  total_fee: number | string;
  tools: unknown;
  outcomes: unknown;
  prerequisites: unknown;
  audience: unknown;
  curriculum: unknown;
  portfolio: unknown;
  capstone: string;
  included: unknown;
  excluded: unknown;
  bonus: string | null;
  display_order: number;
  status: string;
  active: boolean;
  created_at: string;
  course_outline_path: string | null;
  course_outline_name: string | null;
}

const programSelect = [
  'id', 'slug', 'code', 'title', 'short_title', 'category', 'description', 'full_description',
  'duration', 'duration_weeks', 'live_hours', 'level', 'registration_fee', 'monthly_fee',
  'installment_months', 'tuition_fee', 'total_fee', 'tools', 'outcomes', 'prerequisites',
  'audience', 'curriculum', 'portfolio', 'capstone', 'included', 'excluded', 'bonus',
  'display_order', 'status', 'active', 'created_at', 'course_outline_path', 'course_outline_name',
].join(', ');

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function curriculum(value: unknown): CurriculumModule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.period !== 'string' || typeof record.title !== 'string') return [];
    return [{ period: record.period, title: record.title, topics: stringArray(record.topics) }];
  });
}

function toProgram(row: ProgramRow): Program {
  return {
    id: row.id,
    slug: row.slug,
    code: row.code,
    title: row.title,
    shortTitle: row.short_title || row.title,
    category: row.category as ProgramCategory,
    duration: row.duration || `${row.duration_weeks} Weeks`,
    weeks: row.duration_weeks,
    liveHours: row.live_hours,
    level: row.level,
    description: row.description,
    fullDescription: row.full_description || row.description,
    registrationFee: Number(row.registration_fee),
    monthlyFee: Number(row.monthly_fee),
    months: row.installment_months,
    tuition: Number(row.tuition_fee),
    total: Number(row.total_fee),
    tools: stringArray(row.tools),
    outcomes: stringArray(row.outcomes),
    prerequisites: stringArray(row.prerequisites),
    audience: stringArray(row.audience),
    curriculum: curriculum(row.curriculum),
    portfolio: stringArray(row.portfolio),
    capstone: row.capstone,
    included: stringArray(row.included),
    excluded: stringArray(row.excluded),
    bonus: row.bonus || undefined,
    displayOrder: row.display_order,
    status: row.status as ProgramStatus,
    active: row.active,
    createdAt: row.created_at,
    courseOutlineName: row.course_outline_name || undefined,
    courseOutlineUrl: courseOutlineUrl(row.course_outline_path) || undefined,
  };
}

export async function listPublishedPrograms(): Promise<Program[]> {
  const { data, error } = await supabase
    .from('programs')
    .select(programSelect)
    .eq('status', 'published')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ProgramRow[]).map(toProgram);
}

export const categoryLabels: Record<ProgramCategory, string> = {
  'software-development': 'Software Development',
  'data-science': 'Data Science',
  'artificial-intelligence': 'Artificial Intelligence',
  'career-program': 'Career Program',
};

export function programCategoryLabel(category: string) {
  return categoryLabels[category as ProgramCategory]
    ?? category.split('-').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}
