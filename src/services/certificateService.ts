import { supabase } from '../lib/supabase';
import type { Certificate } from '../types';

const signatureBucket = 'certificate-signatures';
const certificateBucket = 'certificates';
const maxSignatureBytes = 2 * 1024 * 1024;
const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];

export interface CertificateSettings {
  id: boolean;
  authorized_signatory_name: string;
  designation: string;
  signature_path: string;
  updated_at: string;
}

export interface CertificateStudentOption {
  id: string;
  enrollmentId: string;
  fullName: string;
  programNames: string[];
}

export interface SavedPendingCertificate { id: string; certificate_id: string }

export interface AdminCertificate extends Certificate {
  student_id: string;
  student_name_snapshot: string | null;
  signatory_name_snapshot: string | null;
  signatory_designation_snapshot: string | null;
  issued_at: string | null;
  student?: { enrollment_id: string | null; profile?: { full_name: string | null } | null } | null;
}

function checked(error: { message: string } | null, fallback: string) {
  if (!error) return;
  const normalized = error.message.toLowerCase();
  if (normalized.includes('certificates_certificate_id_key')) throw new Error('That Certificate ID is already in use.');
  if (normalized.includes('certificates_certificate_id_ci_key')) throw new Error('That Certificate ID is already in use.');
  if (normalized.includes('admin_required')) throw new Error('Your administrator session is not authorized for this action.');
  if (normalized.includes('certificate_snapshot_is_immutable')) throw new Error('An issued certificate snapshot cannot be changed.');
  if (normalized.includes('only_pending_certificates_can_be_deleted')) throw new Error('Only pending certificates can be deleted.');
  if (normalized.includes('row-level security') || normalized.includes('permission denied')) throw new Error('Your administrator session is not authorized for this action.');
  throw new Error(error.message || fallback);
}

export async function getCertificateSettings(): Promise<CertificateSettings | null> {
  const { data, error } = await supabase
    .from('certificate_settings')
    .select('id, authorized_signatory_name, designation, signature_path, updated_at')
    .eq('id', true)
    .maybeSingle();
  checked(error, 'Unable to load certificate settings.');
  return data as CertificateSettings | null;
}

export async function getPrivateSignaturePreview(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(signatureBucket).download(path);
  checked(error, 'Unable to load the private signature preview.');
  if (!data) throw new Error('The private signature file was not found.');
  return data;
}

export async function saveCertificateSettings(input: {
  authorizedSignatoryName: string;
  designation: string;
  signatureFile: File | null;
  existingSignaturePath: string | null;
  updatedBy: string;
}) {
  const authorizedSignatoryName = input.authorizedSignatoryName.trim();
  const designation = input.designation.trim();
  if (authorizedSignatoryName.length < 2 || authorizedSignatoryName.length > 120) throw new Error('Enter an authorized signatory name between 2 and 120 characters.');
  if (designation.length < 2 || designation.length > 120) throw new Error('Enter a designation between 2 and 120 characters.');

  let signaturePath = input.existingSignaturePath;
  let uploadedPath: string | null = null;
  if (input.signatureFile) {
    const bytes = new Uint8Array(await input.signatureFile.arrayBuffer());
    if (input.signatureFile.type !== 'image/png' || !pngHeader.every((value, index) => bytes[index] === value)) throw new Error('The signature must be a valid PNG image. A transparent background is recommended.');
    if (!bytes.length || bytes.length > maxSignatureBytes) throw new Error('The signature PNG must be smaller than 2 MB.');
    uploadedPath = `settings/${crypto.randomUUID()}.png`;
    const upload = await supabase.storage.from(signatureBucket).upload(uploadedPath, bytes, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: false,
    });
    checked(upload.error, 'Unable to upload the private signature PNG.');
    signaturePath = uploadedPath;
  }

  if (!signaturePath) throw new Error('Select a signature PNG before saving certificate settings.');
  const result = await supabase.from('certificate_settings').upsert({
    id: true,
    authorized_signatory_name: authorizedSignatoryName,
    designation,
    signature_path: signaturePath,
    updated_by: input.updatedBy,
  }).select('id').single();

  if (result.error) {
    if (uploadedPath) await supabase.storage.from(signatureBucket).remove([uploadedPath]);
    checked(result.error, 'Unable to save certificate settings.');
  }

  // Old settings objects remain private and immutable. Retaining them avoids a
  // race with an issuance already reading the previous settings version.
}

