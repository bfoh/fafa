'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { Loader2, Image as ImageIcon } from 'lucide-react';

const presetColors = [
  { name: 'Warm Orange', hex: '#FF6B35' },
  { name: 'Deep Rose', hex: '#E01E5A' },
  { name: 'Emerald Green', hex: '#10B981' },
  { name: 'Royal Blue', hex: '#2563EB' },
  { name: 'Golden Yellow', hex: '#FBBF24' },
  { name: 'Charcoal Dark', hex: '#1A1A2E' },
];

export default function BrandingSettingsPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');

  // Form State
  const [primaryColor, setPrimaryColor] = useState('#FF6B35');
  const [secondaryColor, setSecondaryColor] = useState('#1A1A2E');
  
  // Image Uploads
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadTenant() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: member } = await supabase
          .from('tenant_members')
          .select('tenant_id')
          .eq('user_id', session.user.id)
          .single();

        if (member) {
          setTenantId(member.tenant_id);
          const { data: tenant } = await supabase
            .from('tenants')
            .select('name, slug, primary_color, secondary_color, logo_url, cover_image_url')
            .eq('id', member.tenant_id)
            .single();

          if (tenant) {
            setTenantName(tenant.name);
            setTenantSlug(tenant.slug);
            setPrimaryColor(tenant.primary_color || '#FF6B35');
            setSecondaryColor(tenant.secondary_color || '#1A1A2E');
            setLogoUrl(tenant.logo_url || null);
            setCoverUrl(tenant.cover_image_url || null);
          }
        }
      } catch (err) {
        console.error('Failed to load branding settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTenant();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;

    setSaving(true);
    try {
      let finalLogoUrl = logoUrl;
      let finalCoverUrl = coverUrl;

      // 1. Upload Logo if exists
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const fileName = `${tenantId}/logo_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('logos')
          .upload(fileName, logoFile, { cacheControl: '3600', upsert: true });

        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName);
        finalLogoUrl = publicUrl;
      }

      // 2. Upload Cover if exists
      if (coverFile) {
        const ext = coverFile.name.split('.').pop();
        const fileName = `${tenantId}/cover_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('covers')
          .upload(fileName, coverFile, { cacheControl: '3600', upsert: true });

        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(fileName);
        finalCoverUrl = publicUrl;
      }

      // 3. Update database
      const { error } = await supabase
        .from('tenants')
        .update({
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          logo_url: finalLogoUrl,
          cover_image_url: finalCoverUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);

      if (error) throw error;

      // Update local branding cache immediately
      if (tenantSlug) {
        const branding = {
          name: tenantName,
          logoUrl: finalLogoUrl || '',
          primaryColor: primaryColor,
          slug: tenantSlug,
        };
        localStorage.setItem('fafa_last_tenant', JSON.stringify(branding));
        document.cookie = `fafa_last_tenant_slug=${tenantSlug}; path=/; max-age=31536000; SameSite=Lax`;
      }

      alert('Branding settings saved successfully!');
    } catch (err) {
      console.error('Branding update error:', err);
      alert('Error saving branding settings.');
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
        <h2 className="text-base font-bold text-surface-900">Storefront Branding</h2>
        <p className="text-xs text-surface-400 mt-0.5">Customize how your store appears to customers on mobile browsers.</p>
      </div>

      <div className="space-y-5">
        {/* Color Picker presets */}
        <div>
          <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">
            Primary Accent Color
          </label>
          <div className="flex flex-wrap gap-2.5">
            {presetColors.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => setPrimaryColor(color.hex)}
                className={`w-8 h-8 rounded-full border-2 transition-all relative flex items-center justify-center`}
                style={{
                  background: color.hex,
                  borderColor: primaryColor === color.hex ? '#000000' : 'transparent',
                }}
                title={color.name}
              >
                {primaryColor === color.hex && (
                  <span className="w-2.5 h-2.5 rounded-full bg-white ring-1 ring-black/10" />
                )}
              </button>
            ))}
            {/* Custom HEX field */}
            <div className="flex gap-1.5 items-center ml-2 border border-surface-200 rounded-xl px-3 py-1.5 bg-surface-50">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-5 h-5 border border-surface-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor.toUpperCase()}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#FF6B35"
                className="w-16 bg-transparent text-[10px] text-surface-600 font-extrabold focus:outline-none text-center"
              />
            </div>
          </div>
        </div>

        {/* Logo upload */}
        <div className="border-t border-surface-100 pt-5">
          <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
            Restaurant Logo
          </label>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo preview"
                className="w-16 h-16 rounded-2xl object-cover border border-surface-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-surface-50 border-2 border-dashed border-surface-200 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-surface-400" />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setLogoFile(file);
                  setLogoUrl(URL.createObjectURL(file));
                }
              }}
              className="text-xs text-surface-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-500/10 file:text-brand-600 hover:file:bg-brand-500/20 file:cursor-pointer"
            />
          </div>
        </div>

        {/* Cover image upload */}
        <div className="border-t border-surface-100 pt-5">
          <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
            Cover Banner Image
          </label>
          <div className="space-y-3">
            {coverUrl ? (
              <div className="h-28 w-full rounded-2xl overflow-hidden border border-surface-200 relative">
                <img
                  src={coverUrl}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="h-28 w-full rounded-2xl bg-surface-50 border-2 border-dashed border-surface-200 flex flex-col items-center justify-center text-center">
                <ImageIcon className="w-8 h-8 text-surface-400 mb-1" />
                <span className="text-[10px] text-surface-400 font-semibold">Landscape image recommended</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setCoverFile(file);
                  setCoverUrl(URL.createObjectURL(file));
                }
              }}
              className="text-xs text-surface-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-500/10 file:text-brand-600 hover:file:bg-brand-500/20 file:cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-surface-100">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Branding'}
        </button>
      </div>
    </form>
  );
}
