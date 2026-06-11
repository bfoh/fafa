# Live Order Tracking on the Lock Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uber-style lock-screen order tracking: iOS Live Activity + Android ongoing notification with a segmented lifecycle progress bar whose delivery leg fills in real time from rider GPS, updated entirely by backend pushes.

**Architecture:** Event-driven server push. Two existing backend touchpoints (order-status notification hub, rider GPS ingest) call a new `updateLiveActivity` orchestrator that computes content state with pure functions and pushes via a new direct-APNs client (iOS) and an FCM data-message variant (Android). The iOS shell gains a Capacitor plugin + WidgetKit extension; Android gains a messaging service that renders ongoing notifications.

**Tech Stack:** Next.js (apps/web, Vercel), Supabase (Postgres, service-role access), node:http2 + ES256 JWT for APNs, FCM HTTP v1, Capacitor 6, SwiftUI/ActivityKit/WidgetKit, Android NotificationCompat, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-live-activity-design.md`

**Conventions:** All web work in `apps/web` (run `npx vitest run` and `npx tsc --noEmit -p .` from `apps/web`). Native code is CI-verified only (no local Xcode/Android SDK) — Codemagic builds via tags. Read `apps/web/AGENTS.md` note: check `node_modules/next/dist/docs/` before using unfamiliar Next.js APIs.

---

### Task 1: `live_activities` table migration

**Files:**
- Create: `supabase/migrations/026_live_activities.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply to Supabase**

Run from repo root: `npx supabase db push` (if the project uses linked CLI) — otherwise paste the SQL into the Supabase dashboard SQL editor (check how migrations 024/025 were applied; follow the same path). Verify with a select:

```sql
select * from live_activities limit 1;
```
Expected: empty result, no error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/026_live_activities.sql
git commit -m "feat(db): live_activities table for lock-screen order tracking"
```

---

### Task 2: Pure content-state module (TDD)

**Files:**
- Create: `apps/web/lib/live-activity/content-state.ts`
- Test: `apps/web/lib/live-activity/content-state.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  phaseForStatus,
  deliveryProgress,
  deliveryEtaMinutes,
  prepEtaMinutes,
  statusTextFor,
  shouldPushRiderUpdate,
  type ActivityPhase,
} from './content-state';

describe('haversineMeters', () => {
  it('computes a known distance (Accra Independence Square → Kwame Nkrumah Mausoleum ≈ 1.0–1.6 km)', () => {
    const d = haversineMeters(5.5471, -0.1924, 5.5450, -0.2050);
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1700);
  });

  it('is zero for identical points', () => {
    expect(haversineMeters(5.6, -0.2, 5.6, -0.2)).toBe(0);
  });
});

describe('phaseForStatus', () => {
  it('maps order statuses to phases', () => {
    expect(phaseForStatus('pending')).toBe('confirmed');
    expect(phaseForStatus('confirmed')).toBe('confirmed');
    expect(phaseForStatus('preparing')).toBe('preparing');
    expect(phaseForStatus('ready')).toBe('ready');
    expect(phaseForStatus('out_for_delivery')).toBe('on_the_way');
    expect(phaseForStatus('delivered')).toBe('delivered');
    expect(phaseForStatus('cancelled')).toBe('cancelled');
  });

  it('returns null for unknown statuses', () => {
    expect(phaseForStatus('garbage')).toBeNull();
  });
});

describe('deliveryProgress', () => {
  it('is 1 - remaining/initial', () => {
    expect(deliveryProgress(2000, 1000, null)).toBeCloseTo(0.5);
  });

  it('clamps to 0..1', () => {
    expect(deliveryProgress(2000, 2500, null)).toBe(0);
    expect(deliveryProgress(2000, 0, null)).toBe(1);
  });

  it('never decreases below previous progress (GPS jitter)', () => {
    expect(deliveryProgress(2000, 1500, 0.6)).toBe(0.6);
  });
});

describe('deliveryEtaMinutes', () => {
  it('uses distance / speed', () => {
    // 1650 m at 5.5 m/s = 300 s = 5 min
    expect(deliveryEtaMinutes(1650, 5.5)).toBe(5);
  });

  it('clamps absurd speeds into 1.5–15 m/s', () => {
    expect(deliveryEtaMinutes(900, 100)).toBe(deliveryEtaMinutes(900, 15));
    expect(deliveryEtaMinutes(900, 0.1)).toBe(deliveryEtaMinutes(900, 1.5));
  });

  it('falls back to 5.5 m/s when speed missing', () => {
    expect(deliveryEtaMinutes(1650, null)).toBe(5);
  });

  it('floors at 1 minute while distance remains', () => {
    expect(deliveryEtaMinutes(50, 5.5)).toBe(1);
  });
});

describe('prepEtaMinutes', () => {
  const now = new Date('2026-06-11T12:00:00Z');

  it('minutes until estimated_ready_at plus zone minutes', () => {
    expect(prepEtaMinutes('2026-06-11T12:10:00Z', 8, now)).toBe(18);
  });

  it('null without estimated_ready_at', () => {
    expect(prepEtaMinutes(null, 8, now)).toBeNull();
  });

  it('zone minutes only added for delivery legs that exist (null zone = just prep)', () => {
    expect(prepEtaMinutes('2026-06-11T12:10:00Z', null, now)).toBe(10);
  });

  it('floors at 1 when estimate has passed', () => {
    expect(prepEtaMinutes('2026-06-11T11:50:00Z', null, now)).toBe(1);
  });
});

describe('statusTextFor', () => {
  it('matches approved copy', () => {
    expect(statusTextFor('confirmed', null)).toBe('Order confirmed');
    expect(statusTextFor('preparing', null)).toBe('Preparing your order');
    expect(statusTextFor('ready', null)).toBe('Your order is ready!');
    expect(statusTextFor('on_the_way', 1800)).toBe('Rider is on the way — 1.8 km');
    expect(statusTextFor('on_the_way', 240)).toBe('Rider is arriving 🛵');
    expect(statusTextFor('delivered', null)).toBe('Delivered. Enjoy your meal! 🎉');
    expect(statusTextFor('cancelled', null)).toBe('Your order was cancelled');
  });

  it('omits distance when unknown', () => {
    expect(statusTextFor('on_the_way', null)).toBe('Rider is on the way');
  });
});

