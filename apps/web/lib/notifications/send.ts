/**
 * Unified notification dispatcher.
 * Routes notifications to the appropriate channel (SMS, Email)
 * and logs all sends to the notification_log table.
 */

import { sendSMS } from '@/lib/arkesel/client';
import { sendEmail } from '@/lib/brevio/client';
import { sendWhatsApp, isWhatsAppConfigured } from '@/lib/whatsapp/client';
import { sendOrderPush } from '@/lib/notifications/push';
import { sendPush, isPushConfigured } from '@/lib/push/fcm';
import { updateLiveActivity } from '@/lib/live-activity/update';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatGHS } from '@/lib/utils/currency';
import { getBaseUrl } from '@/lib/utils';
import type { Tenant, Order, NotificationEvent } from '@fafa/types';

interface NotificationContext {
  order: Order;
  tenant: Tenant;
}

interface NotificationTemplates {
  customerSms?: string;
  customerEmail?: { subject: string; html: string };
  tenantSms?: string;
}

function getTemplates(
  event: NotificationEvent,
  ctx: NotificationContext
): NotificationTemplates {
  const { order, tenant } = ctx;
  const amount = formatGHS(order.total);

  switch (event) {
    case 'order_placed': {
      const trackUrl = `${getBaseUrl()}/${tenant.slug}/order/${order.id}`;
      return {
        customerSms: `Hi ${order.customer_name}! Your order #${order.order_number} has been received by ${tenant.name}. Total: ${amount}. Track it: ${trackUrl}`,
        tenantSms: `New order #${order.order_number}! ${order.customer_name} - ${amount}. Open Didi to confirm.`,
        customerEmail: {
          subject: `Order #${order.order_number} received - ${tenant.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h2 style="color: ${tenant.primary_color}">Order Received!</h2>
              <p>Hi ${order.customer_name},</p>
              <p>Your order <strong>#${order.order_number}</strong> from <strong>${tenant.name}</strong> has been received.</p>
              <p style="font-size: 24px; font-weight: bold; color: ${tenant.primary_color}">${amount}</p>
              <p>Payment: ${order.payment_method === 'cash_on_delivery' ? 'Pay on delivery' : order.payment_method === 'momo' ? 'Mobile Money' : 'Card'}</p>
              <p style="margin: 24px 0;">
                <a href="${trackUrl}" style="background: ${tenant.primary_color}; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: bold; display: inline-block;">Track your order</a>
              </p>
              <p style="color: #888; font-size: 12px;">Or open: ${trackUrl}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #888; font-size: 12px;">Powered by Didi</p>
            </div>
          `,
        },
      };
    }

    case 'order_confirmed':
      return {
        customerSms: `Great news! ${tenant.name} has confirmed your order #${order.order_number}. Your food is being prepared!`,
      };

    case 'order_ready':
      return {
        customerSms:
          order.delivery_type === 'pickup'
            ? `Your order #${order.order_number} from ${tenant.name} is ready for pickup!`
            : `Your order #${order.order_number} from ${tenant.name} is ready and will be on its way soon!`,
      };

    case 'order_out_for_delivery':
      return {
        customerSms: `Your order #${order.order_number} from ${tenant.name} is on the way! 🚗`,
      };

    case 'order_delivered':
      return {
        customerSms: `Enjoy your meal! 🍽️ Order #${order.order_number} from ${tenant.name} has been delivered. Thank you for using Didi!`,
      };

    case 'payment_confirmed':
      return {
        customerSms: `Payment of ${amount} received for order #${order.order_number}. Thank you!`,
        tenantSms: `Payment received: ${amount} for order #${order.order_number} via ${order.payment_method}.`,
      };

    case 'order_cancelled':
      return {
        customerSms: `Sorry, your order #${order.order_number} from ${tenant.name} has been cancelled.${order.cancellation_reason ? ` Reason: ${order.cancellation_reason}` : ''}`,
      };

    default:
      return {};
  }
}

