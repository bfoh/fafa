import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getResolvedTenantId } from '@/lib/admin/guard';
import { sendOrderMessageNotification } from '@/lib/notifications/send';

const MAX_BODY = 2000;
const MAX_THREAD = 300;

/**
 * Resolve whether the caller is the restaurant (authenticated member of
 * the order's tenant) or the anonymous customer. Returns null tenant
 * match for customers.
 */
async function resolveActor(orderTenantId: string): Promise<'restaurant' | 'customer'> {
  try {
    // Impersonation-aware: a platform admin managing this restaurant resolves to
    // the impersonated tenant. Returns null tenant for anonymous customers.
    const { tenantId } = await getResolvedTenantId();
    return tenantId && tenantId === orderTenantId ? 'restaurant' : 'customer';
  } catch {
    return 'customer';
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: order } = await admin
      .from('orders')
      .select('id, tenant_id')
      .eq('id', id)
      .single();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const actor = await resolveActor(order.tenant_id);

    const { data: messages } = await admin
      .from('order_messages')
      .select('id, sender, body, created_at, read_by_customer_at, read_by_restaurant_at')
      .eq('order_id', id)
      .order('created_at', { ascending: true });

    // Mark the other party's messages as read for whoever is viewing.
    if (actor === 'restaurant') {
      await admin
        .from('order_messages')
        .update({ read_by_restaurant_at: new Date().toISOString() })
        .eq('order_id', id)
        .eq('sender', 'customer')
        .is('read_by_restaurant_at', null);
    } else {
      await admin
        .from('order_messages')
        .update({ read_by_customer_at: new Date().toISOString() })
        .eq('order_id', id)
        .eq('sender', 'restaurant')
        .is('read_by_customer_at', null);
    }

    return NextResponse.json({ messages: messages || [], actor });
  } catch (err) {
    console.error('Failed to load order messages:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { body } = await req.json();

    const text = typeof body === 'string' ? body.trim() : '';
    if (!text) return NextResponse.json({ error: 'Message is empty' }, { status: 400 });
    if (text.length > MAX_BODY) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: order } = await admin
      .from('orders')
      .select('id, tenant_id, order_number, customer_name, customer_phone, customer_email')
      .eq('id', id)
      .single();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Guard against runaway threads (basic abuse protection).
    const { count } = await admin
      .from('order_messages')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', id);
    if ((count ?? 0) >= MAX_THREAD) {
      return NextResponse.json({ error: 'This conversation is full' }, { status: 429 });
    }

    const sender = await resolveActor(order.tenant_id);

    const { data: message, error } = await admin
      .from('order_messages')
      .insert({
        order_id: id,
        tenant_id: order.tenant_id,
        sender,
        body: text,
        // Author's own side is read immediately.
        read_by_customer_at: sender === 'customer' ? new Date().toISOString() : null,
        read_by_restaurant_at: sender === 'restaurant' ? new Date().toISOString() : null,
      })
      .select('id, sender, body, created_at, read_by_customer_at, read_by_restaurant_at')
      .single();

    if (error || !message) throw error || new Error('Failed to send message');

    // Notify the other party (throttled, in background).
    const { data: tenant } = await admin
      .from('tenants')
      .select('id, name, phone, whatsapp, primary_color, notify_sms, notify_email, notify_whatsapp')
      .eq('id', order.tenant_id)
      .single();

    if (tenant) {
      sendOrderMessageNotification({
        order: {
          id: order.id,
          order_number: order.order_number,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_email: order.customer_email,
          tenant_id: order.tenant_id,
        },
        tenant,
        direction: sender === 'customer' ? 'to_restaurant' : 'to_customer',
        preview: text,
      }).catch((e) => console.error('Message notification failed:', e));
    }

    return NextResponse.json({ message });
  } catch (err) {
    console.error('Failed to send order message:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
