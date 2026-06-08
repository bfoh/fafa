'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'https://ghdidi.com';

export default function MobileRegisterPage() {
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
      const res = await fetch(`${API}/api/auth/register`, {
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

      // Redirect to the web version welcome wizard.
      window.location.href = `${API}/welcome`;
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen text-white antialiased flex flex-col justify-between"
      style={{
        backgroundColor: '#0b0910',
        backgroundImage: [
          'radial-gradient(60% 50% at 50% 0%, rgba(255,107,53,0.18), transparent 70%)',
          'radial-gradient(45% 40% at 90% 90%, rgba(255,150,90,0.08), transparent 70%)',
          'radial-gradient(50% 45% at 10% 80%, rgba(120,72,255,0.06), transparent 70%)',
        ].join(','),
      }}
    >
      {/* Texture overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 w-full max-w-md mx-auto px-6 pt-safe pb-8 flex flex-col min-h-screen">
        {/* Back header */}
        <header className="py-4">
          <Link
            href="/for-restaurants"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Didi
          </Link>
        </header>

        {/* Brand mark */}
        <div className="flex-1 flex flex-col justify-center py-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl ring-1 ring-white/15 mb-3.5 bg-white/5 flex items-center justify-center shadow-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/didi_logo.png"
                alt="Didi"
                className="w-full h-full object-cover"
              />
            </div>
            <h2
              className="text-2xl font-extrabold text-white tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Create your account
            </h2>
            <p className="text-white/50 mt-1.5 text-sm">
              Start accepting orders in under 5 minutes
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full px-4 py-3 rounded-xl border border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 focus:outline-none focus:bg-white/[0.08] transition-all text-sm"
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
                className="w-full px-4 py-3 rounded-xl border border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 focus:outline-none focus:bg-white/[0.08] transition-all text-sm"
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
                className="w-full px-4 py-3 rounded-xl border border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 focus:outline-none focus:bg-white/[0.08] transition-all text-sm"
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
                className="w-full px-4 py-3 rounded-xl border border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 focus:outline-none focus:bg-white/[0.08] transition-all text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white font-semibold hover:brightness-110 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-[0_10px_30px_-10px_rgba(255,107,53,0.8)] cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  Create my restaurant
                  <span className="text-base">➔</span>
                </span>
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
      </div>
    </main>
  );
}
