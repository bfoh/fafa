'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [branding, setBranding] = useState<{
    name: string;
    slug: string;
    logoUrl: string;
    primaryColor: string;
  } | null>(null);

  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  useEffect(() => {
    // First, load from localStorage if it exists
    const cached = localStorage.getItem('fafa_last_tenant');
    let cachedSlug = '';
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.slug) {
          setTimeout(() => setBranding(parsed), 0);
          cachedSlug = parsed.slug;
        }
      } catch (e) {
        console.error('Failed to parse cached tenant:', e);
      }
    }

    // Now inspect URL search parameters safely without triggering Next.js dynamic routing bail-out warnings
    const params = new URLSearchParams(window.location.search);
    const tenantParam = params.get('tenant');
    const slugToFetch = tenantParam || cachedSlug;

    if (slugToFetch) {
      async function fetchBranding() {
        try {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('name, slug, logo_url, primary_color')
            .eq('slug', slugToFetch)
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
          } else if (tenantParam) {
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

  const primaryColor = branding?.primaryColor || '#FF6B35';


  return (
    <div>
      {/* Mobile branding */}
      <div className="lg:hidden mb-8 text-center animate-fade-in">
        {branding ? (
          <div className="flex flex-col items-center">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="w-16 h-16 rounded-2xl object-cover shadow-sm mb-3"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-sm mb-3"
                style={{ backgroundColor: primaryColor }}
              >
                {branding.name.charAt(0)}
              </div>
            )}
            <h1 className="text-2xl font-bold text-surface-900">{branding.name}</h1>
            <p className="text-xs text-surface-400 mt-0.5">Powered by Fafa</p>
          </div>
        ) : (
          <div>
            <h1 className="text-3xl font-bold text-brand-500">Fafa</h1>
            <p className="text-surface-500 mt-1">Food Ordering Made Simple</p>
          </div>
        )}
      </div>

      <div className="animate-fade-in">
        {branding ? (
          <div className="text-center lg:text-left">
            <div className="hidden lg:block mb-4">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={branding.name}
                  className="w-16 h-16 rounded-2xl object-cover shadow-sm"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  {branding.name.charAt(0)}
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-surface-900 leading-tight">
              Welcome back to {branding.name}
            </h2>
            <p className="text-surface-500 mt-1">
              Sign in to manage your kitchen
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold text-surface-900">Welcome back</h2>
            <p className="text-surface-500 mt-1">
              Sign in to manage your restaurant
            </p>
          </div>
        )}
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
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            required
            placeholder="you@restaurant.com"
            className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none transition-all"
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
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: primaryColor }}
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            required
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none transition-all"
            style={
              passwordFocused
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
          className="w-full py-3 px-4 rounded-xl text-white font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] hover:opacity-90 cursor-pointer"
          style={{
            backgroundColor: primaryColor,
            ['--tw-ring-color' as string]: primaryColor,
          } as React.CSSProperties}
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
          className="text-xs text-surface-400 hover:text-surface-600 underline mt-4 block mx-auto text-center cursor-pointer"
        >
          Not your restaurant? Sign in to Fafa
        </button>
      )}

      <p className="mt-6 text-center text-sm text-surface-500">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-semibold transition-colors hover:opacity-85"
          style={{ color: primaryColor }}
        >
          Create one free
        </Link>
      </p>
    </div>
  );
}
