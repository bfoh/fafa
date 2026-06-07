'use client';

/**
 * App entry — the first screen Capacitor loads (index.html). In Phase 0 it's a
 * simple launcher; later this becomes the marketplace home / restaurant search.
 * Deep links route straight to /store/?slug=... and bypass this.
 */
export default function Home() {
  return (
    <main className="min-h-[100dvh] bg-canvas flex flex-col items-center justify-center gap-4 p-8 text-center pt-safe pb-safe">
      <h1
        className="text-3xl font-bold text-surface-900"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Didi
      </h1>
      <p className="text-surface-500 text-sm max-w-xs">
        Order food online in Ghana. Open a restaurant link to start.
      </p>
    </main>
  );
}
