-- Queries de verificacion para atribucion UTM en leads

-- 1) Top 10 UTM source (global)
select
  coalesce(nullif(trim(utm_source), ''), 'sin_utm_source') as utm_source,
  count(*) as leads
from public.leads
group by 1
order by leads desc
limit 10;

-- 2) Top 10 UTM campaign (global)
select
  coalesce(nullif(trim(utm_campaign), ''), 'sin_utm_campaign') as utm_campaign,
  count(*) as leads
from public.leads
group by 1
order by leads desc
limit 10;

-- 3) Cruce source + campaign (top 20 combinaciones)
select
  coalesce(nullif(trim(utm_source), ''), 'sin_utm_source') as utm_source,
  coalesce(nullif(trim(utm_campaign), ''), 'sin_utm_campaign') as utm_campaign,
  count(*) as leads
from public.leads
group by 1, 2
order by leads desc
limit 20;

-- 4) Top source ultimos 30 dias
select
  coalesce(nullif(trim(utm_source), ''), 'sin_utm_source') as utm_source,
  count(*) as leads
from public.leads
where created_at >= now() - interval '30 days'
group by 1
order by leads desc
limit 10;
