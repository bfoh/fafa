/**
 * Brevio email client for transactional emails.
 * Docs: https://docs.brevio.com
 */

const BREVIO_API_URL = 'https://api.brevio.com/v1/send';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

/**
 * Send a transactional email via Brevio.
 */
export async function sendEmail({
  to,
  subject,
  html,
  from,
  replyTo,
}: SendEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const response = await fetch(BREVIO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.BREVIO_API_KEY}`,
      },
      body: JSON.stringify({
        from: from || 'Fafa <orders@fafa.com.gh>',
        to,
        subject,
        html,
        reply_to: replyTo,
      }),
    });

    const data = await response.json();

    return {
      success: response.ok,
      messageId: data.id,
      error: !response.ok ? data.message : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email send failed',
    };
  }
}
