-- Backfill inicial para timestamps de contacto en leads historicos.
-- Ejecutar despues de crear first_contact_at y last_contact_at.

-- 1) Vista previa de impacto (opcional)
select
  count(*) as total_leads,
  count(*) filter (where status in ('contacted', 'qualified', 'won', 'lost')) as leads_contactados_o_mas,
  count(*) filter (where status in ('contacted', 'qualified', 'won', 'lost') and first_contact_at is null) as pendientes_first_contact,
  count(*) filter (where status in ('contacted', 'qualified', 'won', 'lost') and last_contact_at is null) as pendientes_last_contact
from public.leads;

begin;

-- 2) Si ya hubo contacto comercial y first_contact_at esta vacio,
-- usar last_contact_at si existe; si no, usar created_at como baseline historica.
update public.leads
set first_contact_at = coalesce(last_contact_at, created_at)
where status in ('contacted', 'qualified', 'won', 'lost')
  and first_contact_at is null;

-- 3) Si ya hubo contacto comercial y last_contact_at esta vacio,
-- completar con first_contact_at (si ya existe) o created_at.
update public.leads
set last_contact_at = coalesce(first_contact_at, created_at)
where status in ('contacted', 'qualified', 'won', 'lost')
  and last_contact_at is null;

commit;

-- 4) Verificacion posterior
select
  count(*) filter (where status in ('contacted', 'qualified', 'won', 'lost') and first_contact_at is null) as first_contact_null_restantes,
  count(*) filter (where status in ('contacted', 'qualified', 'won', 'lost') and last_contact_at is null) as last_contact_null_restantes
from public.leads;
