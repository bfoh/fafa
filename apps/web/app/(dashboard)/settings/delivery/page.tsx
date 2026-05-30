'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { formatGHS } from '@/lib/utils/currency';
import { getResolvedTenantIdClient } from '@/lib/admin/impersonate';

interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  estimated_minutes: number | null;
}

export default function DeliverySettingsPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Form State
  const [acceptsDelivery, setAcceptsDelivery] = useState(true);
  const [acceptsPickup, setAcceptsPickup] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');

  // Delivery Zones list
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneFee, setNewZoneFee] = useState('');
  const [newZoneMins, setNewZoneMins] = useState('');
  const [zoneLoading, setZoneLoading] = useState(false);

  useEffect(() => {
    async function loadTenantData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const tId = await getResolvedTenantIdClient(supabase, session);

        if (tId) {
          setTenantId(tId);

          // Fetch tenant settings
          const { data: tenant } = await supabase
            .from('tenants')
            .select('accepts_delivery, accepts_pickup, delivery_fee, min_order_amount')
            .eq('id', tId)
            .single();

          if (tenant) {
            setAcceptsDelivery(tenant.accepts_delivery ?? true);
            setAcceptsPickup(tenant.accepts_pickup ?? false);
            setDeliveryFee(Number(tenant.delivery_fee).toString());
            setMinOrderAmount(Number(tenant.min_order_amount).toString());
          }

          // Fetch zones
          const { data: fetchedZones } = await supabase
            .from('delivery_zones')
            .select('*')
            .eq('tenant_id', tId)
            .eq('is_active', true)
            .order('name');

          if (fetchedZones) {
            setZones(
              fetchedZones.map((z) => ({
                ...z,
                fee: Number(z.fee),
              }))
            );
          }
        }
      } catch (err) {
        console.error('Failed to load delivery settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTenantData();
  }, []);

  // Save general settings
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          accepts_delivery: acceptsDelivery,
          accepts_pickup: acceptsPickup,
          delivery_fee: parseFloat(deliveryFee) || 0,
          min_order_amount: parseFloat(minOrderAmount) || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);

      if (error) throw error;
      alert('Delivery settings saved successfully!');
    } catch (err) {
      console.error('Delivery settings save error:', err);
      alert('Error saving settings.');
    } finally {
      setSaving(false);
    }
  }

  // Create neighborhood delivery zone
  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    if (!newZoneName.trim() || !newZoneFee || !tenantId) return;

    setZoneLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .insert({
          tenant_id: tenantId,
          name: newZoneName.trim(),
          fee: parseFloat(newZoneFee) || 0,
          estimated_minutes: parseInt(newZoneMins) || null,
        })
        .select()
        .single();

      if (error) throw error;

      setZones((prev) => [...prev, { ...data, fee: Number(data.fee) }]);
      setNewZoneName('');
      setNewZoneFee('');
      setNewZoneMins('');
    } catch (err) {
      console.error('Failed to create zone:', err);
    } finally {
      setZoneLoading(false);
    }
  }

  // Delete neighborhood zone
  async function handleDeleteZone(zoneId: string) {
    try {
      const { error } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', zoneId);

      if (error) throw error;
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
    } catch (err) {
      console.error('Failed to delete zone:', err);
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
    <div className="space-y-8 max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h2 className="text-base font-bold text-surface-900">Delivery Rules</h2>
          <p className="text-xs text-surface-400 mt-0.5">Configure delivery modes, minimum shopping carts, and base rates.</p>
        </div>

        <div className="space-y-4">
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptsDelivery}
                onChange={(e) => setAcceptsDelivery(e.target.checked)}
                className="w-4 h-4 rounded text-brand-500 border-surface-300 focus:ring-brand-500/40"
              />
              <span className="text-xs font-semibold text-surface-700">Accepts Delivery</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptsPickup}
                onChange={(e) => setAcceptsPickup(e.target.checked)}
                className="w-4 h-4 rounded text-brand-500 border-surface-300 focus:ring-brand-500/40"
              />
              <span className="text-xs font-semibold text-surface-700">Accepts Customer Pickup</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                Base Delivery Fee (GH₵)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                Minimum Order Amount (GH₵)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save General Rules'}
        </button>
      </form>

      {/* Neighborhood Delivery Zones configuration */}
      <div className="border-t border-surface-100 pt-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-surface-900">Custom Neighborhood Zones</h3>
          <p className="text-xs text-surface-400 mt-0.5">Add specific neighborhood delivery rates (e.g. East Legon: GH₵ 15).</p>
        </div>

        <form onSubmit={handleAddZone} className="flex gap-2 flex-wrap sm:flex-nowrap">
          <input
            type="text"
            placeholder="Area name (e.g. East Legon)"
            required
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
            className="flex-1 min-w-[140px] px-3 py-2 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Fee (GH₵)"
            required
            value={newZoneFee}
            onChange={(e) => setNewZoneFee(e.target.value)}
            className="w-24 px-3 py-2 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
          />
          <input
            type="number"
            placeholder="Est. mins"
            value={newZoneMins}
            onChange={(e) => setNewZoneMins(e.target.value)}
            className="w-24 px-3 py-2 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
          />
          <button
            type="submit"
            disabled={zoneLoading}
            className="px-4 py-2 bg-surface-900 hover:bg-surface-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0"
          >
            {zoneLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </button>
        </form>

        <div className="bg-surface-50 border border-surface-150 rounded-2xl overflow-hidden text-xs">
          {zones.length === 0 ? (
            <p className="p-4 text-center text-surface-400 italic">No custom neighborhood zones. Orders will fallback to the base rate.</p>
          ) : (
            <div className="divide-y divide-surface-150 text-surface-700">
              {zones.map((zone) => (
                <div key={zone.id} className="flex justify-between items-center p-3 hover:bg-white transition-colors">
                  <div>
                    <span className="font-semibold text-surface-850">{zone.name}</span>
                    {zone.estimated_minutes && (
                      <span className="text-[10px] text-surface-400 ml-2">({zone.estimated_minutes} mins wait)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-brand-500">{formatGHS(zone.fee)}</span>
                    <button
                      onClick={() => handleDeleteZone(zone.id)}
                      className="text-surface-450 hover:text-error-600 hover:bg-error-50 p-1 rounded transition-colors"
                      title="Delete neighborhood"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
