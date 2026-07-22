/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_URL: string;
  readonly VITE_SOLA_IFIELDS_KEY?: string;
  readonly VITE_SOLA_IFIELDS_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
