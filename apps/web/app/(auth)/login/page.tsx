'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [branding, setBranding] = useState<{
    name: string;
    slug: string;
    logoUrl: string;
    primaryColor: string;
  } | null>(null);

  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  useEffect(() => {
    async function checkExistingSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: adminRecord } = await supabase
          .from('platform_admins')
          .select('user_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (adminRecord) {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
      }
    }
    checkExistingSession();
  }, [supabase, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tenantParam = params.get('tenant');

    if (!tenantParam) {
      setBranding(null);
      return;
    }

    const cached = localStorage.getItem('fafa_last_tenant');
    let cachedSlug = '';
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.slug === tenantParam) {
          setTimeout(() => setBranding(parsed), 0);
          cachedSlug = parsed.slug;
        }
      } catch (e) {
        console.error('Failed to parse cached tenant:', e);
      }
    }

    if (tenantParam) {
      async function fetchBranding() {
        try {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('name, slug, logo_url, primary_color')
            .eq('slug', tenantParam)
            .eq('status', 'active')
            .single();

          if (tenant) {
            const brandingData = {
              name: tenant.name,
              slug: tenant.slug,
              logoUrl: tenant.logo_url || '',
              primaryColor: tenant.primary_color || '#FF6B35',
            };
            setBranding(brandingData);
            localStorage.setItem('fafa_last_tenant', JSON.stringify(brandingData));
            document.cookie = `fafa_last_tenant_slug=${tenant.slug}; path=/; max-age=31536000; SameSite=Lax`;
          } else {
            setBranding(null);
          }
        } catch (err) {
          console.error('Error fetching tenant branding:', err);
        }
      }
      fetchBranding();
    }
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (authData?.user) {
      const { data: adminRecord } = await supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (adminRecord) {
        router.push('/admin');
        router.refresh();
        return;
      }
    }

    router.push('/dashboard');
    router.refresh();
  }

  const accent = branding?.primaryColor || '#FF6B35';
  const inputClass =
    'w-full px-4 py-3 rounded-xl border border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 focus:outline-none focus:bg-white/[0.08] transition-all';

  return (
    <div>
      {/* Mobile / in-card brand mark */}
      <div className="mb-7 flex flex-col items-center text-center lg:items-start lg:text-left">
        {branding ? (
          <>
            <Link href="/" aria-label="Back to marketplace" className="mb-3 inline-block">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt={branding.name}
                  className="w-14 h-14 rounded-2xl object-cover ring-1 ring-white/20 hover:ring-white/40 transition"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl grid place-items-center text-white font-bold text-xl"
                  style={{ backgroundColor: accent }}
                >
                  {branding.name.charAt(0)}
                </div>
              )}
            </Link>
            <h2
              className="text-2xl font-extrabold text-white leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Welcome back to {branding.name}
            </h2>
            <p className="text-white/50 mt-1 text-sm">
              Sign in to manage your kitchen
            </p>
          </>
        ) : (
          <>
            <Link href="/" aria-label="Back to marketplace" className="mb-3 inline-block">
              <Image
                src="/images/didi_logo.png"
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
              Welcome back
            </h2>
            <p className="text-white/50 mt-1 text-sm">
              Sign in to manage your kitchen
            </p>
          </>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/25 text-rose-200 text-sm">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="login-email"
            className="block text-sm font-medium text-white/70 mb-1.5"
          >
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@restaurant.com"
            className={inputClass}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-white/70"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: accent }}
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] hover:brightness-110 cursor-pointer shadow-[0_10px_30px_-10px_rgba(255,107,53,0.8)]"
          style={{
            backgroundImage: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          }}
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

      {branding && (
        <button
          type="button"
          onClick={() => {
            setBranding(null);
            localStorage.removeItem('fafa_last_tenant');
            document.cookie =
              'fafa_last_tenant_slug=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            router.replace('/login');
          }}
          className="text-xs text-white/40 hover:text-white/70 underline mt-4 block mx-auto text-center cursor-pointer"
        >
          Not your kitchen? Sign in to Didi
        </button>
      )}

      <p className="mt-6 text-center text-sm text-white/50">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-semibold transition-colors hover:opacity-85"
          style={{ color: accent }}
        >
          Create one free
        </Link>
      </p>
    </div>
  );
}
