import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/202609130001_dynamic_program_catalog.sql');
const storageRepair = read('supabase/migrations/202609130003_repair_course_outline_storage.sql');
const initialSchema = read('supabase/migrations/202609080001_initial_schema.sql');
const service = read('src/services/programService.ts');
const admin = read('src/pages/admin/AdminProgramsPage.tsx');
const adminService = read('src/services/programAdminService.ts');
const card = read('src/components/ProgramCard.tsx');
const router = read('src/router.tsx');
const detail = read('src/pages/public/ProgramDetailPage.tsx');
const catalogContext = read('src/features/programs/ProgramCatalogContext.tsx');
const publicSources = [
  'src/pages/public/HomePage.tsx',
  'src/pages/public/ProgramsPage.tsx',
  'src/pages/public/FeesPage.tsx',
  'src/components/Navbar.tsx',
  'src/components/Footer.tsx',
].map(read).join('\n');

const seedMatch = migration.match(/\$program_seed\$(\[[\s\S]*?\])\$program_seed\$/);
assert(seedMatch, 'The program migration must contain a JSON seed.');
const seed = JSON.parse(seedMatch[1]);
assert.equal(seed.length, 6, 'All six existing programs must be migrated.');
assert.equal(new Set(seed.map((program) => program.id)).size, 6, 'Seed IDs must be unique.');
assert.equal(new Set(seed.map((program) => program.slug)).size, 6, 'Seed slugs must be unique.');
assert.deepEqual(seed.map((program) => program.display_order), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(seed.map((program) => program.slug), ['data-analyst', 'data-science-ml', 'generative-agentic-ai', 'frontend-developer', 'python-backend', 'full-stack']);
assert.deepEqual(seed.map(({ id, short_title, duration, live_hours, total_fee }) => ({ id, short_title, duration, live_hours, total_fee })), [
  { id: '11111111-1111-4111-8111-111111111111', short_title: 'AI-Powered Data Analyst', duration: '5 Months / 20 Weeks', live_hours: 60, total_fee: 31000 },
  { id: '22222222-2222-4222-8222-222222222222', short_title: 'Applied Data Science & ML', duration: '6 Months / 24 Weeks', live_hours: 72, total_fee: 40000 },
  { id: '33333333-3333-4333-8333-333333333333', short_title: 'Generative & Agentic AI', duration: '5 Months / 20 Weeks', live_hours: 60, total_fee: 41000 },
  { id: '44444444-4444-4444-8444-444444444444', short_title: 'Frontend Developer', duration: '4 Months / 16 Weeks', live_hours: 48, total_fee: 25000 },
  { id: '55555555-5555-4555-8555-555555555555', short_title: 'Python Backend Developer', duration: '4 Months / 16 Weeks', live_hours: 48, total_fee: 25000 },
  { id: '66666666-6666-4666-8666-666666666666', short_title: 'Full-Stack Developer', duration: '8 Months / 32 Weeks', live_hours: 96, total_fee: 45000 },
]);
assert(seed.every((program) => program.status === 'published'));
assert(seed.every((program) => program.title && program.category && program.short_title && program.duration));
assert(seed.every((program) => Array.isArray(program.curriculum) && program.curriculum.length > 0));

assert(service.includes(".eq('status', 'published')"), 'Public queries must request only published programs.');
assert(service.includes(".order('display_order', { ascending: true })"), 'Public programs must use ascending display order.');
assert(service.includes(".order('created_at', { ascending: true })") && service.includes(".order('id', { ascending: true })"), 'Public ordering must have stable tie-breakers.');
assert(migration.includes("using (status = 'published' or public.is_admin() or public.has_active_access(id, null))"), 'RLS must hide drafts while retaining admin/student access.');
assert(initialSchema.includes('policy "admins manage programs"') && initialSchema.includes('with check (public.is_admin())'), 'Program writes must remain restricted to administrators.');
assert(migration.includes('programs_slug_case_insensitive_unique'), 'Slugs must be uniquely constrained.');
assert(migration.includes('short_title = coalesce(programs.short_title, excluded.short_title)'), 'The legacy merge must preserve already-populated rich fields.');
assert(!migration.includes('title = excluded.title'), 'Rerunning the seed must not overwrite an existing course name.');
assert(!migration.includes('slug = excluded.slug'), 'Rerunning the seed must not overwrite an existing public URL.');
assert(admin.includes('Add New Course'), 'Admin must expose the requested Add New Course action.');
assert(admin.includes('Save Course'), 'Admin must expose the requested Save Course action.');
for (const label of ['Course Name', 'Duration', 'Live Hours / Class Time', 'Course Fees', 'About the Course / Description', 'Course Outline PDF', 'Status']) {
  assert(admin.includes(label), `The simple course form must include ${label}.`);
}
assert(!admin.includes('JSON') && !admin.includes('name="slug"') && !admin.includes('name="display_order"'), 'Technical and JSON fields must stay out of the normal course form.');
assert(adminService.includes('if (title !== existing.title) values.short_title = title'), 'Ordinary edits must preserve the legacy compact title.');
assert(adminService.includes('existing.full_description.trim() === existing.description.trim()'), 'A simple description edit must preserve a genuinely separate legacy long description.');
assert(adminService.includes("slug: technical.slug") && adminService.includes("display_order: technical.displayOrder"), 'New-course technical fields must be automatic.');
assert(adminService.includes('course_outline_path') && adminService.includes('MAX_COURSE_OUTLINE_BYTES'), 'Course outline upload and size validation must be implemented.');
assert(adminService.includes("file.type !== 'application/pdf'") && adminService.includes('10 * 1024 * 1024'), 'Course outlines must be validated as PDF files no larger than 10 MB.');
assert(admin.includes('accept="application/pdf,.pdf"') && !admin.match(/name="course_outline"[^>]*\brequired\b/), 'The course outline input must accept PDFs and remain optional.');
assert(adminService.includes('if (outlinePath && outlineName)') && adminService.includes('values.course_outline_path = outlinePath'), 'Editing without a new file must preserve the existing outline path.');
assert(adminService.includes('course_outline_path: outlinePath') && adminService.includes('course_outline_name: outlineName'), 'New courses must support both an uploaded outline and a null optional outline.');
assert(migration.includes("'course-outlines', 'course-outlines', true, 10485760") && migration.includes("array['application/pdf']"), 'Course outlines must use a PDF-only 10 MB Storage bucket.');
assert(migration.includes('to anon, authenticated') && migration.includes('for insert') && migration.includes('for update') && migration.includes('for delete'), 'The catalog migration must create public-read and Admin-only write policies for course outlines.');
assert(storageRepair.includes("'course-outlines', 'course-outlines', true, 10485760") && storageRepair.includes("array['application/pdf']"), 'The repair migration must create the expected public PDF-only 10 MB bucket.');
assert(storageRepair.includes('to anon, authenticated') && storageRepair.includes("using (bucket_id = 'course-outlines')"), 'Course outlines must be publicly readable.');
assert(storageRepair.includes('public.is_admin()') && storageRepair.includes('for insert') && storageRepair.includes('for update') && storageRepair.includes('for delete'), 'Only authenticated admins may upload, replace, or delete course outlines.');
assert(adminService.includes(".remove([path])") && adminService.includes('existing.course_outline_path !== outlinePath'), 'Replacing an outline must safely clean up the previous object after updating the course path.');
assert(adminService.includes("normalized.includes('bucket not found')"), 'A missing deployed bucket must produce an actionable configuration error.');
assert(router.includes("path: 'programs/:slug'"));
assert(detail.includes('usePublishedProgram(slug)'));
assert(detail.includes('program.courseOutlineUrl') && detail.includes('View Course Outline'), 'Published course details must expose the stored outline through its public URL.');
assert(catalogContext.includes("window.addEventListener('focus', refresh)"), 'The public catalog must refresh when an administrator returns to a public tab.');
assert(publicSources.includes('programs.map('), 'Public cards and links must render from catalog data.');
assert(publicSources.includes('xl:grid-cols-3'), 'The responsive public grid must retain three desktop columns.');
for (const field of ['programCategoryLabel(program.category)', 'program.code', 'program.shortTitle', 'program.description', 'program.duration', 'program.liveHours', 'program.total', '`/programs/${program.slug}`']) {
  assert(card.includes(field), `The existing card field must remain rendered: ${field}`);
}
assert(!publicSources.includes("data/programs"), 'Public code must not import a hard-coded program list.');
assert(!existsSync('src/data/programs.ts'), 'The old hard-coded catalog must be removed.');

const compare = (left, right) => left.display_order - right.display_order
  || left.created_at.localeCompare(right.created_at)
  || left.id.localeCompare(right.id);
const catalog = [
  ...seed.map((program, index) => ({ ...program, created_at: `2026-09-0${index + 1}T00:00:00Z` })),
  { ...seed[0], id: '77777777-7777-4777-8777-777777777777', slug: 'seventh-program', status: 'draft', display_order: 7, created_at: '2026-09-13T00:00:00Z' },
  { ...seed[0], id: '88888888-8888-4888-8888-888888888888', slug: 'eighth-program', status: 'published', display_order: 8, created_at: '2026-09-14T00:00:00Z' },
];
const published = () => catalog.filter((program) => program.status === 'published').sort(compare);
assert.equal(published().length, 7, 'Draft programs must stay out of the public list.');
catalog[6].status = 'published';
assert.equal(published().length, 8, 'Publishing must add the program without a source-code card.');
catalog[6].status = 'draft';
assert.equal(published().length, 7, 'Unpublishing must remove the program without deletion.');
catalog[6].status = 'published';
catalog[6].display_order = 1;
assert.equal(published()[1].id, catalog[6].id, 'Changing display order must reorder the catalog with stable ties.');

console.log('Program catalog checks passed: safe legacy migration, simple admin form, PDF outlines, visibility, ordering, dynamic routing, and responsive rendering.');
