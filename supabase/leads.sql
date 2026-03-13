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

alter table public.leads enable row level security;

drop policy if exists "Allow public lead insert" on public.leads;

create policy "Allow public lead insert"
on public.leads
for insert
to anon
with check (true);
