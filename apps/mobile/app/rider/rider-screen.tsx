'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSupabase } from '../providers';
import { useRiderTracking } from '../hooks/use-rider-tracking';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'https://www.ghdidi.com';

interface RiderOrder {
  id: string;
  order_number: string;
  status: string;
  delivery_address: string | null;
  customer_name: string;
  customer_phone: string | null;
  total: number;
}

export function RiderScreen() {
  const supabase = useSupabase();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<RiderOrder[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const getToken = useCallback(
    async () =>
      supabase
        ? (await supabase.auth.getSession()).data.session?.access_token ?? null
        : null,
    [supabase]
  );
  const { start, stop, tracking } = useRiderTracking(getToken);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setAuthed(!!session)
    );
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const loadOrders = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/rider/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { orders } = await res.json();
      setOrders(orders ?? []);
    } catch {
      // offline — keep last list
    }
  }, [getToken]);

  useEffect(() => {
    if (authed) loadOrders();
  }, [authed, loadOrders]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  }

  async function toggleOnline(order: RiderOrder) {
    setError(null);
    try {
      if (tracking && activeOrderId === order.id) {
        await stop();
        setActiveOrderId(null);
      } else {
        if (tracking) await stop();
        await start(order.id);
        setActiveOrderId(order.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start tracking');
    }
  }

  if (authed === null) {
    return <div className="p-8 text-center text-surface-400">Loading…</div>;
  }

  if (!authed) {
    return (
      <div className="min-h-[100dvh] bg-canvas flex flex-col justify-center px-6 pt-safe pb-safe">
        <h1 className="text-2xl font-bold text-surface-900 mb-1">Rider sign in</h1>
        <p className="text-sm text-surface-500 mb-6">Sign in to see your deliveries.</p>
        <form onSubmit={signIn} className="space-y-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-hairline bg-white"
            required
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-hairline bg-white"
            required
          />
          {error && <p className="text-sm text-error-600">{error}</p>}
          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-brand-500 text-white font-bold press"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-canvas pt-safe pb-safe">
      <header className="px-4 py-3 flex items-center justify-between border-b border-hairline">
        <h1 className="font-bold text-surface-900">My deliveries</h1>
        <button onClick={() => loadOrders()} className="text-sm text-brand-600 font-semibold">
          Refresh
        </button>
      </header>

      {error && <p className="px-4 py-2 text-sm text-error-600">{error}</p>}

      {orders.length === 0 ? (
        <p className="p-8 text-center text-surface-400">No active deliveries.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {orders.map((o) => {
            const isActive = tracking && activeOrderId === o.id;
            return (
              <li key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-surface-900">#{o.order_number}</p>
                    <p className="text-sm text-surface-600 truncate">{o.customer_name}</p>
                    {o.delivery_address && (
                      <p className="text-xs text-surface-400 truncate">{o.delivery_address}</p>
                    )}
                    <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">
                      {o.status}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleOnline(o)}
                    className={`shrink-0 h-10 px-4 rounded-xl text-sm font-bold press ${
                      isActive ? 'bg-error-500 text-white' : 'bg-brand-500 text-white'
                    }`}
                  >
                    {isActive ? 'Stop sharing' : 'Share location'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {tracking && (
        <p className="px-4 py-3 text-xs text-success-600 font-semibold">
          ● Live — sharing your location with the customer.
        </p>
      )}
    </div>
  );
}
