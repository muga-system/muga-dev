-- Backfill basico de UTM en historicos cuando falta utm_source/utm_medium.
-- No reemplaza datos existentes: solo completa nulos o vacios.

begin;

update public.leads
set
  utm_source = case
    when coalesce(trim(utm_source), '') <> '' then utm_source
    when coalesce(trim(gclid), '') <> '' then 'google'
    when coalesce(trim(fbclid), '') <> '' then 'facebook'
    when coalesce(trim(source), '') <> '' then lower(trim(source))
    else 'direct'
  end,
  utm_medium = case
    when coalesce(trim(utm_medium), '') <> '' then utm_medium
    when coalesce(trim(gclid), '') <> '' then 'cpc'
    when coalesce(trim(fbclid), '') <> '' then 'cpc'
    when coalesce(trim(referrer), '') <> '' and lower(trim(referrer)) <> 'direct' then 'referral'
    else 'none'
  end
where coalesce(trim(utm_source), '') = ''
   or coalesce(trim(utm_medium), '') = '';

commit;

-- Verificacion rapida
select
  count(*) as total,
  count(*) filter (where coalesce(trim(utm_source), '') <> '') as con_utm_source,
  count(*) filter (where coalesce(trim(utm_campaign), '') <> '') as con_utm_campaign
from public.leads;
