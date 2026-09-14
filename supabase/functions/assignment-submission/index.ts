import { createClient } from '@supabase/supabase-js';

type SubmissionType = 'link_only' | 'file_only' | 'link_or_file' | 'no_submission';

interface AssignmentRecord {
  id: string;
  program_id: string;
  batch_id: string | null;
  published: boolean;
  submission_type: SubmissionType;
  max_file_size_mb: number;
  allow_resubmission: boolean;
}

interface ExistingSubmission {
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  file_mime_type: string | null;
  status: string;
  submitted_at: string | null;
}

interface ValidatedFile {
  bytes: Uint8Array;
  extension: string;
  mimeType: string;
  displayName: string;
}

const bucket = 'assignment-submissions';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const fileTypes: Record<string, { acceptedMimeTypes: string[]; storedMimeType: string; container?: 'docx' | 'pptx' | 'xlsx' | 'zip' }> = {
  pdf: { acceptedMimeTypes: ['application/pdf'], storedMimeType: 'application/pdf' },
  docx: {
    acceptedMimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    storedMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    container: 'docx',
  },
  pptx: {
    acceptedMimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    storedMimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    container: 'pptx',
  },
  xlsx: {
    acceptedMimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    storedMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    container: 'xlsx',
  },
  zip: {
    acceptedMimeTypes: ['application/zip', 'application/x-zip-compressed', 'application/x-zip'],
    storedMimeType: 'application/zip',
    container: 'zip',
  },
  png: { acceptedMimeTypes: ['image/png'], storedMimeType: 'image/png' },
  jpg: { acceptedMimeTypes: ['image/jpeg'], storedMimeType: 'image/jpeg' },
  jpeg: { acceptedMimeTypes: ['image/jpeg'], storedMimeType: 'image/jpeg' },
};

const blockedArchiveExtensions = new Set([
  'apk', 'app', 'bin', 'cmd', 'com', 'cpl', 'dll', 'dmg', 'exe', 'hta', 'iso', 'jar',
  'lnk', 'msi', 'msp', 'pif', 'reg', 'scr', 'sys', 'url', 'vb', 'vbe', 'vbs', 'wsf', 'wsh',
]);

const databaseErrors: Array<[string, string]> = [
  ['RESUBMISSION_NOT_ALLOWED', 'This assignment has already been submitted and does not allow resubmission.'],
  ['ASSIGNMENT_NOT_AVAILABLE', 'This assignment is not available for your active enrollment.'],
  ['SUBMISSION_NOT_REQUIRED', 'This assignment does not require a submission.'],
  ['INVALID_SUBMISSION_URL', 'Enter a valid http:// or https:// submission URL.'],
  ['SUBMISSION_NOTES_TOO_LONG', 'Submission notes must be 4,000 characters or fewer.'],
  ['LINK_SUBMISSION_REQUIRED', 'This assignment requires a valid submission URL.'],
  ['FILE_SUBMISSION_REQUIRED', 'This assignment requires an accepted file.'],
  ['LINK_OR_FILE_REQUIRED', 'Add a valid submission URL or an accepted file.'],
  ['FILE_TOO_LARGE', 'The selected file exceeds this assignment\'s upload limit.'],
  ['INVALID_FILE_TYPE', 'The selected file type is not allowed.'],
  ['FILE_STORAGE_METADATA_MISMATCH', 'The uploaded file could not be verified. Please select it again.'],
];

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

function publicKeyFromEnvironment() {
  return Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
}

function friendlyDatabaseError(message: string) {
  const match = databaseErrors.find(([code]) => message.includes(code));
  return match?.[1] ?? 'The assignment submission could not be saved.';
}

