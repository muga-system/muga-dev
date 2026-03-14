export const prerender = false;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

export const GET = async ({ request, url }) => {
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

  const hours = parsePositiveInt(url.searchParams.get("hours"), 24);
  const limit = parsePositiveInt(url.searchParams.get("limit"), 30);
  const cutoffIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const query = new URL(`${supabaseUrl}/rest/v1/${leadsTable}`);
  query.searchParams.set(
    "select",
    "id,created_at,last_contact_at,name,email,phone,project,budget,lead_stage,status,source,page",
  );
  query.searchParams.set("status", "eq.new");
  query.searchParams.set("created_at", `lte.${cutoffIso}`);
  query.searchParams.set("order", "created_at.asc");
  query.searchParams.set("limit", String(limit));

  const response = await fetch(query.toString(), {
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    return new Response(JSON.stringify({ error: "supabase_query_failed", detail }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = await response.json();
  const overdueLeads = Array.isArray(rows) ? rows : [];

  return new Response(
    JSON.stringify({
      ok: true,
      slaHours: hours,
      cutoffIso,
      overdueCount: overdueLeads.length,
      leads: overdueLeads,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
