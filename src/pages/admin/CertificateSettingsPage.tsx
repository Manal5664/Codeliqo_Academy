import { type FormEvent, useEffect, useState } from 'react';
import { FileImage, Save, ShieldCheck } from 'lucide-react';
import { PortalPage } from '../../components/PortalPage';
import { ErrorState, LoadingState } from '../../components/ui';
import { useAuth } from '../../features/auth/AuthContext';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { getCertificateSettings, getPrivateSignaturePreview, saveCertificateSettings } from '../../services/certificateService';

export function CertificateSettingsPage() {
  const { user } = useAuth();
  const settings = useSupabaseQuery(getCertificateSettings, []);
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [storedPreview, setStoredPreview] = useState('');
  const [selectedPreview, setSelectedPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inputKey, setInputKey] = useState(0);

  useEffect(() => {
    if (!settings.data) return;
    setName(settings.data.authorized_signatory_name);
    setDesignation(settings.data.designation);
  }, [settings.data]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    const path = settings.data?.signature_path;
    if (path) {
      void getPrivateSignaturePreview(path).then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setStoredPreview(objectUrl);
      }).catch((value) => { if (active) setError(value instanceof Error ? value.message : 'Unable to load the private signature preview.'); });
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); setStoredPreview(''); };
  }, [settings.data?.signature_path]);

  useEffect(() => {
    if (!signatureFile) { setSelectedPreview(''); return; }
    const objectUrl = URL.createObjectURL(signatureFile);
    setSelectedPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [signatureFile]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await saveCertificateSettings({
        authorizedSignatoryName: name,
        designation,
        signatureFile,
        existingSignaturePath: settings.data?.signature_path ?? null,
        updatedBy: user.id,
      });
      setSignatureFile(null); setInputKey((value) => value + 1);
      await settings.reload();
      setSuccess('Certificate settings updated successfully. Newly issued certificates will use this signatory.');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save certificate settings.');
    } finally { setBusy(false); }
  };

  return <PortalPage title="Certificate Settings" description="Configure the real authorized signature used when new certificate PDFs are issued. Existing issued certificates retain their original snapshot.">
    {settings.loading ? <LoadingState label="Loading certificate settings"/> : settings.error ? <ErrorState message={settings.error} onRetry={settings.reload}/> : <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section className="card p-6 sm:p-8">
        <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-slate-700"><ShieldCheck className="mt-0.5 shrink-0 text-brand-600" size={20}/><p>The source signature is kept in a private storage bucket. Do not upload a generated or imitation signature; use only the authorized signatory’s genuine PNG.</p></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div><label htmlFor="signatory-name" className="label">Authorized Signatory Name</label><input id="signatory-name" className="input" value={name} onChange={(event)=>setName(event.target.value)} required minLength={2} maxLength={120}/></div>
          <div><label htmlFor="signatory-designation" className="label">Designation</label><input id="signatory-designation" className="input" value={designation} onChange={(event)=>setDesignation(event.target.value)} required minLength={2} maxLength={120}/></div>
          <div className="sm:col-span-2"><label htmlFor="signature-image" className="label">Signature Image Upload</label><input key={inputKey} id="signature-image" type="file" accept="image/png,.png" required={!settings.data?.signature_path} onChange={(event)=>setSignatureFile(event.target.files?.[0] ?? null)} className="input file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-700"/><p className="mt-2 text-xs leading-5 text-slate-500">PNG only, maximum 2 MB. A tightly cropped transparent-background PNG is strongly recommended.</p></div>
        </div>
        {error&&<p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success&&<p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
        <button className="btn-primary mt-6" disabled={busy}><Save size={16}/>{busy?'Saving…':settings.data?'Update Settings':'Save Settings'}</button>
      </section>
      <aside className="card overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4"><h3 className="font-bold">Signature preview</h3><p className="mt-1 text-xs text-slate-500">Previewed locally before saving.</p></div>
        <div className="p-6"><div className="grid min-h-48 place-items-center rounded-xl border border-slate-200 p-6" style={{backgroundColor:'#fff',backgroundImage:'linear-gradient(45deg,#f1f5f9 25%,transparent 25%),linear-gradient(-45deg,#f1f5f9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f1f5f9 75%),linear-gradient(-45deg,transparent 75%,#f1f5f9 75%)',backgroundSize:'20px 20px',backgroundPosition:'0 0,0 10px,10px -10px,-10px 0'}}>{selectedPreview||storedPreview?<img src={selectedPreview||storedPreview} alt="Authorized signature preview" className="max-h-32 max-w-full object-contain"/>:<div className="text-center text-slate-400"><FileImage className="mx-auto"/><p className="mt-2 text-sm">Select a PNG to preview it</p></div>}</div><div className="mt-5 text-center"><p className="font-semibold text-navy-900">{name||'Authorized Signatory'}</p><p className="mt-1 text-sm text-slate-500">{designation||'Designation'}</p></div></div>
      </aside>
    </form>}
  </PortalPage>;
}
