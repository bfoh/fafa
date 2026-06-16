import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getResolvedTenantId } from '@/lib/admin/guard';
import { corsHeaders, preflight } from '@/lib/http/cors';

/** CORS preflight for the native app (capacitor:// origin). */
export function OPTIONS(req: Request) {
  return preflight(req);
}

/** Fetch the existing review for this order (so the UI knows if already rated). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cors = corsHeaders(req.headers.get('origin'));
  try {
    const { id } = await params;
    const admin = createAdminClient();
    const { data: review } = await admin
      .from('reviews')
      .select('id, rating, comment, owner_reply, owner_reply_at, created_at')
      .eq('order_id', id)
      .maybeSingle();
    return NextResponse.json({ review: review || null }, { headers: cors });
  } catch (err) {
    console.error('Failed to load review:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: cors });
  }
}

/** Owner reply to a review (authenticated member of the order's tenant). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cors = corsHeaders(req.headers.get('origin'));
  try {
    const { id } = await params;
    const { reply } = await req.json();
    const text = typeof reply === 'string' ? reply.trim().slice(0, 1000) : '';
    if (!text) return NextResponse.json({ error: 'Reply is empty' }, { status: 400, headers: cors });

    const admin = createAdminClient();
    const { data: order } = await admin
      .from('orders')
      .select('tenant_id')
      .eq('id', id)
      .single();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404, headers: cors });

    // Impersonation-aware tenant resolution (cookie session or Bearer token).
    const { tenantId } = await getResolvedTenantId(req);
    if (!tenantId || tenantId !== order.tenant_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
    }

    const { data: review, error } = await admin
      .from('reviews')
      .update({ owner_reply: text, owner_reply_at: new Date().toISOString() })
      .eq('order_id', id)
      .select('id, rating, comment, owner_reply, owner_reply_at, created_at')
      .single();

    if (error || !review) return NextResponse.json({ error: 'No review to reply to' }, { status: 404, headers: cors });
    return NextResponse.json({ review }, { headers: cors });
  } catch (err) {
    console.error('Failed to reply to review:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: cors });
  }
}

/** Submit a review. Verified: only allowed once the order is delivered. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cors = corsHeaders(req.headers.get('origin'));
  try {
    const { id } = await params;
    const { rating, comment } = await req.json();

    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return NextResponse.json({ error: 'Rating must be 1–5' }, { status: 400, headers: cors });
    }
    const text = typeof comment === 'string' ? comment.trim().slice(0, 1000) : null;

    const admin = createAdminClient();

    const { data: order } = await admin
      .from('orders')
      .select('id, tenant_id, status, customer_name')
      .eq('id', id)
      .single();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404, headers: cors });

    if (order.status !== 'delivered') {
      return NextResponse.json(
        { error: 'You can review once your order is delivered.' },
        { status: 400, headers: cors }
      );
    }

    // One review per order (upsert keeps it editable).
    const { data: review, error } = await admin
      .from('reviews')
      .upsert(
        {
          tenant_id: order.tenant_id,
          order_id: order.id,
          rating: r,
          comment: text || null,
          customer_name: order.customer_name,
        },
        { onConflict: 'order_id' }
      )
      .select('id, rating, comment, created_at')
      .single();

    if (error || !review) throw error || new Error('Failed to save review');

    return NextResponse.json({ review }, { headers: cors });
  } catch (err) {
    console.error('Failed to submit review:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: cors });
  }
}
