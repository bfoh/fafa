-- Client-side diagnostics from the native WebView (release builds are not
-- inspectable and Vercel log tails drop lines). Service-role only.
create table live_activity_debug (
  id bigint generated always as identity primary key,
  order_id text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table live_activity_debug enable row level security;
