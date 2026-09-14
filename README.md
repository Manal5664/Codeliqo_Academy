# Codeliqo Academy website and LMS

A responsive React, TypeScript, Tailwind CSS and Supabase application for the Codeliqo Academy public website, student portal and role-protected administration area.

## Included

- Public marketing site with a database-driven program catalog, curriculum, fees, admissions, FAQs, policies, contact information and public certificate verification.
- Student LMS for program and batch details, lessons, secure link/file assignment submissions, projects, progress, payments, certificates and profile updates.
- Admin LMS for secure student account onboarding, enrollments, programs, batches, lessons, assignments, projects, submission review, attendance, payments, certificate issuance/settings and announcements.
- Supabase authentication, role checks and row-level security policies that keep each student's records private.
- Responsive navigation, accessible form controls, SEO metadata, sitemap, robots file and Vercel SPA rewrites.

## Local setup

Requirements: Node.js 18 or newer, npm, and a Supabase project for live portal data.

```bash
npm install
cp .env.example .env.local
npm run dev
```

On PowerShell, copy the environment template with:

```powershell
Copy-Item .env.example .env.local
```

Set these public frontend variables in `.env.local` and in the deployment environment:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
VITE_ADMISSION_FORM_URL=https://your-form.example
VITE_ACADEMY_EMAIL=academy@example.com
VITE_WHATSAPP_NUMBER=923001234567
```

`VITE_SUPABASE_ANON_KEY` remains supported as a legacy variable name, including when its value is a current `sb_publishable_...` key. New configurations should use `VITE_SUPABASE_PUBLISHABLE_KEY`.

Only the Supabase project URL and **publishable key** belong in the browser. Never add a secret/service-role key, database password or other secret to a `VITE_` variable. Non-catalog public pages remain usable when Supabase is not configured; the program catalog, login and certificate lookup display a controlled unavailable state.

## Supabase setup

This workspace includes `supabase/config.toml` so the certificate logo is bundled with the `issue-certificate` Edge Function. Authenticate, then link and apply migrations in order:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

Do not use `supabase db reset --linked` on a production project; it is destructive. The dry run should show only migration timestamps that are not already recorded remotely. If the interrupted `202609090001` migration was already deployed, the new `202609090002` completion migration will still apply normally.

The [initial schema](supabase/migrations/202609080001_initial_schema.sql) creates the LMS tables, initial program records, profile trigger, certificate verification function, and RLS. The [secure onboarding migration](supabase/migrations/202609090001_secure_student_onboarding.sql) adds account email display, unique application references, inactive-student access enforcement, program/batch integrity checks, and service-role-only onboarding functions. The [onboarding completion migration](supabase/migrations/202609090002_complete_student_onboarding.sql) adds safe existing-Auth-account lookup, Auth email synchronization, and atomic administrator edits. The [dynamic program catalog migration](supabase/migrations/202609130001_dynamic_program_catalog.sql) preserves the six existing program IDs, slugs, base values and complete public content; adds draft/published status and automatic ordering; and creates the PDF-only `course-outlines` Storage bucket. Its merge fills only missing legacy columns, so rerunning it does not overwrite later course edits. The [certificate signing migration](supabase/migrations/202609130002_certificate_signing.sql) adds admin-only settings, private signature/PDF buckets, immutable issuance snapshots and protected certificate downloads. The two automatic-ID migrations add the admin-only creation RPC, case-insensitive uniqueness, and an insert trigger that safely assigns `CERT-YYYY-NNNNNN` IDs even for older clients. The [assignment submission migration](supabase/migrations/202609150001_assignment_file_submissions.sql) adds backward-compatible submission types, per-assignment file limits, private file metadata, review outcomes, safe resubmission rules, and owner/admin-only file access. These migrations are additive and do not delete existing records.

### Assignment submissions

Existing assignments default to **Link only**, so existing records and URL submissions continue to work. Administrators can instead select File only, Link or File, or No submission required; configure a 1–50 MB file limit; and allow or disable resubmission. Assignment files accept PDF, DOCX, PPTX, XLSX, ZIP, PNG, JPG, and JPEG.

Files are uploaded through the authenticated `assignment-submission` Edge Function. It verifies the active student and enrollment, assignment configuration, URL, extension, MIME type, byte signature, archive structure, and configured size before writing to the private `assignment-submissions` bucket under a UUID-based path. PostgreSQL independently enforces ownership, assignment rules, storage metadata, timestamps, duplicate/resubmission behavior, and short-lived signed-file access. The original filename is never used as an object key; only a sanitized display name is retained.

Students see their submitted link/file, notes, timestamp, status, and teacher feedback in the existing assignment page. Administrators review the same record under **Admin → Submissions**, where they can view/download the private file and mark it Reviewed, Approved, or Needs Revision.

### Program catalog management

The public home page, program listing, fee comparison, navigation, footer, and slug-based detail page all read published records from the existing Supabase `programs` table. In **Admin -> Programs**, the normal form contains only Course Name, Duration, Live Hours / Class Time, Course Fees, About the Course, Course Outline PDF, and Status. Slugs, short codes, display order, fee-breakdown internals and defaults are generated automatically. Existing slugs and hidden rich content remain unchanged on ordinary edits. Draft rows are filtered both by the public query and PostgreSQL row-level security. The existing `active` flag remains separate: it controls LMS/enrollment availability, while `status` controls public visibility.

Course outlines accept PDF files only and are limited to 10 MB. Replacing an outline stores a new uniquely named object and updates only that course's path; saving any other field leaves the existing outline untouched.

Program deletion is deliberately unavailable in the admin catalog because program records can own enrollment and learning data. Use Draft to remove a program from the public site and disable LMS availability when appropriate.

### Certificate signing and issuance

In **Admin -> Settings -> Certificate Settings**, configure the authorized signatory name, designation and genuine PNG signature. The browser validates the PNG header and size, shows a local preview, and uploads a uniquely named object to the private `certificate-signatures` bucket. A transparent, tightly cropped PNG is recommended. Do not upload a generated or imitation signature.

Certificates receive an atomic database-generated ID in `CERT-YYYY-NNNNNN` format when an administrator creates them. Issuance is allowed only for a student marked certificate eligible. The `issue-certificate` Edge Function independently authorizes the administrator, downloads the current signature privately, renders the PDF and verification QR code server-side, stores the PDF in the private `certificates` bucket, and commits the following immutable snapshot to the certificate row: student name, signatory name, designation, signature object path, signature SHA-256, private PDF path, issuer and issuance timestamp. It also stores a separate private copy of the exact signature bytes used. Updating Certificate Settings therefore affects only later issuances.

Issued and revoked records cannot be edited or deleted. An issued record may only transition to revoked, and revocation is final. Previously issued legacy records remain available as-is; because the old system did not preserve a signing snapshot, the application does not invent one for them.

The signature source and snapshot paths are never returned by public certificate verification. QR codes open `/verify-certificate?id=CERT-YYYY-NNNNNN`, which performs the same limited public lookup. The UI never creates public Storage URLs. Students receive a short-lived, RLS-authorized signed URL for their own issued PDF, while administrators may download issued or revoked PDFs for recordkeeping.

In Supabase Authentication settings, keep the Email provider enabled but disable **Allow new users to sign up**. Admin invitations and secret-key user creation continue to work while public self-signup is blocked.

For the first trusted administrator only, create that Auth account and run the following once in the SQL editor after replacing the UUID:

```sql
update public.profiles set role = 'admin' where id = '<AUTH-USER-UUID>';
```

This UUID step is only the one-time administrator bootstrap. After the first administrator exists, all student accounts are created from **Admin Dashboard → Create Student Account**. No Auth, profile, student, enrollment, program, or batch UUID is typed or copied through the normal admin UI.

The initial migration seeds the program catalog but does not invent cohort dates. Before onboarding the first student, create at least one **planned** or **active** batch from **Admin → Batches** and link it to the appropriate program.

### Secure onboarding architecture

The browser sends the signed-in admin's access token and form data to the `admin-onboard-student` Edge Function using `supabase.functions.invoke`. The Edge Function independently verifies the token, checks `public.profiles.role = 'admin'`, and only then uses the server-side secret key to create an Auth user or send an invitation. It calls a secret-key-only PostgreSQL function to create/update `profiles`, create `students`, and create `enrollments` in one database transaction. `certificate_eligible` is always `false` at creation. If that transaction fails, the Edge Function deletes a newly created Auth user so no partial account is retained.

If the email already belongs to a non-admin Auth account that has no student record, the workflow safely links that existing account instead of creating a duplicate. Invitation mode sends that account a secure password-setup email; temporary-password mode replaces its password only because the administrator explicitly selected that option. Existing administrators and accounts that already have a student record are rejected with a clear message. Existing Application IDs, Enrollment IDs, and active-enrollment conflicts are also rejected without creating partial records.

The service-role key is never included in React, a `VITE_` variable, or a browser request. Existing RLS remains enabled. Setting a student to `inactive` makes student-owned LMS rows inaccessible through the RLS ownership helpers; setting the student back to `active` restores access.

### Deploy the onboarding Edge Function

Deploy the function with JWT verification enabled (the default):

```bash
supabase functions deploy admin-onboard-student
supabase functions deploy issue-certificate
supabase functions deploy assignment-submission
supabase secrets set STUDENT_INVITE_REDIRECT_URL=https://YOUR_DOMAIN/student/accept-invite
```

In Supabase Authentication → URL Configuration, add the same `https://YOUR_DOMAIN/student/accept-invite` URL to the redirect allow list. Invitation recipients land there to choose a password. For local invitation testing, add and configure a localhost URL as an additional allowed redirect.

