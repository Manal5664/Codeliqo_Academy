/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** @deprecated Use VITE_SUPABASE_PUBLISHABLE_KEY for new configurations. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_ADMISSION_FORM_URL?: string;
  readonly VITE_ACADEMY_EMAIL?: string;
  readonly VITE_WHATSAPP_NUMBER?: string;
}

interface ImportMeta { readonly env: ImportMetaEnv }
