import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSlug } from '@/lib/utils/slug';
import { getBaseUrl } from '@/lib/utils';

export async function POST(req: Request) {
  try {
    const { email, phone, password, restaurantName, description, city } =
      await req.json();

    const supabase = createAdminClient();

    // 1. Create auth user
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        phone,
        password,
        email_confirm: true, // Auto-confirm for now
      });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    // 2. Generate unique slug
    const baseSlug = generateSlug(restaurantName);
    let slug = baseSlug;
    let counter = 2;

    // Check uniqueness
    while (true) {
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // 3. Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: restaurantName,
        slug,
        description: description || null,
        phone,
        email,
        city: city || null,
        status: 'active',
      })
      .select()
      .single();

    if (tenantError) {
      console.error('Tenant creation error:', tenantError);
      // Clean up auth user on failure
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Failed to create restaurant: ${tenantError.message}` },
        { status: 500 }
      );
    }

    // 4. Link user to tenant as owner
    await supabase.from('tenant_members').insert({
      tenant_id: tenant.id,
      user_id: authData.user.id,
      role: 'owner',
    });

    // Update user auth metadata with the tenant_id
    await supabase.auth.admin.updateUserById(authData.user.id, {
      app_metadata: { tenant_id: tenant.id },
      user_metadata: { tenant_id: tenant.id },
    });

    // 5. Create default menu categories
    await supabase.from('menu_categories').insert([
      { tenant_id: tenant.id, name: 'Main Dishes', sort_order: 0 },
      { tenant_id: tenant.id, name: 'Sides & Extras', sort_order: 1 },
      { tenant_id: tenant.id, name: 'Drinks', sort_order: 2 },
    ]);

    // 6. Set default operating hours (Mon-Sat 7am-9pm, Sun 10am-6pm)
    const hours = Array.from({ length: 7 }, (_, day) => ({
      tenant_id: tenant.id,
      day_of_week: day,
      open_time: day === 0 ? '10:00' : '07:00',
      close_time: day === 0 ? '18:00' : '21:00',
      is_closed: false,
    }));

    await supabase.from('operating_hours').insert(hours);

    // 7. Sign in the user automatically
    // (The client will handle this after getting the success response)

    return NextResponse.json({
      tenant,
      storefront_url: `${getBaseUrl()}/${slug}`,
    });
  } catch (err) {
    console.error('Registration error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
