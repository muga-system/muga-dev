import nodemailer from "nodemailer";

export const prerender = false;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const getBearerToken = (request) => {
  const authHeader = request.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
};

const normalizeRows = (rows) => (Array.isArray(rows) ? rows : []);

const getLeadTier = (lead) => {
  const stage = String(lead?.lead_stage || "").toLowerCase();
  const budget = String(lead?.budget || "").toLowerCase();
  if (stage === "high-intent" || budget === "premium") return "alto";
  if (stage === "qualified" || budget === "business") return "calificado";
  return "nuevo";
};

export const GET = async ({ request, url }) => {
  const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.SUPABASE_URL;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const leadsTable = process.env.SUPABASE_LEADS_TABLE || import.meta.env.SUPABASE_LEADS_TABLE || "leads";
  const smtpHost = process.env.SMTP_HOST || import.meta.env.SMTP_HOST;
  const smtpPortRaw = process.env.SMTP_PORT || import.meta.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER || import.meta.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS || import.meta.env.SMTP_PASS;
  const alertFromEmail = process.env.ALERT_FROM_EMAIL || import.meta.env.ALERT_FROM_EMAIL;
  const alertToEmail = process.env.ALERT_TO_EMAIL || import.meta.env.ALERT_TO_EMAIL;
  const cronToken = process.env.LEADS_CRON_TOKEN || import.meta.env.LEADS_CRON_TOKEN;
  const adminToken = process.env.LEADS_ADMIN_TOKEN || import.meta.env.LEADS_ADMIN_TOKEN;

  if (!supabaseUrl || !supabaseServiceRoleKey || !smtpHost || !smtpPortRaw || !smtpUser || !smtpPass || !alertFromEmail || !alertToEmail) {
    return new Response(JSON.stringify({ error: "missing_server_config" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const suppliedToken = getBearerToken(request);
  const expectedToken = cronToken || adminToken;

  if (!expectedToken || suppliedToken !== expectedToken) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const hours = parsePositiveInt(url.searchParams.get("hours"), 24);
  const cutoffIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const query = new URL(`${supabaseUrl}/rest/v1/${leadsTable}`);
  query.searchParams.set(
    "select",
    "id,created_at,name,email,phone,project,budget,lead_stage,status,source,page",
  );
  query.searchParams.set("created_at", `gte.${cutoffIso}`);
  query.searchParams.set("order", "created_at.desc");
  query.searchParams.set("limit", "500");

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

  const rows = normalizeRows(await response.json());

  const summary = {
    total: rows.length,
    new: 0,
    contacted: 0,
    qualified: 0,
    won: 0,
    lost: 0,
    highIntent: 0,
    byTier: {
      alto: 0,
      calificado: 0,
      nuevo: 0,
    },
  };

  rows.forEach((lead) => {
    const status = String(lead.status || "new").toLowerCase();
    if (status in summary) summary[status] += 1;

    const tier = getLeadTier(lead);
    summary.byTier[tier] += 1;
    if (tier === "alto") summary.highIntent += 1;
  });

  const topHighIntent = rows
    .filter((lead) => getLeadTier(lead) === "alto")
    .slice(0, 10);

  const topNew = rows
    .filter((lead) => String(lead.status || "new").toLowerCase() === "new")
    .slice(0, 10);

  const subject = `Resumen diario de leads (${summary.total})`;
  const lines = [
    `Periodo: ultimas ${hours} horas`,
    "",
    `Total: ${summary.total}`,
    `New: ${summary.new}`,
    `Contacted: ${summary.contacted}`,
    `Qualified: ${summary.qualified}`,
    `Won: ${summary.won}`,
    `Lost: ${summary.lost}`,
    "",
    `Tier alto: ${summary.byTier.alto}`,
    `Tier calificado: ${summary.byTier.calificado}`,
    `Tier nuevo: ${summary.byTier.nuevo}`,
    "",
    "Leads alto (max 10):",
    ...topHighIntent.map((lead) => `- #${lead.id} ${lead.name || "Sin nombre"} <${lead.email || "sin-email"}> · ${lead.project || "-"} · ${lead.budget || "-"}`),
    "",
    "Leads new recientes (max 10):",
    ...topNew.map((lead) => `- #${lead.id} ${lead.name || "Sin nombre"} <${lead.email || "sin-email"}> · ${lead.project || "-"} · ${lead.budget || "-"}`),
  ];

  const text = lines.join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; background:#ffffff; color:#111111; padding:20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px; margin:0 auto; border:1px solid #ececec;">
        <tr>
          <td style="padding:22px;">
            <p style="margin:0 0 8px; font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#ff5353;">MUGA · Reporte</p>
            <h2 style="margin:0 0 16px; color:#111; font-size:24px;">Resumen diario de leads</h2>
            <p style="margin:0 0 14px; color:#333;">Periodo: ultimas ${hours} horas</p>
            <ul style="margin:0 0 16px; padding-left:18px; color:#222; line-height:1.6;">
              <li>Total: ${summary.total}</li>
              <li>New: ${summary.new}</li>
              <li>Contacted: ${summary.contacted}</li>
              <li>Qualified: ${summary.qualified}</li>
              <li>Won: ${summary.won}</li>
              <li>Lost: ${summary.lost}</li>
            </ul>
            <p style="margin:0 0 10px; font-weight:600; color:#111;">Tiers</p>
            <ul style="margin:0 0 16px; padding-left:18px; color:#222; line-height:1.6;">
              <li>Alto: ${summary.byTier.alto}</li>
              <li>Calificado: ${summary.byTier.calificado}</li>
              <li>Nuevo: ${summary.byTier.nuevo}</li>
            </ul>
            <p style="margin:0 0 10px; font-weight:600; color:#111;">Leads alto (max 10)</p>
            <ul style="margin:0 0 16px; padding-left:18px; color:#222; line-height:1.6;">
              ${topHighIntent.length ? topHighIntent.map((lead) => `<li>#${lead.id} ${lead.name || "Sin nombre"} &lt;${lead.email || "sin-email"}&gt; · ${lead.project || "-"} · ${lead.budget || "-"}</li>`).join("") : "<li>Sin leads alto en el periodo.</li>"}
            </ul>
            <p style="margin:0 0 10px; font-weight:600; color:#111;">Leads new recientes (max 10)</p>
            <ul style="margin:0; padding-left:18px; color:#222; line-height:1.6;">
              ${topNew.length ? topNew.map((lead) => `<li>#${lead.id} ${lead.name || "Sin nombre"} &lt;${lead.email || "sin-email"}&gt; · ${lead.project || "-"} · ${lead.budget || "-"}</li>`).join("") : "<li>Sin leads new en el periodo.</li>"}
            </ul>
          </td>
        </tr>
      </table>
    </div>
  `;

  const smtpPort = Number(smtpPortRaw);
  const recipients = alertToEmail
    .split(",")
    .map((recipient) => recipient.trim())
    .filter(Boolean);

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort !== 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      minVersion: "TLSv1.2",
    },
  });

  try {
    await transporter.sendMail({
      from: alertFromEmail,
      to: recipients,
      subject,
      text,
      html,
      replyTo: alertToEmail,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "smtp_send_failed", detail: String(error) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
