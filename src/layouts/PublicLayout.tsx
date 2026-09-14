import { Outlet, ScrollRestoration } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { ProgramCatalogProvider } from '../features/programs/ProgramCatalogContext';

export function PublicLayout() { return <ProgramCatalogProvider><Navbar /><main><Outlet /></main><Footer /><ScrollRestoration /></ProgramCatalogProvider>; }