describe('shouldPushRiderUpdate', () => {
  const now = new Date('2026-06-11T12:00:00Z');
  const base = { lastPushedAt: '2026-06-11T11:59:00Z', lastProgress: 0.4, lastEtaMinutes: 6 };

  it('pushes when bar visibly moves and ≥20s elapsed', () => {
    expect(shouldPushRiderUpdate(base, { progress: 0.45, etaMinutes: 6 }, now)).toBe(true);
  });

  it('skips when under 20s since last push', () => {
    const recent = { ...base, lastPushedAt: '2026-06-11T11:59:50Z' };
    expect(shouldPushRiderUpdate(recent, { progress: 0.9, etaMinutes: 1 }, now)).toBe(false);
  });

  it('skips when bar would not visibly move and ETA unchanged', () => {
    expect(shouldPushRiderUpdate(base, { progress: 0.41, etaMinutes: 6 }, now)).toBe(false);
  });

  it('pushes on ETA change even with tiny progress delta', () => {
    expect(shouldPushRiderUpdate(base, { progress: 0.41, etaMinutes: 5 }, now)).toBe(true);
  });

  it('pushes when never pushed before', () => {
    expect(
      shouldPushRiderUpdate({ lastPushedAt: null, lastProgress: null, lastEtaMinutes: null }, { progress: 0.01, etaMinutes: 9 }, now)
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/web`: `npx vitest run lib/live-activity/content-state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
/**
 * Pure content-state logic for lock-screen order tracking (iOS Live Activity /
 * Android ongoing notification). No I/O here — everything is unit-testable.
 * Spec: docs/superpowers/specs/2026-06-11-live-activity-design.md
 */

export type ActivityPhase =
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export interface ActivityContentState {
  phase: ActivityPhase;
  progress: number; // 0..1 within the on_the_way leg; 1 once delivered
  etaMinutes: number | null;
  statusText: string;
  distanceMeters: number | null;
}

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function phaseForStatus(status: string): ActivityPhase | null {
  switch (status) {
    case 'pending':
    case 'confirmed':
      return 'confirmed';
    case 'preparing':
      return 'preparing';
    case 'ready':
      return 'ready';
    case 'out_for_delivery':
      return 'on_the_way';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

/** Progress within the delivery leg: monotonic (never backslides on GPS jitter). */
export function deliveryProgress(
  initialM: number,
  remainingM: number,
  lastProgress: number | null
): number {
  const raw = initialM > 0 ? 1 - remainingM / initialM : 0;
  const clamped = Math.min(1, Math.max(0, raw));
  return lastProgress != null ? Math.max(lastProgress, clamped) : clamped;
}

const MIN_SPEED_MPS = 1.5; // ≈5 km/h — below this, rider is effectively stopped
const MAX_SPEED_MPS = 15;  // ≈54 km/h — city ceiling; GPS speed spikes clipped
const FALLBACK_SPEED_MPS = 5.5; // ≈20 km/h city average

export function deliveryEtaMinutes(remainingM: number, speedMps: number | null): number {
  const speed = Math.min(MAX_SPEED_MPS, Math.max(MIN_SPEED_MPS, speedMps ?? FALLBACK_SPEED_MPS));
  return Math.max(1, Math.round(remainingM / speed / 60));
}

export function prepEtaMinutes(
  estimatedReadyAt: string | null,
  zoneMinutes: number | null,
  now: Date
): number | null {
  if (!estimatedReadyAt) return null;
  const prepMs = new Date(estimatedReadyAt).getTime() - now.getTime();
  const prepMin = Math.max(0, prepMs / 60000);
  return Math.max(1, Math.round(prepMin + (zoneMinutes ?? 0)));
}

const ARRIVING_THRESHOLD_M = 300;

export function statusTextFor(phase: ActivityPhase, distanceMeters: number | null): string {
  switch (phase) {
    case 'confirmed':
      return 'Order confirmed';
    case 'preparing':
      return 'Preparing your order';
    case 'ready':
      return 'Your order is ready!';
    case 'on_the_way':
      if (distanceMeters == null) return 'Rider is on the way';
      if (distanceMeters <= ARRIVING_THRESHOLD_M) return 'Rider is arriving 🛵';
      return `Rider is on the way — ${(distanceMeters / 1000).toFixed(1)} km`;
    case 'delivered':
      return 'Delivered. Enjoy your meal! 🎉';
    case 'cancelled':
      return 'Your order was cancelled';
  }
}

const MIN_PUSH_INTERVAL_MS = 20000;
const MIN_VISIBLE_PROGRESS_DELTA = 0.02;

/** Throttle for rider-movement updates. Status-change pushes bypass this. */
export function shouldPushRiderUpdate(
  prev: { lastPushedAt: string | null; lastProgress: number | null; lastEtaMinutes: number | null },
  next: { progress: number; etaMinutes: number | null },
  now: Date
): boolean {
  if (prev.lastPushedAt == null) return true;
  if (now.getTime() - new Date(prev.lastPushedAt).getTime() < MIN_PUSH_INTERVAL_MS) return false;
  const progressMoved =
    prev.lastProgress == null ||
    Math.abs(next.progress - prev.lastProgress) >= MIN_VISIBLE_PROGRESS_DELTA;
  const etaChanged = next.etaMinutes !== prev.lastEtaMinutes;
  return progressMoved || etaChanged;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `apps/web`: `npx vitest run lib/live-activity/content-state.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/live-activity/content-state.ts apps/web/lib/live-activity/content-state.test.ts
git commit -m "feat(live-activity): pure content-state computation with tests"
```

---

### Task 3: APNs client (TDD on JWT + gating)

**Files:**
- Create: `apps/web/lib/push/apns.ts`
- Test: `apps/web/lib/push/apns.test.ts`

- [ ] **Step 1: Write the failing tests**

JWT shape is testable without hitting Apple; the HTTP/2 send is exercised only when env-configured (it is best-effort and logged in callers).

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Generate a real EC P-256 key for signing tests.
import { generateKeyPairSync, createVerify } from 'crypto';
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

describe('apns', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('isApnsConfigured false without env', async () => {
    const { isApnsConfigured } = await import('./apns');
    expect(isApnsConfigured()).toBe(false);
  });

  it('isApnsConfigured true with full env', async () => {
    vi.stubEnv('APNS_TEAM_ID', 'TEAM123456');
    vi.stubEnv('APNS_KEY_ID', 'KEY1234567');
    vi.stubEnv('APNS_PRIVATE_KEY', pem);
    const { isApnsConfigured } = await import('./apns');
    expect(isApnsConfigured()).toBe(true);
  });

  it('builds a valid ES256 JWT (header kid, claims iss/iat, verifiable signature)', async () => {
    vi.stubEnv('APNS_TEAM_ID', 'TEAM123456');
    vi.stubEnv('APNS_KEY_ID', 'KEY1234567');
    vi.stubEnv('APNS_PRIVATE_KEY', pem);
    const { apnsJwtForTesting } = await import('./apns');
    const jwt = apnsJwtForTesting();
    const [h, c, s] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({
      alg: 'ES256',
      kid: 'KEY1234567',
    });
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
    expect(claims.iss).toBe('TEAM123456');
    expect(typeof claims.iat).toBe('number');
    const verify = createVerify('SHA256').update(`${h}.${c}`);
    expect(verify.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/web`: `npx vitest run lib/push/apns.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import crypto from 'crypto';
import http2 from 'http2';

/**
 * Direct APNs HTTP/2 client for Live Activity updates. FCM cannot deliver
 * `liveactivity` pushes, so this talks to Apple directly. Env-gated like
 * lib/push/fcm.ts — with no key configured every caller is a no-op.
 *
 * Env:
 *   APNS_TEAM_ID      Apple Developer team id
 *   APNS_KEY_ID       APNs auth key id (from the .p8 download page)
 *   APNS_PRIVATE_KEY  .p8 contents (\n-escaped is fine)
 *   APNS_ENV          'production' (default; TestFlight uses production) | 'sandbox'
 */

const TEAM_ID = process.env.APNS_TEAM_ID;
const KEY_ID = process.env.APNS_KEY_ID;
const PRIVATE_KEY = process.env.APNS_PRIVATE_KEY
  ?.replace(/^["']|["']$/g, '')
  ?.replace(/\\n/g, '\n')
  ?.trim();
const BUNDLE_ID = 'com.ghdidi.app';
const HOST =
  process.env.APNS_ENV === 'sandbox'
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com';

export function isApnsConfigured(): boolean {
  return !!(TEAM_ID && KEY_ID && PRIVATE_KEY);
}

// ── ES256 provider JWT (cached ~50 min; Apple allows 20–60) ──
let cachedJwt: { value: string; iat: number } | null = null;

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function apnsJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.iat < 3000) return cachedJwt.value;

  const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID }));
  const claims = b64url(JSON.stringify({ iss: TEAM_ID, iat: now }));
  const signature = crypto
    .createSign('SHA256')
    .update(`${header}.${claims}`)
    .sign({ key: PRIVATE_KEY as string, dsaEncoding: 'ieee-p1363' })
    .toString('base64url');
  const jwt = `${header}.${claims}.${signature}`;
  cachedJwt = { value: jwt, iat: now };
  return jwt;
}

/** Test-only export: JWT building without sending. */
export function apnsJwtForTesting(): string {
  return apnsJwt();
}

export interface LiveActivityPush {
  event: 'update' | 'end';
  contentState: Record<string, unknown>;
  /** 10 = deliver now (status changes, arrival); 5 = opportunistic (bar movement). */
  priority?: 5 | 10;
}

export type ApnsSendResult = 'ok' | 'stale' | 'error';

/** Single-shot HTTP/2 POST. APNs requires HTTP/2; fetch() can't do it. */
function http2Post(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const origin = new URL(url).origin;
    const client = http2.connect(origin);
    client.on('error', reject);
    const req = client.request({
      ':method': 'POST',
      ':path': new URL(url).pathname,
      ...headers,
    });
    let data = '';
    let status = 0;
    req.on('response', (h) => {
      status = Number(h[':status'] ?? 0);
    });
    req.setEncoding('utf8');
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      client.close();
      resolve({ status, body: data });
    });
    req.on('error', (err) => {
      client.close();
      reject(err);
    });
    req.end(body);
  });
}

export async function sendLiveActivityPush(
  token: string,
  push: LiveActivityPush
): Promise<ApnsSendResult> {
  if (!isApnsConfigured()) return 'error';
  try {
    const payload = JSON.stringify({
      aps: {
        timestamp: Math.floor(Date.now() / 1000),
        event: push.event,
        'content-state': push.contentState,
      },
    });
    const { status, body } = await http2Post(`${HOST}/3/device/${token}`, {
      authorization: `bearer ${apnsJwt()}`,
      'apns-topic': `${BUNDLE_ID}.push-type.liveactivity`,
      'apns-push-type': 'liveactivity',
      'apns-priority': String(push.priority ?? 10),
      'content-type': 'application/json',
    }, payload);

    if (status === 200) return 'ok';
    if (status === 410 || body.includes('BadDeviceToken') || body.includes('Unregistered')) {
      return 'stale';
    }
    console.error(`APNs live activity push ${status}: ${body}`);
    return 'error';
  } catch (err) {
    console.error('APNs live activity push failed:', err);
    return 'error';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `apps/web`: `npx vitest run lib/push/apns.test.ts`
Expected: all PASS. Note: tests import with `vi.resetModules()` + dynamic import so env stubs apply to module-level constants.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/push/apns.ts apps/web/lib/push/apns.test.ts
git commit -m "feat(push): direct APNs HTTP/2 client for Live Activity updates"
```

---

### Task 4: FCM data-only message variant

**Files:**
- Modify: `apps/web/lib/push/fcm.ts` (after `sendPush`, around line 131)

- [ ] **Step 1: Add `sendDataPush` to fcm.ts**

Insert after the closing brace of `sendPush` (before the `pruneStaleTokens` helper). It reuses `getAccessToken`/`pruneStaleTokens`; FCM requires all data values to be strings:

```ts
/**
 * Data-only message (no notification block): Android delivers it silently to
 * the native MessagingService, which renders/updates the ongoing order-tracking
 * notification. Same best-effort + stale-token pruning as sendPush.
 */
export async function sendDataPush(
  tokens: string[],
  data: Record<string, string>
): Promise<number> {
  if (!isPushConfigured() || tokens.length === 0) return 0;

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    console.error('FCM auth failed:', err);
    return 0;
  }

  const url = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;
  const stale: string[] = [];

  const results = await Promise.allSettled(
    tokens.map(async (token) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: { token, data, android: { priority: 'high' } },
        }),
      });
      if (res.status === 404 || res.status === 410) {
        stale.push(token);
        throw new Error('stale token');
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`FCM send ${res.status}: ${body}`);
      }
    })
  );

  results.forEach((r) => {
    if (r.status === 'rejected') console.error('FCM data send failed:', r.reason?.message ?? r.reason);
  });
  if (stale.length) await pruneStaleTokens(stale);
  return results.filter((r) => r.status === 'fulfilled').length;
}
```

- [ ] **Step 2: Typecheck**

Run from `apps/web`: `npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/push/fcm.ts
git commit -m "feat(push): FCM data-only message variant for silent Android updates"
```

---

### Task 5: `updateLiveActivity` orchestrator

**Files:**
- Create: `apps/web/lib/live-activity/update.ts`

All decision logic already lives (tested) in content-state.ts; this module is thin I/O glue, intentionally untested beyond typecheck (same stance as `sendOrderPush`).

- [ ] **Step 1: Implement**

```ts
import { createAdminClient } from '@/lib/supabase/admin';
import { isApnsConfigured, sendLiveActivityPush } from '@/lib/push/apns';
import { sendDataPush, isPushConfigured } from '@/lib/push/fcm';
import {
  phaseForStatus,
  haversineMeters,
  deliveryProgress,
  deliveryEtaMinutes,
  prepEtaMinutes,
  statusTextFor,
  shouldPushRiderUpdate,
  type ActivityContentState,
} from './content-state';
import type { Order, Tenant } from '@fafa/types';

