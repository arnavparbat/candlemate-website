-- ==============================================================================
-- 🕯️ CANDLEMATE STOREFRONT: SUPABASE PRODUCTION DATABASE & REALTIME SETUP
-- ==============================================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- It creates the orders table, sets up image storage, and enables instant Realtime.

-- 1. Create the Orders Table
create table if not exists public.orders (
  id text primary key,
  customer_name text not null,
  customer_phone text not null,
  customer_address text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  status text not null default 'Order Received',
  screenshot text,
  screenshot_expired boolean default false,
  screenshot_expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Index for speedy ordering in studio dashboard
create index if not exists idx_orders_created_at on public.orders (created_at desc);

-- 2. Enable Realtime on the Orders Table (for Instant Studio Chime & Live Updates)
alter publication supabase_realtime add table public.orders;

-- 3. Row Level Security (RLS) Configuration
alter table public.orders enable row level security;

-- Allow customer checkouts to insert new orders
create policy "Allow public order creation"
  on public.orders
  for insert
  to anon, authenticated
  with check (true);

-- Allow studio dashboard to view all incoming orders
create policy "Allow studio dashboard order reading"
  on public.orders
  for select
  to anon, authenticated
  using (true);

-- Allow studio dashboard to update order status or delete screenshots
create policy "Allow studio dashboard order updates"
  on public.orders
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- Allow studio dashboard to delete orders
create policy "Allow studio dashboard order deletion"
  on public.orders
  for delete
  to anon, authenticated
  using (true);

-- 4. Create the Storage Bucket for Payment Screenshots (Proof Photos)
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do nothing;

-- Storage policies: Anyone can upload proof, anyone can view with URL
create policy "Allow public uploads of payment screenshots"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'payment-proofs');

create policy "Allow public viewing of payment screenshots"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'payment-proofs');

create policy "Allow studio deletion of payment screenshots"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'payment-proofs');
