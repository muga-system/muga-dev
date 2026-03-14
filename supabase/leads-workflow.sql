alter table public.leads
add column if not exists last_contact_at timestamptz;

alter table public.leads
add column if not exists first_contact_at timestamptz;