export interface RiderFix {
  latitude: number;
  longitude: number;
  speed?: number | null;
}

/**
 * Push a content-state update to the customer's lock screen (iOS Live Activity
 * via APNs + Android ongoing notification via FCM data message). Best-effort:
 * never throws into callers; all failures are logged. Spec:
 * docs/superpowers/specs/2026-06-11-live-activity-design.md
 */
export async function updateLiveActivity(
  ctx: { order: Order; tenant: Tenant },
  trigger: 'status' | 'rider',
  riderFix?: RiderFix
): Promise<void> {
  try {
    const { order, tenant } = ctx;
    const phase = phaseForStatus(order.status);
    if (!phase) return;
    const terminal = phase === 'delivered' || phase === 'cancelled';

    const supabase = createAdminClient();
    let { data: row } = await supabase
      .from('live_activities')
      .select('*')
      .eq('order_id', order.id)
      .maybeSingle();

    if (row?.ended_at) return;

    // Lazy row for the Android-only path (no iOS registration happened).
    // Don't create rows for terminal events with no prior activity.
    if (!row) {
      if (terminal) return;
      const { data: inserted } = await supabase
        .from('live_activities')
        .upsert({ order_id: order.id }, { onConflict: 'order_id' })
        .select('*')
        .single();
      row = inserted;
      if (!row) return;
    }

    const now = new Date();

    // ── Compute content state ──
    let progress = row.last_progress ?? 0;
    let etaMinutes: number | null = null;
    let distanceMeters: number | null = null;

    if (phase === 'on_the_way' && riderFix && order.delivery_lat != null && order.delivery_lng != null) {
      const remaining = haversineMeters(
        riderFix.latitude, riderFix.longitude,
        order.delivery_lat, order.delivery_lng
      );
      distanceMeters = Math.round(remaining);
      let initial = row.initial_distance_m as number | null;
      if (initial == null) {
        initial = remaining;
        await supabase
          .from('live_activities')
          .update({ initial_distance_m: initial })
          .eq('order_id', order.id);
      }
      progress = deliveryProgress(initial, remaining, row.last_progress);
      etaMinutes = deliveryEtaMinutes(remaining, riderFix.speed ?? null);
    } else if (phase === 'delivered') {
      progress = 1;
    } else if (phase !== 'on_the_way' && phase !== 'cancelled') {
      // Pre-delivery phases: ETA from kitchen estimate (+ zone leg if any).
      progress = 0;
      etaMinutes = prepEtaMinutes(order.estimated_ready_at, null, now);
    }

    const state: ActivityContentState = {
      phase,
      progress,
      etaMinutes,
      statusText: statusTextFor(phase, distanceMeters),
      distanceMeters,
    };

    // ── Throttle (rider movement only; status changes always push) ──
    if (trigger === 'rider') {
      const ok = shouldPushRiderUpdate(
        {
          lastPushedAt: row.last_pushed_at,
          lastProgress: row.last_progress,
          lastEtaMinutes: row.last_eta_minutes,
        },
        { progress: state.progress, etaMinutes: state.etaMinutes },
        now
      );
      if (!ok) return;
    }

    // ── iOS: APNs liveactivity push ──
    if (row.apns_token && isApnsConfigured()) {
      const result = await sendLiveActivityPush(row.apns_token, {
        event: terminal ? 'end' : 'update',
        contentState: state as unknown as Record<string, unknown>,
        priority: trigger === 'rider' && state.distanceMeters != null && state.distanceMeters > 300 ? 5 : 10,
      });
      if (result === 'stale') {
        await supabase
          .from('live_activities')
          .update({ ended_at: now.toISOString() })
          .eq('order_id', order.id);
      }
    }

    // ── Android: silent FCM data message to the customer's devices ──
    if (isPushConfigured() && order.customer_phone) {
      const { data: deviceRows } = await supabase
        .from('device_tokens')
        .select('token')
        .eq('customer_phone', order.customer_phone)
        .eq('platform', 'android');
      const tokens = (deviceRows || []).map((r) => r.token as string);
      if (tokens.length > 0) {
        await sendDataPush(tokens, {
          type: 'live_activity',
          orderId: order.id,
          orderNumber: order.order_number,
          slug: tenant.slug,
          tenantName: tenant.name,
          deliveryType: order.delivery_type,
          phase: state.phase,
          progress: String(state.progress),
          etaMinutes: state.etaMinutes == null ? '' : String(state.etaMinutes),
          statusText: state.statusText,
        });
      }
    }

    // ── Persist throttle state / close out ──
    await supabase
      .from('live_activities')
      .update({
        last_progress: state.progress,
        last_eta_minutes: state.etaMinutes,
        last_pushed_at: now.toISOString(),
        ...(terminal ? { ended_at: now.toISOString() } : {}),
      })
      .eq('order_id', order.id);
  } catch (err) {
    console.error('[live-activity] update failed:', err);
  }
}
```

Note: `device_tokens.platform` column — verify it exists (`grep -n platform supabase/migrations/023_device_tokens.sql`). If the column doesn't exist, drop the `.eq('platform', 'android')` filter (iOS devices simply ignore unknown data messages; the capawesome plugin emits a JS event that nothing listens to).

- [ ] **Step 2: Typecheck**

Run from `apps/web`: `npx tsc --noEmit -p .`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/live-activity/update.ts
git commit -m "feat(live-activity): update orchestrator (APNs + FCM data push, throttled)"
```

