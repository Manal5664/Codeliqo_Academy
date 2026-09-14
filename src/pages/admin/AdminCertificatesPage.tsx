import { type FormEvent, useMemo, useState } from 'react';
import { Ban, Download, FileCheck2, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { DataTable, type Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PortalPage } from '../../components/PortalPage';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { formatDate, titleCase } from '../../lib/utils';
import {
  createCertificateDownloadUrl,
  deletePendingCertificate,
  issueCertificate,
  listAdminCertificates,
  listCertificateStudents,
  revokeCertificate,
  savePendingCertificate,
  type AdminCertificate,
} from '../../services/certificateService';

const today = () => new Date().toISOString().slice(0, 10);

export function AdminCertificatesPage() {
  const records = useSupabaseQuery(listAdminCertificates, []);
  const students = useSupabaseQuery(listCertificateStudents, []);
  const [editing, setEditing] = useState<AdminCertificate | null>(null);
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [programName, setProgramName] = useState('');
  const [issueDate, setIssueDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const columns = useMemo<Column<AdminCertificate>[]>(() => [
    { key: 'certificate', header: 'Certificate', render: (row) => <div><p className="font-mono font-semibold text-navy-900">{row.certificate_id||'Pending ID'}</p><p className="mt-1 text-xs text-slate-500">{row.program_name}</p></div> },
    { key: 'student', header: 'Student', render: (row) => <div><p className="font-semibold">{row.student_name_snapshot||row.student?.profile?.full_name||'Student'}</p><p className="mt-1 text-xs text-slate-500">{row.student?.enrollment_id||'Reference pending'}</p></div> },
    { key: 'date', header: 'Completion date', render: (row) => formatDate(row.issue_date) },
    { key: 'signatory', header: 'Signatory snapshot', render: (row) => row.signatory_name_snapshot?<div><p>{row.signatory_name_snapshot}</p><p className="mt-1 text-xs text-slate-500">{row.signatory_designation_snapshot}</p></div>:<span className="text-slate-400">{row.status==='pending'?'Not issued':'Legacy record'}</span> },
    { key: 'status', header: 'Status', render: (row) => <span className={`badge ${row.status==='issued'?'bg-emerald-50 text-emerald-700':row.status==='revoked'?'bg-red-50 text-red-700':''}`}>{titleCase(row.status)}</span> },
    { key: 'actions', header: 'Actions', render: (row) => <div className="flex items-center gap-1">
      {row.status==='pending'&&<><button type="button" onClick={()=>startEdit(row)} className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 hover:text-brand-700" aria-label="Edit pending certificate" title="Edit"><Pencil size={16}/></button><button type="button" disabled={workingId===row.id} onClick={()=>void issue(row)} className="rounded-lg p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50" aria-label="Issue certificate" title="Issue certificate"><FileCheck2 size={17}/></button><button type="button" disabled={workingId===row.id} onClick={()=>void remove(row)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50" aria-label="Delete pending certificate" title="Delete pending"><Trash2 size={16}/></button></>}
      {(row.status==='issued'||row.status==='revoked')&&(row.file_path||row.file_url)&&<button type="button" disabled={workingId===row.id} onClick={()=>void download(row)} className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50" aria-label="Download rendered certificate" title="Download PDF"><Download size={16}/></button>}
      {row.status==='issued'&&<button type="button" disabled={workingId===row.id} onClick={()=>void revoke(row)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50" aria-label="Revoke certificate" title="Revoke certificate"><Ban size={16}/></button>}
    </div> },
  ], [workingId]);

  const startAdd = () => {
    setEditing(null); setStudentId(''); setProgramName(''); setIssueDate(today()); setError(''); setSuccess(''); setOpen(true);
  };
  function startEdit(row: AdminCertificate) {
    setEditing(row); setStudentId(row.student_id); setProgramName(row.program_name); setIssueDate(row.issue_date??today()); setError(''); setSuccess(''); setOpen(true);
  }
  const selectStudent = (id: string) => {
    setStudentId(id);
    const student = students.data?.find((item)=>item.id===id);
    setProgramName(student?.programNames[0]??'');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      const saved = await savePendingCertificate({studentId,programName,issueDate:issueDate||null},editing?.id);
      if (editing) {
        await records.reload(); setOpen(false); setEditing(null); setSuccess(`Pending certificate ${saved.certificate_id} updated successfully.`);
      } else {
        try {
          await issueCertificate(saved.id);
          await records.reload(); setOpen(false); setSuccess(`Certificate ${saved.certificate_id} was generated and issued successfully.`);
        } catch (issueError) {
          await records.reload(); setOpen(false);
          setError(`Certificate ${saved.certificate_id} was created as pending, but issuance failed: ${issueError instanceof Error?issueError.message:'Unable to issue the certificate.'}`);
        }
      }
    } catch(value) { setError(value instanceof Error?value.message:'Unable to save the pending certificate.'); }
    finally { setBusy(false); }
  };
  const issue = async (row: AdminCertificate) => {
    if(!window.confirm(`Issue certificate “${row.certificate_id}”? The signatory and signature snapshot will become immutable.`))return;
    setWorkingId(row.id); setError(''); setSuccess('');
    try { await issueCertificate(row.id); await records.reload(); setSuccess(`Certificate ${row.certificate_id} was rendered and issued successfully.`); }
    catch(value){setError(value instanceof Error?value.message:'Unable to issue the certificate.');}
    finally{setWorkingId('');}
  };
  const revoke = async (row: AdminCertificate) => {
    if(!window.confirm(`Revoke certificate “${row.certificate_id}”? Revocation is final and its original snapshot will be retained.`))return;
    setWorkingId(row.id); setError(''); setSuccess('');
    try{await revokeCertificate(row.id);await records.reload();setSuccess(`Certificate ${row.certificate_id} was revoked.`);}
    catch(value){setError(value instanceof Error?value.message:'Unable to revoke the certificate.');}
    finally{setWorkingId('');}
  };
  const remove = async (row: AdminCertificate) => {
    if(!window.confirm(`Delete pending certificate “${row.certificate_id}”? This cannot be undone.`))return;
    setWorkingId(row.id);setError('');setSuccess('');
    try{await deletePendingCertificate(row.id);await records.reload();setSuccess('Pending certificate deleted.');}
    catch(value){setError(value instanceof Error?value.message:'Unable to delete the pending certificate.');}
    finally{setWorkingId('');}
  };
  const download = async (row: AdminCertificate) => {
    const popup=window.open('', '_blank');setWorkingId(row.id);setError('');
    try{const url=await createCertificateDownloadUrl(row);if(popup)popup.location.href=url;else window.location.assign(url);}
    catch(value){popup?.close();setError(value instanceof Error?value.message:'Unable to download the certificate.');}
    finally{setWorkingId('');}
  };

  return <PortalPage title="Certificates" description="Prepare pending records, then issue server-rendered PDFs using the current private signature settings. Issued snapshots cannot be altered." actions={<button type="button" className="btn-primary" onClick={startAdd}><Plus size={16}/>Add Certificate</button>}>
    {error&&<p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {success&&<p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
    {records.loading?<LoadingState label="Loading certificates"/>:records.error?<ErrorState message={records.error} onRetry={records.reload}/>:<DataTable columns={columns} rows={records.data??[]} empty={<EmptyState title="No certificates yet" message="Create a pending certificate after a student becomes eligible."/>}/>} 
    <Modal open={open} onClose={()=>{if(!busy)setOpen(false);}} title={editing?'Edit Pending Certificate':'Generate Certificate'}>
      <form onSubmit={submit} className="space-y-5"><div><label htmlFor="certificate-student" className="label">Student enrollment</label><select id="certificate-student" className="input" value={studentId} onChange={(event)=>selectStudent(event.target.value)} required><option value="">Select student</option>{(students.data??[]).map((student)=><option key={student.id} value={student.id}>{student.fullName} — {student.enrollmentId}</option>)}</select>{students.error&&<p className="mt-2 text-xs text-red-600">{students.error}</p>}</div>{editing&&<div><span className="label">Certificate ID</span><p className="input bg-slate-50 font-mono">{editing.certificate_id}</p></div>}<div><label htmlFor="certificate-program" className="label">Program</label><select id="certificate-program" className="input" value={programName} onChange={(event)=>setProgramName(event.target.value)} required><option value="">Select program</option>{Array.from(new Set([...(students.data?.find((student)=>student.id===studentId)?.programNames??[]),...(editing?.program_name?[editing.program_name]:[])])).map((program)=><option key={program} value={program}>{program}</option>)}</select></div><div><label htmlFor="certificate-date" className="label">Completion Date</label><input id="certificate-date" type="date" className="input" value={issueDate} onChange={(event)=>setIssueDate(event.target.value)} required/></div><p className="rounded-xl bg-brand-50 p-3 text-xs leading-5 text-slate-600">{editing?`Certificate ID ${editing.certificate_id} is immutable after issuance.`:'A unique Certificate ID such as CERT-2026-000001 will be assigned automatically and safely by the database.'}</p>{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" className="btn-secondary" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy||students.loading}><Save size={16}/>{busy?'Saving…':editing?'Save Pending Certificate':'Generate & Issue Certificate'}</button></div></form>
    </Modal>
  </PortalPage>;
}
