import { FUNCTIONS_URL, supabase } from "./supabase";

export interface ApiError {
  code: string;
  message: string;
}

export class ApiRequestError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

/**
 * Call a Supabase Edge Function. Automatically attaches the anon key and,
 * when present, the authenticated user's JWT for admin endpoints.
 */
export async function callFunction<T>(
  name: string,
  body?: unknown,
  method: "POST" | "GET" = "POST",
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${
        session?.access_token ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string)
      }`,
    },
    body: method === "POST" && body ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (payload as { error?: ApiError }).error;
    throw new ApiRequestError(
      err?.code ?? "REQUEST_FAILED",
      err?.message ?? `Request failed (${res.status})`,
      res.status,
    );
  }
  return payload as T;
}
