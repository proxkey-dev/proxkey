# QR Short Links Setup Guide

This guide will help you set up the QR short links functionality for ProxKey.

## 1. Database Schema Setup

Since the Supabase CLI is having connection issues, you'll need to apply the database schema manually through the Supabase Dashboard.

### Go to Supabase Dashboard
1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/jiguxwsfuolxsyqkejop)
2. Navigate to **SQL Editor**
3. Create a new query and paste the following SQL:

```sql
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
```

4. Click **Run** to execute the SQL

## 2. Storage Buckets Setup

### Create Storage Buckets
1. In the Supabase Dashboard, go to **Storage**
2. Create two new buckets:

#### QR Bucket
- **Name**: `qr`
- **Public**: ✅ Yes
- **File size limit**: 2MB
- **Allowed MIME types**: `image/svg+xml,image/png`

#### Issuer Logos Bucket
- **Name**: `issuer-logos`
- **Public**: ✅ Yes
- **File size limit**: 5MB
- **Allowed MIME types**: `image/svg+xml,image/png,image/jpeg,image/webp`

### Set Storage Policies
1. Go to **Storage** → **Policies**
2. Add the following policies:

#### For QR Bucket
```sql
-- Public read for qr
create policy "qr public read" 
on storage.objects for select 
to anon, authenticated 
using (bucket_id = 'qr');
```

#### For Issuer Logos Bucket
```sql
-- Public read for issuer-logos
create policy "issuer-logos public read" 
on storage.objects for select 
to anon, authenticated 
using (bucket_id = 'issuer-logos');
```

## 3. Environment Variables

Make sure your `.env.local` file contains:

```env
# Supabase Configuration for Next.js
NEXT_PUBLIC_SUPABASE_URL=https://jiguxwsfuolxsyqkejop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppZ3V4d3NmdW9seHN5cWtlam9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NTA2MTksImV4cCI6MjA3MzIyNjYxOX0.T6xrf4iztRa19RP7mZBQPnR6-GRoFaChZJOZCVKtSy4

# Service Role Key (needed for admin operations)
SUPABASE_SERVICE_ROLE=YOUR_SERVICE_ROLE_KEY_HERE

# Base URL for absolute links
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Important**: Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service role key from Supabase Dashboard → Settings → API.

## 4. Test the Implementation

Once everything is set up, you can test the QR short links functionality:

### Start the Development Server
```bash
npm run dev
```

### Create a Demo Link
```bash
curl -X POST http://localhost:3000/api/links/demo \
  -H 'Content-Type: application/json' \
  -d '{"issued_to":"Test User","ttl_minutes":60}'
```

### Test the Landing Page
Open the returned URL in your browser to see the QR code and link details.

### Test QR Generation
The QR code should be automatically generated and uploaded to the `qr` storage bucket.

## 5. Features Implemented

✅ **Database Schema**: Complete with RLS policies and public view
✅ **Storage Buckets**: QR and issuer-logos buckets with public access
✅ **API Endpoints**: 
   - `POST /api/links/demo` - Create demo links
   - `GET /api/qr/[slug]` - Generate and serve QR codes
✅ **Landing Page**: `GET /k/[slug]` - Display link details with QR code
✅ **Security**: Row-level security, public view without sensitive data
✅ **QR Generation**: SVG with ProxKey logo overlay
✅ **Responsive Design**: Mobile-friendly landing pages

## 6. Next Steps

- Add email verification flow for protected links
- Implement usage tracking and geofencing
- Add analytics dashboard
- Create admin interface for link management
- Add custom branding options

## Troubleshooting

### Database Connection Issues
If you encounter database connection issues with the CLI, use the Supabase Dashboard SQL Editor instead.

### Storage Upload Issues
Make sure the storage buckets are created and have the correct policies. Check that the service role key has the necessary permissions.

### QR Code Not Displaying
Verify that the QR API endpoint is working by visiting `/api/qr/[slug]` directly. Check the browser console for any errors.
