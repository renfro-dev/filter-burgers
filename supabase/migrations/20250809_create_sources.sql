create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  type text not null check (type in ('pdf','x','reddit','job','advertiser','article')),
  title text,
  author text,
  publish_date timestamptz,
  summary text,
  content text,
  newsletter text,
  inserted_at timestamptz not null default now()
);