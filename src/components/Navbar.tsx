import { useEffect, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { ApplyLink } from './ApplyLink';
import { classNames } from '../lib/utils';
import { useAuth } from '../features/auth/AuthContext';
import { dashboardPath } from '../features/auth/authPolicy';
import { useProgramCatalog } from '../features/programs/ProgramCatalogContext';

const links = [{ label: 'Home', to: '/' }, { label: 'Learning Experience', to: '/learning-experience' }, { label: 'Admissions', to: '/admissions' }, { label: 'About', to: '/about' }, { label: 'FAQs', to: '/faqs' }, { label: 'Contact', to: '/contact' }];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [mobileProgramsOpen, setMobileProgramsOpen] = useState(false);
  const location = useLocation();
  const { role, accountStatus } = useAuth();
  const { programs } = useProgramCatalog();
  const hasPortalAccess = accountStatus === 'ready' && role;
  const portalPath = hasPortalAccess ? dashboardPath(role) : '/student/login';
  const portalLabel = hasPortalAccess
    ? `${role === 'admin' ? 'Admin' : 'Student'} Dashboard`
    : 'Student Login';

  useEffect(() => {
    setOpen(false);
    setMobileProgramsOpen(false);
  }, [location.pathname]);

  return <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
    <div className="container-shell flex min-h-20 items-center justify-between gap-4">
      <BrandMark />
      <nav className="hidden items-center gap-2 xl:flex" aria-label="Primary navigation">
        <NavItem to="/" label="Home" />
        <div className="group relative">
          <NavLink to="/programs" className={({ isActive }) => navItemClass(isActive)}>
            Programs
            <ChevronDown className="transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180" size={15} aria-hidden="true" />
          </NavLink>
          <div className="pointer-events-none invisible absolute left-1/2 top-full z-50 w-80 -translate-x-1/2 translate-y-2 pt-3 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-navy-900/10">
              {programs.map((program) => <NavLink key={program.slug} to={`/programs/${program.slug}`} className={({ isActive }) => classNames('block rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors hover:bg-brand-50 hover:text-brand-700', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700')}>{program.shortTitle}</NavLink>)}
            </div>
          </div>
        </div>
        {links.slice(1).map((link) => <NavItem key={link.to} {...link} />)}
      </nav>
      <div className="flex items-center gap-2.5">
        <div className="hidden items-center gap-3 md:flex">
          <Link to={portalPath} className="btn-secondary min-h-10 px-4 py-2 text-[15px]">{portalLabel}</Link>
          <ApplyLink className="min-h-10 px-4 py-2 text-[15px] [&>svg]:hidden" />
        </div>
        <button type="button" onClick={() => { setOpen(!open); if (open) setMobileProgramsOpen(false); }} className="grid size-11 place-items-center rounded-xl border border-slate-200 text-navy-900 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 xl:hidden" aria-label="Toggle navigation" aria-controls="mobile-navigation" aria-expanded={open}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
    </div>
    {open && <nav id="mobile-navigation" className="max-h-[calc(100vh-5rem)] overflow-y-auto border-t border-slate-200 bg-white shadow-lg shadow-navy-900/5 xl:hidden" aria-label="Mobile navigation">
      <div className="container-shell grid gap-1 py-4">
        <MobileNavItem to="/" label="Home" />
        <div>
          <div className={classNames('flex items-center rounded-xl transition-colors', location.pathname.startsWith('/programs') ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50 hover:text-brand-700')}>
            <Link to="/programs" className="flex-1 px-4 py-3 text-base font-semibold">Programs</Link>
            <button type="button" onClick={() => setMobileProgramsOpen(!mobileProgramsOpen)} className="mr-1 grid size-10 place-items-center rounded-lg hover:bg-white/80" aria-label="Toggle Programs submenu" aria-expanded={mobileProgramsOpen}>
              <ChevronDown className={classNames('transition-transform duration-200', mobileProgramsOpen && 'rotate-180')} size={17} aria-hidden="true" />
            </button>
          </div>
          {mobileProgramsOpen && <div className="ml-4 mt-1 grid gap-1 border-l border-brand-100 pl-3">
            {programs.map((program) => <NavLink key={program.slug} to={`/programs/${program.slug}`} className={({ isActive }) => classNames('rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-brand-50 hover:text-brand-700', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600')}>{program.shortTitle}</NavLink>)}
          </div>}
        </div>
        {links.slice(1).map((link) => <MobileNavItem key={link.to} {...link} />)}
        <div className="mt-3 grid gap-2 border-t border-slate-100 pt-4 md:hidden">
          <Link to={portalPath} className="btn-secondary w-full">{portalLabel}</Link>
          <ApplyLink className="w-full [&>svg]:hidden" />
        </div>
      </div>
    </nav>}
  </header>;
}

function NavItem({ to, label }: { to: string; label: string }) {
  return <NavLink to={to} end={to === '/'} className={({ isActive }) => navItemClass(isActive)}>{label}</NavLink>;
}

function MobileNavItem({ to, label }: { to: string; label: string }) {
  return <NavLink to={to} end={to === '/'} className={({ isActive }) => classNames('rounded-xl px-4 py-3 text-base font-semibold transition-colors hover:bg-slate-50 hover:text-brand-700', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700')}>{label}</NavLink>;
}

function navItemClass(isActive: boolean) {
  return classNames('flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-base font-semibold transition-colors hover:bg-slate-50 hover:text-brand-700 2xl:px-3', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700');
}
