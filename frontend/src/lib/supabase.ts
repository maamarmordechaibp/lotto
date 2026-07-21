import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

/**
 * Public Supabase client — anon key only.
 * The service_role key NEVER touches the frontend. All privileged
 * operations go through Edge Functions. Query results are cast to the
 * explicit Row types declared in each hook (see src/types/database.ts).
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const FUNCTIONS_URL = `${url}/functions/v1`;
