export interface AdepaContext {
  mode: 'storefront' | 'marketplace';
  tenantName?: string;
  tenantOpen?: boolean;
  customerFirstName?: string;
  usual?: string; // e.g. "Waakye Special" from the last order
  localVoice?: boolean;
}
