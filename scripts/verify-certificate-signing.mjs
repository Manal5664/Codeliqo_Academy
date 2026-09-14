import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/202609130002_certificate_signing.sql');
const idMigration = read('supabase/migrations/202609140001_automatic_certificate_ids.sql');
const idEnforcementMigration = read('supabase/migrations/202609140002_enforce_automatic_certificate_ids.sql');
const issuer = read('supabase/functions/issue-certificate/index.ts');
const importMap = read('supabase/functions/issue-certificate/deno.json');
const supabaseConfig = read('supabase/config.toml');
const websiteLogo = readFileSync('logo.png');
const certificateLogo = readFileSync('supabase/functions/issue-certificate/logo.png');
const settingsPage = read('src/pages/admin/CertificateSettingsPage.tsx');
const certificatesPage = read('src/pages/admin/AdminCertificatesPage.tsx');
const certificateService = read('src/services/certificateService.ts');
const studentPage = read('src/pages/student/CertificatesPage.tsx');
const studentService = read('src/services/studentService.ts');
const router = read('src/router.tsx');
const sidebar = read('src/layouts/DashboardLayout.tsx');

for (const field of [
  'authorized_signatory_name',
  'designation',
  'signature_path',
  'signatory_name_snapshot',
  'signatory_designation_snapshot',
  'signature_path_snapshot',
  'signature_sha256_snapshot',
  'student_name_snapshot',
  'file_path',
  'issued_at',
  'issued_by',
]) {
  assert(migration.includes(field), `Certificate persistence must include ${field}.`);
}

assert(migration.includes("values ('certificate-signatures', 'certificate-signatures', false"), 'The signature bucket must be private.');
assert(migration.includes("values ('certificates', 'certificates', false"), 'The rendered-certificate bucket must be private.');
assert(migration.includes("name ~ '^settings/[0-9a-f-]+\\.png$'"), 'Admin uploads must be restricted to current settings PNG paths.');
assert(migration.includes('CERTIFICATE_SNAPSHOT_IS_IMMUTABLE'), 'Issued snapshots must be immutable in PostgreSQL.');
assert(migration.includes('ONLY_PENDING_CERTIFICATES_CAN_BE_DELETED'), 'Issued certificates must not be deletable.');
assert(migration.includes('ONLY_ISSUED_CERTIFICATES_CAN_BE_REVOKED'), 'Pending records must not skip directly to revoked.');
assert(migration.includes("c.status = 'issued'"), 'Student PDF access must require issued status.');
assert(migration.includes('public.owns_student(c.student_id)'), 'Private PDF access must retain inactive-student enforcement.');

const verifyFunction = migration.slice(migration.indexOf('create or replace function public.verify_certificate'));
assert(verifyFunction.includes('student_name_snapshot'), 'Public verification must use the issued student-name snapshot.');
assert(!verifyFunction.match(/returns table[^;]*(signature|file_path|file_url)/s), 'Public verification must not expose signature or file locations.');

assert(issuer.includes("adminProfile?.role !== 'admin'"), 'The issuer must independently verify the admin role.');
assert(issuer.includes('certificate_eligible'), 'The issuer must enforce certificate eligibility.');
assert(issuer.includes(".from('certificate_settings')"), 'Issuance must read current settings server-side.');
assert(issuer.includes(".from('certificate-signatures').download(settings.signature_path)"), 'Issuance must read the private source signature.');
assert(issuer.includes('crypto.subtle.digest(\'SHA-256\''), 'Issuance must fingerprint the exact PNG used.');
assert(issuer.includes('document.embedPng(input.signature)'), 'The real uploaded PNG must be embedded in the PDF.');
assert.deepEqual(certificateLogo, websiteLogo, 'The certificate must bundle the exact logo.png used by the website.');
assert(supabaseConfig.includes('static_files = ["./functions/issue-certificate/logo.png"]'), 'The certificate logo must be bundled with the Edge Function.');
assert(issuer.includes("new URL('./logo.png', import.meta.url)"), 'The server renderer must resolve the logo through its filesystem URL.');
assert(issuer.includes('Deno.readFile(academyLogoUrl)') && issuer.includes('document.embedPng(academyLogoBytes)'), 'The server renderer must embed the logo from PNG bytes.');
assert(issuer.includes('x: (width - logoWidth) / 2'), 'The certificate logo must remain horizontally centered.');
assert(issuer.includes('document.addPage([841.89, 595.28])'), 'The rendered certificate must remain A4 landscape.');
assert(issuer.includes('borderColor: navy, borderWidth: 3') && issuer.includes('borderColor: gold, borderWidth: 1.35'), 'The certificate must render the navy and gold double border.');
assert(issuer.includes('drawCornerAccents(page, width, height, navy, gold)'), 'The certificate must render decorative corner accents.');
assert(issuer.includes('opacity: 0.035'), 'The certificate must render a subtle academy-logo watermark.');
assert(issuer.includes("fittedTextBlock(input.studentName") && issuer.includes("fittedTextBlock(input.programName"), 'Long student and program names must use the responsive text layout.');
assert(issuer.includes("'CERTIFICATE ID'") && issuer.includes("'COMPLETION DATE'") && issuer.includes("'AUTHORIZED SIGNATORY'"), 'The print footer must identify its dynamic certificate fields.');
assert(issuer.includes('signatureSnapshotPath') && issuer.includes('signature_path_snapshot: signatureSnapshotPath'), 'Issuance must preserve a private signature copy per certificate.');
assert(issuer.includes('signatory_name_snapshot: signatoryName') && issuer.includes('signatory_designation_snapshot: designation'), 'Issuance must snapshot signatory text.');
assert(issuer.includes(".from('certificates').upload(certificatePath, pdf"), 'The rendered PDF must be uploaded privately.');
assert(issuer.includes(".eq('status', 'pending')"), 'Issuance must use a pending-state concurrency guard.');
assert(importMap.includes('npm:pdf-lib@1.17.1') && importMap.includes('npm:@supabase/supabase-js@2.116.0'), 'Edge dependencies must be pinned.');
assert(importMap.includes('npm:qrcode@1.5.4'), 'The QR encoder dependency must be pinned.');
assert(issuer.includes("QRCode.toDataURL(input.verificationUrl"), 'The rendered PDF must include a QR verification code.');
assert(issuer.includes("new URL('/verify-certificate', origin.origin)"), 'The QR code must target the public verification route.');
assert(issuer.includes("input.verificationOrigin ?? request.headers.get('Origin')"), 'The deployed issuer must remain compatible with browser clients that predate the QR request field.');

