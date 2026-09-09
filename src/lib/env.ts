const readEnv = (value: string | undefined) => value?.trim() ?? '';

// Prefer Supabase's current name, while keeping existing deployments that use
// VITE_SUPABASE_ANON_KEY compatible during the key migration.
const supabasePublishableKey =
  readEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const env = {
  supabaseUrl: readEnv(import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey,
  admissionFormUrl: import.meta.env.VITE_ADMISSION_FORM_URL?.trim() ?? '',
  academyEmail: import.meta.env.VITE_ACADEMY_EMAIL?.trim() ?? '',
  whatsappNumber: import.meta.env.VITE_WHATSAPP_NUMBER?.trim() ?? '',
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabasePublishableKey);
