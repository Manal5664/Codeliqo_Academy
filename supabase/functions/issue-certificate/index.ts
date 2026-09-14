import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import QRCode from 'qrcode';

interface IssueRequest { certificateId?: unknown; verificationOrigin?: unknown }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
const academyLogoUrl = new URL('./logo.png', import.meta.url);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function adminKeyFromEnvironment() {
  const secretKeyMap = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeyMap) {
    try {
      const keys = JSON.parse(secretKeyMap) as Record<string, unknown>;
      if (typeof keys.default === 'string' && keys.default) return keys.default;
      const first = Object.values(keys).find((value): value is string => typeof value === 'string' && Boolean(value));
      if (first) return first;
    } catch {
      console.error('SUPABASE_SECRET_KEYS is not valid JSON.');
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

function centeredX(text: string, font: PDFFont, size: number, pageWidth: number) {
  return (pageWidth - font.widthOfTextAtSize(text, size)) / 2;
}

function centeredAtX(text: string, font: PDFFont, size: number, centerX: number) {
  return centerX - font.widthOfTextAtSize(text, size) / 2;
}

function fittedSize(text: string, font: PDFFont, preferred: number, minimum: number, maxWidth: number) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

function splitToken(token: string, font: PDFFont, size: number, maxWidth: number) {
  const pieces: string[] = [];
  let piece = '';
  for (const character of token) {
    const candidate = `${piece}${character}`;
    if (piece && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      pieces.push(piece);
      piece = character;
    } else {
      piece = candidate;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.trim().split(/\s+/).flatMap((word) => (
    font.widthOfTextAtSize(word, size) <= maxWidth ? [word] : splitToken(word, font, size, maxWidth)
  ));
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fittedTextBlock(text: string, font: PDFFont, preferred: number, minimum: number, maxWidth: number, maxLines: number, label: string) {
  for (let size = preferred; size >= minimum; size -= 0.5) {
    const lines = wrapText(text, font, size, maxWidth);
    if (lines.length <= maxLines) return { lines, size };
  }
  throw new Error(`${label} is too long to fit safely on the certificate.`);
}

function drawCenteredTextBlock(page: PDFPage, lines: string[], font: PDFFont, size: number, pageWidth: number, centerY: number, color: RGB) {
  const lineHeight = size * 1.16;
  const firstBaseline = centerY + ((lines.length - 1) * lineHeight) / 2 - size * 0.34;
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: centeredX(line, font, size, pageWidth),
      y: firstBaseline - index * lineHeight,
      size,
      font,
      color,
    });
  });
}

function drawCornerAccents(page: PDFPage, width: number, height: number, navy: RGB, gold: RGB) {
  const outerInset = 39;
  const innerOffset = 7;
  const outerLength = 61;
  const innerLength = 41;

  const drawCorner = (x: number, y: number, horizontalDirection: 1 | -1, verticalDirection: 1 | -1) => {
    page.drawLine({
      start: { x, y },
      end: { x: x + horizontalDirection * outerLength, y },
      thickness: 1.8,
      color: gold,
    });
    page.drawLine({
      start: { x, y },
      end: { x, y: y + verticalDirection * outerLength },
      thickness: 1.8,
      color: gold,
    });

    const innerX = x + horizontalDirection * innerOffset;
    const innerY = y + verticalDirection * innerOffset;
    page.drawLine({
      start: { x: innerX, y: innerY },
      end: { x: innerX + horizontalDirection * innerLength, y: innerY },
      thickness: 0.8,
      color: navy,
    });
    page.drawLine({
      start: { x: innerX, y: innerY },
      end: { x: innerX, y: innerY + verticalDirection * innerLength },
      thickness: 0.8,
      color: navy,
    });

    const horizontalCapX = x + horizontalDirection * outerLength;
    const verticalCapY = y + verticalDirection * outerLength;
    page.drawRectangle({ x: horizontalCapX - 1.8, y: y - 1.8, width: 3.6, height: 3.6, color: gold });
    page.drawRectangle({ x: x - 1.8, y: verticalCapY - 1.8, width: 3.6, height: 3.6, color: gold });
  };

  drawCorner(outerInset, height - outerInset, 1, -1);
  drawCorner(width - outerInset, height - outerInset, -1, -1);
  drawCorner(outerInset, outerInset, 1, 1);
  drawCorner(width - outerInset, outerInset, -1, 1);
}

function certificateDesignation(designation: string) {
  return /^director\s+of\s+codeliquo$/i.test(designation.trim())
    ? 'Director, Codeliqo Academy'
    : designation;
}

function validatePdfText(values: Array<[string, string]>, font: PDFFont) {
  for (const [label, value] of values) {
    try { font.widthOfTextAtSize(value, 12); }
    catch { throw new Error(`${label} contains characters not supported by the current certificate font.`); }
  }
}

function getVerificationUrl(originValue: unknown, certificateId: string) {
  const configuredOrigin = Deno.env.get('CERTIFICATE_VERIFY_BASE_URL')?.trim();
  const suppliedOrigin = typeof originValue === 'string' ? originValue.trim() : '';
  const rawOrigin = configuredOrigin || suppliedOrigin;
  if (!rawOrigin) throw new Error('Certificate verification URL is not configured.');

  let origin: URL;
  try { origin = new URL(rawOrigin); }
  catch { throw new Error('Certificate verification URL is invalid.'); }
  const localDevelopment = origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname);
  if (origin.protocol !== 'https:' && !localDevelopment) throw new Error('Certificate verification must use an HTTPS URL.');

  const verificationUrl = new URL('/verify-certificate', origin.origin);
  verificationUrl.searchParams.set('id', certificateId);
  return verificationUrl.toString();
}