function validUrl(value: string) {
  if (!value || value.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function sanitizeDisplayName(originalName: string, extension: string) {
  const basename = originalName.normalize('NFKC').split(/[\\/]/).pop() ?? '';
  const lastDot = basename.lastIndexOf('.');
  const stem = (lastDot > 0 ? basename.slice(0, lastDot) : basename)
    .replace(/\./g, '-')
    .replace(/[^\p{L}\p{N} _()-]+/gu, '-')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160) || 'submission';
  return `${stem}.${extension}`;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function findZipDirectory(bytes: Uint8Array) {
  const minimumOffset = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x05 && bytes[offset + 3] === 0x06) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.length - offset);
      const entries = view.getUint16(10, true);
      const size = view.getUint32(12, true);
      const directoryOffset = view.getUint32(16, true);
      if (entries === 0xffff || size === 0xffffffff || directoryOffset === 0xffffffff) throw new Error('ZIP64 archives are not accepted.');
      if (directoryOffset + size > offset) throw new Error('The ZIP directory is invalid.');
      return { entries, offset: directoryOffset, size };
    }
  }
  throw new Error('The ZIP directory is missing or invalid.');
}

function inspectZip(bytes: Uint8Array, container: 'docx' | 'pptx' | 'xlsx' | 'zip') {
  if (!startsWith(bytes, [0x50, 0x4b])) throw new Error('The file is not a valid ZIP-based document.');
  const directory = findZipDirectory(bytes);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const names: string[] = [];
  let offset = directory.offset;
  let totalUncompressedSize = 0;

  for (let index = 0; index < directory.entries; index += 1) {
    if (offset + 46 > bytes.length || !startsWith(bytes.subarray(offset), [0x50, 0x4b, 0x01, 0x02])) {
      throw new Error('The ZIP entry directory is invalid.');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.length - offset);
    const flags = view.getUint16(8, true);
    const uncompressedSize = view.getUint32(24, true);
    const nameLength = view.getUint16(28, true);
    const extraLength = view.getUint16(30, true);
    const commentLength = view.getUint16(32, true);
    if ((flags & 0x1) !== 0) throw new Error('Password-protected archives are not accepted.');
    if (!nameLength || offset + 46 + nameLength + extraLength + commentLength > bytes.length) throw new Error('The ZIP entry name is invalid.');

    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)).replace(/\\/g, '/');
    const segments = name.split('/');
    if (name.startsWith('/') || segments.includes('..') || name.includes('\u0000')) throw new Error('The archive contains an unsafe path.');
    const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
    if (extension && blockedArchiveExtensions.has(extension)) throw new Error('The archive contains an executable or unsafe system file.');

    totalUncompressedSize += uncompressedSize;
    if (uncompressedSize > 100 * 1024 * 1024 || totalUncompressedSize > 250 * 1024 * 1024) {
      throw new Error('The archive expands beyond the safe processing limit.');
    }
    names.push(name);
    offset += 46 + nameLength + extraLength + commentLength;
  }

  if (offset > directory.offset + directory.size) throw new Error('The ZIP directory size is invalid.');
  if (container !== 'zip') {
    const requiredPrefix = container === 'docx' ? 'word/' : container === 'pptx' ? 'ppt/' : 'xl/';
    if (!names.includes('[Content_Types].xml') || !names.some((name) => name.startsWith(requiredPrefix))) {
      throw new Error(`The uploaded file is not a valid ${container.toUpperCase()} document.`);
    }
  }
}

