// ============================================================
// _shared/env.ts — Typed, validated access to Edge secrets.
// Never expose these values to the frontend.
// ============================================================

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return Deno.env.get(name) ?? fallback;
}

export const env = {
  // Supabase
  supabaseUrl: () => required("SUPABASE_URL"),
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  anonKey: () => required("SUPABASE_ANON_KEY"),

  // Sola Payments
  solaApiKey: () => required("SOLA_API_KEY"),
  solaApiSecret: () => required("SOLA_API_SECRET"),
  solaWebhookSecret: () => required("SOLA_WEBHOOK_SECRET"),
  solaMerchantId: () => required("SOLA_MERCHANT_ID"),
  solaEnvironment: () => optional("SOLA_ENVIRONMENT", "sandbox"),
  solaBaseUrl: () => optional("SOLA_API_BASE_URL", "https://api.solapayments.com"),

  // SignalWire
  signalwireProjectId: () => required("SIGNALWIRE_PROJECT_ID"),
  signalwireApiToken: () => required("SIGNALWIRE_API_TOKEN"),
  signalwireSpaceUrl: () => required("SIGNALWIRE_SPACE_URL"),
  signalwirePhoneNumber: () => required("SIGNALWIRE_PHONE_NUMBER"),
  signalwireWebhookSecret: () => optional("SIGNALWIRE_WEBHOOK_SECRET"),

  // Email
  emailFrom: () => required("EMAIL_FROM"),
  emailProviderKey: () => required("EMAIL_PROVIDER_KEY"),

  // App
  appUrl: () => optional("APP_URL", "http://localhost:5173"),
  adminUrl: () => optional("ADMIN_URL", "http://localhost:5173"),
};
