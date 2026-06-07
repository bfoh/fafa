import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { initializeTransaction } from '@/lib/paystack/client';
import { normalizeGhanaPhone, isValidGhanaPhone } from '@/lib/utils/phone';
import { sendOrderNotifications } from '@/lib/notifications/send';
import { getBaseUrl } from '@/lib/utils';
import { resolveDeliveryFee } from '@/lib/delivery/resolve';
import { resolveItemBasePrice } from '@/lib/orders/item-pricing';
import { corsHeaders, preflight } from '@/lib/http/cors';

export const dynamic = 'force-dynamic';

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const body = await req.json();
    const supabase = createAdminClient();

    const {
      tenantSlug,
      items,
      customer,
      deliveryType,
      deliveryAddress,
      deliveryNotes,
      paymentMethod,
      city,
      areaName,
      customerLat,
      customerLng,
    } = body;

    // 1. Resolve tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .single();

    if (tenantErr || !tenant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404, headers }
      );
    }

    // 2. Validate phone
    if (!isValidGhanaPhone(customer.phone)) {
      return NextResponse.json(
        { error: 'Please enter a valid Ghana phone number' },
        { status: 400, headers }
      );
    }

    // 3. Validate menu items and calculate totals server-side
    const menuItemIds = items.map(
      (i: { menuItemId: string }) => i.menuItemId
    );
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('*')
      .in('id', menuItemIds)
      .eq('tenant_id', tenant.id);

    if (!menuItems || menuItems.length !== items.length) {
      return NextResponse.json(
        { error: 'Some menu items are no longer available' },
        { status: 400, headers }
      );
    }

    // Build order items with server-verified prices
    const orderItems = items.map(
      (item: { menuItemId: string; quantity: number; price?: number; options: Array<{ name: string; priceModifier: number }> }) => {
        const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
        const isChopBar = (menuItem as any).is_chop_bar ?? false;

        // Chop-bar items carry a customer-built price; normal items use the DB
        // price. The helper floors chop-bar at the configured base so a missing
        // or tampered client price can never undercharge.
        const basePrice = resolveItemBasePrice({
          isChopBar,
          clientPrice: item.price,
          dbPrice: Number(menuItem.price),
        });

        const optionsTotal = (item.options || []).reduce(
          (s: number, o: { priceModifier: number }) => s + o.priceModifier,
          0
        );
        const lineTotal =
          (basePrice + optionsTotal) * item.quantity;

        return {
          menu_item_id: menuItem.id,
          item_name: menuItem.name,
          unit_price: basePrice,
          quantity: item.quantity,
          options_json: item.options || [],
          line_total: lineTotal,
        };
      }
    );

    const subtotal = orderItems.reduce(
      (sum: number, item: { line_total: number }) => sum + item.line_total,
      0
    );

    let deliveryFee = 0;
    let deliveryDistanceKm: number | null = null;
    let deliveryAreaName: string | null = null;

    if (deliveryType === 'delivery') {
      // Load active manual zones for override matching.
      const { data: zones } = await supabase
        .from('delivery_zones')
        .select('name, fee')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);

      const customerPin =
        customerLat != null && customerLng != null
          ? { lat: Number(customerLat), lng: Number(customerLng) }
          : null;

      const resolved = resolveDeliveryFee({
        restaurant: {
          lat: tenant.location_lat != null ? Number(tenant.location_lat) : null,
          lng: tenant.location_lng != null ? Number(tenant.location_lng) : null,
          baseFee: Number(tenant.delivery_fee),
          freeRadiusKm: tenant.free_delivery_radius_km != null ? Number(tenant.free_delivery_radius_km) : null,
          perKmRate: tenant.per_km_rate != null ? Number(tenant.per_km_rate) : null,
          maxDistanceKm: tenant.max_delivery_distance_km != null ? Number(tenant.max_delivery_distance_km) : null,
        },
        city: city || tenant.city || '',
        areaName: areaName || '',
        manualZones: (zones || []).map((z) => ({ name: z.name, fee: Number(z.fee) })),
        customer: customerPin,
      });

      if (!resolved.deliverable) {
        return NextResponse.json(
          { error: 'This address is outside the delivery range for this restaurant.' },
          { status: 400, headers }
        );
      }

      deliveryFee = resolved.fee;
      deliveryDistanceKm = resolved.distanceKm;
      deliveryAreaName = areaName || null;
    }

    const total = subtotal + deliveryFee;

    // 4. Check minimum order
    if (total < Number(tenant.min_order_amount)) {
      return NextResponse.json(
        {
          error: `Minimum order is GH₵${Number(tenant.min_order_amount).toFixed(2)}`,
        },
        { status: 400, headers }
      );
    }

    // 5. Generate order number
    const { data: orderNumResult } = await supabase.rpc(
      'generate_order_number',
      { p_tenant_id: tenant.id }
    );
    const orderNumber = orderNumResult || `FA-${Date.now().toString().slice(-4)}`;

    // 6. Upsert customer
    const normalizedPhone = normalizeGhanaPhone(customer.phone);
    const { data: customerRecord } = await supabase
      .from('customers')
      .upsert(
        {
          tenant_id: tenant.id,
          phone: normalizedPhone,
          name: customer.name,
          email: customer.email || null,
          address: deliveryAddress || null,
        },
        { onConflict: 'tenant_id,phone' }
      )
      .select()
      .single();

    // 7. Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        tenant_id: tenant.id,
        customer_id: customerRecord?.id,
        order_number: orderNumber,
        status: 'pending',
        payment_method: paymentMethod,
        payment_status: 'pending',
        subtotal,
        delivery_fee: deliveryFee,
        total,
        delivery_type: deliveryType,
        delivery_address: deliveryAddress || null,
        delivery_notes: deliveryNotes || null,
        customer_name: customer.name,
        customer_phone: normalizedPhone,
        customer_email: customer.email || null,
        delivery_area_name: deliveryType === 'delivery' ? deliveryAreaName : null,
        delivery_distance_km: deliveryType === 'delivery' ? deliveryDistanceKm : null,
        delivery_lat:
          deliveryType === 'delivery' && customerLat != null ? Number(customerLat) : null,
        delivery_lng:
          deliveryType === 'delivery' && customerLng != null ? Number(customerLng) : null,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Order creation error:', orderError);
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500, headers }
      );
    }

    // 8. Create order items
    await supabase.from('order_items').insert(
      orderItems.map((item: { menu_item_id: string; item_name: string; unit_price: number; quantity: number; options_json: Array<{ name: string; priceModifier: number }>; line_total: number }) => ({
        ...item,
        order_id: order.id,
      }))
    );

    // 9. Create initial status history
    await supabase.from('order_status_history').insert({
      order_id: order.id,
      to_status: 'pending',
    });

    // 10. If online payment, initialize Paystack
    if (paymentMethod !== 'cash_on_delivery') {
      try {
        // Create a pending payment record
        await supabase.from('payments').insert({
          tenant_id: tenant.id,
          order_id: order.id,
          amount: total,
          method: paymentMethod === 'momo' ? 'momo' : 'card',
          provider: 'paystack',
          status: 'pending',
        });

        const paystackResult = await initializeTransaction({
          email:
            customer.email || `${normalizedPhone.replace('+', '')}@ghdidi.com`,
          amount: Math.round(total * 100), // Pesewas
          currency: 'GHS',
          reference: order.id,
          callback_url: `${getBaseUrl()}/${tenantSlug}/order/${order.id}`,
          channels:
            paymentMethod === 'momo' ? ['mobile_money'] : ['card'],
          metadata: {
            order_id: order.id,
            tenant_id: tenant.id,
            order_number: orderNumber,
          },
          subaccount: tenant.paystack_subaccount_code || undefined,
        });

        return NextResponse.json({
          order,
          payment_url: paystackResult.data.authorization_url,
        }, { headers });
      } catch (paystackError) {
        console.error('Paystack error:', paystackError);
        // Order created but payment failed — tenant can see it as pending
        return NextResponse.json({
          order,
          payment_error: 'Payment initialization failed. You can retry payment.',
        }, { headers });
      }
    }

    // 11. Cash on delivery — no payment processing needed
    sendOrderNotifications(
      {
        order,
        tenant,
      },
      'order_placed'
    ).catch((err) => {
      console.error('Failed to send order placed notification:', err);
    });

    return NextResponse.json({ order }, { headers });
  } catch (err) {
    console.error('Order creation error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}
