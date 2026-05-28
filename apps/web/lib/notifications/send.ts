/**
 * Unified notification dispatcher.
 * Routes notifications to the appropriate channel (SMS, Email)
 * and logs all sends to the notification_log table.
 */

import { sendSMS } from '@/lib/arkesel/client';
import { sendEmail } from '@/lib/brevio/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatGHS } from '@/lib/utils/currency';
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
    case 'order_placed':
      return {
        customerSms: `Hi ${order.customer_name}! Your order #${order.order_number} has been received by ${tenant.name}. Total: ${amount}. You'll be notified when it's confirmed.`,
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
              <p>You'll receive updates as your order progresses.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #888; font-size: 12px;">Powered by Didi</p>
            </div>
          `,
        },
      };

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
  channel: 'sms' | 'email';
  provider: 'arkesel' | 'brevio';
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

  await Promise.allSettled(notifications);
}
