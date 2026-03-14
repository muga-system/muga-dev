# Formulario con Supabase

## Variables de entorno

Usa estas variables (ver `.env.example`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_LEADS_TABLE` (default: `leads`)
- `SUPABASE_SMTP_FAILURES_TABLE` (default: `smtp_failures`)
- `AUTOMATION_ALERT_WEBHOOK_URL` (opcional, para alertas high-intent)
- `SMTP_HOST` (opcional, alertas por email)
- `SMTP_PORT` (opcional, alertas por email)
- `SMTP_USER` (opcional, alertas por email)
- `SMTP_PASS` (opcional, alertas por email)
- `ALERT_FROM_EMAIL` (opcional, alertas por email)
- `ALERT_TO_EMAIL` (opcional, destino interno para todos los leads)
- `AUTO_REPLY_ENABLED` (opcional, `true` por defecto)
- `LEADS_CRON_TOKEN` (token para ejecutar resumen diario)

El formulario no escribe directo a Supabase desde el navegador.
Envia a `src/pages/api/contacto.js` y ese endpoint inserta con `service_role`.

## Tabla sugerida

```sql
create table if not exists public.leads (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  name text not null,
  email text not null,
  phone text,
  project text,
  budget text,
  message text not null,
  page text,
  landing_page text,
  referrer text,
  locale text,
  timezone text,
  user_agent text,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  fbclid text,
  status text,
  lead_tier text,
  lead_stage text,
  lead_route text
);
```

## RLS recomendado

```sql
alter table public.leads enable row level security;

drop policy if exists "allow_insert_via_service_role" on public.leads;

create policy "allow_insert_via_service_role"
on public.leads
for insert
to service_role
with check (true);
```

Mantene lectura/update/delete solo para roles internos.

## Automatizacion basica por email

Si configuras SMTP (por ejemplo Hostinger):

- se envia email interno para todos los leads a `ALERT_TO_EMAIL`
- el asunto se etiqueta por nivel (`LEAD ALTO`, `LEAD CALIFICADO`, `LEAD NUEVO`)
- se envia acuse de recibo al cliente indicando respuesta en 48 horas habiles (si `AUTO_REPLY_ENABLED` no es `false`)

## Anti-spam basico

`/api/contacto` incluye:

- honeypot (`company_website`) para frenar bots simples
- rate limit en memoria por `IP + email` (3 envios por minuto)

Si se supera el limite responde `429 rate_limited`.

## Alertas de fallo SMTP

Cuando falla un envio SMTP (alerta interna o autorespuesta), el sistema guarda el error en Supabase para seguimiento.

Tabla por defecto: `smtp_failures`

SQL de creacion:

`supabase/smtp-failures.sql`

## Resumen diario automatico

Endpoint interno: `GET /api/leads/resumen-diario`

Headers:

- `Authorization: Bearer <LEADS_CRON_TOKEN>`

Query params:

- `hours` (default `24`)

Ejemplo manual:

```bash
curl -sS "https://muga.dev/api/leads/resumen-diario?hours=24" \
  -H "Authorization: Bearer $LEADS_CRON_TOKEN"
```

Programacion en Vercel:

- `vercel.json` ejecuta este endpoint todos los dias a las 20:00 de Argentina (`0 23 * * *` UTC).
