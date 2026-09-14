import { ProgramCard } from '../../components/ProgramCard';
import { CTASection, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useProgramCatalog } from '../../features/programs/ProgramCatalogContext';
import { usePageMeta } from '../../hooks/usePageMeta';

export function ProgramsPage() {
  const { programs, loading, error, reload } = useProgramCatalog();
  usePageMeta('Career Programs', 'Compare Codeliqo Academy career programs in software development, data science and artificial intelligence.');
  return <><PageHeader eyebrow="Career pathways" title="Choose the skills you want to build" description="Each program follows a structured progression from core concepts to applied work, reviewed projects and a final capstone. Compare the scope carefully and choose the pathway aligned with your starting point and goals."/><section className="section-pad"><div className="container-shell">{loading ? <LoadingState label="Loading programs" /> : error ? <ErrorState message={error} onRetry={reload} /> : programs.length ? <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{programs.map((program)=><ProgramCard key={program.slug} program={program}/>)}</div> : <EmptyState title="No programs are published yet" message="Published programs will appear here automatically."/>}<div className="mt-10 rounded-2xl border border-brand-100 bg-brand-50 p-6 text-sm leading-6 text-slate-700"><strong className="text-navy-900">Not sure which path fits?</strong> Compare prerequisites, technologies and portfolio outcomes on each program page, then contact the academy before applying. Codeliqo does not promise employment; these pathways focus on practical skill development and career preparation.</div></div></section><CTASection/></>;
}
