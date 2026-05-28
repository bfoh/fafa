/**
 * Paystack API client for Ghana payments (Card + Mobile Money).
 * Docs: https://paystack.com/docs/api
 */

const PAYSTACK_BASE = 'https://api.paystack.co';

interface InitializeTransactionParams {
  email: string;
  amount: number;           // In pesewas (GH₵ 1 = 100 pesewas)
  currency?: string;
  reference?: string;
  callback_url?: string;
  channels?: ('card' | 'mobile_money' | 'bank')[];
  metadata?: Record<string, unknown>;
  subaccount?: string;       // For split payments
  transaction_charge?: number; // Platform fee in pesewas
}

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface InitializeData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

interface VerifyData {
  id: number;
  status: 'success' | 'failed' | 'abandoned';
  reference: string;
  amount: number;
  channel: string;
  currency: string;
  metadata: Record<string, unknown>;
  paid_at: string;
}

async function paystackFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<PaystackResponse<T>> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Paystack API error: ${res.status} ${error}`);
  }

  return res.json();
}

/**
 * Initialize a transaction — returns a checkout URL.
 */
export async function initializeTransaction(
  params: InitializeTransactionParams
): Promise<PaystackResponse<InitializeData>> {
  return paystackFetch<InitializeData>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      ...params,
      currency: params.currency || 'GHS',
    }),
  });
}

/**
 * Verify a transaction by reference.
 */
export async function verifyTransaction(
  reference: string
): Promise<PaystackResponse<VerifyData>> {
  return paystackFetch<VerifyData>(`/transaction/verify/${reference}`);
}

/**
 * Verify Paystack webhook signature.
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest('hex');

  return hash === signature;
}

export interface CreateSubaccountParams {
  business_name: string;
  settlement_bank: string;
  account_number: string;
  percentage_charge: number;
  description: string;
}

export interface BankData {
  name: string;
  code: string;
  type: string;
}

export interface SubaccountData {
  id: number;
  subaccount_code: string;
  business_name: string;
  settlement_bank: string;
  account_number: string;
  percentage_charge: number;
  description: string;
}

/**
 * List Ghanaian banks/mobile money providers from Paystack.
 */
export async function listBanks(currency: string = 'GHS'): Promise<PaystackResponse<BankData[]>> {
  return paystackFetch<BankData[]>(`/bank?currency=${currency}`);
}

/**
 * Get details of an existing subaccount.
 */
export async function getSubaccount(
  code: string
): Promise<PaystackResponse<SubaccountData>> {
  return paystackFetch<SubaccountData>(`/subaccount/${code}`);
}

/**
 * Create a new subaccount in Paystack.
 */
export async function createSubaccount(
  params: CreateSubaccountParams
): Promise<PaystackResponse<SubaccountData>> {
  return paystackFetch<SubaccountData>('/subaccount', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
