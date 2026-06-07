'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { StorefrontScreen } from './storefront-screen';

/**
 * Static route — no dynamic segment, so it exports cleanly. The restaurant slug
 * is a runtime query param (`/store/?slug=...`), read client-side. Deep links
 * (ghdidi.com/<slug>) are translated to this internal route by the native layer
 * in Phase 3. useSearchParams requires a Suspense boundary under export.
 */
function StoreRoute() {
  const slug = useSearchParams().get('slug') ?? '';
  if (!slug) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center text-surface-500">
        No restaurant selected.
      </div>
    );
  }
  return <StorefrontScreen slug={slug} />;
}

export default function StorePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-surface-400">Loading…</div>}>
      <StoreRoute />
    </Suspense>
  );
}
