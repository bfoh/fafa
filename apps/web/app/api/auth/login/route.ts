import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { corsHeaders, preflight } from '@/lib/http/cors';

export const dynamic = 'force-dynamic';

/**
 * Mobile sign-in proxy. The Capacitor bundle cannot reach Supabase Auth
 * directly from the `capacitor://localhost` origin (WebKit blocks it), so the
 * app posts credentials here and we authenticate server-side, returning the
 * session tokens for the app to persist via `supabase.auth.setSession(...)`.
 *
 * Uses the admin client (service-role key) so this route works even when
 * NEXT_PUBLIC_SUPABASE_ANON_KEY is only available at build-time in the client
 * bundle and not in the server runtime environment.
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

    const supabase = createAdminClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      return NextResponse.json(
        { error: error?.message || 'Invalid email or password' },
        { status: 401, headers }
      );
    }

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
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/auth/login] error:', msg);
    return NextResponse.json(
      { error: `Sign-in failed: ${msg}` },
      { status: 500, headers }
    );
  }
}

export function OPTIONS(req: Request) {
  return preflight(req);
}
