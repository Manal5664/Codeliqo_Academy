import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../lib/env';

export function useSupabaseQuery<T>(query: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); setError('The academy portal is not connected yet.'); return; }
    setLoading(true); setError(null);
    try { setData(await query()); } catch (value) { setError(value instanceof Error ? value.message : 'Unable to load this information.'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}
