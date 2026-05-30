import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** Fetch the existing review for this order (so the UI knows if already rated). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();
    const { data: review } = await admin
      .from('reviews')
      .select('id, rating, comment, created_at')
      .eq('order_id', id)
      .maybeSingle();
    return NextResponse.json({ review: review || null });
  } catch (err) {
    console.error('Failed to load review:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Submit a review. Verified: only allowed once the order is delivered. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { rating, comment } = await req.json();

    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return NextResponse.json({ error: 'Rating must be 1–5' }, { status: 400 });
    }
    const text = typeof comment === 'string' ? comment.trim().slice(0, 1000) : null;

    const admin = createAdminClient();

    const { data: order } = await admin
      .from('orders')
      .select('id, tenant_id, status, customer_name')
      .eq('id', id)
      .single();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    if (order.status !== 'delivered') {
      return NextResponse.json(
        { error: 'You can review once your order is delivered.' },
        { status: 400 }
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

    return NextResponse.json({ review });
  } catch (err) {
    console.error('Failed to submit review:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