---

### Task 6: Register endpoint

**Files:**
- Create: `apps/web/app/api/live-activity/register/route.ts`

- [ ] **Step 1: Implement**

Same CORS + public-by-UUID trust model as `app/api/orders/[id]/location/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { corsHeaders, preflight } from '@/lib/http/cors';

/* ── Live Activity token registration (CORS, public-by-UUID) ──
   The iOS shell starts an ActivityKit activity for an order and posts the APNs
   update token here. Keyed by the unguessable order id — same trust model as
   public order tracking. */

export const dynamic = 'force-dynamic';

const TERMINAL = ['delivered', 'cancelled'];

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get('origin'));
  try {
    const { orderId, token } = (await req.json()) as { orderId?: string; token?: string };
    if (!orderId || !token || !/^[a-f0-9]{32,200}$/i.test(token)) {
      return NextResponse.json({ error: 'orderId and hex token required' }, { status: 400, headers });
    }

    const supabase = createAdminClient();
    const { data: order } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (!order || TERMINAL.includes(order.status)) {
      return NextResponse.json({ error: 'Order not active' }, { status: 404, headers });
    }

    const { error } = await supabase
      .from('live_activities')
      .upsert({ order_id: orderId, apns_token: token }, { onConflict: 'order_id' });
    if (error) throw error;

    return NextResponse.json({ ok: true }, { headers });
  } catch (err) {
    console.error('live activity register failed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers });
  }
}
```

- [ ] **Step 2: Typecheck + commit**

Run from `apps/web`: `npx tsc --noEmit -p .` — expected clean.

```bash
git add apps/web/app/api/live-activity/register
git commit -m "feat(api): live activity token registration endpoint"
```

---

### Task 7: Wire the two triggers

**Files:**
- Modify: `apps/web/lib/notifications/send.ts` (imports + ~line 246, next to `sendOrderPush`)
- Modify: `apps/web/app/api/rider/location/route.ts` (after breadcrumb insert, ~line 81)

- [ ] **Step 1: send.ts — status trigger**

Add import at top with the other imports:

```ts
import { updateLiveActivity } from '@/lib/live-activity/update';
```

In `sendOrderNotifications`, directly after `notifications.push(sendOrderPush(ctx, event));`:

```ts
  // 5. Lock-screen live activity (iOS Live Activity / Android ongoing
  //    notification). Env-gated and best-effort like push.
  notifications.push(updateLiveActivity(ctx, 'status'));
```

- [ ] **Step 2: rider location route — movement trigger**

In `app/api/rider/location/route.ts`: extend the order select to pull what `updateLiveActivity` needs, and fire after the insert. Replace the existing select:

```ts
    const { data: order } = await supabase
      .from('orders')
      .select('id, rider_id')
      .eq('id', orderId)
      .single();
```

with:

```ts
    const { data: order } = await supabase
      .from('orders')
      .select('*, tenant:tenants(*)')
      .eq('id', orderId)
      .single();
```

After the successful insert (`if (error) throw error;`), before the success response:

```ts
    // Lock-screen progress update from the freshest fix — fire-and-forget,
    // throttled inside updateLiveActivity.
    const latest = rows[rows.length - 1];
    if (order.tenant) {
      void updateLiveActivity(
        { order, tenant: order.tenant },
        'rider',
        { latitude: latest.latitude, longitude: latest.longitude, speed: latest.speed }
      ).catch(() => {});
    }
```

Add the import at top:

```ts
import { updateLiveActivity } from '@/lib/live-activity/update';
```

Note: verify the tenants relation name with `grep -n "tenant:tenants\|tenants(" apps/web/app/api -r` — follow whatever join alias pattern other routes use. The rider-auth check `order.rider_id !== rider.id` keeps working since `select('*')` includes `rider_id`.

- [ ] **Step 3: Typecheck + full tests**

From `apps/web`: `npx tsc --noEmit -p . && npx vitest run`
Expected: clean, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/notifications/send.ts "apps/web/app/api/rider/location/route.ts"
git commit -m "feat(live-activity): wire status + rider-movement triggers"
```

---

### Task 8: Web-side start + widget tap routing

**Files:**
- Create: `apps/web/components/live-activity-bridge.tsx`
- Modify: `apps/web/app/(storefront)/[slug]/order/[orderId]/page.tsx` (render bridge next to `OrderTracker`)
- Modify: `apps/web/lib/push/notification-url.ts` (+ universal-link parser)
- Test: `apps/web/lib/push/notification-url.test.ts` (extend)
- Modify: `apps/web/components/native-bridge.tsx` (appUrlOpen listener)
- Modify: `apps/web/package.json` (add `@capacitor/app` if absent — check first: `grep '@capacitor/app' apps/web/package.json`)

- [ ] **Step 1: Failing tests for the universal-link parser**

Append to `apps/web/lib/push/notification-url.test.ts`:

```ts
import { trackerPathFromUrl } from './notification-url';

describe('trackerPathFromUrl', () => {
  it('maps a tracker universal link to its path', () => {
    expect(trackerPathFromUrl('https://ghdidi.com/mama-chops/order/abc-123')).toBe(
      '/mama-chops/order/abc-123'
    );
  });

  it('returns null for non-tracker links', () => {
    expect(trackerPathFromUrl('https://ghdidi.com/mama-chops')).toBeNull();
    expect(trackerPathFromUrl('https://ghdidi.com/')).toBeNull();
    expect(trackerPathFromUrl('not a url')).toBeNull();
  });
});
```

Run: `npx vitest run lib/push/notification-url.test.ts` — expected FAIL (function missing).

- [ ] **Step 2: Implement parser**

Append to `apps/web/lib/push/notification-url.ts`:

```ts
/**
 * Maps a tracker universal link (widget tap) to an in-app path:
 * https://ghdidi.com/<slug>/order/<orderId> → /<slug>/order/<orderId>.
 * Returns null for anything else.
 */
