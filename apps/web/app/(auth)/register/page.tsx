'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [restaurantName, setRestaurantName] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !phone || !password || !restaurantName) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, password, restaurantName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Straight into the guided setup wizard.
      router.push('/welcome');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Brand mark — register always wears Didi */}
      <div className="mb-6 flex flex-col items-center text-center lg:items-start lg:text-left">
        <Link href="/" aria-label="Back to marketplace" className="mb-3 inline-block">
          <Image
            src="/images/didi_favicon.png"
            alt="Didi"
            width={48}
            height={48}
            className="rounded-2xl ring-1 ring-white/15 hover:ring-white/30 transition"
          />
        </Link>
        <h2
          className="text-2xl font-extrabold text-white"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Create your account
        </h2>
        <p className="text-white/50 mt-1 text-sm">
          Start accepting orders in under 5 minutes
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/25 text-rose-200 text-sm animate-fade-in">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="register-restaurant" className="block text-sm font-medium text-white/70 mb-1.5">
            Restaurant name
          </label>
          <input
            id="register-restaurant"
            type="text"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            required
            placeholder="Mama Ama's Kitchen"
            className="w-full px-4 py-3 rounded-xl border border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 focus:outline-none focus:bg-white/[0.08] transition-all"
          />
        </div>

        <div>
          <label htmlFor="register-email" className="block text-sm font-medium text-white/70 mb-1.5">
            Email address
          </label>
          <input
            id="register-email"
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

        <div>
          <label htmlFor="register-phone" className="block text-sm font-medium text-white/70 mb-1.5">
            Phone number
          </label>
          <input
            id="register-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="024 123 4567"
            className="w-full px-4 py-3 rounded-xl border border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 focus:outline-none focus:bg-white/[0.08] transition-all"
          />
        </div>

        <div>
          <label htmlFor="register-password" className="block text-sm font-medium text-white/70 mb-1.5">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="At least 6 characters"
            className="w-full px-4 py-3 rounded-xl border border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 focus:outline-none focus:bg-white/[0.08] transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white font-semibold hover:brightness-110 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-[0_10px_30px_-10px_rgba(255,107,53,0.8)]"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating your account...
            </span>
          ) : (
            'Create my restaurant →'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/50">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-300 font-semibold hover:text-brand-200 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
