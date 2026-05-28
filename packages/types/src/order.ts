// ─── Order Types ────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'card' | 'momo' | 'cash_on_delivery';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type DeliveryType = 'delivery' | 'pickup';

export interface Order {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  order_number: string;

  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;

  subtotal: number;
  delivery_fee: number;
  total: number;

  delivery_type: DeliveryType;
  delivery_address: string | null;
  delivery_zone_id: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_notes: string | null;

  customer_name: string;
  customer_phone: string;
  customer_email: string | null;

  estimated_ready_at: string | null;
  confirmed_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;

  created_at: string;
  updated_at: string;

  // Relations (optional, when joined)
  items?: OrderItem[];
  customer?: Customer;
  payment?: Payment;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  options_json: SelectedOption[] | null;
  line_total: number;
}

export interface SelectedOption {
  name: string;
  price_modifier: number;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

// ─── Customer Types ─────────────────────────────────────────

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
}

// ─── Payment Types ──────────────────────────────────────────

export type PaymentProvider = 'paystack' | 'manual';

export interface Payment {
  id: string;
  tenant_id: string;
  order_id: string;
  amount: number;
  method: PaymentMethod;
  provider: PaymentProvider;
  provider_ref: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
}

// ─── Delivery Zone Types ────────────────────────────────────

export interface DeliveryZone {
  id: string;
  tenant_id: string;
  name: string;
  fee: number;
  estimated_minutes: number | null;
  is_active: boolean;
}

// ─── Operating Hours Types ──────────────────────────────────

export interface OperatingHours {
  id: string;
  tenant_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

// ─── Notification Types ─────────────────────────────────────

export type NotificationChannel = 'sms' | 'email';
export type NotificationProvider = 'arkesel' | 'brevio';
export type NotificationStatus = 'sent' | 'failed' | 'delivered';

export type NotificationEvent =
  | 'order_placed'
  | 'order_confirmed'
  | 'order_ready'
  | 'order_out_for_delivery'
  | 'order_delivered'
  | 'payment_confirmed'
  | 'order_cancelled';

export interface NotificationLog {
  id: string;
  tenant_id: string;
  order_id: string | null;
  channel: NotificationChannel;
  provider: NotificationProvider;
  recipient: string;
  template: string;
  status: NotificationStatus;
  provider_ref: string | null;
  error_message: string | null;
  created_at: string;
}

// ─── Cart Types (client-side only) ──────────────────────────

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  options: SelectedOption[];
  imageUrl: string | null;
}

export interface CartState {
  tenantSlug: string;
  items: CartItem[];
  deliveryZoneId: string | null;
  deliveryFee: number;
}
