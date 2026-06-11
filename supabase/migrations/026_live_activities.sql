-- Live lock-screen activities (iOS Live Activity / Android ongoing notification).
-- One row per order. Service-role access only: RLS enabled with no policies, so
-- the anon key can't touch it (same trust model as rider_locations).
create table live_activities (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  apns_token text,                      -- ActivityKit update token; null = Android-only
  initial_distance_m double precision,  -- rider→customer distance at first out-for-delivery fix
  last_progress double precision,       -- throttle state
  last_eta_minutes integer,
  last_pushed_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table live_activities enable row level security;
