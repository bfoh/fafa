import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/brevio/client';
import { getBaseUrl } from '@/lib/utils';

// Send the password-reset email through our own provider (Brevio) instead of
// Supabase's built-in mailer, which has a very low rate limit ("email rate limit
// exceeded"). We mint the recovery link with the admin API and email it ourselves.
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const redirectTo = `${getBaseUrl()}/reset-password`;

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    // Never reveal whether an account exists — always respond success.
    const actionLink = data?.properties?.action_link;
    if (error || !actionLink) {
      return NextResponse.json({ ok: true });
    }

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #FF6B35;">Reset your password</h2>
        <p>We received a request to reset your Didi password. Tap the button below to choose a new one. This link expires shortly.</p>
        <p style="margin: 24px 0;">
          <a href="${actionLink}" style="background: #FF6B35; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: bold; display: inline-block;">Set a new password</a>
        </p>
        <p style="color: #888; font-size: 12px;">If the button doesn't work, open this link:<br>${actionLink}</p>
        <p style="color: #888; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #888; font-size: 12px;">Powered by Didi</p>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: 'Reset your Didi password',
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Password reset email failed:', err);
    // Still respond ok to avoid leaking account state / errors to the form.
    return NextResponse.json({ ok: true });
  }
}
