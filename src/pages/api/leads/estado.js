import { METRICAS_SESSION_COOKIE, isMetricasSessionValid } from "../../../lib/metricas-auth.js";

export const prerender = false;

const allowedStatuses = new Set(["new", "contacted", "qualified", "won", "lost"]);

const parseLeadId = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
};

const sanitizeReturnTo = (value) => {
  const raw = String(value || "").trim();
  if (!raw.startsWith("/metricas")) return "/metricas";
  return raw;
};

const withStatusParam = (path, status) => {
  const url = new URL(path, "https://muga.dev");
  url.searchParams.set("status_update", status);
  return `${url.pathname}${url.search}`;
};

const redirectResponse = (requestUrl, returnTo, status) => {
  return Response.redirect(new URL(withStatusParam(returnTo, status), requestUrl), 303);
};

const parsePayload = async (request) => {
  const contentType = request.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (isJson) {
    const body = await request.json();
    return { payload: body || {}, isJson: true };
  }

  const formData = await request.formData();
  const payload = {};
  formData.forEach((value, key) => {
    payload[key] = typeof value === "string" ? value : "";
  });
  return { payload, isJson: false };
};

export const POST = async ({ request, cookies }) => {
  const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.SUPABASE_URL;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const leadsTable = process.env.SUPABASE_LEADS_TABLE || import.meta.env.SUPABASE_LEADS_TABLE || "leads";
  const panelPassword = process.env.METRICAS_PANEL_PASSWORD || import.meta.env.METRICAS_PANEL_PASSWORD;
  const sessionSalt = process.env.METRICAS_SESSION_SALT || import.meta.env.METRICAS_SESSION_SALT || "muga-metricas-v1";

  const { payload, isJson } = await parsePayload(request);
  const returnTo = sanitizeReturnTo(payload.return_to);

  const cookieValue = cookies.get(METRICAS_SESSION_COOKIE)?.value || "";
  const isAuthorized = isMetricasSessionValid({
    cookieValue,
    panelPassword,
    sessionSalt,
  });

  if (!isAuthorized) {
    if (isJson) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirectResponse(request.url, returnTo, "unauthorized");
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    if (isJson) {
      return new Response(JSON.stringify({ error: "missing_server_config" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirectResponse(request.url, returnTo, "config_error");
  }

  const leadId = parseLeadId(payload.lead_id);
  const nextStatus = String(payload.status || "").toLowerCase();

  if (!leadId || !allowedStatuses.has(nextStatus)) {
    if (isJson) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirectResponse(request.url, returnTo, "invalid_payload");
  }

  const patchUrl = new URL(`${supabaseUrl}/rest/v1/${leadsTable}`);
  patchUrl.searchParams.set("id", `eq.${leadId}`);

  const nowIso = new Date().toISOString();
  const firstAttemptPayload =
    nextStatus === "new"
      ? { status: nextStatus }
      : { status: nextStatus, last_contact_at: nowIso, first_contact_at: nowIso };

  const patchHeaders = {
    "Content-Type": "application/json",
    apikey: supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseServiceRoleKey}`,
    Prefer: "return=representation",
  };

  let response = await fetch(patchUrl.toString(), {
    method: "PATCH",
    headers: patchHeaders,
    body: JSON.stringify(firstAttemptPayload),
  });

  if (!response.ok && response.status === 400) {
    response = await fetch(patchUrl.toString(), {
      method: "PATCH",
      headers: patchHeaders,
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  if (!response.ok) {
    const detail = await response.text();
    if (isJson) {
      return new Response(JSON.stringify({ error: "supabase_update_failed", detail }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirectResponse(request.url, returnTo, "update_failed");
  }

  if (isJson) {
    return new Response(JSON.stringify({ ok: true, lead_id: leadId, status: nextStatus }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return redirectResponse(request.url, returnTo, "ok");
};