async function validateFile(file: File, maximumBytes: number): Promise<ValidatedFile> {
  if (!file.size) throw new Error('The selected file is empty.');
  if (file.size > maximumBytes) throw new Error(`The selected file must be ${Math.floor(maximumBytes / 1024 / 1024)} MB or smaller.`);

  const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const type = fileTypes[extension];
  if (!type || !type.acceptedMimeTypes.includes(file.type.toLowerCase())) {
    throw new Error('Select a PDF, DOCX, PPTX, XLSX, ZIP, PNG, JPG, or JPEG file with a matching file type.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (extension === 'pdf' && !startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) throw new Error('The selected file is not a valid PDF.');
  if (extension === 'png' && !startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) throw new Error('The selected file is not a valid PNG image.');
  if ((extension === 'jpg' || extension === 'jpeg') && !startsWith(bytes, [0xff, 0xd8, 0xff])) throw new Error('The selected file is not a valid JPEG image.');
  if (type.container) inspectZip(bytes, type.container);

  return {
    bytes,
    extension,
    mimeType: type.storedMimeType,
    displayName: sanitizeDisplayName(file.name, extension),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const adminKey = adminKeyFromEnvironment();
  const publicKey = publicKeyFromEnvironment();
  if (!supabaseUrl || !adminKey || !publicKey) {
    console.error('Missing required Supabase server environment variables.');
    return json(500, { error: 'Assignment file submission is not configured on the server.' });
  }

  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json(401, { error: 'Sign in as a student to submit this assignment.' });

  const service = createClient(supabaseUrl, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const accessToken = authorization.slice('Bearer '.length);
  const { data: userResult, error: userError } = await service.auth.getUser(accessToken);
  if (userError || !userResult.user) return json(401, { error: 'Your session is invalid or has expired. Sign in again.' });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: 'The submission request is not valid form data.' });
  }

  const assignmentId = String(form.get('assignment_id') ?? '').trim();
  const submissionUrl = String(form.get('submission_url') ?? '').trim();
  const notes = String(form.get('notes') ?? '').trim();
  const fileValue = form.get('file');
  const uploadedFile = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  if (!uuidPattern.test(assignmentId)) return json(400, { error: 'The assignment reference is invalid.' });
  if (notes.length > 4000) return json(400, { error: 'Submission notes must be 4,000 characters or fewer.' });

  const { data: student, error: studentError } = await service
    .from('students')
    .select('id, status')
    .eq('profile_id', userResult.user.id)
    .maybeSingle();
  if (studentError) {
    console.error('Unable to load the submitting student:', studentError.message);
    return json(500, { error: 'Unable to verify your student record.' });
  }
  if (!student || student.status !== 'active') return json(403, { error: 'An active student account is required to submit assignments.' });

  const { data: assignmentData, error: assignmentError } = await service
    .from('assignments')
    .select('id, program_id, batch_id, published, submission_type, max_file_size_mb, allow_resubmission')
    .eq('id', assignmentId)
    .maybeSingle();
  if (assignmentError) {
    console.error('Unable to load assignment configuration:', assignmentError.message);
    return json(500, { error: 'Unable to load this assignment\'s submission settings.' });
  }
  const assignment = assignmentData as AssignmentRecord | null;
  if (!assignment?.published) return json(404, { error: 'This assignment is not available.' });

  let enrollmentQuery = service
    .from('enrollments')
    .select('id')
    .eq('student_id', student.id)
    .eq('program_id', assignment.program_id)
    .eq('status', 'active');
  if (assignment.batch_id) enrollmentQuery = enrollmentQuery.eq('batch_id', assignment.batch_id);
  const { data: enrollment, error: enrollmentError } = await enrollmentQuery.limit(1).maybeSingle();
  if (enrollmentError) {
    console.error('Unable to verify assignment enrollment:', enrollmentError.message);
    return json(500, { error: 'Unable to verify access to this assignment.' });
  }
  if (!enrollment) return json(403, { error: 'This assignment is not available for your active enrollment.' });
  if (assignment.submission_type === 'no_submission') return json(400, { error: 'This assignment does not require a submission.' });

  const { data: existingData, error: existingError } = await service
    .from('assignment_submissions')
    .select('file_path, file_name, file_size, file_mime_type, status, submitted_at')
    .eq('student_id', student.id)
    .eq('assignment_id', assignmentId)
    .maybeSingle();
  if (existingError) {
    console.error('Unable to inspect existing assignment submission:', existingError.message);
    return json(500, { error: 'Unable to verify the current submission.' });
  }
  const existing = existingData as ExistingSubmission | null;
  const alreadySubmitted = Boolean(existing && (existing.submitted_at || ['submitted', 'reviewed', 'approved', 'needs_revision'].includes(existing.status)));
  if (alreadySubmitted && !assignment.allow_resubmission) {
    return json(409, { error: 'This assignment has already been submitted and does not allow resubmission.' });
  }

  if (assignment.submission_type === 'link_only' && uploadedFile) return json(400, { error: 'This assignment accepts a link only.' });
  if (assignment.submission_type === 'file_only' && submissionUrl) return json(400, { error: 'This assignment accepts a file only.' });
  if (submissionUrl && !validUrl(submissionUrl)) return json(400, { error: 'Enter a valid http:// or https:// submission URL.' });

  let newFile: ValidatedFile | null = null;
  if (uploadedFile) {
    try {
      newFile = await validateFile(uploadedFile, assignment.max_file_size_mb * 1024 * 1024);
    } catch (value) {
      return json(400, { error: value instanceof Error ? value.message : 'The selected file is not valid.' });
    }
  }

  let filePath = existing?.file_path ?? null;
  let fileName = existing?.file_name ?? null;
  let fileSize = existing?.file_size ?? null;
  let fileMimeType = existing?.file_mime_type ?? null;
  let uploadedPath: string | null = null;

  if (newFile) {
    uploadedPath = `${student.id}/${assignmentId}/${crypto.randomUUID()}.${newFile.extension}`;
    const upload = await service.storage.from(bucket).upload(uploadedPath, newFile.bytes, {
      contentType: newFile.mimeType,
      cacheControl: '3600',
      upsert: false,
    });
    if (upload.error) {
      console.error('Assignment submission upload failed:', upload.error.message);
      return json(500, { error: 'The file could not be uploaded. Please try again.' });
    }
    filePath = uploadedPath;
    fileName = newFile.displayName;
    fileSize = newFile.bytes.length;
    fileMimeType = newFile.mimeType;
  }

  const hasFile = Boolean(filePath && fileName && fileSize && fileMimeType);
  if (assignment.submission_type === 'link_only' && !submissionUrl) {
    return json(400, { error: 'This assignment requires a valid submission URL.' });
  }
  if (assignment.submission_type === 'file_only' && !hasFile) {
    return json(400, { error: 'This assignment requires an accepted file.' });
  }
  if (assignment.submission_type === 'link_or_file' && !submissionUrl && !hasFile) {
    return json(400, { error: 'Add a valid submission URL or an accepted file.' });
  }

  const userClient = createClient(supabaseUrl, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: savedRows, error: saveError } = await userClient.rpc('submit_assignment_submission', {
    p_assignment_id: assignmentId,
    p_submission_url: submissionUrl || null,
    p_file_path: filePath,
    p_file_name: fileName,
    p_file_size: fileSize,
    p_file_mime_type: fileMimeType,
    p_notes: notes || null,
  });

  if (saveError || !savedRows?.[0]) {
    if (uploadedPath) await service.storage.from(bucket).remove([uploadedPath]);
    const detail = saveError?.message ?? 'No submission record was returned.';
    console.error('Assignment submission record failed:', detail);
    const status = detail.includes('RESUBMISSION_NOT_ALLOWED') ? 409 : detail.includes('42501') ? 403 : 400;
    return json(status, { error: friendlyDatabaseError(detail) });
  }

  const replacedPath = (savedRows[0] as { replaced_file_path?: string | null }).replaced_file_path;
  if (replacedPath && replacedPath !== uploadedPath) {
    const cleanup = await service.storage.from(bucket).remove([replacedPath]);
    if (cleanup.error) console.error('Unable to remove replaced assignment file:', cleanup.error.message);
  }

  return json(alreadySubmitted ? 200 : 201, {
    submission: { id: (savedRows[0] as { submission_id: string }).submission_id },
  });
});
