// ─── Tenant Types ───────────────────────────────────────────

export type TenantStatus = 'onboarding' | 'active' | 'suspended' | 'deactivated';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tagline: string | null;

  // Branding
  logo_url: string | null;
  cover_image_url: string | null;
  primary_color: string;
  secondary_color: string;

  // Contact
  phone: string;
  whatsapp: string | null;
  email: string | null;

  // Location
  address: string | null;
  city: string | null;
  region: string | null;
  location_lat: number | null;
  location_lng: number | null;

  // Business config
  delivery_fee: number;
  min_order_amount: number;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  accepts_pay_online: boolean;
  accepts_pay_on_delivery: boolean;

  // Paystack
  paystack_subaccount_code: string | null;

  // Notification preferences
  notify_sms: boolean;
  notify_email: boolean;
  notify_whatsapp: boolean;

  // Status
  status: TenantStatus;

  created_at: string;
  updated_at: string;
}

export type TenantMemberRole = 'owner' | 'manager' | 'staff';

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: TenantMemberRole;
  created_at: string;
}
