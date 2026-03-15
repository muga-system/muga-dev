import nodemailer from "nodemailer";

const requiredFields = ["name", "email", "message"];
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const recentSubmissions = new Map();

const getClientIp = (request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
};

const getGeoContext = (request) => {
  const country = (request.headers.get("x-vercel-ip-country") || "").trim().toUpperCase();
  const region = (request.headers.get("x-vercel-ip-country-region") || "").trim();
  const city = (request.headers.get("x-vercel-ip-city") || "").trim();
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : "",
    region,
    city,
  };
};

const isRateLimited = (key) => {
  const now = Date.now();
  const previousTimestamps = recentSubmissions.get(key) || [];
  const validTimestamps = previousTimestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  validTimestamps.push(now);
  recentSubmissions.set(key, validTimestamps);
  return validTimestamps.length > RATE_LIMIT_MAX_REQUESTS;
};

const normalizeLowerText = (value) => String(value || "").trim().toLowerCase();

const parseHostname = (urlValue) => {
  try {
    return new URL(String(urlValue || "")).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const inferUtmSource = (payload) => {
  const existing = normalizeLowerText(payload.utm_source);
  if (existing) return existing;

  if (normalizeLowerText(payload.gclid)) return "google";
  if (normalizeLowerText(payload.fbclid)) return "facebook";

  const referrerHost = parseHostname(payload.referrer);
  if (referrerHost) return referrerHost;

  return "direct";
};

const inferUtmMedium = (payload) => {
  const existing = normalizeLowerText(payload.utm_medium);
  if (existing) return existing;

  if (normalizeLowerText(payload.gclid) || normalizeLowerText(payload.fbclid)) return "cpc";
  if (parseHostname(payload.referrer)) return "referral";
  return "none";
};

const resolveLeadVariant = ({ leadTier, budget, leadStage }) => {
  const normalizedTier = normalizeLowerText(leadTier);
  const normalizedBudget = normalizeLowerText(budget);
  const normalizedStage = normalizeLowerText(leadStage);

  if (normalizedTier === "premium" || normalizedBudget === "premium" || normalizedStage === "high-intent") {
    return "premium";
  }

  if (normalizedTier === "business" || normalizedBudget === "business" || normalizedStage === "qualified") {
    return "business";
  }

  return "start";
};

const buildCustomerReply = ({ variant, name }) => {
  const safeName = name || "";

  if (variant === "premium") {
    return {
      subject: "Recibimos tu consulta premium en MUGA",
      text: [
        `Hola ${safeName},`,
        "",
        "Recibimos tu consulta y ya la estamos priorizando internamente.",
        "Te respondemos dentro de 48 horas habiles con una propuesta clara de siguiente paso.",
        "",
        "Si queres avanzar mas rapido, respondenos este mail con 2 o 3 horarios posibles para una llamada breve.",
        "",
        "Equipo MUGA",
        "muga.dev",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; background:#ffffff; color:#111111; padding:24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:420px; margin:0 auto;">
            <tr>
              <td style="border:1px solid #e8e8e8; padding:30px 24px; background:#ffffff;">
                <p style="margin:0 0 10px; font-size:12px; letter-spacing:1px; color:#ff5353; text-transform:uppercase;">MUGA · PRIORIDAD ALTA</p>
                <h2 style="margin:0 0 20px; font-size:28px; line-height:1.2; color:#111111;">Recibimos tu consulta</h2>
                <p style="margin:0 0 16px; line-height:1.8; color:#222222;">Hola ${escapeHtml(safeName)},</p>
                <p style="margin:0 0 16px; line-height:1.8; color:#222222;">Recibimos tu consulta y ya la estamos priorizando internamente.</p>
                <p style="margin:0 0 16px; line-height:1.8; color:#222222;">Te respondemos dentro de 48 horas habiles con una propuesta clara de siguiente paso.</p>
                <p style="margin:0 0 22px; line-height:1.8; color:#222222;">Si queres avanzar mas rapido, respondenos este mail con 2 o 3 horarios posibles para una llamada breve.</p>
                <p style="margin:0; padding-top:14px; border-top:1px solid #ececec; color:#666666; font-size:13px;">Equipo MUGA · <a href="https://muga.dev" style="color:#ff5353; text-decoration:none;">muga.dev</a></p>
              </td>
            </tr>
          </table>
        </div>
      `,
    };
  }

  if (variant === "business") {
    return {
      subject: "Recibimos tu consulta business en MUGA",
      text: [
        `Hola ${safeName},`,
        "",
        "Gracias por escribirnos. Ya estamos revisando tu caso para ordenarte una recomendacion concreta.",
        "Te respondemos dentro de 48 horas habiles.",
        "",
        "Si queres, podes responder este mail con tu disponibilidad para una llamada breve.",
        "",
        "Equipo MUGA",
        "muga.dev",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; background:#ffffff; color:#111111; padding:24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:420px; margin:0 auto;">
            <tr>
              <td style="border:1px solid #e8e8e8; padding:30px 24px; background:#ffffff;">
                <p style="margin:0 0 10px; font-size:12px; letter-spacing:1px; color:#ff5353; text-transform:uppercase;">MUGA · BUSINESS</p>
                <h2 style="margin:0 0 20px; font-size:28px; line-height:1.2; color:#111111;">Recibimos tu consulta</h2>
                <p style="margin:0 0 16px; line-height:1.8; color:#222222;">Hola ${escapeHtml(safeName)},</p>
                <p style="margin:0 0 16px; line-height:1.8; color:#222222;">Gracias por escribirnos. Ya estamos revisando tu caso para ordenarte una recomendacion concreta.</p>
                <p style="margin:0 0 16px; line-height:1.8; color:#222222;">Te respondemos dentro de 48 horas habiles.</p>
                <p style="margin:0 0 22px; line-height:1.8; color:#222222;">Si queres, podes responder este mail con tu disponibilidad para una llamada breve.</p>
                <p style="margin:0; padding-top:14px; border-top:1px solid #ececec; color:#666666; font-size:13px;">Equipo MUGA · <a href="https://muga.dev" style="color:#ff5353; text-decoration:none;">muga.dev</a></p>
              </td>
            </tr>
          </table>
        </div>
      `,
    };
  }

  return {
    subject: "Recibimos tu consulta en MUGA",
    text: [
      `Hola ${safeName},`,
      "",
      "Recibimos tu consulta y ya estamos revisando tu caso.",
      "Te respondemos dentro de 48 horas habiles con una devolucion clara sobre el mejor siguiente paso.",
      "",
      "Si queres sumar contexto antes de nuestra respuesta, podes responder este mismo email.",
      "",
      "Equipo MUGA",
      "muga.dev",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; background:#ffffff; color:#111111; padding:24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:420px; margin:0 auto;">
          <tr>
            <td style="border:1px solid #e8e8e8; padding:30px 24px; background:#ffffff;">
              <p style="margin:0 0 10px; font-size:12px; letter-spacing:1px; color:#ff5353; text-transform:uppercase;">MUGA</p>
              <h2 style="margin:0 0 20px; font-size:28px; line-height:1.2; color:#111111;">Recibimos tu consulta</h2>
              <p style="margin:0 0 16px; line-height:1.8; color:#222222;">Hola ${escapeHtml(safeName)},</p>
              <p style="margin:0 0 16px; line-height:1.8; color:#222222;">Gracias por escribirnos. Ya estamos revisando tu caso.</p>
              <p style="margin:0 0 16px; line-height:1.8; color:#222222;">Te respondemos dentro de 48 horas habiles con una devolucion clara sobre el mejor siguiente paso.</p>
              <p style="margin:0 0 22px; line-height:1.8; color:#222222;">Si queres sumar contexto mientras tanto, podes responder este mismo email.</p>
              <p style="margin:0; padding-top:14px; border-top:1px solid #ececec; color:#666666; font-size:13px;">Equipo MUGA · <a href="https://muga.dev" style="color:#ff5353; text-decoration:none;">muga.dev</a></p>
            </td>
          </tr>
        </table>
      </div>
    `,
  };
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const prerender = false;

export const POST = async ({ request }) => {
  const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.SUPABASE_URL;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const leadsTable = process.env.SUPABASE_LEADS_TABLE || import.meta.env.SUPABASE_LEADS_TABLE || "leads";
  const smtpFailuresTable =
    process.env.SUPABASE_SMTP_FAILURES_TABLE || import.meta.env.SUPABASE_SMTP_FAILURES_TABLE || "smtp_failures";
  const emailEventsTable =
    process.env.SUPABASE_EMAIL_EVENTS_TABLE || import.meta.env.SUPABASE_EMAIL_EVENTS_TABLE || "lead_email_events";
  const alertWebhookUrl = process.env.AUTOMATION_ALERT_WEBHOOK_URL || import.meta.env.AUTOMATION_ALERT_WEBHOOK_URL;
  const smtpHost = process.env.SMTP_HOST || import.meta.env.SMTP_HOST;
  const smtpPortRaw = process.env.SMTP_PORT || import.meta.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER || import.meta.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS || import.meta.env.SMTP_PASS;
  const alertFromEmail = process.env.ALERT_FROM_EMAIL || import.meta.env.ALERT_FROM_EMAIL;
  const alertToEmail = process.env.ALERT_TO_EMAIL || import.meta.env.ALERT_TO_EMAIL;
  const autoReplyEnabledRaw = process.env.AUTO_REPLY_ENABLED || import.meta.env.AUTO_REPLY_ENABLED || "true";
  const autoReplyEnabled = autoReplyEnabledRaw.toLowerCase() !== "false";
  const contentType = request.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  let alertEmailSent = false;
  let customerReplySent = false;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const missing = [
      !supabaseUrl ? "SUPABASE_URL" : null,
      !supabaseServiceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter(Boolean);
    return new Response(JSON.stringify({ error: "missing_server_config", missing }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const persistEmailEvent = async ({ eventType, recipient, variant, status, detail }) => {
    const eventPayload = {
      event_type: eventType,
      recipient: recipient || null,
      variant: variant || null,
      status,
      detail: detail || null,
      lead_email: normalizedEmail || null,
      lead_name: cleanedPayload?.name || null,
      lead_stage: cleanedPayload?.lead_stage || null,
      budget: cleanedPayload?.budget || null,
      created_at: new Date().toISOString(),
    };

    try {
      await fetch(`${supabaseUrl}/rest/v1/${emailEventsTable}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(eventPayload),
      });
    } catch {
      // Never block lead flow on event tracking failures.
    }
  };

  const persistSmtpFailure = async (context, error) => {
    const errorMessage =
      typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : String(error || "unknown_error");

    const failurePayload = {
      context,
      error_message: errorMessage.slice(0, 1500),
      lead_email: normalizedEmail || null,
      lead_name: cleanedPayload?.name || null,
      lead_stage: cleanedPayload?.lead_stage || null,
      budget: cleanedPayload?.budget || null,
      source: cleanedPayload?.source || null,
      page: cleanedPayload?.page || null,
      created_at: new Date().toISOString(),
    };

    try {
      await fetch(`${supabaseUrl}/rest/v1/${smtpFailuresTable}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify(failurePayload),
      });
    } catch {
      // Do not block lead capture on alert persistence failures.
    }
  };

  let payload;
  if (isJson) {
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    const formData = await request.formData();
    payload = {};
    formData.forEach((value, key) => {
      payload[key] = typeof value === "string" ? value : "";
    });
  }

  const cleanedPayload = {};
  Object.entries(payload).forEach(([key, value]) => {
    cleanedPayload[key] = typeof value === "string" ? value.trim() : value;
  });

  const normalizedEmail =
    typeof cleanedPayload.email === "string" ? cleanedPayload.email.toLowerCase() : "";
  cleanedPayload.email = normalizedEmail;
  const leadVariant = resolveLeadVariant({
    leadTier: cleanedPayload.lead_tier,
    budget: cleanedPayload.budget,
    leadStage: cleanedPayload.lead_stage,
  });

  const honeypotValue =
    typeof cleanedPayload.company_website === "string" ? cleanedPayload.company_website.trim() : "";
  delete cleanedPayload.company_website;

  if (honeypotValue) {
    return new Response(JSON.stringify({ ok: true, redirectTo: "/contacto/enviado" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const clientIp = getClientIp(request);
  const geo = getGeoContext(request);
  const rateLimitKey = `${clientIp}:${normalizedEmail || "no-email"}`;
  if (isRateLimited(rateLimitKey)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  delete cleanedPayload.created_at;

  for (const field of requiredFields) {
    const value = cleanedPayload[field];
    if (typeof value !== "string" || !value.trim()) {
      return new Response(JSON.stringify({ error: `missing_${field}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  Object.entries(cleanedPayload).forEach(([key, value]) => {
    if (typeof value === "string" && value === "") {
      cleanedPayload[key] = null;
    }
  });

  cleanedPayload.utm_source = inferUtmSource(cleanedPayload);
  cleanedPayload.utm_medium = inferUtmMedium(cleanedPayload);
  cleanedPayload.ip_country = geo.country || null;
  cleanedPayload.ip_region = geo.region || null;
  cleanedPayload.ip_city = geo.city || null;

  if (!cleanedPayload.status) {
    cleanedPayload.status = "new";
  }

  let response = await fetch(`${supabaseUrl}/rest/v1/${leadsTable}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(cleanedPayload),
  });

  if (!response.ok && response.status === 400) {
    const fallbackPayload = { ...cleanedPayload };
    delete fallbackPayload.ip_country;
    delete fallbackPayload.ip_region;
    delete fallbackPayload.ip_city;

    response = await fetch(`${supabaseUrl}/rest/v1/${leadsTable}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(fallbackPayload),
    });
  }

  if (!response.ok) {
    const detail = await response.text();
    return new Response(JSON.stringify({ error: "supabase_insert_failed", detail }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const leadStage = (cleanedPayload.lead_stage || "").toString().toLowerCase();
  const budget = (cleanedPayload.budget || "").toString().toLowerCase();
  const isHighIntentLead = leadStage === "high-intent" || budget === "premium";
  const isQualifiedLead = leadStage === "qualified" || budget === "business";
  const leadTag = isHighIntentLead ? "LEAD ALTO" : isQualifiedLead ? "LEAD CALIFICADO" : "LEAD NUEVO";
  const leadSummary = [
    `Tipo: ${leadTag}`,
    "Accion: Nuevo",
    `Nombre: ${cleanedPayload.name || "-"}`,
    `Email: ${cleanedPayload.email || "-"}`,
    `Telefono: ${cleanedPayload.phone || "-"}`,
    `Proyecto: ${cleanedPayload.project || "-"}`,
    `Presupuesto: ${cleanedPayload.budget || "-"}`,
    `Lead stage: ${cleanedPayload.lead_stage || "-"}`,
    `Fuente: ${cleanedPayload.source || "-"}`,
    `Pagina: ${cleanedPayload.page || "-"}`,
    "",
    "Mensaje:",
    `${cleanedPayload.message || "-"}`,
  ].join("\n");



  if (alertWebhookUrl && isHighIntentLead) {
    const alertPayload = {
      type: "high_intent_lead",
      action: "created",
      at: new Date().toISOString(),
      lead: {
        id: null,
        name: cleanedPayload.name || null,
        email: cleanedPayload.email || null,
        phone: cleanedPayload.phone || null,
        project: cleanedPayload.project || null,
        budget: cleanedPayload.budget || null,
        lead_stage: cleanedPayload.lead_stage || null,
        source: cleanedPayload.source || null,
        page: cleanedPayload.page || null,
      },
    };

    try {
      await fetch(alertWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(alertPayload),
      });
    } catch {
      // Intentionally ignore webhook errors to not block lead capture.
    }
  }

  if (smtpHost && smtpPortRaw && smtpUser && smtpPass && alertFromEmail && alertToEmail) {
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

    const subject = `[${leadTag}] ${cleanedPayload.name || "Sin nombre"} - ${cleanedPayload.project || "sin formato"} - ${cleanedPayload.budget || "sin presupuesto"}`;

    try {
      await transporter.sendMail({
        from: alertFromEmail,
        to: recipients,
        replyTo: typeof cleanedPayload.email === "string" ? cleanedPayload.email : undefined,
        subject,
        text: leadSummary,
      });
      alertEmailSent = true;
      await persistEmailEvent({
        eventType: "internal_alert",
        recipient: recipients.join(","),
        variant: leadVariant,
        status: "sent",
      });
      console.info("[api/contacto] SMTP alert sent", {
        recipients,
        leadEmail: cleanedPayload.email || null,
        leadTag,
      });
    } catch (error) {
      console.error("[api/contacto] SMTP alert failed", error);
      await persistEmailEvent({
        eventType: "internal_alert",
        recipient: recipients.join(","),
        variant: leadVariant,
        status: "failed",
        detail: String(error),
      });
      await persistSmtpFailure("internal_alert", error);
    }

    const customerEmail = typeof cleanedPayload.email === "string" ? cleanedPayload.email : "";
    const canSendCustomerReply = autoReplyEnabled && customerEmail.includes("@");

    if (canSendCustomerReply) {
      const customerReply = buildCustomerReply({
        variant: leadVariant,
        name: cleanedPayload.name,
      });

      try {
        await transporter.sendMail({
          from: alertFromEmail,
          to: customerEmail,
          subject: customerReply.subject,
          text: customerReply.text,
          html: customerReply.html,
          replyTo: alertToEmail,
        });
        customerReplySent = true;
        await persistEmailEvent({
          eventType: "customer_reply",
          recipient: customerEmail,
          variant: leadVariant,
          status: "sent",
        });
        console.info("[api/contacto] Customer reply sent", {
          customerEmail,
        });
      } catch (error) {
        console.error("[api/contacto] Customer reply failed", error);
        await persistEmailEvent({
          eventType: "customer_reply",
          recipient: customerEmail,
          variant: leadVariant,
          status: "failed",
          detail: String(error),
        });
        await persistSmtpFailure("customer_reply", error);
      }
    }
  }

  if (isJson) {
    return new Response(
      JSON.stringify({
        ok: true,
        redirectTo: "/contacto/enviado",
        alertEmailSent,
        customerReplySent,
        leadTag,
        leadVariant,
      }),
      {
      status: 200,
      headers: { "Content-Type": "application/json" },
      },
    );
  }

  return Response.redirect(new URL("/contacto/enviado", request.url), 303);
};
