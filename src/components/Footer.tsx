import { Link } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { env } from '../lib/env';
import { useProgramCatalog } from '../features/programs/ProgramCatalogContext';

export function Footer() {
  const { programs } = useProgramCatalog();
  return <footer className="bg-navy-950 text-slate-300">
    <div className="container-shell grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
      <div><BrandMark large /><p className="mt-5 max-w-sm text-sm leading-6 text-slate-400">Practical, career-focused training in software development, data science and artificial intelligence.</p><p className="mt-4 text-sm font-semibold text-brand-500">Learn. Build. Innovate.</p></div>
      <FooterGroup title="Academy" links={[['Programs','/programs'],['Learning Experience','/learning-experience'],['Admissions','/admissions'],['Fees','/fees'],['About','/about']]} />
      <FooterGroup title="Programs" links={programs.map((program) => [program.shortTitle, `/programs/${program.slug}`])} />
      <div><h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Support</h2><div className="grid gap-3 text-sm"><Link to="/faqs" className="hover:text-white">FAQs</Link><Link to="/contact" className="hover:text-white">Contact</Link><Link to="/verify-certificate" className="hover:text-white">Verify Certificate</Link><Link to="/policies" className="hover:text-white">Policies</Link>{env.academyEmail && <a href={`mailto:${env.academyEmail}`} className="hover:text-white">{env.academyEmail}</a>}<Link to="/admin/login" className="mt-2 text-xs text-slate-500 hover:text-slate-300">Admin Login</Link></div></div>
    </div>
    <div className="border-t border-white/10"><div className="container-shell flex flex-col gap-2 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} Codeliqo Academy. All rights reserved.</p><p>Online Academy · Software Development · Data Science · AI</p></div></div>
  </footer>;
}

function FooterGroup({ title, links }: { title: string; links: string[][] }) { return <div><h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">{title}</h2><div className="grid gap-3 text-sm">{links.map(([label, to]) => <Link key={to} to={to} className="hover:text-white">{label}</Link>)}</div></div>; }
