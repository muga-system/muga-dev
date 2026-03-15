-- Campo opcional de provincia para analitica local (Argentina)

alter table public.leads
add column if not exists province text;

create index if not exists leads_province_idx on public.leads (province);
