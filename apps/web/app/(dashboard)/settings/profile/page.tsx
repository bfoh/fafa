'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { CUISINES } from '@/lib/marketplace/cuisines';
import { CITY_COORDS } from '@/lib/marketplace/geo';
import { getResolvedTenantIdClient } from '@/lib/admin/impersonate';

const LocationPicker = dynamic(
  () => import('@/components/onboarding/location-picker'),
  { ssr: false }
);

export default function ProfileSettingsPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');

  // Notification Preferences
  const [notifySms, setNotifySms] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    async function loadTenantData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const tId = await getResolvedTenantIdClient(supabase, session);

        if (tId) {
          setTenantId(tId);
          const { data: tenant } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', tId)
            .single();

          if (tenant) {
            setName(tenant.name || '');
            setTagline(tenant.tagline || '');
            setDescription(tenant.description || '');
            setAddress(tenant.address || '');
            setCity(tenant.city || '');
            setPhone(tenant.phone || '');
            setWhatsapp(tenant.whatsapp || '');
            setEmail(tenant.email || '');
            setNotifySms(tenant.notify_sms ?? true);
            setNotifyEmail(tenant.notify_email ?? true);
            setCuisines(Array.isArray(tenant.cuisines) ? tenant.cuisines : []);
            if (tenant.location_lat != null && tenant.location_lng != null) {
              setLoc({
                lat: Number(tenant.location_lat),
                lng: Number(tenant.location_lng),
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to load profile settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTenantData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: name.trim(),
          tagline: tagline.trim() || null,
          description: description.trim() || null,
          address: address.trim() || null,
          city: city || null,
          phone: phone.trim(),
          whatsapp: whatsapp.trim() || null,
          email: email.trim() || null,
          notify_sms: notifySms,
          notify_email: notifyEmail,
          cuisines,
          location_lat: loc?.lat ?? null,
          location_lng: loc?.lng ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);

      if (error) throw error;
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Failed to update profile:', err);
      alert('Error updating profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="p-6 text-center">
        <p className="text-surface-500 font-medium">No restaurant found for this account.</p>
        <p className="text-sm text-surface-400 mt-1">Please ensure you have onboarded or created a restaurant.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-base font-bold text-surface-900">General Profile</h2>
        <p className="text-xs text-surface-400 mt-0.5">Edit public information about your food business.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
            Restaurant Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-hairline bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-hairline bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
              WhatsApp Contact
            </label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-hairline bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-hairline bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
              City / Area
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-hairline bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
            Business Tagline
          </label>
          <input
            type="text"
            placeholder="e.g. Best local dishes in East Legon"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-hairline bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
            Detailed Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-hairline bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs resize-none"
          />
        </div>

        {/* Cuisines + location */}
        <div className="border-t border-surface-100 pt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
              Cuisines
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
            <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
              Map Location
            </label>
            <LocationPicker
              center={city && CITY_COORDS[city] ? CITY_COORDS[city] : undefined}
              value={loc}
              onChange={(lat, lng) => setLoc({ lat, lng })}
            />
            {loc && (
              <p className="text-[11px] text-success-600 mt-1">Location set ✓</p>
            )}
          </div>
        </div>

        {/* Notifications config */}
        <div className="border-t border-surface-100 pt-5 space-y-3">
          <h3 className="text-xs font-bold text-surface-800 uppercase tracking-wider">
            Notification Alerts
          </h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={notifySms}
                onChange={(e) => setNotifySms(e.target.checked)}
                className="w-4 h-4 rounded text-brand-500 border-surface-300 focus:ring-brand-500/40"
              />
              <div className="text-xs">
                <p className="font-semibold text-surface-800">Receive SMS order updates</p>
                <p className="text-surface-400 text-[10px]">Send automated order SMS updates to your clients.</p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="w-4 h-4 rounded text-brand-500 border-surface-300 focus:ring-brand-500/40"
              />
              <div className="text-xs">
                <p className="font-semibold text-surface-800">Receive Email order updates</p>
                <p className="text-surface-400 text-[10px]">Send email copies of transaction orders to clients.</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
