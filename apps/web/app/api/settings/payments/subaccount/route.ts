import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createSubaccount, getSubaccount } from '@/lib/paystack/client';

export async function GET() {
  const supabase = await createServerClient();
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve tenant ID
    const { data: member } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', session.user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('paystack_subaccount_code')
      .eq('id', member.tenant_id)
      .single();

    if (!tenant || !tenant.paystack_subaccount_code) {
      return NextResponse.json({ subaccount: null });
    }

    // Query Paystack to verify and get bank details
    try {
      const response = await getSubaccount(tenant.paystack_subaccount_code);
      return NextResponse.json({
        subaccount: {
          code: tenant.paystack_subaccount_code,
          business_name: response.data.business_name,
          settlement_bank: response.data.settlement_bank,
          account_number: response.data.account_number,
          verified: true,
        }
      });
    } catch (paystackErr: any) {
      console.error('Paystack failed to fetch subaccount details:', paystackErr.message);
      // Fallback: return the code from database but note it could not be queried
      return NextResponse.json({
        subaccount: {
          code: tenant.paystack_subaccount_code,
          verified: false,
          note: 'Could not fetch live details from Paystack (using placeholder or inactive keys).'
        }
      });
    }
  } catch (error: any) {
    console.error('Failed to get subaccount:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createServerClient();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve tenant ID
    const { data: member } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', session.user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const { manual_code, settlement_bank, account_number } = await req.json();

    let subaccountCode = '';

    if (manual_code) {
      subaccountCode = manual_code.trim();
    } else {
      // Create subaccount on Paystack
      if (!settlement_bank || !account_number) {
        return NextResponse.json({ error: 'Missing bank or account details' }, { status: 400 });
      }

      // Fetch tenant name
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name, email')
        .eq('id', member.tenant_id)
        .single();

      if (!tenant) {
        return NextResponse.json({ error: 'Tenant details not found' }, { status: 404 });
      }

      try {
        const response = await createSubaccount({
          business_name: tenant.name,
          settlement_bank,
          account_number,
          percentage_charge: 0.0, // Default to 0.0% split for now
          description: `Payout account for ${tenant.name}`,
        });
        subaccountCode = response.data.subaccount_code;
      } catch (paystackErr: any) {
        console.error('Paystack subaccount creation failed:', paystackErr);
        return NextResponse.json({
          error: `Paystack Error: ${paystackErr.message || 'Verification failed'}. You can try setting it up manually if you are using test keys.`
        }, { status: 422 });
      }
    }

    // Save subaccount code in database
    const { error: updateErr } = await supabase
      .from('tenants')
      .update({ paystack_subaccount_code: subaccountCode })
      .eq('id', member.tenant_id);

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({ success: true, subaccount_code: subaccountCode });
  } catch (error: any) {
    console.error('Failed to create/link subaccount:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  const supabase = await createServerClient();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve tenant ID
    const { data: member } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', session.user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const { error: updateErr } = await supabase
      .from('tenants')
      .update({ paystack_subaccount_code: null })
      .eq('id', member.tenant_id);

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to unlink subaccount:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
