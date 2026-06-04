import type { SupabaseClient } from '@supabase/supabase-js';

export interface SetupStatus {
  menuDone: boolean;
  paymentsDone: boolean;
  brandingDone: boolean;
  locationDone: boolean;
}

export async function loadSetupStatus(
  supabase: SupabaseClient,
  tenantId: string
): Promise<SetupStatus> {
  const [{ count: menuCount }, { data: tenant }] = await Promise.all([
    supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase
      .from('tenants')
      .select('paystack_subaccount_code, logo_url, location_lat, location_lng')
      .eq('id', tenantId)
      .single(),
  ]);

  return {
    menuDone: (menuCount || 0) > 0,
    paymentsDone: Boolean(tenant?.paystack_subaccount_code),
    brandingDone: Boolean(tenant?.logo_url),
    locationDone: tenant?.location_lat != null && tenant?.location_lng != null,
  };
}
