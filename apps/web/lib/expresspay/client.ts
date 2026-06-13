/**
 * ExpressPay (Ghana) Merchant API client — Card + Mobile Money collections.
 * Docs: https://expresspaygh.com/developers/docs/accept-payments/merchant-api
 *
 * Flow (differs from Paystack — no bearer token, no full checkout URL):
 *   1. POST form-encoded fields to /api/submit.php  → returns a `token`.
 *   2. Redirect the customer to  <base>/payment?token=<token>.
 *   3. On completion ExpressPay (a) redirects to our `redirect-url` with
 *      ?order-id&token appended, and (b) POSTs `order-id` + `token` to our
 *      `post-url` webhook. ExpressPay sends NO signature, so the webhook is
 *      not trusted on its own — it is only a trigger to re-query.
 *   4. POST /api/query.php with the token → authoritative result
 *      (result === 1 ⇒ approved). This is the single source of truth and is
 *      what both the webhook and the tracker-poll reconciliation call.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { settlePaidOrder } from '@/lib/orders/settle';

type ExpressPayEnv = 'sandbox' | 'production';

function env(): ExpressPayEnv {
  return process.env.EXPRESSPAY_ENV === 'production' ? 'production' : 'sandbox';
}

function apiBase(): string {
  return env() === 'production'
    ? 'https://expresspaygh.com/api'
    : 'https://sandbox.expresspaygh.com/api';
}

/** Public checkout page the customer is redirected to with their token. */
export function checkoutUrl(token: string): string {
  const host =
    env() === 'production'
      ? 'https://expresspaygh.com'
      : 'https://sandbox.expresspaygh.com';
  return `${host}/payment?token=${encodeURIComponent(token)}`;
}

function credentials(): { merchantId: string; apiKey: string } {
  const merchantId = process.env.EXPRESSPAY_MERCHANT_ID;
  const apiKey = process.env.EXPRESSPAY_API_KEY;
  if (!merchantId || !apiKey) {
    throw new Error(
      'ExpressPay credentials missing: set EXPRESSPAY_MERCHANT_ID and EXPRESSPAY_API_KEY'
    );
  }
  return { merchantId, apiKey };
}

async function postForm(
  path: string,
  fields: Record<string, string>
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(fields);
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ExpressPay API error: ${res.status} ${text}`);
  }
  return res.json();
}

export interface InitializeParams {
  amount: number; // Major units (GH₵), e.g. 45.00 — ExpressPay expects a decimal string, NOT pesewas.
  currency?: string;
  orderId: string;
  orderDesc?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string; // normalized, e.g. 233241234567 (no +)
  redirectUrl: string;
  postUrl: string;
}

export interface InitializeResult {
  token: string;
  checkoutUrl: string;
  raw: Record<string, unknown>;
}

/**
 * Submit a transaction. Returns the token + the checkout URL to redirect to.
 * Throws when ExpressPay reports a non-success submit status.
 */
export async function initializeTransaction(
  params: InitializeParams
): Promise<InitializeResult> {
  const { merchantId, apiKey } = credentials();

  // ExpressPay splits the name; fall back gracefully when only one is given.
  const data = await postForm('/submit.php', {
    'merchant-id': merchantId,
    'api-key': apiKey,
    firstname: params.firstName || 'Customer',
    lastname: params.lastName || '-',
    email: params.email,
    phonenumber: params.phone,
    // NOTE: the published docs list `accountnumber` as required, max 3 — that
    // length is almost certainly an OCR slip (the customer account/phone never
    // fits in 3 chars). We send the phone; if sandbox rejects on length, trim
    // here. It is not used for settlement (token is).
    accountnumber: params.phone,
    currency: params.currency || 'GHS',
    amount: params.amount.toFixed(2),
    'order-id': params.orderId,
    'order-desc': params.orderDesc || `Order ${params.orderId}`,
    'redirect-url': params.redirectUrl,
    'post-url': params.postUrl,
  });

  // status: 1=Success, 2=Invalid Credentials, 3=Invalid Request, 4=Invalid IP
  const status = Number(data.status);
  const token = typeof data.token === 'string' ? data.token : '';
  if (status !== 1 || !token) {
    throw new Error(
      `ExpressPay submit failed (status ${data.status}): ${JSON.stringify(data)}`
    );
  }

  return { token, checkoutUrl: checkoutUrl(token), raw: data };
}

export interface QueryResult {
  approved: boolean;
  pending: boolean;
  resultText: string;
  orderId: string | null;
  transactionId: string | null;
  amount: number | null;
  currency: string | null;
  raw: Record<string, unknown>;
}

/**
 * Query a transaction by token. `result` semantics:
 *   1 = Approved, 2 = Declined, 3 = Error, 4 = Pending.
 */
export async function queryTransaction(token: string): Promise<QueryResult> {
  const { merchantId, apiKey } = credentials();
  const data = await postForm('/query.php', {
    'merchant-id': merchantId,
    'api-key': apiKey,
    token,
  });

  const result = Number(data.result);
  return {
    approved: result === 1,
    pending: result === 4,
    resultText: String(data['result-text'] ?? ''),
    orderId: data['order-id'] != null ? String(data['order-id']) : null,
    transactionId:
      data['transaction-id'] != null ? String(data['transaction-id']) : null,
    amount: data.amount != null ? Number(data.amount) : null,
    currency: data.currency != null ? String(data.currency) : null,
    raw: data,
  };
}

/**
 * Authoritative reconcile for a single order, keyed by the ExpressPay token we
 * stored in payments.provider_ref at submit time. Idempotent and safe to call
 * from the webhook AND the tracker-poll paths — both end here so they can never
 * diverge. No-op for already-paid / cash orders / missing token.
 *
 * Returns true once the order is settled paid.
 */
export async function reconcileExpressPayOrder(orderId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, payment_status, payment_method, total')
    .eq('id', orderId)
    .single();

  if (!order) return false;
  if (order.payment_status === 'paid') return true;
  if (order.payment_method === 'cash_on_delivery') return false;
  if (order.payment_status !== 'pending') return false;

  // The token lives on the pending payment row created at submit time.
  const { data: payment } = await supabase
    .from('payments')
    .select('provider_ref')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const token = payment?.provider_ref;
  if (!token) return false;

  try {
    const result = await queryTransaction(token);
    // Guard on the amount so a tampered/short charge can never settle an order.
    if (
      result.approved &&
      result.amount != null &&
      result.amount >= Number(order.total)
    ) {
      await settlePaidOrder(orderId, {
        // ExpressPay query doesn't return a Paystack-style channel; derive it
        // from what the customer chose so the payment row records momo vs card.
        channel: order.payment_method === 'momo' ? 'mobile_money' : 'card',
        providerRef: result.transactionId ?? token,
      });
      return true;
    }
  } catch (err) {
    console.error('ExpressPay reconcile failed:', err);
  }
  return false;
}
