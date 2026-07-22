// ============================================================
// Cloudflare Worker: Supabase reverse proxy
// Serves the Supabase project through a codelabsus.com subdomain so
// clients on networks that block *.supabase.co can still reach it.
// Forwards ALL paths (auth, rest, realtime WS, functions, storage)
// to the upstream project and adds permissive CORS.
// ============================================================

const UPSTREAM = "jhezyjzemvpnaiitelwq.supabase.co";

addEventListener("fetch", (event) => {
  event.respondWith(handle(event.request));
});

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  const reqHeaders =
    request.headers.get("Access-Control-Request-Headers") ||
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, range, prefer";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Expose-Headers": "content-range, content-encoding, etag, x-client-info",
    "Access-Control-Max-Age": "86400",
  };
}

async function handle(request) {
  const url = new URL(request.url);
  url.hostname = UPSTREAM;
  url.protocol = "https:";
  url.port = "";

  // WebSocket passthrough (Supabase Realtime).
  if ((request.headers.get("Upgrade") || "").toLowerCase() === "websocket") {
    return fetch(new Request(url.toString(), request));
  }

  // CORS preflight.
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const init = {
    method: request.method,
    headers: request.headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  };

  const upstreamResp = await fetch(url.toString(), init);
  const headers = new Headers(upstreamResp.headers);
  const cors = corsHeaders(request);
  for (const key in cors) headers.set(key, cors[key]);

  return new Response(upstreamResp.body, {
    status: upstreamResp.status,
    statusText: upstreamResp.statusText,
    headers,
  });
}
