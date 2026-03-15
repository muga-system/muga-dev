-- Backfill estimado de pais para historicos cuando ip_country esta vacio.
-- Prioridad: locale -> timezone -> desconocido
-- Este script es tolerante: crea columnas geo si aun no existen.

alter table public.leads
add column if not exists ip_country text;

alter table public.leads
add column if not exists ip_region text;

alter table public.leads
add column if not exists ip_city text;

begin;

update public.leads
set ip_country = case
  when coalesce(trim(ip_country), '') <> '' then upper(trim(ip_country))
  when coalesce(trim(locale), '') ~ '^[a-zA-Z]{2}-[a-zA-Z]{2}$' then upper(split_part(locale, '-', 2))
  when coalesce(trim(timezone), '') like 'America/Argentina%' then 'AR'
  when coalesce(trim(timezone), '') = 'America/Buenos_Aires' then 'AR'
  when coalesce(trim(timezone), '') like 'America/Sao_Paulo%' then 'BR'
  when coalesce(trim(timezone), '') like 'America/Santiago%' then 'CL'
  when coalesce(trim(timezone), '') like 'America/Bogota%' then 'CO'
  when coalesce(trim(timezone), '') like 'America/Lima%' then 'PE'
  when coalesce(trim(timezone), '') like 'America/Montevideo%' then 'UY'
  when coalesce(trim(timezone), '') like 'America/Mexico_City%' then 'MX'
  when coalesce(trim(timezone), '') like 'America/New_York%' then 'US'
  when coalesce(trim(timezone), '') like 'America/Los_Angeles%' then 'US'
  when coalesce(trim(timezone), '') like 'Europe/Madrid%' then 'ES'
  when coalesce(trim(timezone), '') like 'Europe/Lisbon%' then 'PT'
  when coalesce(trim(timezone), '') like 'Europe/Paris%' then 'FR'
  when coalesce(trim(timezone), '') like 'Europe/Berlin%' then 'DE'
  when coalesce(trim(timezone), '') like 'Europe/Rome%' then 'IT'
  when coalesce(trim(timezone), '') like 'Europe/London%' then 'GB'
  when coalesce(trim(timezone), '') like 'Australia/Sydney%' then 'AU'
  else null
end
where coalesce(trim(ip_country), '') = '';

commit;

-- Verificacion rapida
select
  count(*) as total,
  count(*) filter (where coalesce(trim(ip_country), '') <> '') as con_ip_country
from public.leads;
