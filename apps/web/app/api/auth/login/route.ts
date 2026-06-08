import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { corsHeaders, preflight } from '@/lib/http/cors';

export const dynamic = 'force-dynamic';

/**
 * Mobile sign-in. The Capacitor bundle cannot reach Supabase Auth directly from
 * the `capacitor://localhost` origin (the request fails with WebKit's "Load
 * failed"), so the app posts credentials here — same pattern as registration —
 * and we verify them server-side, returning the session tokens for the app to
 * persist via `supabase.auth.setSession(...)`.
 */
export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get('origin'));
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400, headers }
      );
    }

    // Anon client — verifies the password and returns a real user session.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'Invalid email or password' },
        { status: 400, headers }
      );
    }

    // Decide where the app should land: platform admins vs kitchen owners.
    const { data: adminRecord } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle();

    return NextResponse.json(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        redirect: adminRecord ? 'admin' : 'dashboard',
      },
      { headers }
    );
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500, headers }
    );
  }
}

export function OPTIONS(req: Request) {
  return preflight(req);
}
