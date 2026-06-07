'use client';

import { useEffect } from 'react';
import {
  OrderTracker,
  AdepaConversion,
  type TrackedOrder,
  type HistoryEntry,
} from '@fafa/storefront';
import { useOrder, useVerifyOrder } from '@/app/hooks/use-storefront';

/** Order tracking screen. orderId is a runtime query param (unbounded — never
 *  known at build), so this lives on a static route, not a [orderId] segment. */
export function OrderScreen({ slug, orderId }: { slug: string; orderId: string }) {
  const { data, isLoading, isError } = useOrder(orderId, { poll: true });
  const verify = useVerifyOrder();

  // Authoritative settlement on return from Paystack (idempotent, no-op for COD).
  useEffect(() => {
    if (orderId) verify.mutate(orderId);
  }, [orderId]);

  if (isLoading && !data) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-3">
        <div className="h-32 rounded-2xl bg-surface-100 animate-pulse" />
        <div className="h-24 rounded-xl bg-surface-100 animate-pulse" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center text-surface-500">
        Could not load your order. Check your connection.
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-canvas pt-safe">
      <AdepaConversion
        slug={slug}
        orderNumber={(data.order as any).order_number}
        total={Number((data.order as any).total)}
      />
      <OrderTracker
        initialOrder={data.order as unknown as TrackedOrder}
        initialHistory={(data.history as HistoryEntry[]) || []}
        slug={slug}
        tenant={data.tenant}
      />
    </div>
  );
}
