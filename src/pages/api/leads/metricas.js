export const prerender = false;

const getLeadTier = (lead) => {
  const stage = String(lead?.lead_stage || "").toLowerCase();
  const budget = String(lead?.budget || "").toLowerCase();
  if (stage === "high-intent" || budget === "premium") return "alto";
  if (stage === "qualified" || budget === "business") return "calificado";
  return "nuevo";
};

export const GET = async ({ request }) => {
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

  const query = new URL(`${supabaseUrl}/rest/v1/${leadsTable}`);
  query.searchParams.set("select", "id,created_at,status,lead_stage,budget");
  query.searchParams.set("order", "created_at.desc");
  query.searchParams.set("limit", "5000");

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
  const leads = Array.isArray(rows) ? rows : [];

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const metrics = {
    total: leads.length,
    byStatus: {
      new: 0,
      contacted: 0,
      qualified: 0,
      won: 0,
      lost: 0,
    },
    byTier: {
      alto: 0,
      calificado: 0,
      nuevo: 0,
    },
    last24h: 0,
  };

  leads.forEach((lead) => {
    const status = String(lead.status || "new").toLowerCase();
    if (status in metrics.byStatus) metrics.byStatus[status] += 1;

    const tier = getLeadTier(lead);
    metrics.byTier[tier] += 1;

    const createdAt = new Date(lead.created_at).getTime();
    if (!Number.isNaN(createdAt) && now - createdAt <= dayMs) {
      metrics.last24h += 1;
    }
  });

  const contactedOrMore =
    metrics.byStatus.contacted + metrics.byStatus.qualified + metrics.byStatus.won + metrics.byStatus.lost;
  const qualifiedOrMore = metrics.byStatus.qualified + metrics.byStatus.won;

  const funnel = {
    contactRate: metrics.total ? Number(((contactedOrMore / metrics.total) * 100).toFixed(1)) : 0,
    qualificationRate: metrics.total ? Number(((qualifiedOrMore / metrics.total) * 100).toFixed(1)) : 0,
    winRate: metrics.total ? Number(((metrics.byStatus.won / metrics.total) * 100).toFixed(1)) : 0,
  };

  return new Response(
    JSON.stringify({
      ok: true,
      metrics,
      funnel,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
