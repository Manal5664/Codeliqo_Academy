import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../../hooks/usePageMeta';
export function NotFoundPage(){usePageMeta('Page Not Found','The requested page could not be found.');return <section className="grid min-h-[65vh] place-items-center px-5 text-center"><div><p className="text-sm font-extrabold tracking-widest text-brand-600">404</p><h1 className="mt-3 text-4xl font-extrabold">This page does not exist</h1><p className="mt-4 text-slate-600">The address may have changed, or the page may have been removed.</p><Link to="/" className="btn-primary mt-7"><ArrowLeft size={16}/>Return home</Link></div></section>}
