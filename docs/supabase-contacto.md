# Formulario con Supabase

## Variables de entorno

Usa estas variables (ver `.env.example`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_LEADS_TABLE` (default: `leads`)

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
