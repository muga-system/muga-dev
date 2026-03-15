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

const hoursSince = (isoDate) => {
  const parsed = new Date(String(isoDate || ""));
  if (Number.isNaN(parsed.getTime())) return 0;
  return (Date.now() - parsed.getTime()) / (1000 * 60 * 60);
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

  if (
    !supabaseUrl ||
    !supabaseServiceRoleKey ||
    !smtpHost ||
    !smtpPortRaw ||
    !smtpUser ||
    !smtpPass ||
    !alertFromEmail ||
    !alertToEmail
  ) {
    return new Response(JSON.stringify({ error: "missing_server_config" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const suppliedToken = getBearerToken(request);
  if (!cronToken || suppliedToken !== cronToken) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const warningHours = parsePositiveInt(url.searchParams.get("warning_hours"), 24);
  const criticalHours = parsePositiveInt(url.searchParams.get("critical_hours"), 48);
  const topLimit = Math.min(30, parsePositiveInt(url.searchParams.get("top"), 12));
  const oldestCutoffIso = new Date(Date.now() - warningHours * 60 * 60 * 1000).toISOString();

  const query = new URL(`${supabaseUrl}/rest/v1/${leadsTable}`);
  query.searchParams.set("select", "id,created_at,name,email,phone,project,budget,source,status,lead_stage");
  query.searchParams.set("status", "eq.new");
  query.searchParams.set("created_at", `lte.${oldestCutoffIso}`);
  query.searchParams.set("order", "created_at.asc");
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
  const criticalRows = rows.filter((lead) => hoursSince(lead.created_at) >= criticalHours);
  const warningRows = rows.filter((lead) => {
    const ageHours = hoursSince(lead.created_at);
    return ageHours >= warningHours && ageHours < criticalHours;
  });

  if (!criticalRows.length && !warningRows.length) {
    return new Response(
      JSON.stringify({
        ok: true,
        sent: false,
        warningHours,
        criticalHours,
        totalCandidates: rows.length,
        criticalCount: 0,
        warningCount: 0,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const criticalTop = criticalRows.slice(0, topLimit);
  const warningTop = warningRows.slice(0, topLimit);
  const subject = `Alerta SLA leads sin contacto · >${warningHours}h: ${warningRows.length} · >${criticalHours}h: ${criticalRows.length}`;

  const buildLine = (lead) => {
    const ageHours = Math.floor(hoursSince(lead.created_at));
    return `- #${lead.id} ${lead.name || "Sin nombre"} <${lead.email || "sin-email"}> · ${lead.project || "-"} · ${lead.budget || "-"} · ${ageHours}h`;
  };

  const lines = [
    "Alerta de SLA de primer contacto",
    "",
    `Umbral warning: >${warningHours}h`,
    `Umbral crítico: >${criticalHours}h`,
    "",
    `Leads nuevos sin contacto >${criticalHours}h: ${criticalRows.length}`,
    ...criticalTop.map(buildLine),
    "",
    `Leads nuevos sin contacto >${warningHours}h y <${criticalHours}h: ${warningRows.length}`,
    ...warningTop.map(buildLine),
  ];

  const htmlList = (items) =>
    items.length
      ? `<ul style=\"margin:0; padding-left:18px; color:#222; line-height:1.6;\">${items
          .map((lead) => {
            const ageHours = Math.floor(hoursSince(lead.created_at));
            return `<li>#${escapeHtml(lead.id)} ${escapeHtml(lead.name || "Sin nombre")} &lt;${escapeHtml(lead.email || "sin-email")}&gt; · ${escapeHtml(lead.project || "-")} · ${escapeHtml(lead.budget || "-")} · ${ageHours}h</li>`;
          })
          .join("")}</ul>`
      : "<p style=\"margin:0; color:#666;\">Sin leads en este bloque.</p>";

  const html = `
    <div style="font-family: Arial, sans-serif; background:#ffffff; color:#111111; padding:20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px; margin:0 auto; border:1px solid #ececec;">
        <tr>
          <td style="padding:22px;">
            <p style="margin:0 0 8px; font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#ff5353;">MUGA · SLA</p>
            <h2 style="margin:0 0 16px; color:#111; font-size:24px;">Leads nuevos sin contacto</h2>
            <p style="margin:0 0 12px; color:#333;">Umbral warning: &gt;${warningHours}h · Umbral crítico: &gt;${criticalHours}h</p>
            <p style="margin:0 0 10px; font-weight:600; color:#111;">Críticos (&gt;${criticalHours}h): ${criticalRows.length}</p>
            ${htmlList(criticalTop)}
            <p style="margin:18px 0 10px; font-weight:600; color:#111;">Warning (&gt;${warningHours}h y &lt;${criticalHours}h): ${warningRows.length}</p>
            ${htmlList(warningTop)}
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
      text: lines.join("\n"),
      html,
      replyTo: alertToEmail,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "smtp_send_failed", detail: String(error) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      sent: true,
      warningHours,
      criticalHours,
      totalCandidates: rows.length,
      criticalCount: criticalRows.length,
      warningCount: warningRows.length,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
