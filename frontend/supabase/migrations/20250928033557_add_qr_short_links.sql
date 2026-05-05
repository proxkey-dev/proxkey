-- === Core tables ===
create table if not exists public.short_links (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  type text not null check (type in ('redirect','demo','api')),
  target_url text,
  issued_to text,
  issuer text default 'ProxKey',
  api_key text,
  usage_limit integer,
  usage_count integer default 0,
  ttl_minutes integer,
  geofence_countries text[],
  block_same_ip_reuse boolean default false,
  require_email boolean default false,
  claim_status text default 'unclaimed' check (claim_status in ('unclaimed','pending','claimed')),
  claimed_by_email text,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.short_link_ip_log (
  id bigserial primary key,
  short_link_id uuid references public.short_links(id) on delete cascade,
  ip inet not null,
  ts timestamptz not null default now()
);

-- === RLS ===
alter table public.short_links enable row level security;
alter table public.short_link_ip_log enable row level security;

-- revoke direct table access from anon/auth; service_role can do all
revoke all on public.short_links from anon, authenticated;
revoke all on public.short_link_ip_log from anon, authenticated;

grant select, insert, update, delete on public.short_links to service_role;
grant select, insert, update, delete on public.short_link_ip_log to service_role;

-- public-safe view (no api_key / claimed_by_email). SECURITY INVOKER.
drop view if exists public.short_links_public_v;
create view public.short_links_public_v
with (security_invoker = true) as
select
  slug,
  type,
  issued_to,
  issuer,
  usage_limit,
  usage_count,
  ttl_minutes,
  created_at,
  geofence_countries,
  block_same_ip_reuse,
  require_email,
  claim_status,
  (ttl_minutes is not null and now() > created_at + make_interval(mins => ttl_minutes)) as is_expired
from public.short_links;

grant select on public.short_links_public_v to anon, authenticated;

-- allow anon/auth to SELECT underlying rows so the view can resolve (no direct grants on table)
drop policy if exists "public_read_via_view" on public.short_links;
create policy "public_read_via_view"
on public.short_links
for select
to anon, authenticated
using (true);

-- IP log: no public policies; only service_role uses it.

-- === Helper RPC (optional): atomic usage increment ===
create or replace function public.increment_usage(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.short_links
  set usage_count = coalesce(usage_count,0) + 1
  where id = p_id;
$$;
revoke all on function public.increment_usage(uuid) from anon, authenticated;
grant execute on function public.increment_usage(uuid) to service_role;
