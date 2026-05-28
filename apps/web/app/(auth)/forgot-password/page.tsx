'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const supabase = createBrowserClient();

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

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/login` }
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="text-center animate-fade-in">
        <div className="w-16 h-16 bg-success-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">📧</span>
        </div>
        <h2 className="text-2xl font-bold text-surface-900">Check your email</h2>
        <p className="text-surface-500 mt-2">
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
      <div className="lg:hidden mb-8 text-center">
        <h1 className="text-3xl font-bold" style={{ color: primaryColor }}>
          {branding ? branding.name : 'Didi'}
        </h1>
      </div>

      <h2 className="text-2xl font-bold text-surface-900">Reset password</h2>
      <p className="text-surface-500 mt-1">
        Enter your email and we&apos;ll send you a reset link
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-error-500/10 text-error-600 text-sm animate-fade-in">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-surface-700 mb-1.5">
            Email address
          </label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            required
            placeholder="you@restaurant.com"
            className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 transition-all"
            style={
              emailFocused
                ? {
                    borderColor: primaryColor,
                    boxShadow: `0 0 0 2px ${primaryColor}55`,
                  }
                : undefined
            }
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] hover:opacity-90 cursor-pointer"
          style={{
            backgroundColor: primaryColor,
          }}
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-surface-500">
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