export function trackerPathFromUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    if (parts.length === 3 && parts[1] === 'order') {
      return `/${parts[0]}/order/${parts[2]}`;
    }
    return null;
  } catch {
    return null;
  }
}
```

Run: `npx vitest run lib/push/notification-url.test.ts` — expected PASS.

- [ ] **Step 3: appUrlOpen listener in native-bridge**

In `apps/web/components/native-bridge.tsx`, add imports:

```ts
import { App as CapApp } from '@capacitor/app';
import { orderTrackingUrl, trackerPathFromUrl } from '@/lib/push/notification-url';
```

(replacing the existing `orderTrackingUrl` import line). Inside the async IIFE, right after the `notificationActionPerformed` listener registration:

```ts
      // Widget taps arrive as universal links (Live Activity widgetURL).
      handles.push(
        await CapApp.addListener('appUrlOpen', ({ url }) => {
          const path = trackerPathFromUrl(url);
          if (path) router.push(path);
        })
      );
```

If `@capacitor/app` is missing from `apps/web/package.json` dependencies, add `"@capacitor/app": "^6.0.0"` next to `@capacitor/core` and run `npm install` from repo root.

- [ ] **Step 4: LiveActivityBridge component**

Create `apps/web/components/live-activity-bridge.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Starts an iOS Live Activity for an active order and registers its APNs
 * update token with the backend. The 'LiveActivity' plugin ships in the iOS
 * shell binary; on web/Android/old-iOS it is absent or unavailable and this
 * is a silent no-op. Backend pushes drive every later update.
 */

interface LiveActivityPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  start(options: {
    orderId: string;
    orderNumber: string;
    tenantName: string;
    slug: string;
    deliveryType: string;
    statusText: string;
  }): Promise<{ token?: string }>;
}

const LiveActivity = registerPlugin<LiveActivityPlugin>('LiveActivity');

const TERMINAL = ['delivered', 'cancelled'];

export function LiveActivityBridge({
  orderId,
  orderNumber,
  tenantName,
  slug,
  deliveryType,
  status,
}: {
  orderId: string;
  orderNumber: string;
  tenantName: string;
  slug: string;
  deliveryType: string;
  status: string;
}) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return;
    if (TERMINAL.includes(status)) return;

    (async () => {
      try {
        const { available } = await LiveActivity.isAvailable();
        if (!available) return;
        const { token } = await LiveActivity.start({
          orderId,
          orderNumber,
          tenantName,
          slug,
          deliveryType,
          statusText: 'Order confirmed',
        });
        if (token) {
          await fetch('/api/live-activity/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, token }),
          });
        }
      } catch {
        // Plugin missing (web build) or Live Activities disabled — fine.
      }
    })();
  }, [orderId, orderNumber, tenantName, slug, deliveryType, status]);

  return null;
}
```

- [ ] **Step 5: Render it on the tracker page**

In `apps/web/app/(storefront)/[slug]/order/[orderId]/page.tsx`, import:

```tsx
import { LiveActivityBridge } from '@/components/live-activity-bridge';
```

and render directly before `<OrderTracker .../>` (find the JSX return; the page already has `order`, `slug`, and a tenant object in scope — check exact variable names in the file and use them):

```tsx
      <LiveActivityBridge
        orderId={order.id}
        orderNumber={order.order_number}
        tenantName={tenant.name}
        slug={slug}
        deliveryType={order.delivery_type}
        status={order.status}
      />
```

- [ ] **Step 6: Typecheck + tests + commit**

From `apps/web`: `npx tsc --noEmit -p . && npx vitest run` — expected clean/pass.

```bash
git add apps/web/components/live-activity-bridge.tsx apps/web/components/native-bridge.tsx \
  apps/web/lib/push/notification-url.ts apps/web/lib/push/notification-url.test.ts \
  "apps/web/app/(storefront)/[slug]/order/[orderId]/page.tsx" apps/web/package.json package-lock.json
git commit -m "feat(web): start Live Activity on tracker page + widget tap routing"
```

---

### Task 9: iOS Capacitor plugin + shared attributes

**Files:**
- Create: `apps/mobile/ios/App/App/OrderActivityAttributes.swift`
- Create: `apps/mobile/ios/App/App/LiveActivityPlugin.swift`
- Create: `apps/mobile/ios/App/App/LiveActivityPlugin.m`
- Modify: `apps/mobile/ios/App/App/Info.plist` (NSSupportsLiveActivities)

(pbxproj registration happens in Task 10 — these files are inert until then.)

- [ ] **Step 1: OrderActivityAttributes.swift** (shared by App + widget targets)

```swift
import Foundation
#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.2, *)
struct OrderActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var phase: String        // confirmed | preparing | ready | on_the_way | delivered | cancelled
        var progress: Double     // 0..1 within the delivery leg
        var etaMinutes: Int?
        var statusText: String
        var distanceMeters: Int?
    }

    var orderId: String
    var orderNumber: String
    var tenantName: String
    var slug: String
    var deliveryType: String     // delivery | pickup
}
#endif
```

- [ ] **Step 2: LiveActivityPlugin.swift**

```swift
import Foundation
import Capacitor
#if canImport(ActivityKit)
import ActivityKit
#endif

