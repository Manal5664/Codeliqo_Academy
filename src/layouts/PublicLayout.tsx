import { Outlet, ScrollRestoration } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function PublicLayout() { return <><Navbar /><main><Outlet /></main><Footer /><ScrollRestoration /></>; }
