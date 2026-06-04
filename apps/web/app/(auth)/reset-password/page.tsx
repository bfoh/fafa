'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const supabase = createBrowserClient();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ready, setReady] = useState(false); // recovery session established
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // The browser client parses the recovery token from the URL hash on load and
  // emits PASSWORD_RECOVERY (or SIGNED_IN). We also check for an existing session
  // in case that event already fired before this listener attached.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      setChecking(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    if (updErr) {
      setError(updErr.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    setTimeout(() => router.push('/login'), 1600);
  }

  if (done) {
    return (
      <div className="text-center animate-fade-in">
        <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-400/25 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-2xl font-extrabold text-white">Password updated</h2>
        <p className="text-white/55 mt-2">Redirecting you to sign in…</p>
      </div>
    );
  }

  // Link invalid/expired: no recovery session after the URL was parsed.
  if (!checking && !ready) {
    return (
      <div className="text-center animate-fade-in">
        <div className="w-16 h-16 bg-rose-500/15 border border-rose-400/25 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-extrabold text-white">Link expired or invalid</h2>
        <p className="text-white/55 mt-2">
          This password reset link is no longer valid. Request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block mt-6 text-sm font-semibold text-brand-400 hover:opacity-80 transition-colors"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-extrabold text-white" style={{ fontFamily: 'var(--font-display)' }}>
        Set a new password
      </h2>
      <p className="text-white/50 mt-1 text-sm">Choose a new password for your account.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/25 text-rose-200 text-sm animate-fade-in">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="reset-password" className="block text-sm font-medium text-white/70 mb-1.5">
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl border border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 focus:outline-none focus:bg-white/[0.08] transition-all"
          />
        </div>

        <div>
          <label htmlFor="reset-confirm" className="block text-sm font-medium text-white/70 mb-1.5">
            Confirm password
          </label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl border border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 focus:outline-none focus:bg-white/[0.08] transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading || checking}
          className="w-full py-3 px-4 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] hover:brightness-110 cursor-pointer shadow-[0_10px_30px_-10px_rgba(255,107,53,0.8)]"
          style={{ backgroundImage: 'linear-gradient(135deg, #FF6B35, #FF6B35cc)' }}
        >
          {loading ? 'Updating…' : checking ? 'Validating link…' : 'Update password'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/50">
        <Link href="/login" className="font-semibold text-brand-400 hover:opacity-85 transition-colors">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
