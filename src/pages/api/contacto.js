import nodemailer from "nodemailer";

const requiredFields = ["name", "email", "message"];
const mugaLogoUrl = "https://muga.dev/logo/logo.png";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const prerender = false;

export const POST = async ({ request }) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const leadsTable = process.env.SUPABASE_LEADS_TABLE || "leads";
  const alertWebhookUrl = process.env.AUTOMATION_ALERT_WEBHOOK_URL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPortRaw = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const alertFromEmail = process.env.ALERT_FROM_EMAIL;
  const alertToEmail = process.env.ALERT_TO_EMAIL;
  const autoReplyEnabledRaw = process.env.AUTO_REPLY_ENABLED || "true";
  const autoReplyEnabled = autoReplyEnabledRaw.toLowerCase() !== "false";
  const contentType = request.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  let alertEmailSent = false;
  let customerReplySent = false;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: "missing_server_config" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

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

  const existingResponse = await fetch(
    `${supabaseUrl}/rest/v1/${leadsTable}?select=id&email=eq.${encodeURIComponent(normalizedEmail)}&order=id.desc&limit=1`,
    {
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
      },
    },
  );

  if (!existingResponse.ok) {
    const detail = await existingResponse.text();
    return new Response(JSON.stringify({ error: "supabase_lookup_failed", detail }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const existingLeads = await existingResponse.json();
  const existingLead = Array.isArray(existingLeads) ? existingLeads[0] : null;

  const supabaseEndpoint = existingLead?.id
    ? `${supabaseUrl}/rest/v1/${leadsTable}?id=eq.${existingLead.id}`
    : `${supabaseUrl}/rest/v1/${leadsTable}`;
  const supabaseMethod = existingLead?.id ? "PATCH" : "POST";

  const response = await fetch(supabaseEndpoint, {
    method: supabaseMethod,
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(cleanedPayload),
  });

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
    `Accion: ${existingLead?.id ? "Actualizado" : "Nuevo"}`,
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

  const internalEmailHtml = `
    <div style="font-family: Arial, sans-serif; background:#0f0f0f; color:#f3f3f3; padding:24px;">
      <div style="max-width:640px; margin:0 auto; border:1px solid rgba(255,255,255,0.12); background:#141414; padding:20px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px;">
          <img src="${mugaLogoUrl}" alt="MUGA" width="44" height="44" style="border-radius:999px; border:1px solid rgba(255,255,255,0.2);" />
          <div>
            <p style="margin:0; font-size:12px; letter-spacing:1px; color:#ff5353; text-transform:uppercase;">${escapeHtml(leadTag)}</p>
            <h2 style="margin:4px 0 0; font-size:18px; color:#fff;">Nuevo ingreso de formulario</h2>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          <tr><td style="padding:6px 0; color:#a0a0a0;">Nombre</td><td style="padding:6px 0; color:#fff;">${escapeHtml(cleanedPayload.name || "-")}</td></tr>
          <tr><td style="padding:6px 0; color:#a0a0a0;">Email</td><td style="padding:6px 0; color:#fff;">${escapeHtml(cleanedPayload.email || "-")}</td></tr>
          <tr><td style="padding:6px 0; color:#a0a0a0;">Telefono</td><td style="padding:6px 0; color:#fff;">${escapeHtml(cleanedPayload.phone || "-")}</td></tr>
          <tr><td style="padding:6px 0; color:#a0a0a0;">Proyecto</td><td style="padding:6px 0; color:#fff;">${escapeHtml(cleanedPayload.project || "-")}</td></tr>
          <tr><td style="padding:6px 0; color:#a0a0a0;">Presupuesto</td><td style="padding:6px 0; color:#fff;">${escapeHtml(cleanedPayload.budget || "-")}</td></tr>
          <tr><td style="padding:6px 0; color:#a0a0a0;">Stage</td><td style="padding:6px 0; color:#fff;">${escapeHtml(cleanedPayload.lead_stage || "-")}</td></tr>
          <tr><td style="padding:6px 0; color:#a0a0a0;">Fuente</td><td style="padding:6px 0; color:#fff;">${escapeHtml(cleanedPayload.source || "-")}</td></tr>
          <tr><td style="padding:6px 0; color:#a0a0a0;">Pagina</td><td style="padding:6px 0; color:#fff;">${escapeHtml(cleanedPayload.page || "-")}</td></tr>
        </table>
        <div style="margin-top:18px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.12);">
          <p style="margin:0 0 6px; font-size:12px; color:#a0a0a0; text-transform:uppercase; letter-spacing:0.8px;">Mensaje</p>
          <p style="margin:0; line-height:1.6; color:#fff;">${escapeHtml(cleanedPayload.message || "-")}</p>
        </div>
      </div>
    </div>
  `;

  if (alertWebhookUrl && isHighIntentLead) {
    const alertPayload = {
      type: "high_intent_lead",
      action: existingLead?.id ? "updated" : "created",
      at: new Date().toISOString(),
      lead: {
        id: existingLead?.id || null,
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
        html: internalEmailHtml,
      });
      alertEmailSent = true;
      console.info("[api/contacto] SMTP alert sent", {
        recipients,
        leadEmail: cleanedPayload.email || null,
        leadTag,
      });
    } catch (error) {
      console.error("[api/contacto] SMTP alert failed", error);
    }

    const customerEmail = typeof cleanedPayload.email === "string" ? cleanedPayload.email : "";
    const canSendCustomerReply = autoReplyEnabled && customerEmail.includes("@");

    if (canSendCustomerReply) {
      const customerSubject = "Recibimos tu consulta en MUGA";
      const customerText = [
        `Hola ${cleanedPayload.name || ""},`,
        "",
        "Recibimos tu consulta y ya estamos revisando tu caso.",
        "Te respondemos dentro de 48 horas habiles con una devolucion clara sobre el mejor siguiente paso.",
        "",
        "Si queres sumar contexto antes de nuestra respuesta, podes responder este mismo email.",
        "",
        "Equipo MUGA",
        "muga.dev",
      ].join("\n");
      const customerHtml = `
        <div style="font-family: Arial, sans-serif; background:#0f0f0f; color:#f3f3f3; padding:24px;">
          <div style="max-width:640px; margin:0 auto; border:1px solid rgba(255,255,255,0.12); background:#141414; padding:20px;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px;">
              <img src="${mugaLogoUrl}" alt="MUGA" width="44" height="44" style="border-radius:999px; border:1px solid rgba(255,255,255,0.2);" />
              <div>
                <p style="margin:0; font-size:12px; letter-spacing:1px; color:#ff5353; text-transform:uppercase;">MUGA</p>
                <h2 style="margin:4px 0 0; font-size:18px; color:#fff;">Recibimos tu consulta</h2>
              </div>
            </div>
            <p style="margin:0 0 12px; line-height:1.7; color:#fff;">Hola ${escapeHtml(cleanedPayload.name || "")},</p>
            <p style="margin:0 0 12px; line-height:1.7; color:#fff;">Gracias por escribirnos. Ya estamos revisando tu caso y te respondemos dentro de 48 horas habiles con una devolucion clara sobre el mejor siguiente paso.</p>
            <p style="margin:0 0 16px; line-height:1.7; color:#fff;">Si queres sumar contexto mientras tanto, podes responder este mismo email.</p>
            <div style="padding-top:14px; border-top:1px solid rgba(255,255,255,0.12);">
              <p style="margin:0; color:#a0a0a0; font-size:13px;">Equipo MUGA · <a href="https://muga.dev" style="color:#ff5353; text-decoration:none;">muga.dev</a></p>
            </div>
          </div>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: alertFromEmail,
          to: customerEmail,
          subject: customerSubject,
          text: customerText,
          html: customerHtml,
          replyTo: alertToEmail,
        });
        customerReplySent = true;
        console.info("[api/contacto] Customer reply sent", {
          customerEmail,
        });
      } catch (error) {
        console.error("[api/contacto] Customer reply failed", error);
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
      }),
      {
      status: 200,
      headers: { "Content-Type": "application/json" },
      },
    );
  }

  return Response.redirect(new URL("/contacto/enviado", request.url), 303);
};
