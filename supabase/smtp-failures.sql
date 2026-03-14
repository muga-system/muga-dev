create table if not exists public.smtp_failures (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  context text not null,
  error_message text not null,
  lead_email text,
  lead_name text,
  lead_stage text,
  budget text,
  source text,
  page text
);
