import crypto from "node:crypto";

export const prerender = false;

const ALLOWED_EVENTS = new Set([
  "session_start",
  "page_view",
  "funnel_step_view",
  "cta_click",
  "form_field_selected",
  "form_started",
  "form_submit_attempt",
  "form_submit_success",
  "form_submit_error",
]);

const safeText = (value, max = 120) => String(value || "").trim().slice(0, max);

const normalizeCountry = (value) => {
  const code = safeText(value, 2).toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
};

const parseReferrerHost = (value) => {
  const raw = safeText(value, 400);
  if (!raw) return "";
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const detectDeviceType = (userAgent) => {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return "unknown";
  if (/tablet|ipad/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  return "desktop";
};

const detectBrowser = (userAgent) => {
  const ua = String(userAgent || "").toLowerCase();
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "opera";
  if (ua.includes("chrome/") && !ua.includes("edg/")) return "chrome";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "safari";
  if (ua.includes("firefox/")) return "firefox";
  return "other";
};

const getClientIp = (request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-vercel-forwarded-for") ||
    ""
  );
};

const hashIp = (value) => {
  if (!value) return "";
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
};

const normalizeEvent = (raw, context) => {
  const eventName = safeText(raw?.event, 80);
  if (!ALLOWED_EVENTS.has(eventName)) return null;

  return {
    event_name: eventName,
    session_id: safeText(raw?.session_id, 120),
    page_path: safeText(raw?.page_path, 240) || "/",
    page_url: safeText(raw?.page_url, 800),
    referrer_host: parseReferrerHost(raw?.referrer),
    utm_source: safeText(raw?.utm_source, 120).toLowerCase(),
    utm_medium: safeText(raw?.utm_medium, 120).toLowerCase(),
    utm_campaign: safeText(raw?.utm_campaign, 160).toLowerCase(),
    country: context.country,
    region: context.region,
    city: context.city,
    device_type: context.deviceType,
    browser: context.browser,
    ip_hash: context.ipHash,
    payload: {
      timestamp: safeText(raw?.timestamp, 40),
      location: safeText(raw?.location, 120),
      destination: safeText(raw?.destination, 400),
      label: safeText(raw?.label, 200),
      funnel_step: safeText(raw?.funnel_step, 80),
      form_id: safeText(raw?.form_id, 80),
      field_name: safeText(raw?.field_name, 80),
      field_value: safeText(raw?.field_value, 160),
      form_context: safeText(raw?.form_context, 80),
    },
  };
};

export const POST = async ({ request }) => {
  const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.SUPABASE_URL;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const webEventsTable =
    process.env.SUPABASE_WEB_EVENTS_TABLE || import.meta.env.SUPABASE_WEB_EVENTS_TABLE || "web_events";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ ok: false, error: "missing_supabase_config" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const events = Array.isArray(body?.events) ? body.events : [body];
  if (!events.length) {
    return new Response(JSON.stringify({ ok: false, error: "empty_payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userAgent = request.headers.get("user-agent") || "";
  const context = {
    country: normalizeCountry(request.headers.get("x-vercel-ip-country")),
    region: safeText(request.headers.get("x-vercel-ip-country-region"), 120),
    city: safeText(request.headers.get("x-vercel-ip-city"), 120),
    deviceType: detectDeviceType(userAgent),
    browser: detectBrowser(userAgent),
    ipHash: hashIp(getClientIp(request)),
  };

  const normalizedEvents = events
    .slice(0, 25)
    .map((item) => normalizeEvent(item, context))
    .filter(Boolean);

  if (!normalizedEvents.length) {
    return new Response(JSON.stringify({ ok: true, dropped: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${webEventsTable}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
    body: JSON.stringify(normalizedEvents),
  });

  if (!response.ok) {
    return new Response(JSON.stringify({ ok: false, error: "insert_failed" }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
};