export async function listCertificateStudents(): Promise<CertificateStudentOption[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, enrollment_id, profile:profiles(full_name), enrollments(status, program:programs(title))')
    .order('created_at');
  checked(error, 'Unable to load students.');
  return ((data ?? []) as unknown as Array<{
    id: string;
    enrollment_id: string | null;
    profile: { full_name: string | null } | null;
    enrollments: Array<{ status: string; program: { title: string } | null }>;
  }>).map((student) => {
    return {
      id: student.id,
      enrollmentId: student.enrollment_id ?? 'Reference pending',
      fullName: student.profile?.full_name ?? 'Student',
      programNames: student.enrollments
        .map((item) => item.program?.title?.trim() ?? '')
        .filter((title, index, titles) => Boolean(title) && titles.indexOf(title) === index),
    };
  });
}

export async function listAdminCertificates(): Promise<AdminCertificate[]> {
  const { data, error } = await supabase
    .from('certificates')
    .select('id, student_id, certificate_id, program_name, issue_date, status, file_url, file_path, student_name_snapshot, signatory_name_snapshot, signatory_designation_snapshot, issued_at, student:students(enrollment_id, profile:profiles(full_name))')
    .order('created_at', { ascending: false });
  checked(error, 'Unable to load certificates.');
  return (data ?? []) as unknown as AdminCertificate[];
}

export async function savePendingCertificate(values: {
  studentId: string;
  programName: string;
  issueDate: string | null;
}, id?: string): Promise<SavedPendingCertificate> {
  const programName = values.programName.trim();
  if (!values.studentId) throw new Error('Select a student.');
  if (programName.length < 2 || programName.length > 180) throw new Error('Enter a valid program name.');
  if (!values.issueDate) throw new Error('Select the completion date.');

  if (!id) {
    const { data, error } = await supabase.rpc('create_pending_certificate', {
      p_student_id: values.studentId,
      p_program_name: programName,
      p_completion_date: values.issueDate,
    }).single();
    checked(error, 'Unable to create the certificate.');
    if (!data) throw new Error('The database did not return the generated Certificate ID.');
    return data as SavedPendingCertificate;
  }

  const { data, error } = await supabase.from('certificates')
    .update({ student_id: values.studentId, program_name: programName, issue_date: values.issueDate })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, certificate_id')
    .maybeSingle();
  checked(error, 'Unable to save the pending certificate.');
  if (!data) throw new Error('Only pending certificates can be edited. Reload and try again.');
  return data as SavedPendingCertificate;
}

export async function deletePendingCertificate(id: string) {
  const { error } = await supabase.from('certificates').delete().eq('id', id).eq('status', 'pending');
  checked(error, 'Unable to delete the pending certificate.');
}

export async function issueCertificate(id: string) {
  const { data, error } = await supabase.functions.invoke('issue-certificate', {
    body: { certificateId: id, verificationOrigin: window.location.origin },
  });
  if (error) {
    let message = error.message || 'Unable to issue the certificate.';
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as { error?: unknown };
        if (typeof body.error === 'string') message = body.error;
      } catch {
        // Keep the transport error when the function did not return JSON.
      }
    }
    throw new Error(message);
  }
  if (!(data as { certificate?: unknown } | null)?.certificate) throw new Error('The server did not return the issued certificate.');
}

export async function revokeCertificate(id: string) {
  const { data, error } = await supabase.from('certificates').update({ status: 'revoked' }).eq('id', id).eq('status', 'issued').select('id').maybeSingle();
  checked(error, 'Unable to revoke the certificate.');
  if (!data) throw new Error('Only an issued certificate can be revoked. Reload and try again.');
}

export async function createCertificateDownloadUrl(certificate: Pick<Certificate, 'certificate_id' | 'file_path' | 'file_url'>) {
  if (certificate.file_path) {
    const filename = `${certificate.certificate_id || 'certificate'}.pdf`.replace(/[^A-Za-z0-9._-]/g, '-');
    const { data, error } = await supabase.storage.from(certificateBucket).createSignedUrl(certificate.file_path, 60, { download: filename });
    checked(error, 'Unable to prepare the private certificate download.');
    if (!data?.signedUrl) throw new Error('The private certificate file is unavailable.');
    return data.signedUrl;
  }
  if (certificate.file_url) return certificate.file_url;
  throw new Error('No rendered certificate file is available.');
}
