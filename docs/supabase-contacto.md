# Formulario con Supabase

## Variables de entorno

Usa estas variables (ver `.env.example`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_LEADS_TABLE` (default: `leads`)
- `AUTOMATION_ALERT_WEBHOOK_URL` (opcional, para alertas high-intent)
- `SMTP_HOST` (opcional, alertas por email)
- `SMTP_PORT` (opcional, alertas por email)
- `SMTP_USER` (opcional, alertas por email)
- `SMTP_PASS` (opcional, alertas por email)
- `ALERT_FROM_EMAIL` (opcional, alertas por email)
- `ALERT_TO_EMAIL` (opcional, alertas por email)

El formulario no escribe directo a Supabase desde el navegador.
Envia a `src/pages/api/contacto.ts` y ese endpoint inserta con `service_role`.

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

## Automatizacion basica: alerta high-intent

Si defines `AUTOMATION_ALERT_WEBHOOK_URL`, el endpoint `/api/contacto` enviara un webhook cuando:

- `lead_stage = high-intent`, o
- `budget = premium`

El payload incluye `name`, `email`, `phone`, `project`, `budget`, `lead_stage`, `source` y `page`.
Esto sirve para conectar Slack, Discord, Make, n8n, Zapier u otro receptor.

Si configuras SMTP (por ejemplo Hostinger), tambien se envia email interno cuando el lead es high-intent.
