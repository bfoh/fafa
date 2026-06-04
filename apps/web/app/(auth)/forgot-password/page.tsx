'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const [branding, setBranding] = useState<{
    name: string;
    slug: string;
    logoUrl: string;
    primaryColor: string;
  } | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem('fafa_last_tenant');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.slug) {
          setTimeout(() => setBranding(parsed), 0);
        }
      } catch (e) {
        console.error('Failed to parse cached tenant:', e);
      }
    }
  }, []);

  const primaryColor = branding?.primaryColor || '#FF6B35';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not send reset link. Please try again.');
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center animate-fade-in">
        <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-400/25 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">📧</span>
        </div>
        <h2 className="text-2xl font-extrabold text-white">Check your email</h2>
        <p className="text-white/55 mt-2">
          We&apos;ve sent a password reset link to <strong>{email}</strong>
        </p>
        <Link
          href="/login"
          className="inline-block mt-6 text-sm font-semibold transition-colors hover:opacity-80"
          style={{ color: primaryColor }}
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2
        className="text-2xl font-extrabold text-white"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Reset password
      </h2>
      <p className="text-white/50 mt-1 text-sm">
        Enter your email and we&apos;ll send you a reset link
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/25 text-rose-200 text-sm animate-fade-in">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-white/70 mb-1.5">
            Email address
          </label>
          <input
            id="forgot-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@restaurant.com"
            className="w-full px-4 py-3 rounded-xl border border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 focus:outline-none focus:bg-white/[0.08] transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] hover:brightness-110 cursor-pointer shadow-[0_10px_30px_-10px_rgba(255,107,53,0.8)]"
          style={{
            backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
          }}
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/50">
        Remember your password?{' '}
        <Link
          href="/login"
          className="font-semibold transition-colors hover:opacity-85"
          style={{ color: primaryColor }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
