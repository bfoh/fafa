'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createBrowserClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div>
      {/* Mobile branding */}
      <div className="lg:hidden mb-8 text-center">
        <h1 className="text-3xl font-bold text-brand-500">Fafa</h1>
        <p className="text-surface-500 mt-1">Food Ordering Made Simple</p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-surface-900">Welcome back</h2>
        <p className="text-surface-500 mt-1">
          Sign in to manage your restaurant
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-error-500/10 text-error-600 text-sm animate-fade-in">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-surface-700 mb-1.5"
          >
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@restaurant.com"
            className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-surface-700"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-brand-500 hover:text-brand-600 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Signing in...
            </span>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-surface-500">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="text-brand-500 font-semibold hover:text-brand-600 transition-colors"
        >
          Create one free
        </Link>
      </p>
    </div>
  );
}