/// Starts/ends the order-tracking Live Activity. Updates after start come
/// exclusively from backend APNs pushes (apns-push-type: liveactivity).
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin {

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["available": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["available": false])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve([:]) // older iOS: no activity, no token
            return
        }
        guard let orderId = call.getString("orderId"),
              let orderNumber = call.getString("orderNumber"),
              let tenantName = call.getString("tenantName"),
              let slug = call.getString("slug"),
              let deliveryType = call.getString("deliveryType") else {
            call.reject("orderId, orderNumber, tenantName, slug, deliveryType required")
            return
        }
        let statusText = call.getString("statusText") ?? "Order confirmed"

        Task {
            do {
                // Reuse an existing activity for this order (page revisits).
                let existing = Activity<OrderActivityAttributes>.activities
                    .first { $0.attributes.orderId == orderId }
                let activity: Activity<OrderActivityAttributes>
                if let existing {
                    activity = existing
                } else {
                    let attributes = OrderActivityAttributes(
                        orderId: orderId, orderNumber: orderNumber,
                        tenantName: tenantName, slug: slug, deliveryType: deliveryType
                    )
                    let state = OrderActivityAttributes.ContentState(
                        phase: "confirmed", progress: 0, etaMinutes: nil,
                        statusText: statusText, distanceMeters: nil
                    )
                    activity = try Activity.request(
                        attributes: attributes,
                        content: .init(state: state, staleDate: nil),
                        pushType: .token
                    )
                }
                // First token usually arrives within a second.
                for await tokenData in activity.pushTokenUpdates {
                    let token = tokenData.map { String(format: "%02x", $0) }.joined()
                    call.resolve(["token": token])
                    return
                }
                call.resolve([:])
            } catch {
                call.reject("Live Activity request failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let orderId = call.getString("orderId")
        Task {
            for activity in Activity<OrderActivityAttributes>.activities
            where orderId == nil || activity.attributes.orderId == orderId {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }
}
```

- [ ] **Step 3: LiveActivityPlugin.m** (Capacitor objc registration macro)

```objc
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(LiveActivityPlugin, "LiveActivity",
  CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(start, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(end, CAPPluginReturnPromise);
)
```

- [ ] **Step 4: Info.plist — declare Live Activity support**

In `apps/mobile/ios/App/App/Info.plist`, add inside the top-level `<dict>`:

```xml
	<key>NSSupportsLiveActivities</key>
	<true/>
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/ios/App/App/OrderActivityAttributes.swift \
  apps/mobile/ios/App/App/LiveActivityPlugin.swift \
  apps/mobile/ios/App/App/LiveActivityPlugin.m \
  apps/mobile/ios/App/App/Info.plist
git commit -m "feat(ios): LiveActivity Capacitor plugin + activity attributes"
```

---

### Task 10: iOS widget extension (files + pbxproj)

**Files:**
- Create: `apps/mobile/ios/App/DidiWidgets/DidiWidgetsBundle.swift`
- Create: `apps/mobile/ios/App/DidiWidgets/OrderLiveActivity.swift`
- Create: `apps/mobile/ios/App/DidiWidgets/Info.plist`
- Modify: `apps/mobile/ios/App/App.xcodeproj/project.pbxproj`

- [ ] **Step 1: DidiWidgetsBundle.swift**

```swift
import WidgetKit
import SwiftUI

@main
struct DidiWidgetsBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 16.2, *) {
            OrderLiveActivity()
        }
    }
}
```

- [ ] **Step 2: OrderLiveActivity.swift** (lock screen card + Dynamic Island, per approved mockups)

```swift
import ActivityKit
import WidgetKit
import SwiftUI

@available(iOS 16.2, *)
struct OrderLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: OrderActivityAttributes.self) { context in
            LockScreenCard(context: context)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(trackerURL(context.attributes))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    BrandMark()
                }
                DynamicIslandExpandedRegion(.trailing) {
                    EtaText(minutes: context.state.etaMinutes, phase: context.state.phase)
                        .font(.subheadline.weight(.semibold))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(context.state.statusText)
                            .font(.subheadline.weight(.semibold))
                        SegmentedBar(state: context.state, deliveryType: context.attributes.deliveryType)
                    }
                }
            } compactLeading: {
                ProgressRing(state: context.state, deliveryType: context.attributes.deliveryType)
            } compactTrailing: {
                EtaText(minutes: context.state.etaMinutes, phase: context.state.phase)
                    .font(.caption2.weight(.semibold))
            } minimal: {
                ProgressRing(state: context.state, deliveryType: context.attributes.deliveryType)
            }
            .widgetURL(trackerURL(context.attributes))
        }
    }

    private func trackerURL(_ attrs: OrderActivityAttributes) -> URL? {
        URL(string: "https://ghdidi.com/\(attrs.slug)/order/\(attrs.orderId)")
    }
}

@available(iOS 16.2, *)
private struct LockScreenCard: View {
    let context: ActivityViewContext<OrderActivityAttributes>

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                BrandMark()
                Text(context.attributes.tenantName)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                EtaText(minutes: context.state.etaMinutes, phase: context.state.phase)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text(context.state.statusText)
                .font(.headline)
            SegmentedBar(state: context.state, deliveryType: context.attributes.deliveryType)
            HStack {
                Text("Confirmed").font(.caption2).foregroundStyle(.secondary)
                Spacer()
                Text(context.attributes.deliveryType == "pickup" ? "Ready" : "Delivered")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            Text("Order #\(context.attributes.orderNumber)")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(16)
        .foregroundStyle(.white)
    }
}

private struct BrandMark: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 6)
            .fill(LinearGradient(colors: [Color(red: 0.22, green: 0.74, blue: 0.97),
                                          Color(red: 0.15, green: 0.39, blue: 0.92)],
                                 startPoint: .topLeading, endPoint: .bottomTrailing))
            .frame(width: 24, height: 24)
            .overlay(Text("D").font(.caption.weight(.bold)).foregroundStyle(.white))
    }
}

@available(iOS 16.2, *)
private struct EtaText: View {
    let minutes: Int?
    let phase: String

    var body: some View {
        if phase == "delivered" {
            Text("Done")
        } else if phase == "cancelled" {
            Text("—")
        } else if let minutes {
            Text("~\(minutes) min")
        } else {
            Text("")
        }
    }
}

@available(iOS 16.2, *)
private struct SegmentedBar: View {
    let state: OrderActivityAttributes.ContentState
    let deliveryType: String

    // Segments: delivery = confirmed/preparing/ready/on_the_way; pickup drops the last.
    private var phases: [String] {
        deliveryType == "pickup"
            ? ["confirmed", "preparing", "ready"]
            : ["confirmed", "preparing", "ready", "on_the_way"]
    }

    private func fill(for index: Int) -> Double {
        let current = phases.firstIndex(of: state.phase)
        if state.phase == "delivered" || state.phase == "cancelled" { return 1 }
        guard let current else { return 0 }
        if index < current { return 1 }
        if index > current { return 0 }
        // Active segment: rider progress drives on_the_way; others show half.
        return state.phase == "on_the_way" ? max(0.05, state.progress) : 0.5
    }

    var body: some View {
        HStack(spacing: 4) {
            ForEach(phases.indices, id: \.self) { i in
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.white.opacity(0.25))
                        Capsule()
                            .fill(LinearGradient(colors: [Color(red: 0.22, green: 0.74, blue: 0.97),
                                                          Color(red: 0.2, green: 0.83, blue: 0.6)],
                                                 startPoint: .leading, endPoint: .trailing))
                            .frame(width: geo.size.width * fill(for: i))
                    }
                }
                .frame(height: 6)
            }
        }
    }
}
```

- [ ] **Step 3: DidiWidgets/Info.plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleDisplayName</key>
	<string>DidiWidgets</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>XPC!</string>
	<key>CFBundleShortVersionString</key>
	<string>$(MARKETING_VERSION)</string>
	<key>CFBundleVersion</key>
	<string>$(CURRENT_PROJECT_VERSION)</string>
	<key>NSExtension</key>
	<dict>
		<key>NSExtensionPointIdentifier</key>
		<string>com.apple.widgetkit-extension</string>
	</dict>
</dict>
</plist>
```

- [ ] **Step 4: pbxproj surgery**

Edit `apps/mobile/ios/App/App.xcodeproj/project.pbxproj`. Use fixed new IDs (24-hex, `DD1A...` prefix, no collisions with existing `50...`/`2F...`/`90...` IDs — verify with grep first: `grep -c DD1A project.pbxproj` expect 0).

**4a. PBXBuildFile section** — add inside `/* Begin PBXBuildFile section */`:

```
		DD1A000000000000000000B1 /* OrderActivityAttributes.swift in Sources */ = {isa = PBXBuildFile; fileRef = DD1A000000000000000000F1 /* OrderActivityAttributes.swift */; };
		DD1A000000000000000000B2 /* LiveActivityPlugin.swift in Sources */ = {isa = PBXBuildFile; fileRef = DD1A000000000000000000F2 /* LiveActivityPlugin.swift */; };
		DD1A000000000000000000B3 /* LiveActivityPlugin.m in Sources */ = {isa = PBXBuildFile; fileRef = DD1A000000000000000000F3 /* LiveActivityPlugin.m */; };
		DD1A000000000000000000B4 /* OrderActivityAttributes.swift in Sources */ = {isa = PBXBuildFile; fileRef = DD1A000000000000000000F1 /* OrderActivityAttributes.swift */; };
		DD1A000000000000000000B5 /* DidiWidgetsBundle.swift in Sources */ = {isa = PBXBuildFile; fileRef = DD1A000000000000000000F5 /* DidiWidgetsBundle.swift */; };
		DD1A000000000000000000B6 /* OrderLiveActivity.swift in Sources */ = {isa = PBXBuildFile; fileRef = DD1A000000000000000000F6 /* OrderLiveActivity.swift */; };
		DD1A000000000000000000B7 /* DidiWidgets.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = DD1A000000000000000000F7 /* DidiWidgets.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
```

**4b. PBXFileReference section** — add:

