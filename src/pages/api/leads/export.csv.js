import { METRICAS_SESSION_COOKIE, isMetricasSessionValid } from "../../../lib/metricas-auth.js";

export const prerender = false;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const normalizeFilter = (value) => String(value || "all").trim().toLowerCase();

const escapeCsv = (value) => {
  const text = String(value ?? "");
  if (!text.includes('"') && !text.includes(",") && !text.includes("\n")) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (rows) => {
  const headers = ["created_at", "name", "email", "phone", "project", "status", "lead_stage", "budget", "source"];
  const lines = [headers.join(",")];

  rows.forEach((row) => {
    lines.push(
      [
        row.created_at,
        row.name,
        row.email,
        row.phone,
        row.project,
        row.status,
        row.lead_stage,
        row.budget,
        row.source,
      ]
        .map(escapeCsv)
        .join(","),
    );
  });

  return lines.join("\n");
};

export const GET = async ({ url, cookies }) => {
  const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.SUPABASE_URL;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const leadsTable = process.env.SUPABASE_LEADS_TABLE || import.meta.env.SUPABASE_LEADS_TABLE || "leads";
  const panelPassword = process.env.METRICAS_PANEL_PASSWORD || import.meta.env.METRICAS_PANEL_PASSWORD;
  const sessionSalt = process.env.METRICAS_SESSION_SALT || import.meta.env.METRICAS_SESSION_SALT || "muga-metricas-v1";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response("missing_server_config", { status: 500 });
  }

  const cookieValue = cookies.get(METRICAS_SESSION_COOKIE)?.value || "";
  const isAuthorized = isMetricasSessionValid({
    cookieValue,
    panelPassword,
    sessionSalt,
  });

  if (!isAuthorized) {
    return new Response("unauthorized", { status: 401 });
  }

  const dias = parsePositiveInt(url.searchParams.get("dias"), 30);
  const estado = normalizeFilter(url.searchParams.get("estado"));
  const fuente = normalizeFilter(url.searchParams.get("fuente"));
  const cutoffIso = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

  const query = new URL(`${supabaseUrl}/rest/v1/${leadsTable}`);
  query.searchParams.set("select", "created_at,name,email,phone,project,status,lead_stage,budget,source");
  query.searchParams.set("created_at", `gte.${cutoffIso}`);
  query.searchParams.set("order", "created_at.desc");
  query.searchParams.set("limit", "5000");

  const response = await fetch(query.toString(), {
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
  });

  if (!response.ok) {
    return new Response("supabase_query_failed", { status: 502 });
  }

  const rows = await response.json();
  const filteredRows = (Array.isArray(rows) ? rows : []).filter((row) => {
    const rowStatus = normalizeFilter(row.status || "new");
    const rowSource = normalizeFilter(row.source || "desconocido");

    if (estado !== "all" && rowStatus !== estado) return false;
    if (fuente !== "all" && rowSource !== fuente) return false;
    return true;
  });

  const csv = toCsv(filteredRows);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `leads-${stamp}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
};
