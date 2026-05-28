/**
 * Arkesel SMS Gateway for Ghana.
 * Docs: https://developers.arkesel.com
 */

import { normalizeGhanaPhone } from '@/lib/utils/phone';

const ARKESEL_API_URL = 'https://sms.arkesel.com/api/v2/sms/send';

interface SendSMSParams {
  to: string;
  message: string;
  sender?: string;
}

interface ArkeselResponse {
  status: string;
  message: string;
  data?: Array<{ id: string; recipient: string; status: string }>;
}

/**
 * Send an SMS via Arkesel.
 * @param to - Ghana phone number (any format, will be normalized)
 * @param message - SMS body (max 160 chars for single SMS, 306 for concatenated)
 * @param sender - Sender ID, max 11 chars. Default: "Fafa"
 */
export async function sendSMS({
  to,
  message,
  sender = 'Fafa',
}: SendSMSParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const normalizedPhone = normalizeGhanaPhone(to);

    const response = await fetch(ARKESEL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.ARKESEL_API_KEY!,
      },
      body: JSON.stringify({
        sender,
        message,
        recipients: [normalizedPhone],
      }),
    });

    const data: ArkeselResponse = await response.json();

    return {
      success: data.status === 'success',
      messageId: data.data?.[0]?.id,
      error: data.status !== 'success' ? data.message : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SMS send failed',
    };
  }
}
