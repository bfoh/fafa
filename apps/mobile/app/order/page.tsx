'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OrderScreen } from './order-screen';

/** Static route, runtime params: `/order/?id=<orderId>&slug=<slug>`. */
function OrderRoute() {
  const sp = useSearchParams();
  const orderId = sp.get('id') ?? '';
  const slug = sp.get('slug') ?? '';
  if (!orderId) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center text-surface-500">
        No order specified.
      </div>
    );
  }
  return <OrderScreen orderId={orderId} slug={slug} />;
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-surface-400">Loading…</div>}>
      <OrderRoute />
    </Suspense>
  );
}
