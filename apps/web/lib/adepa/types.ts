export interface AdepaContext {
  mode: 'storefront' | 'marketplace';
  channel?: 'web' | 'whatsapp';
  tenantName?: string;
  tenantOpen?: boolean;
  customerFirstName?: string;
  usual?: string; // e.g. "Waakye Special" from the last order
  localVoice?: boolean;
  storefrontUrl?: string; // for WhatsApp: where to send them to order
}
