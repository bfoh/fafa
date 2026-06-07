'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  StorefrontPayload,
  OrderTrackingPayload,
  VerifyResult,
} from '@fafa/storefront/payload';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'https://ghdidi.com';

/** Tenant + menu + delivery zones. Stale-while-revalidate: instant cached menu,
 *  silent refresh. Shared by the [slug] layout chrome and page (one network call). */
export function useStorefront(slug: string) {
  return useQuery({
    queryKey: ['storefront', slug],
    enabled: !!slug,
    queryFn: async ({ signal }): Promise<StorefrontPayload> => {
      const res = await fetch(`${API}/api/storefront/${slug}`, { signal });
      if (res.status === 404) throw new Error('not_found');
      if (!res.ok) throw new Error(`storefront ${res.status}`);
      return res.json();
    },
  });
}

/** Order + history + tenant contact for the tracker. Polls live status. */
export function useOrder(orderId: string, opts?: { poll?: boolean }) {
  return useQuery({
    queryKey: ['order', orderId],
    enabled: !!orderId,
    refetchInterval: opts?.poll ? 10_000 : false, // live polling while on the tracker
    queryFn: async ({ signal }): Promise<OrderTrackingPayload> => {
      const res = await fetch(`${API}/api/orders/${orderId}/verify`, { signal });
      if (res.status === 404) throw new Error('not_found');
      if (!res.ok) throw new Error(`order ${res.status}`);
      return res.json();
    },
  });
}

/** Explicit settlement on return from Paystack. More retries — payment matters. */
export function useVerifyOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string): Promise<VerifyResult> => {
      const res = await fetch(`${API}/api/orders/${orderId}/verify`, {
        method: 'POST',
      });
      return res.json();
    },
    retry: 6,
    retryDelay: (n) => Math.min(1500 * 2 ** n, 20_000),
    onSuccess: (_res, orderId) => {
      // Repaint the tracker with the settled state.
      qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}
