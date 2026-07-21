// ============================================================
// _shared/supabase.ts — Service-role admin client factory.
// Used ONLY inside Edge Functions. Bypasses RLS.
// ============================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { env } from "./env.ts";

let adminClient: SupabaseClient | null = null;

/** Service-role client — full access, bypasses RLS. Edge Functions only. */
export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(env.supabaseUrl(), env.serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/**
 * Client scoped to the caller's JWT — respects RLS. Use this to identify
 * the authenticated admin and enforce role checks for admin endpoints.
 */
export function getUserClient(authHeader: string | null): SupabaseClient {
  return createClient(env.supabaseUrl(), env.anonKey(), {
    global: { headers: { Authorization: authHeader ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Resolve the authenticated user id, or null. */
export async function getAuthUser(authHeader: string | null) {
  if (!authHeader) return null;
  const client = getUserClient(authHeader);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/** Assert the caller holds at least one of the required roles. Throws otherwise. */
export async function requireRole(
  authHeader: string | null,
  roles: AppRoleName[],
): Promise<{ userId: string }> {
  const user = await getAuthUser(authHeader);
  if (!user) throw new HttpError("UNAUTHENTICATED", "Authentication required", 401);

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (error) throw new HttpError("ROLE_LOOKUP_FAILED", error.message, 500);
  const held = new Set((data ?? []).map((r) => r.role as AppRoleName));
  const ok = roles.some((r) => held.has(r));
  if (!ok) throw new HttpError("FORBIDDEN", "Insufficient role", 403);

  return { userId: user.id };
}

export type AppRoleName = "super_admin" | "lottery_manager" | "support" | "viewer";

export class HttpError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
