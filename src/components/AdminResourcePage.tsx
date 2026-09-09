import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { DataTable, type Column } from './DataTable';
import { Modal } from './Modal';
import { PortalPage } from './PortalPage';
import { EmptyState, ErrorState, LoadingState } from './ui';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { deleteRecord, listRecords, saveRecord, type AdminRecord } from '../services/adminService';
import { supabase } from '../lib/supabase';

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'url' | 'select' | 'checkbox' | 'json';
type Option = { label: string; value: string; record?: AdminRecord };

export interface AdminField {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: Option[];
  reference?: {
    table: string;
    label: string;
    match?: { field: string; foreignKey: string };
  };
}

export interface AdminColumn {
  key: string;
  header: string;
  render: (row: AdminRecord) => ReactNode;
}

interface Props {
  title: string;
  description: string;
  singular: string;
  table: string;
  fields: AdminField[];
  columns: AdminColumn[];
  select?: string;
  orderBy?: string;
}

export function AdminResourcePage({ title, description, singular, table, fields, columns, select = '*', orderBy = 'created_at' }: Props) {
  const records = useSupabaseQuery(() => listRecords(table, select, orderBy), [table, select, orderBy]);
  const [editing, setEditing] = useState<AdminRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [selectValues, setSelectValues] = useState<Record<string, string>>({});
  const references = useReferenceOptions(fields);

  const tableColumns = useMemo<Column<AdminRecord>[]>(() => [
    ...columns,
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => <div className="flex items-center gap-2">
        <button type="button" onClick={() => {
          setEditing(row);
          setSelectValues(Object.fromEntries(fields.filter((field) => field.type === 'select' || field.reference).map((field) => [field.key, String(row[field.key] ?? '')])));
          setFormError('');
          setOpen(true);
        }} className="rounded-lg p-2 text-slate-500 hover:bg-brand-50 hover:text-brand-700" aria-label={`Edit ${singular}`}><Pencil size={16} /></button>
        <button type="button" onClick={() => void remove(row)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${singular}`}><Trash2 size={16} /></button>
      </div>,
    },
  ], [columns, fields, singular]);

  const remove = async (row: AdminRecord) => {
    const label = String(row.title ?? row.name ?? row.certificate_id ?? `this ${singular.toLowerCase()}`);
    if (!window.confirm(`Delete ${singular.toLowerCase()} “${label}”? This cannot be undone.`)) return;
    try { await deleteRecord(table, row.id); await records.reload(); }
    catch (error) { window.alert(error instanceof Error ? error.message : `Unable to delete ${singular.toLowerCase()}.`); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setFormError('');
    try {
      const data = new FormData(event.currentTarget);
      const values: Record<string, unknown> = {};
      for (const field of fields) {
        const raw = data.get(field.key);
        if (field.type === 'checkbox') values[field.key] = raw === 'on';
        else if (field.type === 'number') values[field.key] = raw === '' ? null : Number(raw);
        else if (field.type === 'json') values[field.key] = raw ? JSON.parse(String(raw)) : [];
        else values[field.key] = raw === '' ? null : String(raw);
      }
      await saveRecord(table, values, editing?.id);
      await records.reload();
      setOpen(false); setEditing(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : `Unable to save ${singular.toLowerCase()}.`);
    } finally { setBusy(false); }
  };

  return <PortalPage title={title} description={description} actions={<button type="button" className="btn-primary" onClick={() => { setEditing(null); setSelectValues({}); setFormError(''); setOpen(true); }}><Plus size={16} />Add {singular}</button>}>
    {records.loading ? <LoadingState label={`Loading ${title.toLowerCase()}`} /> : records.error ? <ErrorState message={records.error} onRetry={records.reload} /> : <DataTable columns={tableColumns} rows={records.data ?? []} empty={<EmptyState title={`No ${title.toLowerCase()} yet`} message={`Create the first ${singular.toLowerCase()} to get started.`} />} />}
    <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title={`${editing ? 'Edit' : 'Add'} ${singular}`}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map((field) => {
            const match = field.reference?.match;
            const availableOptions = field.options ?? references[field.key] ?? [];
            const filteredOptions = match
              ? availableOptions.filter((option) => String(option.record?.[match.foreignKey] ?? '') === (selectValues[match.field] ?? ''))
              : availableOptions;
            return <ResourceField
              key={field.key}
              field={field}
              value={editing?.[field.key]}
              selectedValue={selectValues[field.key] ?? ''}
              options={filteredOptions}
              onValueChange={(value) => setSelectValues((current) => {
                const next = { ...current, [field.key]: value };
                for (const dependent of fields) {
                  if (dependent.reference?.match?.field === field.key) next[dependent.key] = '';
                }
                return next;
              })}
            />;
          })}
        </div>
        {formError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
          <button className="btn-primary" disabled={busy}><Save size={16} />{busy ? 'Saving…' : `Save ${singular}`}</button>
        </div>
      </form>
    </Modal>
  </PortalPage>;
}

function ResourceField({ field, value, selectedValue, options, onValueChange }: { field: AdminField; value: unknown; selectedValue: string; options: Option[]; onValueChange: (value: string) => void }) {
  const id = `admin-field-${field.key}`;
  const initial = value == null ? '' : field.type === 'json' ? JSON.stringify(value, null, 2) : field.type === 'date' ? String(value).slice(0, 10) : field.type === 'time' ? String(value).slice(0, 5) : String(value);
  if (field.type === 'checkbox') return <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700"><input name={field.key} type="checkbox" defaultChecked={Boolean(value)} className="size-4 rounded border-slate-300 text-brand-600" />{field.label}</label>;
  return <div className={field.type === 'textarea' || field.type === 'json' ? 'sm:col-span-2' : ''}>
    <label className="label" htmlFor={id}>{field.label}</label>
    {field.type === 'select' || field.reference
      ? <select id={id} name={field.key} value={selectedValue} onChange={(event) => onValueChange(event.target.value)} className="input" required={field.required}><option value="">Select {field.label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      : field.type === 'textarea' || field.type === 'json'
        ? <textarea id={id} name={field.key} defaultValue={initial} className="input min-h-28 resize-y font-inherit" required={field.required} placeholder={field.placeholder} />
        : <input id={id} name={field.key} type={field.type ?? 'text'} defaultValue={initial} className="input" required={field.required} placeholder={field.placeholder} step={field.type === 'number' ? 'any' : undefined} />}
    {field.help && <p className="mt-1.5 text-xs leading-5 text-slate-500">{field.help}</p>}
  </div>;
}

function useReferenceOptions(fields: AdminField[]) {
  const references = useMemo(() => fields.filter((field) => field.reference), [fields]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  useEffect(() => {
    let active = true;
    void Promise.all(references.map(async (field) => {
      const reference = field.reference!;
      if (reference.table === 'students') {
        const { data } = await supabase
          .from('students')
          .select('id, enrollment_id, application_id, profile:profiles(full_name)')
          .order('created_at');
        const rows = (data ?? []) as unknown as AdminRecord[];
        return [field.key, rows.map((item) => {
          const relation = (Array.isArray(item.profile) ? item.profile[0] : item.profile) as { full_name?: string | null } | null;
          const referenceLabel = item.enrollment_id ?? item.application_id ?? 'Reference pending';
          return { value: String(item.id), label: `${relation?.full_name || 'Student'} — ${String(referenceLabel)}`, record: item };
        })] as const;
      }
      const { data } = await supabase.from(reference.table).select('*').order(reference.label);
      const rows = (data ?? []) as unknown as AdminRecord[];
      return [field.key, rows.map((item) => ({ value: String(item.id), label: String(item[reference.label] ?? item.id), record: item }))] as const;
    })).then((entries) => { if (active) setOptions(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [references]);
  return options;
}
