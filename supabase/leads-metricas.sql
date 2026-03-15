-- Migracion para soporte de metricas y rendimiento en leads

-- 1) Columnas operativas de contacto
alter table public.leads
add column if not exists first_contact_at timestamptz;

alter table public.leads
add column if not exists last_contact_at timestamptz;

-- 2) Indices recomendados para panel de metricas
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_source_idx on public.leads (source);
create index if not exists leads_utm_source_idx on public.leads (utm_source);
create index if not exists leads_utm_campaign_idx on public.leads (utm_campaign);

-- 3) Verificacion de columnas relevantes
select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'leads'
  and column_name in (
    'first_contact_at',
    'last_contact_at',
    'utm_source',
    'utm_medium',
    'utm_campaign'
  )
order by column_name;
