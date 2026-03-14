create table if not exists public.lead_email_events (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  event_type text not null,
  recipient text,
  variant text,
  status text not null,
  detail text,
  lead_email text,
  lead_name text,
  lead_stage text,
  budget text
);