```
		DD1A000000000000000000F1 /* OrderActivityAttributes.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = OrderActivityAttributes.swift; sourceTree = "<group>"; };
		DD1A000000000000000000F2 /* LiveActivityPlugin.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LiveActivityPlugin.swift; sourceTree = "<group>"; };
		DD1A000000000000000000F3 /* LiveActivityPlugin.m */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; path = LiveActivityPlugin.m; sourceTree = "<group>"; };
		DD1A000000000000000000F5 /* DidiWidgetsBundle.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DidiWidgetsBundle.swift; sourceTree = "<group>"; };
		DD1A000000000000000000F6 /* OrderLiveActivity.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = OrderLiveActivity.swift; sourceTree = "<group>"; };
		DD1A000000000000000000F7 /* DidiWidgets.appex */ = {isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = DidiWidgets.appex; sourceTree = BUILT_PRODUCTS_DIR; };
		DD1A000000000000000000F8 /* DidiWidgetsInfo.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; name = Info.plist; path = Info.plist; sourceTree = "<group>"; };
```

**4c. Groups.** In the `App` PBXGroup children (find the group containing `AppDelegate.swift`), add:

```
				DD1A000000000000000000F1 /* OrderActivityAttributes.swift */,
				DD1A000000000000000000F2 /* LiveActivityPlugin.swift */,
				DD1A000000000000000000F3 /* LiveActivityPlugin.m */,
```

In the main/root PBXGroup (the one containing the `App` group), add a new child reference `DD1A000000000000000000G1 /* DidiWidgets */,` and define the group:

```
		DD1A000000000000000000G1 /* DidiWidgets */ = {
			isa = PBXGroup;
			children = (
				DD1A000000000000000000F5 /* DidiWidgetsBundle.swift */,
				DD1A000000000000000000F6 /* OrderLiveActivity.swift */,
				DD1A000000000000000000F8 /* DidiWidgetsInfo.plist */,
			);
			path = DidiWidgets;
			sourceTree = "<group>";
		};
```

Also add `DD1A000000000000000000F7 /* DidiWidgets.appex */,` to the `Products` group children.

⚠️ pbxproj IDs are hex-only in practice — `G1` contains a valid ambiguity risk. Replace the `...G1` id with `DD1A000000000000000000C1` (hex-only) everywhere it appears.

**4d. App target additions.** In the `App` PBXNativeTarget block: add to `buildPhases` list a new phase id `DD1A000000000000000000C2 /* Embed Foundation Extensions */`, and add `dependencies = ( DD1A000000000000000000C3 /* PBXTargetDependency */, );` (the list currently empty). In the App target's `PBXSourcesBuildPhase` files list, add:

```
				DD1A000000000000000000B1 /* OrderActivityAttributes.swift in Sources */,
				DD1A000000000000000000B2 /* LiveActivityPlugin.swift in Sources */,
				DD1A000000000000000000B3 /* LiveActivityPlugin.m in Sources */,
```

Define the new sections (place before `/* End PBXNativeTarget section */` etc. as appropriate):

```
/* Begin PBXCopyFilesBuildPhase section */
		DD1A000000000000000000C2 /* Embed Foundation Extensions */ = {
			isa = PBXCopyFilesBuildPhase;
			buildActionMask = 2147483647;
			dstPath = "";
			dstSubfolderSpec = 13;
			files = (
				DD1A000000000000000000B7 /* DidiWidgets.appex in Embed Foundation Extensions */,
			);
			name = "Embed Foundation Extensions";
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXCopyFilesBuildPhase section */

/* Begin PBXContainerItemProxy section */
		DD1A000000000000000000C4 /* PBXContainerItemProxy */ = {
			isa = PBXContainerItemProxy;
			containerPortal = 504EC3034E2A3D3E00673253 /* Project object */;
			proxyType = 1;
			remoteGlobalIDString = DD1A000000000000000000C5;
			remoteInfo = DidiWidgets;
		};
/* End PBXContainerItemProxy section */

/* Begin PBXTargetDependency section */
		DD1A000000000000000000C3 /* PBXTargetDependency */ = {
			isa = PBXTargetDependency;
			target = DD1A000000000000000000C5 /* DidiWidgets */;
			targetProxy = DD1A000000000000000000C4 /* PBXContainerItemProxy */;
		};
/* End PBXTargetDependency section */
```

⚠️ `containerPortal` must be the real Project object id — find it: `grep -n "rootObject" project.pbxproj` and use that id, not the example above.

**4e. DidiWidgets native target** (in PBXNativeTarget section):

```
		DD1A000000000000000000C5 /* DidiWidgets */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = DD1A000000000000000000C6 /* Build configuration list for PBXNativeTarget "DidiWidgets" */;
			buildPhases = (
				DD1A000000000000000000C7 /* Sources */,
				DD1A000000000000000000C8 /* Frameworks */,
				DD1A000000000000000000C9 /* Resources */,
			);
			buildRules = ();
			dependencies = ();
			name = DidiWidgets;
			productName = DidiWidgets;
			productReference = DD1A000000000000000000F7 /* DidiWidgets.appex */;
			productType = "com.apple.product-type.app-extension";
		};
```

Add `DD1A000000000000000000C5 /* DidiWidgets */,` to the PBXProject `targets` list.

**4f. Widget build phases:**

```
		DD1A000000000000000000C7 /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				DD1A000000000000000000B4 /* OrderActivityAttributes.swift in Sources */,
				DD1A000000000000000000B5 /* DidiWidgetsBundle.swift in Sources */,
				DD1A000000000000000000B6 /* OrderLiveActivity.swift in Sources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		DD1A000000000000000000C8 /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = ();
			runOnlyForDeploymentPostprocessing = 0;
		};
		DD1A000000000000000000C9 /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = ();
			runOnlyForDeploymentPostprocessing = 0;
		};
```

**4g. Build configurations** (XCBuildConfiguration section; MARKETING_VERSION must match the App target's `1.1`, CURRENT_PROJECT_VERSION any number — CI's sed rewrites all occurrences):

```
		DD1A000000000000000000D1 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 15;
				GENERATE_INFOPLIST_FILE = NO;
				INFOPLIST_FILE = DidiWidgets/Info.plist;
				IPHONEOS_DEPLOYMENT_TARGET = 16.2;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
					"@executable_path/../../Frameworks",
				);
				MARKETING_VERSION = 1.1;
				PRODUCT_BUNDLE_IDENTIFIER = com.ghdidi.app.DidiWidgets;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SKIP_INSTALL = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Debug;
		};
		DD1A000000000000000000D2 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 15;
				GENERATE_INFOPLIST_FILE = NO;
				INFOPLIST_FILE = DidiWidgets/Info.plist;
				IPHONEOS_DEPLOYMENT_TARGET = 16.2;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
					"@executable_path/../../Frameworks",
				);
				MARKETING_VERSION = 1.1;
				PRODUCT_BUNDLE_IDENTIFIER = com.ghdidi.app.DidiWidgets;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SKIP_INSTALL = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Release;
		};
```

And the configuration list (XCConfigurationList section):

```
		DD1A000000000000000000C6 /* Build configuration list for PBXNativeTarget "DidiWidgets" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				DD1A000000000000000000D1 /* Debug */,
				DD1A000000000000000000D2 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
```

- [ ] **Step 5: Sanity-check pbxproj**

```bash
plutil -lint apps/mobile/ios/App/App.xcodeproj/project.pbxproj
```
Expected: `OK` (plutil parses old-style plists). Also `grep -c DD1A` should equal the number of inserted references (count them — every id referenced at least twice except section comments).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/ios/App/DidiWidgets apps/mobile/ios/App/App.xcodeproj/project.pbxproj
git commit -m "feat(ios): DidiWidgets Live Activity extension target"
```

---

### Task 11: Codemagic — sign + build the extension

**Files:**
- Modify: `codemagic.yaml` ("Set up code signing" step in `ios-release`)

- [ ] **Step 1: Fetch a profile for the widget bundle id too**

Replace the single fetch line:

```yaml
          app-store-connect fetch-signing-files "$BUNDLE_ID" --platform IOS --type IOS_APP_STORE --create