assert(idMigration.includes('create_pending_certificate'), 'Certificate creation must use a database-owned ID allocator.');
assert(idMigration.includes('lock table public.certificates in share row exclusive mode'), 'Certificate ID allocation must serialize concurrent writes.');
assert(idMigration.includes("'CERT-' || certificate_year || '-' || lpad(next_number::text, 6, '0')"), 'Certificate IDs must use CERT-YYYY-NNNNNN format.');
assert(idMigration.includes('certificates_certificate_id_ci_key'), 'Certificate IDs must be unique without case ambiguity.');
assert(idEnforcementMigration.includes('before insert on public.certificates'), 'Automatic IDs must also cover legacy insert clients.');
assert(idEnforcementMigration.includes('pg_advisory_xact_lock'), 'All certificate insert paths must serialize automatic ID allocation.');
assert(idEnforcementMigration.includes("new.certificate_id := 'CERT-'"), 'Legacy manual IDs must be replaced by canonical generated IDs.');
assert(certificateService.includes(".rpc('create_pending_certificate'"), 'The admin client must request generated Certificate IDs from PostgreSQL.');
assert(!certificatesPage.includes('onChange={(event)=>setCertificateId'), 'Admins must not manually guess Certificate IDs.');

for (const label of ['Authorized Signatory Name', 'Designation', 'Signature Image Upload', 'Signature preview']) {
  assert(settingsPage.includes(label), `Certificate Settings must render ${label}.`);
}
assert(settingsPage.includes('selectedPreview||storedPreview'), 'A newly selected signature must be previewed before saving.');
assert(settingsPage.includes('generated or imitation signature'), 'The settings UI must prohibit fake signatures.');
assert(certificateService.includes("input.signatureFile.type !== 'image/png'"), 'Settings must validate PNG MIME type.');
assert(certificateService.includes('pngHeader.every'), 'Settings must validate the actual PNG file header.');
assert(certificateService.includes(".upload(uploadedPath, bytes") && certificateService.includes('upsert: false'), 'Signature uploads must use immutable unique paths.');
assert(certificateService.includes('.createSignedUrl(certificate.file_path, 60'), 'Rendered certificates must use short-lived signed downloads.');
assert(!certificateService.includes('getPublicUrl'), 'Certificate code must not create public storage URLs.');

assert(router.includes("path: 'settings/certificates'"), 'The protected admin Certificate Settings route must exist.');
assert(sidebar.includes("['Settings','/admin/settings/certificates'"), 'Admin navigation must expose Settings.');
assert(certificatesPage.includes('issueCertificate(row.id)'), 'Admin certificate issuance must use the secure renderer.');
assert(certificatesPage.includes('The signatory and signature snapshot will become immutable.'), 'The admin must confirm snapshot finality before issuance.');
assert(studentService.includes('file_path'), 'Student certificate queries must load the private PDF path.');
assert(studentPage.includes("item.status==='issued'&&(item.file_path||item.file_url)"), 'Students may download only issued certificate files.');
assert(read('src/pages/public/VerifyCertificatePage.tsx').includes("new URLSearchParams(window.location.search).get('id')"), 'QR verification links must automatically run their certificate lookup.');

console.log('Certificate checks passed: private storage, atomic IDs, real signature rendering, QR verification, immutable snapshots, protected issuance, and signed PDF downloads.');
