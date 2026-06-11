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
    let progress = (row.last_progress as number | null) ?? 0;
    let etaMinutes: number | null = null;
    let distanceMeters: number | null = null;

    if (
      phase === 'on_the_way' &&
      riderFix &&
      order.delivery_lat != null &&
      order.delivery_lng != null
    ) {
      const remaining = haversineMeters(
        riderFix.latitude,
        riderFix.longitude,
        order.delivery_lat,
        order.delivery_lng
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
      // Pre-delivery phases: ETA from the kitchen estimate.
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
        priority:
          trigger === 'rider' && state.distanceMeters != null && state.distanceMeters > 300
            ? 5
            : 10,
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