```

with:

```yaml
          app-store-connect fetch-signing-files "$BUNDLE_ID" --platform IOS --type IOS_APP_STORE --create
          # Widget extension needs its own bundle id + provisioning profile
          app-store-connect fetch-signing-files "$BUNDLE_ID.DidiWidgets" --platform IOS --type IOS_APP_STORE --create
```

- [ ] **Step 2: Validate YAML + commit**

```bash
node -e "const y=require('/Users/ebenezerbarning/Desktop/fafa/node_modules/js-yaml');y.load(require('fs').readFileSync('codemagic.yaml','utf8'));console.log('YAML OK')"
git add codemagic.yaml
git commit -m "ci(ios): provision DidiWidgets extension bundle id"
```

---

### Task 12: Android ongoing notification

**Files:**
- Create: `apps/mobile/android/app/src/main/java/com/ghdidi/app/DidiMessagingService.java`
- Modify: `apps/mobile/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: DidiMessagingService.java**

Extends the capawesome plugin's service so token refresh + normal pushes keep working; intercepts live-activity data messages:

```java
package com.ghdidi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.RemoteMessage;
import io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService;
import java.util.Map;

/**
 * Renders live order-tracking updates (type=live_activity data messages) as a
 * silent ongoing notification with a progress bar — Android's equivalent of an
 * iOS Live Activity. Everything else falls through to the Capacitor Firebase
 * messaging plugin's service.
 */
public class DidiMessagingService extends MessagingService {

    private static final String CHANNEL_ID = "order_tracking";
    private static final int NOTIFICATION_ID = 0x0D1D1;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if ("live_activity".equals(data.get("type"))) {
            showOrderProgress(data);
            return; // handled natively; don't surface to the JS layer
        }
        super.onMessageReceived(remoteMessage);
    }

    private void showOrderProgress(Map<String, String> data) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Order tracking", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Live progress of your active order");
            manager.createNotificationChannel(channel);
        }

        String phase = data.get("phase");
        boolean terminal = "delivered".equals(phase) || "cancelled".equals(phase);

        if (terminal) {
            manager.cancel(NOTIFICATION_ID);
            // Final, non-ongoing notice that clears itself.
            Notification done = baseBuilder(data)
                .setOngoing(false)
                .setAutoCancel(true)
                .setTimeoutAfter(30 * 60 * 1000L)
                .build();
            manager.notify(NOTIFICATION_ID + 1, done);
            return;
        }

        int progress = 0;
        try {
            progress = (int) Math.round(Double.parseDouble(data.get("progress")) * 100);
        } catch (Exception ignored) {}

        Notification n = baseBuilder(data)
            .setOngoing(true)
            .setProgress(100, progress, false)
            .build();
        manager.notify(NOTIFICATION_ID, n);
    }

    private NotificationCompat.Builder baseBuilder(Map<String, String> data) {
        String eta = data.get("etaMinutes");
        String text = data.get("statusText");
        if (eta != null && !eta.isEmpty()) text = text + " · ~" + eta + " min";

        Intent tap = new Intent(this, MainActivity.class);
        tap.putExtra("orderId", data.get("orderId"));
        tap.putExtra("slug", data.get("slug"));
        tap.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, tap, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(data.get("tenantName"))
            .setContentText(text)
            .setOnlyAlertOnce(true)
            .setContentIntent(pi);
    }
}
```

Note: the tap intent reuses `MainActivity.orderTrackerUrl` extras path (cold-start deep link from commit 22623bc) — warm taps go through `onNewIntent`, which `BridgeActivity` forwards; if warm-tap navigation proves unreliable on device testing, add an `onNewIntent` override to MainActivity mirroring its `onCreate` logic.

- [ ] **Step 2: Manifest — swap the plugin's service for ours**

In `apps/mobile/android/app/src/main/AndroidManifest.xml`: add `xmlns:tools="http://schemas.android.com/tools"` to the `<manifest>` tag if absent, then inside `<application>`:

```xml
        <!-- Replace the Capacitor Firebase plugin's messaging service with ours
             (which extends it) so live-activity data messages render natively. -->
        <service
            android:name="io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService"
            tools:node="remove" />
        <service
            android:name=".DidiMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/android/app/src/main/java/com/ghdidi/app/DidiMessagingService.java \
  apps/mobile/android/app/src/main/AndroidManifest.xml
git commit -m "feat(android): ongoing order-progress notification from live-activity data messages"
```

---

### Task 13: Ship + verify

- [ ] **Step 1: Full local verification**

From `apps/web`: `npx vitest run && npx tsc --noEmit -p .`
Expected: all tests pass, typecheck clean.

- [ ] **Step 2: Push + deploy web**

```bash
git push
```
Vercel auto-deploys `main` (backend goes live but stays inert: APNs env unset, no iOS build has the plugin yet — everything is env-gated/no-op).

- [ ] **Step 3: Trigger iOS build**

```bash
git tag build-3 && git push origin build-3
```
Watch Codemagic. Likely failure points, in order: pbxproj parse (fix syntax), extension signing (verify the `.DidiWidgets` bundle id was created — the `--create` flag should handle it), Swift compile errors. Iterate until green; each fix = new `build-N` tag.

- [ ] **Step 4: User actions (cannot be done by the agent)**

1. Apple Developer portal → Certificates, Identifiers & Profiles → **Keys** → `+` → check "Apple Push Notifications service (APNs)" → register → download `.p8`, note **Key ID**; Team ID is in the top-right of the portal.
2. Vercel project → Settings → Environment Variables (Production):
   - `APNS_TEAM_ID` = team id
   - `APNS_KEY_ID` = key id
   - `APNS_PRIVATE_KEY` = full `.p8` contents
   - `APNS_ENV` = `production`
3. Redeploy web (any push, or Vercel "Redeploy").

- [ ] **Step 5: End-to-end test (TestFlight, iPhone)**

1. Update app from TestFlight.
2. Place a real order (delivery type) → tracker page opens → lock phone.
3. Lock screen shows the activity card ("Order confirmed").
4. From the dashboard, advance status: confirmed → preparing → ready → out_for_delivery. Card segments advance within seconds of each change.
5. With the rider app moving (or rider location POSTs simulated via curl with a rider bearer token), the final segment fills and ETA counts down.
6. Mark delivered → card shows "Delivered. Enjoy your meal! 🎉" and clears.
7. Tap the card mid-delivery → app opens directly on the tracker page.

- [ ] **Step 6: Android (deferred)**

Code ships in the repo; functional verification waits for the test device + `android-N` tag (Android release currently shelved).

---

## Self-review notes

- **Spec coverage:** migration (T1), content state + throttle (T2), APNs (T3), FCM data (T4), orchestrator (T5), register route (T6), trigger wiring (T7), web start/tap (T8), iOS plugin (T9), widget UI incl. pickup + Dynamic Island (T10), CI signing (T11), Android (T12), env + E2E (T13). Pickup zone-minutes ETA: `prepEtaMinutes` supports `zoneMinutes` but T5 passes `null` (delivery zone lookup would add a join; kitchen estimate alone is acceptable v1 — matches "when present" spec wording, the data simply isn't joined yet).
- **Types:** `ActivityContentState` field names match Swift `ContentState` Codable keys and the Android data-message keys (`phase/progress/etaMinutes/statusText/distanceMeters`).
- **Placeholders:** none; all code complete.
- **Known-risk callouts embedded:** pbxproj ids (4c/4d warnings), `device_tokens.platform` column check (T5), tenants join alias check (T7), warm-tap `onNewIntent` (T12).