async function sendAndLog(params: {
  tenantId: string;
  orderId: string;
  channel: 'sms' | 'email' | 'whatsapp';
  provider: 'arkesel' | 'brevio' | 'twilio';
  recipient: string;
  template: string;
  message: string;
  emailSubject?: string;
}) {
  const supabase = createAdminClient();

  let success = false;
  let providerRef: string | undefined;
  let errorMessage: string | undefined;

  try {
    if (params.channel === 'sms') {
      const result = await sendSMS({
        to: params.recipient,
        message: params.message,
      });
      success = result.success;
      providerRef = result.messageId;
      errorMessage = result.error;
    } else if (params.channel === 'whatsapp') {
      const result = await sendWhatsApp({
        to: params.recipient,
        message: params.message,
      });
      // Skipped (unconfigured) — don't log a phantom failure.
      if (result.skipped) return;
      success = result.success;
      providerRef = result.messageId;
      errorMessage = result.error;
    } else {
      const result = await sendEmail({
        to: params.recipient,
        subject: params.emailSubject || 'Didi Order Update',
        html: params.message,
      });
      success = result.success;
      providerRef = result.messageId;
      errorMessage = result.error;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Unknown error';
  }

  // Log the notification
  await supabase.from('notification_log').insert({
    tenant_id: params.tenantId,
    order_id: params.orderId,
    channel: params.channel,
    provider: params.provider,
    recipient: params.recipient,
    template: params.template,
    status: success ? 'sent' : 'failed',
    provider_ref: providerRef,
    error_message: errorMessage,
  });
}

/**
 * Send all appropriate notifications for an order event.
 */
export async function sendOrderNotifications(
  ctx: NotificationContext,
  event: NotificationEvent
) {
  const { order, tenant } = ctx;
  const templates = getTemplates(event, ctx);

  const notifications: Promise<void>[] = [];

  // 1. SMS to customer (always — SMS is king in Ghana)
  if (templates.customerSms) {
    notifications.push(
      sendAndLog({
        tenantId: tenant.id,
        orderId: order.id,
        channel: 'sms',
        provider: 'arkesel',
        recipient: order.customer_phone,
        template: event,
        message: templates.customerSms,
      })
    );
  }

  // 1b. WhatsApp to customer (same status copy) — when enabled & configured.
  if (templates.customerSms && tenant.notify_whatsapp && isWhatsAppConfigured() && order.customer_phone) {
    notifications.push(
      sendAndLog({
        tenantId: tenant.id,
        orderId: order.id,
        channel: 'whatsapp',
        provider: 'twilio',
        recipient: order.customer_phone,
        template: `${event}_whatsapp`,
        message: templates.customerSms,
      })
    );
  }

  // 2. Email to customer (if email provided and tenant has email enabled)
  if (
    order.customer_email &&
    tenant.notify_email &&
    templates.customerEmail
  ) {
    notifications.push(
      sendAndLog({
        tenantId: tenant.id,
        orderId: order.id,
        channel: 'email',
        provider: 'brevio',
        recipient: order.customer_email,
        template: event,
        message: templates.customerEmail.html,
        emailSubject: templates.customerEmail.subject,
      })
    );
  }

  // 3. SMS to tenant (for new orders and payments)
  if (
    templates.tenantSms &&
    tenant.notify_sms &&
    ['order_placed', 'payment_confirmed'].includes(event)
  ) {
    notifications.push(
      sendAndLog({
        tenantId: tenant.id,
        orderId: order.id,
        channel: 'sms',
        provider: 'arkesel',
        recipient: tenant.phone,
        template: `${event}_tenant`,
        message: templates.tenantSms,
      })
    );
  }

  // 4. Push to the customer's registered mobile devices. Env-gated (no FCM
  //    creds → no-op), so this is inert until the mobile app ships.
  notifications.push(sendOrderPush(ctx, event));

  // 5. Lock-screen live activity (iOS Live Activity / Android ongoing
  //    notification). Env-gated and best-effort like push.
  notifications.push(updateLiveActivity(ctx, 'status'));

  await Promise.allSettled(notifications);
}

/**
 * Notify the other party about a new chat message on an order.
 * Throttled: skips the SMS/email if one was already sent for the same
 * order + direction within the last 2 minutes (avoids spamming during
 * rapid back-and-forth). The in-app thread still updates instantly.
 */
export async function sendOrderMessageNotification(params: {
  order: {
    id: string;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string | null;
    tenant_id: string;
  };
  tenant: { id: string; slug?: string; name: string; phone: string; whatsapp?: string | null; primary_color?: string; notify_sms?: boolean; notify_email?: boolean; notify_whatsapp?: boolean };
  direction: 'to_customer' | 'to_restaurant';
  preview: string;
}) {
  const { order, tenant, direction, preview } = params;
  const supabase = createAdminClient();
  const template = direction === 'to_customer' ? 'order_message_to_customer' : 'order_message_to_restaurant';

  const short = preview.length > 90 ? `${preview.slice(0, 87)}…` : preview;

  // Device push for every message (free, chat-app feel, wakes the lock
  // screen). Tapping deep-links to the tracker thread. Recipient is whoever
  // registered the device with the matching phone — including a restaurant
  // owner using the app.
  if (isPushConfigured()) {
    const recipientPhone = direction === 'to_customer' ? order.customer_phone : tenant.phone;
    if (recipientPhone) {
      try {
        const { data: rows } = await supabase
          .from('device_tokens')
          .select('token')
          .eq('customer_phone', recipientPhone);
        const tokens = (rows || []).map((r) => r.token as string);
        if (tokens.length > 0) {
          await sendPush(tokens, {
            title:
              direction === 'to_customer'
                ? tenant.name
                : `${order.customer_name} — order #${order.order_number}`,
            body: short,
            data: tenant.slug ? { orderId: order.id, slug: tenant.slug } : { orderId: order.id },
          });
        }
      } catch (err) {
        console.error('[push] message push failed:', err);
      }
    }
  }

  // Throttle SMS/WhatsApp/email (paid channels): one per direction per order
  // every 2 minutes. The in-app thread and push above are not throttled.
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order.id)
    .eq('template', template)
    .gte('created_at', twoMinAgo);

  if ((count ?? 0) > 0) return;

  const waOn = Boolean(tenant.notify_whatsapp) && isWhatsAppConfigured();

  if (direction === 'to_restaurant') {
    const msg = `New message on order #${order.order_number} from ${order.customer_name}: "${short}" — open Didi to reply.`;
    if (tenant.notify_sms !== false && tenant.phone) {
      await sendAndLog({
        tenantId: tenant.id,
        orderId: order.id,
        channel: 'sms',
        provider: 'arkesel',
        recipient: tenant.phone,
        template,
        message: msg,
      });
    }
    const waTo = tenant.whatsapp || tenant.phone;
    if (waOn && waTo) {
      await sendAndLog({
        tenantId: tenant.id,
        orderId: order.id,
        channel: 'whatsapp',
        provider: 'twilio',
        recipient: waTo,
        template,
        message: msg,
      });
    }
  } else {
    const msg = `${tenant.name} replied to your order #${order.order_number}: "${short}". Open your order page to view and reply.`;
    if (order.customer_phone) {
      await sendAndLog({
        tenantId: tenant.id,
        orderId: order.id,
        channel: 'sms',
        provider: 'arkesel',
        recipient: order.customer_phone,
        template,
        message: msg,
      });
    }
    if (waOn && order.customer_phone) {
      await sendAndLog({
        tenantId: tenant.id,
        orderId: order.id,
        channel: 'whatsapp',
        provider: 'twilio',
        recipient: order.customer_phone,
        template,
        message: msg,
      });
    }
    if (order.customer_email && tenant.notify_email) {
      await sendAndLog({
        tenantId: tenant.id,
        orderId: order.id,
        channel: 'email',
        provider: 'brevio',
        recipient: order.customer_email,
        template,
        emailSubject: `New message about your order #${order.order_number} — ${tenant.name}`,
        message: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: ${tenant.primary_color || '#FF6B35'}">${tenant.name} sent you a message</h2>
            <p>About your order <strong>#${order.order_number}</strong>:</p>
            <blockquote style="border-left: 3px solid ${tenant.primary_color || '#FF6B35'}; margin: 0; padding: 8px 14px; color: #333;">${short}</blockquote>
            <p>Open your order page to view and reply.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px;">Powered by Didi</p>
          </div>
        `,
      });
    }
  }
}
