import { createClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from './env';

const placeholderUrl = 'https://placeholder.supabase.co';
const placeholderKey = 'placeholder-anon-key';

export const supabase = createClient(
  isSupabaseConfigured ? env.supabaseUrl : placeholderUrl,
  isSupabaseConfigured ? env.supabasePublishableKey : placeholderKey,
  { auth: { persistSession: isSupabaseConfigured, autoRefreshToken: isSupabaseConfigured, detectSessionInUrl: isSupabaseConfigured } },
);
