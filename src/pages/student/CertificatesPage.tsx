import { useState } from 'react';
import { BadgeCheck, Download, ShieldCheck } from 'lucide-react';
import { PortalPage } from '../../components/PortalPage';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { useStudentContext } from '../../hooks/useStudentContext';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { formatDate, titleCase } from '../../lib/utils';
import { createCertificateDownloadUrl } from '../../services/certificateService';
import { getCertificates } from '../../services/studentService';
import type { Certificate } from '../../types';

export function CertificatesPage() {
  const context = useStudentContext();
  const certificates = useSupabaseQuery(getCertificates, []);
  if (context.loading || certificates.loading) return <LoadingState label="Loading certificates"/>;
  if (context.error || certificates.error) return <ErrorState message={context.error||certificates.error||undefined} onRetry={certificates.reload}/>;
  return <PortalPage title="Certificates" description="Eligibility and issue records for your Certificate of Completion.">
    <div className={`mb-6 flex gap-4 rounded-2xl border p-5 ${context.data?.student.certificate_eligible?'border-emerald-200 bg-emerald-50':'border-slate-200 bg-white'}`}><ShieldCheck className={context.data?.student.certificate_eligible?'text-emerald-600':'text-slate-400'}/><div><h3 className="font-bold">{context.data?.student.certificate_eligible?'Certificate eligible':'Eligibility requirements in progress'}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{context.data?.student.certificate_eligible?'Your record is marked eligible. Check the certificate page for issue status.':'Complete applicable academic, project, attendance, conduct and payment requirements.'}</p></div></div>
    {!certificates.data?.length?<EmptyState title="No certificates available" message="An issued Certificate of Completion will appear here after eligibility review."/>:<div className="grid gap-5 md:grid-cols-2">{certificates.data.map((item)=><article key={item.id} className="card overflow-hidden"><div className="bg-navy-900 p-6 text-white"><BadgeCheck className="text-brand-500" size={31}/><p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-brand-500">Codeliqo Academy</p><h3 className="mt-2 text-2xl font-bold text-white">Certificate of Completion</h3></div><dl className="grid gap-4 p-6 text-sm"><Detail label="Program" value={item.program_name}/><Detail label="Certificate ID" value={item.certificate_id||'Pending'}/><Detail label="Completion date" value={formatDate(item.issue_date)}/><Detail label="Status" value={titleCase(item.status)}/></dl>{item.status==='issued'&&(item.file_path||item.file_url)&&<div className="border-t border-slate-100 p-5"><CertificateDownloadButton certificate={item}/></div>}</article>)}</div>}
  </PortalPage>;
}

function CertificateDownloadButton({certificate}:{certificate:Certificate}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const download=async()=>{
    const popup=window.open('', '_blank');setBusy(true);setError('');
    try{const url=await createCertificateDownloadUrl(certificate);if(popup)popup.location.href=url;else window.location.assign(url);}
    catch(value){popup?.close();setError(value instanceof Error?value.message:'Unable to download the certificate.');}
    finally{setBusy(false);}
  };
  return <><button type="button" onClick={()=>void download()} disabled={busy} className="btn-primary w-full"><Download size={16}/>{busy?'Preparing secure download…':'Download certificate'}</button>{error&&<p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}</>;
}

function Detail({label,value}:{label:string;value:string}){return <div className="flex justify-between gap-4"><dt className="text-slate-500">{label}</dt><dd className="text-right font-semibold text-navy-900">{value}</dd></div>}
