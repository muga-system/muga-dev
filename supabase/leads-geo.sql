-- Campos geo para analitica de origen por pais/region/ciudad

alter table public.leads
add column if not exists ip_country text;

alter table public.leads
add column if not exists ip_region text;

alter table public.leads
add column if not exists ip_city text;

create index if not exists leads_ip_country_idx on public.leads (ip_country);
