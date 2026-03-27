alter table public.diagrams add column if not exists is_public boolean not null default false;
