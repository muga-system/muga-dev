export const prerender = false;

const VALID_STATUSES = ["new", "contacted", "qualified", "won", "lost"];

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const escapeLikeValue = (value) => value.replace(/[,*]/g, "").trim();

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

  const status = (url.searchParams.get("status") || "all").toLowerCase();
  const rawSearch = url.searchParams.get("q") || "";
  const search = escapeLikeValue(rawSearch);
  const limit = parsePositiveInt(url.searchParams.get("limit"), 30);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const offset = (page - 1) * limit;

  const query = new URL(`${supabaseUrl}/rest/v1/${leadsTable}`);
  query.searchParams.set(
    "select",
    "id,created_at,last_contact_at,name,email,phone,project,budget,message,lead_stage,status,source,page",
  );
  query.searchParams.set("order", "created_at.desc");
  query.searchParams.set("limit", String(limit));
  query.searchParams.set("offset", String(offset));

  if (VALID_STATUSES.includes(status)) {
    query.searchParams.set("status", `eq.${status}`);
  }

  if (search) {
    query.searchParams.set(
      "or",
      `(name.ilike.*${search}*,email.ilike.*${search}*,phone.ilike.*${search}*)`,
    );
  }

  const response = await fetch(query.toString(), {
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      Prefer: "count=exact",
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
  const rangeHeader = response.headers.get("content-range") || "";
  const totalMatch = rangeHeader.match(/\/(\d+)$/);
  const total = totalMatch ? Number(totalMatch[1]) : Array.isArray(rows) ? rows.length : 0;

  return new Response(
    JSON.stringify({
      ok: true,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      rows: Array.isArray(rows) ? rows : [],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
