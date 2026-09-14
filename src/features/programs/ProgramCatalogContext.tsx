import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useSupabaseQuery } from '../../hooks/useSupabaseQuery';
import { listPublishedPrograms } from '../../services/programService';
import type { Program } from '../../types';

interface ProgramCatalogState {
  programs: Program[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const ProgramCatalogContext = createContext<ProgramCatalogState | undefined>(undefined);

export function ProgramCatalogProvider({ children }: { children: ReactNode }) {
  const catalog = useSupabaseQuery(listPublishedPrograms, []);
  useEffect(() => {
    const refresh = () => { void catalog.reload(); };
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [catalog.reload]);
  return <ProgramCatalogContext.Provider value={{
    programs: catalog.data ?? [],
    loading: catalog.loading,
    error: catalog.error,
    reload: catalog.reload,
  }}>{children}</ProgramCatalogContext.Provider>;
}

export function useProgramCatalog() {
  const value = useContext(ProgramCatalogContext);
  if (!value) throw new Error('useProgramCatalog must be used within ProgramCatalogProvider');
  return value;
}

export function usePublishedProgram(slug?: string) {
  const catalog = useProgramCatalog();
  return { ...catalog, program: catalog.programs.find((item) => item.slug === slug) };
}
