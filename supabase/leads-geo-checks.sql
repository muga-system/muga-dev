-- Queries de verificacion para geodatos de leads

-- 1) Top paises (global)
select
  coalesce(nullif(trim(ip_country), ''), 'ZZ') as country,
  count(*) as leads
from public.leads
group by 1
order by leads desc
limit 10;

-- 2) Top paises ultimos 30 dias
select
  coalesce(nullif(trim(ip_country), ''), 'ZZ') as country,
  count(*) as leads
from public.leads
where created_at >= now() - interval '30 days'
group by 1
order by leads desc
limit 10;

-- 3) Detalle pais + timezone
select
  coalesce(nullif(trim(ip_country), ''), 'ZZ') as country,
  coalesce(nullif(trim(timezone), ''), 'sin_timezone') as timezone,
  count(*) as leads
from public.leads
group by 1, 2
order by leads desc
limit 20;