async function pngFromDataUrl(dataUrl: string) {
  const encoded = dataUrl.split(',', 2)[1];
  if (!encoded) throw new Error('The verification QR code could not be encoded.');
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

export async function renderCertificate(input: {
  studentName: string;
  programName: string;
  certificateId: string;
  issueDate: string;
  signatoryName: string;
  designation: string;
  signature: Uint8Array;
  verificationUrl: string;
}) {
  const document = await PDFDocument.create();
  document.setTitle(`Certificate ${input.certificateId}`);
  document.setAuthor('Codeliqo Academy');
  document.setSubject(`Certificate of Completion — ${input.programName}`);
  document.setCreator('Codeliqo Academy certificate issuance service');
  document.setCreationDate(new Date());

  const page = document.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const serif = await document.embedFont(StandardFonts.TimesRomanBoldItalic);
  const academyLogoBytes = await Deno.readFile(academyLogoUrl);
  if (!academyLogoBytes.length || !pngHeader.every((value, index) => academyLogoBytes[index] === value)) {
    throw new Error('The bundled Codeliqo Academy logo is missing or invalid.');
  }
  const academyLogo = await document.embedPng(academyLogoBytes);
  const displayedDesignation = certificateDesignation(input.designation);
  validatePdfText([
    ['Student name', input.studentName],
    ['Program name', input.programName],
    ['Certificate ID', input.certificateId],
    ['Authorized signatory name', input.signatoryName],
    ['Designation', displayedDesignation],
  ], regular);

  const navy = rgb(0.025, 0.075, 0.165);
  const royal = rgb(0.02, 0.315, 0.69);
  const gold = rgb(0.72, 0.52, 0.16);
  const warmGold = rgb(0.86, 0.69, 0.34);
  const slate = rgb(0.29, 0.33, 0.39);
  const paper = rgb(0.997, 0.992, 0.976);
  const softGold = rgb(0.95, 0.91, 0.81);

  page.drawRectangle({ x: 0, y: 0, width, height, color: paper });
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: navy, borderWidth: 3 });
  page.drawRectangle({ x: 31, y: 31, width: width - 62, height: height - 62, borderColor: gold, borderWidth: 1.35 });
  drawCornerAccents(page, width, height, navy, gold);

  const watermarkScale = Math.min(286 / academyLogo.width, 286 / academyLogo.height);
  const watermarkWidth = academyLogo.width * watermarkScale;
  const watermarkHeight = academyLogo.height * watermarkScale;
  page.drawImage(academyLogo, {
    x: (width - watermarkWidth) / 2,
    y: 151,
    width: watermarkWidth,
    height: watermarkHeight,
    opacity: 0.035,
  });

  page.drawLine({ start: { x: 72, y: 519 }, end: { x: width / 2 - 72, y: 519 }, thickness: 0.75, color: softGold });
  page.drawLine({ start: { x: width / 2 + 72, y: 519 }, end: { x: width - 72, y: 519 }, thickness: 0.75, color: softGold });
  page.drawRectangle({ x: width / 2 - 2.5, y: 516.5, width: 5, height: 5, color: gold, opacity: 0.9 });

  const logoScale = Math.min(100 / academyLogo.width, 100 / academyLogo.height);
  const logoWidth = academyLogo.width * logoScale;
  const logoHeight = academyLogo.height * logoScale;
  page.drawImage(academyLogo, {
    x: (width - logoWidth) / 2,
    y: height - 136,
    width: logoWidth,
    height: logoHeight,
  });

  const academyLine = 'ACADEMIC EXCELLENCE  |  PROFESSIONAL LEARNING';
  page.drawText(academyLine, {
    x: centeredX(academyLine, bold, 9.5, width),
    y: 443,
    size: 9.5,
    font: bold,
    color: gold,
  });

  const heading = 'Certificate of Completion';
  page.drawText(heading, { x: centeredX(heading, serif, 35, width), y: 398, size: 35, font: serif, color: navy });
  page.drawLine({ start: { x: width / 2 - 74, y: 388 }, end: { x: width / 2 - 8, y: 388 }, thickness: 0.85, color: warmGold });
  page.drawLine({ start: { x: width / 2 + 8, y: 388 }, end: { x: width / 2 + 74, y: 388 }, thickness: 0.85, color: warmGold });
  page.drawRectangle({ x: width / 2 - 2, y: 386, width: 4, height: 4, color: gold });

  const presented = 'This certificate is proudly presented to';
  page.drawText(presented, { x: centeredX(presented, regular, 12.5, width), y: 362, size: 12.5, font: regular, color: slate });

  const studentBlock = fittedTextBlock(input.studentName, bold, 30, 11, width - 176, 2, 'Student name');
  drawCenteredTextBlock(page, studentBlock.lines, bold, studentBlock.size, width, 321, royal);
  const widestStudentLine = Math.max(...studentBlock.lines.map((line) => bold.widthOfTextAtSize(line, studentBlock.size)));
  const studentRuleWidth = Math.min(widestStudentLine + 54, width - 176);
  page.drawLine({
    start: { x: (width - studentRuleWidth) / 2, y: 285 },
    end: { x: (width + studentRuleWidth) / 2, y: 285 },
    thickness: 0.8,
    color: softGold,
  });

  const completion = 'has successfully fulfilled the academic requirements and completed the program';
  page.drawText(completion, { x: centeredX(completion, regular, 11.5, width), y: 264, size: 11.5, font: regular, color: slate });
  const programBlock = fittedTextBlock(input.programName, bold, 20, 10.5, width - 176, 3, 'Program name');
  drawCenteredTextBlock(page, programBlock.lines, bold, programBlock.size, width, 222, navy);

  page.drawLine({ start: { x: 72, y: 183 }, end: { x: width / 2 - 9, y: 183 }, thickness: 0.7, color: softGold });
  page.drawLine({ start: { x: width / 2 + 9, y: 183 }, end: { x: width - 72, y: 183 }, thickness: 0.7, color: softGold });
  page.drawRectangle({ x: width / 2 - 3, y: 180, width: 6, height: 6, color: gold });

  const formattedDate = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${input.issueDate}T00:00:00Z`));
  const footerSideMargin = 70;
  const footerColumnGap = 28;
  const footerColumnWidth = (width - footerSideMargin * 2 - footerColumnGap * 2) / 3;
  const leftColumnCenter = footerSideMargin + footerColumnWidth / 2;
  const centerColumnCenter = width / 2;
  const rightColumnCenter = width - footerSideMargin - footerColumnWidth / 2;
  const leftDividerX = footerSideMargin + footerColumnWidth + footerColumnGap / 2;
  const rightDividerX = width - leftDividerX;
  page.drawLine({ start: { x: leftDividerX, y: 62 }, end: { x: leftDividerX, y: 158 }, thickness: 0.45, color: softGold });
  page.drawLine({ start: { x: rightDividerX, y: 62 }, end: { x: rightDividerX, y: 158 }, thickness: 0.45, color: softGold });

  const footerTextWidth = footerColumnWidth - 20;
  page.drawText('CERTIFICATE ID', { x: centeredAtX('CERTIFICATE ID', bold, 7.5, leftColumnCenter), y: 143, size: 7.5, font: bold, color: gold });
  const certificateIdSize = fittedSize(input.certificateId, bold, 11, 8.5, footerTextWidth);
  page.drawText(input.certificateId, { x: centeredAtX(input.certificateId, bold, certificateIdSize, leftColumnCenter), y: 124, size: certificateIdSize, font: bold, color: navy });
  page.drawText('COMPLETION DATE', { x: centeredAtX('COMPLETION DATE', bold, 7.5, leftColumnCenter), y: 96, size: 7.5, font: bold, color: gold });
  const dateSize = fittedSize(formattedDate, regular, 10.5, 8.5, footerTextWidth);
  page.drawText(formattedDate, { x: centeredAtX(formattedDate, regular, dateSize, leftColumnCenter), y: 78, size: dateSize, font: regular, color: slate });

  const signature = await document.embedPng(input.signature);
  const signatureScale = Math.min(168 / signature.width, 52 / signature.height);
  const signatureWidth = signature.width * signatureScale;
  const signatureHeight = signature.height * signatureScale;
  page.drawImage(signature, { x: centerColumnCenter - signatureWidth / 2, y: 112, width: signatureWidth, height: signatureHeight });
  page.drawLine({ start: { x: centerColumnCenter - 98, y: 107 }, end: { x: centerColumnCenter + 98, y: 107 }, thickness: 0.75, color: slate });
  const signatorySize = fittedSize(input.signatoryName, bold, 11.5, 7.5, footerTextWidth);
  page.drawText(input.signatoryName, { x: centeredAtX(input.signatoryName, bold, signatorySize, centerColumnCenter), y: 88, size: signatorySize, font: bold, color: navy });
  const designationSize = fittedSize(displayedDesignation, regular, 9.5, 7, footerTextWidth);
  page.drawText(displayedDesignation, { x: centeredAtX(displayedDesignation, regular, designationSize, centerColumnCenter), y: 70, size: designationSize, font: regular, color: slate });

  const qrDataUrl = await QRCode.toDataURL(input.verificationUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
    color: { dark: '#091A34', light: '#FFFFFF' },
  });
  const qr = await document.embedPng(await pngFromDataUrl(qrDataUrl));
  const qrSize = 76;
  const qrX = rightColumnCenter - qrSize / 2;
  page.drawRectangle({ x: qrX - 4, y: 76, width: qrSize + 8, height: qrSize + 8, color: rgb(1, 1, 1), borderColor: softGold, borderWidth: 0.65 });
  page.drawImage(qr, { x: qrX, y: 80, width: qrSize, height: qrSize });
  const verifyLabel = 'SCAN TO VERIFY';
  page.drawText(verifyLabel, { x: centeredAtX(verifyLabel, bold, 7.5, rightColumnCenter), y: 62, size: 7.5, font: bold, color: gold });
  return await document.save();
}

if (import.meta.main) Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const adminKey = adminKeyFromEnvironment();
  if (!supabaseUrl || !adminKey) return json(500, { error: 'Certificate issuance is not configured on the server.' });
  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json(401, { error: 'Sign in as an administrator to continue.' });

  const service = createClient(supabaseUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const { data: userResult, error: userError } = await service.auth.getUser(authorization.slice('Bearer '.length));
  if (userError || !userResult.user) return json(401, { error: 'Your session is invalid or has expired. Sign in again.' });
  const { data: adminProfile, error: profileError } = await service.from('profiles').select('role').eq('id', userResult.user.id).maybeSingle();
  if (profileError) return json(500, { error: 'Unable to verify administrator access.' });
  if (adminProfile?.role !== 'admin') return json(403, { error: 'Only administrators can issue certificates.' });

  let input: IssueRequest;
  try { input = await request.json(); }
  catch { return json(400, { error: 'The issuance request is not valid JSON.' }); }
  const certificateRecordId = typeof input.certificateId === 'string' ? input.certificateId.trim() : '';
  if (!uuidPattern.test(certificateRecordId)) return json(400, { error: 'Select a valid pending certificate.' });

  const { data: certificate, error: certificateError } = await service.from('certificates')
    .select('id, student_id, certificate_id, program_name, issue_date, status')
    .eq('id', certificateRecordId).maybeSingle();
  if (certificateError) return json(500, { error: 'Unable to load the certificate record.' });
  if (!certificate) return json(404, { error: 'The certificate record no longer exists.' });
  if (certificate.status !== 'pending') return json(409, { error: 'Only a pending certificate can be issued.' });
  const certificateId = certificate.certificate_id?.trim().toUpperCase() ?? '';
  const programName = certificate.program_name?.trim() ?? '';
  if (!/^[A-Z0-9][A-Z0-9/_-]{2,79}$/.test(certificateId)) return json(409, { error: 'Add a valid, unique Certificate ID before issuing.' });
  if (programName.length < 2 || programName.length > 180) return json(409, { error: 'Add a valid program name before issuing.' });
  let verificationUrl: string;
  try { verificationUrl = getVerificationUrl(input.verificationOrigin ?? request.headers.get('Origin'), certificateId); }
  catch (error) { return json(409, { error: error instanceof Error ? error.message : 'Certificate verification URL is invalid.' }); }

  const { data: student, error: studentError } = await service.from('students').select('profile_id, certificate_eligible').eq('id', certificate.student_id).maybeSingle();
  if (studentError || !student) return json(409, { error: 'The certificate student record is unavailable.' });
  if (!student.certificate_eligible) return json(409, { error: 'Mark the student as certificate eligible before issuing.' });
  const { data: profile, error: studentProfileError } = await service.from('profiles').select('full_name').eq('id', student.profile_id).maybeSingle();
  const studentName = profile?.full_name?.trim() ?? '';
  if (studentProfileError || studentName.length < 2) return json(409, { error: 'The student needs a valid full name before a certificate can be issued.' });

  const { data: settings, error: settingsError } = await service.from('certificate_settings')
    .select('authorized_signatory_name, designation, signature_path').eq('id', true).maybeSingle();
  if (settingsError) return json(500, { error: 'Unable to load certificate settings.' });
  if (!settings) return json(409, { error: 'Configure Certificate Settings before issuing a certificate.' });
  const signatoryName = settings.authorized_signatory_name?.trim() ?? '';
  const designation = settings.designation?.trim() ?? '';
  if (signatoryName.length < 2 || signatoryName.length > 120 || designation.length < 2 || designation.length > 120) {
    return json(409, { error: 'Certificate Settings contain an invalid signatory name or designation.' });
  }

  const signatureResult = await service.storage.from('certificate-signatures').download(settings.signature_path);
  if (signatureResult.error || !signatureResult.data) return json(409, { error: 'The configured private signature PNG is unavailable. Upload it again in Certificate Settings.' });
  const signature = new Uint8Array(await signatureResult.data.arrayBuffer());
  if (signature.length > 2 * 1024 * 1024 || !pngHeader.every((value, index) => signature[index] === value)) return json(409, { error: 'The configured signature is not a valid PNG under 2 MB.' });
  const hashBuffer = await crypto.subtle.digest('SHA-256', signature);
  const signatureSha256 = Array.from(new Uint8Array(hashBuffer)).map((value) => value.toString(16).padStart(2, '0')).join('');
  const issueDate = certificate.issue_date ?? new Date().toISOString().slice(0, 10);

  let pdf: Uint8Array;
  try {
    pdf = await renderCertificate({
      studentName,
      programName,
      certificateId,
      issueDate,
      signatoryName,
      designation,
      signature,
      verificationUrl,
    });
  } catch (error) {
    console.error('Certificate rendering failed:', error instanceof Error ? error.message : 'Unknown rendering error');
    return json(422, { error: error instanceof Error ? error.message : 'The certificate PDF could not be rendered.' });
  }

  const versionId = crypto.randomUUID();
  const signatureSnapshotPath = `snapshots/${certificate.id}/${versionId}.png`;
  const certificatePath = `${certificate.student_id}/${certificate.id}-${versionId}.pdf`;
  const signatureUpload = await service.storage.from('certificate-signatures').upload(signatureSnapshotPath, signature, { contentType: 'image/png', cacheControl: '31536000', upsert: false });
  if (signatureUpload.error) return json(500, { error: 'Unable to preserve the certificate signature snapshot.' });
  const pdfUpload = await service.storage.from('certificates').upload(certificatePath, pdf, { contentType: 'application/pdf', cacheControl: '3600', upsert: false });
  if (pdfUpload.error) {
    await service.storage.from('certificate-signatures').remove([signatureSnapshotPath]);
    return json(500, { error: 'Unable to store the rendered certificate PDF.' });
  }

  const { data: issued, error: issueError } = await service.from('certificates').update({
    issue_date: issueDate,
    status: 'issued',
    student_name_snapshot: studentName,
    signatory_name_snapshot: signatoryName,
    signatory_designation_snapshot: designation,
    signature_path_snapshot: signatureSnapshotPath,
    signature_sha256_snapshot: signatureSha256,
    file_path: certificatePath,
    file_url: null,
    issued_at: new Date().toISOString(),
    issued_by: userResult.user.id,
  }).eq('id', certificate.id).eq('status', 'pending').select('id, certificate_id, status, issue_date').maybeSingle();

  if (issueError || !issued) {
    await Promise.all([
      service.storage.from('certificate-signatures').remove([signatureSnapshotPath]),
      service.storage.from('certificates').remove([certificatePath]),
    ]);
    if (issueError) console.error('Certificate snapshot commit failed:', issueError.message);
    return json(409, { error: 'The certificate changed while it was being issued. No rendered files were retained.' });
  }
  return json(200, { certificate: issued });
});
