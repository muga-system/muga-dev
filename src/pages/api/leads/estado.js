export const prerender = false;

const VALID_STATUSES = ["new", "contacted", "qualified", "won", "lost"];

export const POST = async ({ request }) => {
  const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.SUPABASE_URL;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const leadsTable = process.env.SUPABASE_LEADS_TABLE || import.meta.env.SUPABASE_LEADS_TABLE || "leads";
  const adminToken = process.env.LEADS_ADMIN_TOKEN || import.meta.env.LEADS_ADMIN_TOKEN;

  if (!supabaseUrl || !supabaseServiceRoleKey || !adminToken) {
    return new Response(JSON.stringify({ error: "missing_server_config" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!bearerToken || bearerToken !== adminToken) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const leadId = Number(payload?.leadId);
  const status = typeof payload?.status === "string" ? payload.status.trim().toLowerCase() : "";
  const setLastContactAt = payload?.setLastContactAt !== false;

  if (!Number.isInteger(leadId) || leadId <= 0) {
    return new Response(JSON.stringify({ error: "invalid_lead_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!VALID_STATUSES.includes(status)) {
    return new Response(JSON.stringify({ error: "invalid_status", valid: VALID_STATUSES }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const updatePayload = {
    status,
  };

  if (setLastContactAt && (status === "contacted" || status === "qualified" || status === "won")) {
    updatePayload.last_contact_at = new Date().toISOString();
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${leadsTable}?id=eq.${leadId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(updatePayload),
  });

  if (!response.ok) {
    const detail = await response.text();
    return new Response(JSON.stringify({ error: "supabase_update_failed", detail }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = await response.json();
  const updated = Array.isArray(rows) ? rows[0] : null;

  return new Response(JSON.stringify({ ok: true, updated }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
