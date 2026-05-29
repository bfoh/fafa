'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { CUISINES } from '@/lib/marketplace/cuisines';
import { CITY_COORDS } from '@/lib/marketplace/geo';

const LocationPicker = dynamic(
  () => import('@/components/onboarding/location-picker'),
  { ssr: false }
);

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Step 1: Account
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Step 2: Restaurant
  const [restaurantName, setRestaurantName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (step === 1) {
      // Validate step 1
      if (!email || !phone || !password) {
        setError('Please fill in all fields');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      setError('');
      setStep(2);
      return;
    }

    // Step 2: Submit
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          phone,
          password,
          restaurantName,
          description,
          city,
          cuisines,
          locationLat: loc?.lat ?? null,
          locationLng: loc?.lng ?? null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Success → go to step 3 (confirmation) or dashboard
      setStep(3);
      // Auto-redirect after a moment
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 3000);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  // Step 3: Success
  if (step === 3) {
    return (
      <div className="text-center animate-fade-in">
        <div className="w-20 h-20 bg-success-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">✅</span>
        </div>
        <h2 className="text-2xl font-bold text-surface-900">
          You&apos;re all set!
        </h2>
        <p className="text-surface-500 mt-2">
          Your restaurant is ready to accept orders.
        </p>
        <p className="mt-4 text-sm text-surface-400">
          Redirecting to your dashboard...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Mobile branding */}
      <div className="lg:hidden mb-8 text-center">
        <h1 className="text-3xl font-bold text-brand-500">Didi</h1>
        <p className="text-surface-500 mt-1">Food Ordering Made Simple</p>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-surface-900">
          Create your account
        </h2>
        <p className="text-surface-500 mt-1">
          {step === 1
            ? 'Start accepting orders in under 5 minutes'
            : 'Tell us about your restaurant'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mt-6">
        <div
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            step >= 1 ? 'bg-brand-500' : 'bg-surface-200'
          }`}
        />
        <div
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            step >= 2 ? 'bg-brand-500' : 'bg-surface-200'
          }`}
        />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {error && (
          <div className="p-3 rounded-xl bg-error-500/10 text-error-600 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label
                htmlFor="register-email"
                className="block text-sm font-medium text-surface-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@restaurant.com"
                className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="register-phone"
                className="block text-sm font-medium text-surface-700 mb-1.5"
              >
                Phone number
              </label>
              <input
                id="register-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="024 123 4567"
                className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="block text-sm font-medium text-surface-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label
                htmlFor="register-restaurant"
                className="block text-sm font-medium text-surface-700 mb-1.5"
              >
                Restaurant name
              </label>
              <input
                id="register-restaurant"
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                required
                placeholder="Mama Ama's Kitchen"
                className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="register-description"
                className="block text-sm font-medium text-surface-700 mb-1.5"
              >
                Short description{' '}
                <span className="text-surface-400">(optional)</span>
              </label>
              <textarea
                id="register-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Authentic Ghanaian home cooking..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all resize-none"
              />
            </div>

            <div>
              <label
                htmlFor="register-city"
                className="block text-sm font-medium text-surface-700 mb-1.5"
              >
                City / Area
              </label>
              <select
                id="register-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
              >
                <option value="">Select your city</option>
                <option value="Accra">Accra</option>
                <option value="Kumasi">Kumasi</option>
                <option value="Tamale">Tamale</option>
                <option value="Takoradi">Takoradi</option>
                <option value="Cape Coast">Cape Coast</option>
                <option value="Tema">Tema</option>
                <option value="Sunyani">Sunyani</option>
                <option value="Ho">Ho</option>
                <option value="Koforidua">Koforidua</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                What food do you serve?{' '}
                <span className="text-surface-400">(pick a few)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CUISINES.map((c) => {
                  const on = cuisines.includes(c.slug);
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() =>
                        setCuisines((prev) =>
                          on
                            ? prev.filter((s) => s !== c.slug)
                            : [...prev, c.slug]
                        )
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        on
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-white text-surface-600 border-surface-200'
                      }`}
                    >
                      {c.emoji} {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Pin your location{' '}
                <span className="text-surface-400">
                  (helps nearby customers find you)
                </span>
              </label>
              <LocationPicker
                center={city && CITY_COORDS[city] ? CITY_COORDS[city] : undefined}
                value={loc}
                onChange={(lat, lng) => setLoc({ lat, lng })}
              />
              {loc && (
                <p className="text-[11px] text-success-600 mt-1">
                  Location set ✓
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 py-3 px-4 rounded-xl border border-surface-200 text-surface-700 font-semibold hover:bg-surface-100 transition-all"
            >
              Back
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
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
                Creating your account...
              </span>
            ) : step === 1 ? (
              'Continue →'
            ) : (
              'Create Restaurant'
            )}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-surface-500">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-brand-500 font-semibold hover:text-brand-600 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
