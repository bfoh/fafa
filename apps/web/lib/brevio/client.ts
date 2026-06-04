/**
 * Brevo (formerly Sendinblue) transactional email client.
 * Docs: https://developers.brevo.com/docs/send-a-transactional-email
 *
 * NOTE: the previous implementation targeted a non-existent "brevio.com" API and
 * never actually delivered mail. This uses Brevo's real REST endpoint.
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Accept either env name so existing deployments keep working.
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.BREVIO_API_KEY;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string; // "Name <email@domain>" or "email@domain"
  replyTo?: string;
}

// Parse "Didi <orders@didi.com.gh>" → { name, email }.
function parseSender(from: string): { email: string; name?: string } {
  const match = from.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (match) return { name: match[1] || undefined, email: match[2] };
  return { email: from.trim() };
}

/**
 * Send a transactional email via Brevo.
 */
export async function sendEmail({
  to,
  subject,
  html,
  from = 'Didi <orders@didi.com.gh>',
  replyTo,
}: SendEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  if (!BREVO_API_KEY) {
    return { success: false, error: 'BREVO_API_KEY is not configured' };
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: parseSender(from),
        to: [{ email: to }],
        subject,
        htmlContent: html,
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      }),
    });

    const data = await response.json().catch(() => ({}));

    return {
      success: response.ok,
      messageId: data.messageId,
      error: !response.ok ? data.message || `Brevo error ${response.status}` : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email send failed',
    };
  }
}
