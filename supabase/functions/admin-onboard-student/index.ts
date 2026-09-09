import { createClient } from 'npm:@supabase/supabase-js@2';

type ProvisioningMode = 'invite' | 'temporary_password';

interface OnboardingRequest {
  fullName?: unknown;
  email?: unknown;
  applicationId?: unknown;
  programId?: unknown;
  batchId?: unknown;
  studentStatus?: unknown;
  enrollmentStatus?: unknown;
  enrollmentId?: unknown;
  provisioningMode?: unknown;
  temporaryPassword?: unknown;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const errors: Record<string, string> = {
  INVALID_FULL_NAME: 'Enter the student\'s full name (2 to 120 characters).',
  INVALID_EMAIL: 'Enter a valid email address.',
  INVALID_APPLICATION_ID: 'Application ID must be 3 to 64 characters and use only letters, numbers, dashes, underscores, or slashes.',
  INVALID_ENROLLMENT_ID: 'Enrollment ID must be 3 to 64 characters and use only letters, numbers, dashes, underscores, or slashes.',
  PROGRAM_AND_BATCH_REQUIRED: 'Select both a program and a batch.',
  PROGRAM_BATCH_MISMATCH: 'The selected batch is not available for the selected program.',
  INVALID_STUDENT_STATUS: 'Select a valid student status.',
  INVALID_ENROLLMENT_STATUS: 'Select a valid enrollment status.',
  APPLICATION_ID_EXISTS: 'A student with this Application ID already exists.',
  ENROLLMENT_ID_EXISTS: 'A student with this Enrollment ID already exists.',
  DUPLICATE_ENROLLMENT: 'This student is already enrolled in the selected program and batch.',
  STUDENT_ALREADY_EXISTS: 'A student record already exists for this email. Edit the existing student instead.',
  EMAIL_ALREADY_EXISTS: 'A user with this email address already exists.',
  ADMIN_ACCOUNT_EXISTS: 'This email belongs to an administrator and cannot be enrolled as a student.',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function rawText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function adminKeyFromEnvironment() {
  const secretKeyMap = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeyMap) {
    try {
      const keys = JSON.parse(secretKeyMap) as Record<string, unknown>;
      if (typeof keys.default === 'string' && keys.default) return keys.default;
      const firstKey = Object.values(keys).find((value): value is string => typeof value === 'string' && Boolean(value));
      if (firstKey) return firstKey;
    } catch {
      console.error('SUPABASE_SECRET_KEYS is not valid JSON.');
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

function friendlyError(value: string) {
  if (errors[value]) return errors[value];
  const normalized = value.toLowerCase();
  if (normalized.includes('already') || normalized.includes('registered') || normalized.includes('duplicate')) {
    return 'A user with this email address already exists.';
  }
  if (normalized.includes('email')) return 'Enter a valid email address.';
  return 'The student account could not be created. No partial student record was kept.';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const adminKey = adminKeyFromEnvironment();
  if (!supabaseUrl || !adminKey) {
    console.error('Missing required Supabase server environment variables.');
    return json(500, { error: 'Student onboarding is not configured on the server.' });
  }

  const authorization = request.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json(401, { error: 'Sign in as an administrator to continue.' });

  const service = createClient(supabaseUrl, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const accessToken = authorization.slice('Bearer '.length);
  const { data: userResult, error: userError } = await service.auth.getUser(accessToken);
  if (userError || !userResult.user) return json(401, { error: 'Your session is invalid or has expired. Sign in again.' });

  const { data: adminProfile, error: profileError } = await service
    .from('profiles')
    .select('role')
    .eq('id', userResult.user.id)
    .maybeSingle();
  if (profileError) {
    console.error('Unable to verify administrator role:', profileError.message);
    return json(500, { error: 'Unable to verify administrator access.' });
  }
  if (adminProfile?.role !== 'admin') return json(403, { error: 'Only administrators can create student accounts.' });

  let input: OnboardingRequest;
  try {
    input = await request.json();
  } catch {
    return json(400, { error: 'The onboarding request is not valid JSON.' });
  }

  const fullName = text(input.fullName);
  const email = text(input.email).toLowerCase();
  const applicationId = text(input.applicationId);
  const programId = text(input.programId);
  const batchId = text(input.batchId);
  const studentStatus = text(input.studentStatus) || 'active';
  const enrollmentStatus = text(input.enrollmentStatus) || 'active';
  const enrollmentId = text(input.enrollmentId) || null;
  const provisioningMode: ProvisioningMode = input.provisioningMode === 'temporary_password'
    ? 'temporary_password'
    : 'invite';
  const temporaryPassword = rawText(input.temporaryPassword);

  if (fullName.length < 2 || fullName.length > 120) return json(400, { error: errors.INVALID_FULL_NAME });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json(400, { error: errors.INVALID_EMAIL });
  if (!/^[A-Za-z0-9][A-Za-z0-9/_-]{2,63}$/.test(applicationId)) return json(400, { error: errors.INVALID_APPLICATION_ID });
  if (enrollmentId && !/^[A-Za-z0-9][A-Za-z0-9/_-]{2,63}$/.test(enrollmentId)) return json(400, { error: errors.INVALID_ENROLLMENT_ID });
  if (!programId || !batchId) return json(400, { error: errors.PROGRAM_AND_BATCH_REQUIRED });
  if (!['active', 'inactive', 'paused', 'completed', 'withdrawn'].includes(studentStatus)) return json(400, { error: errors.INVALID_STUDENT_STATUS });
  if (!['active', 'paused', 'completed', 'withdrawn'].includes(enrollmentStatus)) return json(400, { error: errors.INVALID_ENROLLMENT_STATUS });
  if (provisioningMode === 'temporary_password' && temporaryPassword.length < 10) {
    return json(400, { error: 'Temporary password must contain at least 10 characters.' });
  }

  const { error: preflightError } = await service.rpc('validate_student_onboarding', {
    p_application_id: applicationId,
    p_enrollment_id: enrollmentId,
    p_program_id: programId,
    p_batch_id: batchId,
  });
  if (preflightError) {
    console.error('Onboarding preflight failed:', preflightError.message);
    return json(409, { error: friendlyError(preflightError.message) });
  }

  const { data: existingRows, error: lookupError } = await service.rpc('lookup_student_onboarding_account', {
    p_email: email,
  });
  if (lookupError) {
    console.error('Unable to check for an existing Auth account:', lookupError.message);
    return json(500, { error: 'Unable to check the student account. Apply the latest onboarding migration and try again.' });
  }

  const existingAccount = existingRows?.[0] as {
    user_id: string;
    email_confirmed: boolean;
    profile_role: string | null;
    student_exists: boolean;
  } | undefined;
  if (existingAccount?.profile_role === 'admin') return json(409, { error: errors.ADMIN_ACCOUNT_EXISTS });
  if (existingAccount?.student_exists) return json(409, { error: errors.STUDENT_ALREADY_EXISTS });

  const metadata = { full_name: fullName, account_type: 'student' };
  const inviteRedirectTo = Deno.env.get('STUDENT_INVITE_REDIRECT_URL')?.trim();
  if (provisioningMode === 'invite' && !inviteRedirectTo) {
    return json(500, { error: 'Secure invitations are not configured. Set STUDENT_INVITE_REDIRECT_URL on the Edge Function.' });
  }
  let authUserId = existingAccount?.user_id;
  let createdAuthUser = false;
  let accountStatus = provisioningMode === 'invite'
    ? 'Invitation sent'
    : 'Active — temporary password set';
  if (!authUserId) {
    const createResult = provisioningMode === 'invite'
      ? await service.auth.admin.inviteUserByEmail(email, {
          data: metadata,
          redirectTo: inviteRedirectTo,
        })
      : await service.auth.admin.createUser({
          email,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: metadata,
        });

    if (createResult.error || !createResult.data.user) {
      const detail = createResult.error?.message ?? 'Auth user creation failed';
      console.error('Auth provisioning failed:', detail);
      return json(409, { error: friendlyError(detail) });
    }
    authUserId = createResult.data.user.id;
    createdAuthUser = true;
  } else if (provisioningMode === 'temporary_password') {
    // The admin explicitly selected password replacement. Replacing the
    // password before confirming an older unverified account prevents whoever
    // created that account from retaining usable credentials.
    const { error: passwordError } = await service.auth.admin.updateUserById(authUserId, {
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (passwordError) {
      console.error('Unable to prepare the existing account with a temporary password:', passwordError.message);
      return json(409, { error: 'The existing account was found, but its temporary password could not be set. No student records were created.' });
    }
    accountStatus = 'Existing account linked — temporary password set';
  } else {
    // Never auto-confirm an unverified existing account while retaining its old
    // password. Confirmed accounts receive recovery; unconfirmed accounts
    // receive a fresh confirmation link. Both paths prove email ownership.
    const { error: metadataError } = await service.auth.admin.updateUserById(authUserId, {
      user_metadata: metadata,
    });
    if (metadataError) {
      console.error('Unable to prepare existing account metadata:', metadataError.message);
      return json(409, { error: 'The existing account was found, but account setup could not begin. No student records were created.' });
    }
    const { error: setupEmailError } = existingAccount.email_confirmed
      ? await service.auth.resetPasswordForEmail(email, { redirectTo: inviteRedirectTo })
      : await service.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: inviteRedirectTo },
        });
    if (setupEmailError) {
      console.error('Unable to send existing-account setup email:', setupEmailError.message);
      return json(502, { error: 'The existing account was found, but the secure setup email could not be sent. No student records were created. Try again shortly.' });
    }
    accountStatus = 'Existing account linked — password setup email sent';
  }

  const { data: onboardingRows, error: onboardingError } = await service.rpc('onboard_student_records', {
    p_user_id: authUserId,
    p_full_name: fullName,
    p_email: email,
    p_application_id: applicationId,
    p_program_id: programId,
    p_batch_id: batchId,
    p_student_status: studentStatus,
    p_enrollment_status: enrollmentStatus,
    p_enrollment_id: enrollmentId,
  });

  if (onboardingError || !onboardingRows?.[0]) {
    const rollback = createdAuthUser
      ? await service.auth.admin.deleteUser(authUserId)
      : { error: null };
    if (rollback.error) console.error('Auth rollback failed for newly created user', authUserId, rollback.error.message);
    const code = onboardingError?.message ?? 'DATABASE_ONBOARDING_FAILED';
    console.error('Database onboarding failed:', code);
    return json(rollback.error ? 500 : 409, {
      error: rollback.error
        ? 'Onboarding failed and automatic account cleanup needs administrator attention.'
        : existingAccount
          ? `Account access was prepared, but ${friendlyError(code)} No student or enrollment record was created; retry the enrollment.`
          : friendlyError(code),
    });
  }

  const result = onboardingRows[0] as {
    enrollment_id: string;
    program_name: string;
    batch_name: string;
  };
  return json(201, {
    student: {
      fullName,
      email,
      applicationId,
      enrollmentId: result.enrollment_id,
      program: result.program_name,
      batch: result.batch_name,
      accountStatus,
    },
  });
});
