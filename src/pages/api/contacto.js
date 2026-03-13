const requiredFields = ["name", "email", "message"];

export const prerender = false;

export const POST = async ({ request }) => {
  const supabaseUrl = import.meta.env.SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceRoleKey =
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const leadsTable =
    import.meta.env.SUPABASE_LEADS_TABLE || process.env.SUPABASE_LEADS_TABLE || "leads";
  const contentType = request.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

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

  if (cleanedPayload.created_at === "") {
    delete cleanedPayload.created_at;
  }

  for (const field of requiredFields) {
    const value = cleanedPayload[field];
    if (typeof value !== "string" || !value.trim()) {
      return new Response(JSON.stringify({ error: `missing_${field}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${leadsTable}`, {
    method: "POST",
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

  if (isJson) {
    return new Response(JSON.stringify({ ok: true, redirectTo: "/contacto/enviado" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.redirect(new URL("/contacto/enviado", request.url), 303);
};