Keep the default Invite and Reset Password email templates using `{{ .ConfirmationURL }}`, or ensure a customized template honors `{{ .RedirectTo }}`. Configure custom SMTP before production use so invitation/password-setup delivery and rate limits are appropriate for your academy.

Server-side function configuration:

- `SUPABASE_URL` — required; Supabase injects it automatically for hosted Edge Functions.
- `SUPABASE_SECRET_KEYS` — required privileged server key map; Supabase injects it automatically for hosted Edge Functions. The function uses its `default` key.
- `SUPABASE_SERVICE_ROLE_KEY` — supported only as a legacy fallback and also injected automatically for legacy projects.
- `STUDENT_INVITE_REDIRECT_URL` — required when using invitation mode; set it to the deployed `/student/accept-invite` URL. It is configuration rather than a secret.

Never expose either a secret key or legacy service-role key in Vercel, React, a `VITE_` variable, or any browser-accessible configuration. On hosted Supabase, only `STUDENT_INVITE_REDIRECT_URL` needs to be set manually.

For local function serving only, copy [the function environment template](supabase/functions/.env.example) to an ignored local env file and supply local server values. Do not commit real keys.

The form validates names, email addresses, application/enrollment references, statuses, and matching active program/batch selections. Batch choices in enrollment and content editors are filtered by the selected program, while the database independently rejects mismatched enrollment relationships. Duplicate email, Application ID, Enrollment ID, existing student, and conflicting enrollment failures are returned as administrator-friendly messages. An omitted Enrollment ID is generated securely by PostgreSQL. Student/profile/enrollment edits from the student directory are committed atomically.

Assignment uploads use the private bucket and validated function described above. Other learning resources may be hosted in an appropriately protected Supabase Storage bucket or another trusted host; store only the authorized URL in the relevant LMS record.

## Build and deployment

```bash
npm run build
npm run preview
```

The production output is written to `dist`. `vercel.json` rewrites application routes to `index.html`, so public and protected client-side URLs work on refresh. Configure the same environment variables in Vercel before deploying.
