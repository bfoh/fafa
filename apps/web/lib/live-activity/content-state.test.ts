import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  phaseForStatus,
  deliveryProgress,
  deliveryEtaMinutes,
  prepEtaMinutes,
  statusTextFor,
  shouldPushRiderUpdate,
} from './content-state';

describe('haversineMeters', () => {
  it('computes a known distance (Accra Independence Square → Kwame Nkrumah Mausoleum ≈ 1.0–1.6 km)', () => {
    const d = haversineMeters(5.5471, -0.1924, 5.545, -0.205);
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

  it('zone minutes only added when present (null zone = just prep)', () => {
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
      shouldPushRiderUpdate(
        { lastPushedAt: null, lastProgress: null, lastEtaMinutes: null },
        { progress: 0.01, etaMinutes: 9 },
        now
      )
    ).toBe(true);
  });
});
