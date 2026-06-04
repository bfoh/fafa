'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Trash2, Building2, CreditCard, ExternalLink, HelpCircle } from 'lucide-react';

interface Bank {
  name: string;
  code: string;
  type: string;
}

interface LinkedSubaccount {
  code: string;
  business_name?: string;
  settlement_bank?: string;
  account_number?: string;
  verified: boolean;
  note?: string;
}

export default function PayoutSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [linkedAccount, setLinkedAccount] = useState<LinkedSubaccount | null>(null);

  // Form states
  const [mode, setMode] = useState<'create' | 'manual'>('create');
  const [selectedBank, setSelectedBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [manualCode, setManualCode] = useState('');
  
  // Feedback states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Fetch current subaccount configuration
        const subRes = await fetch('/api/settings/payments/subaccount');
        if (subRes.ok) {
          const subData = await subRes.json();
          if (subData.subaccount) {
            setLinkedAccount(subData.subaccount);
          }
        }

        // 2. Fetch Ghanaian banks list
        const banksRes = await fetch('/api/settings/payments/banks');
        if (banksRes.ok) {
          const banksData = await banksRes.json();
          setBanks(banksData.data || []);
        }
      } catch (err: any) {
        console.error('Failed to load payouts settings:', err);
        setError('Failed to load settings data. Please reload.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  async function handleLinkSubaccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const payload = mode === 'manual' 
        ? { manual_code: manualCode }
        : { settlement_bank: selectedBank, account_number: accountNumber };

      const res = await fetch('/api/settings/payments/subaccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to link payout account');
      }

      setSuccess('Payout account successfully linked!');
      
      // Reload subaccount details
      const subRes = await fetch('/api/settings/payments/subaccount');
      if (subRes.ok) {
        const subData = await subRes.json();
        setLinkedAccount(subData.subaccount);
      }
      
      // Reset form fields
      setAccountNumber('');
      setSelectedBank('');
      setManualCode('');
    } catch (err: any) {
      console.error('Error linking subaccount:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnlinkSubaccount() {
    if (!confirm('Are you sure you want to unlink your Paystack payout account? Online transactions will no longer route to your local account.')) {
      return;
    }

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/settings/payments/subaccount', {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to unlink account');
      }

      setLinkedAccount(null);
      setSuccess('Payout account unlinked successfully.');
    } catch (err: any) {
      console.error('Error unlinking subaccount:', err);
      setError(err.message || 'Failed to unlink payout account.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-surface-900">Payouts & Payments (Paystack Split)</h2>
        <p className="text-xs text-surface-500 mt-0.5">
          Configure where funds from card and Mobile Money (MoMo) storefront transactions will land.
        </p>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-xs font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-xs font-medium">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
          <span>{success}</span>
        </div>
      )}

      {linkedAccount ? (
        /* LINKED STATE */
        <div className="space-y-6">
          <div className="p-6 border border-emerald-100 bg-emerald-50/20 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>ACTIVE PAYOUT ROUTING</span>
              </div>
              <span className="text-[10px] uppercase bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Linked
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="block text-[10px] font-bold text-surface-400 uppercase tracking-wider">Subaccount Code</span>
                <span className="font-mono text-surface-950 font-semibold">{linkedAccount.code}</span>
              </div>
              
              <div className="space-y-1">
                <span className="block text-[10px] font-bold text-surface-400 uppercase tracking-wider">Settlement Method</span>
                <span className="text-surface-950 font-semibold">
                  {linkedAccount.verified ? (
                    `${linkedAccount.settlement_bank} (${linkedAccount.account_number})`
                  ) : (
                    'Custom Manual Split'
                  )}
                </span>
              </div>
            </div>

            {linkedAccount.note && (
              <p className="text-[11px] text-surface-500 border-t border-surface-100 pt-3">
                ⚠️ {linkedAccount.note}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-surface-100 pt-5">
            <p className="text-xs text-surface-400">
              Need to split payouts to a different account? Unlink the current subaccount first.
            </p>
            <button
              onClick={handleUnlinkSubaccount}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition-all cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Unlink Account
            </button>
          </div>
        </div>
      ) : (
        /* UNLINKED STATE (ONBOARDING FORM) */
        <div className="space-y-6">
          <div className="flex border-b border-surface-100">
            <button
              onClick={() => setMode('create')}
              className={`pb-3 text-xs font-bold transition-all border-b-2 px-4 ${
                mode === 'create'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-surface-500 hover:text-surface-900'
              }`}
            >
              Auto-Create Subaccount
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`pb-3 text-xs font-bold transition-all border-b-2 px-4 ${
                mode === 'manual'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-surface-500 hover:text-surface-900'
              }`}
            >
              Link Code Manually
            </button>
          </div>

          <form onSubmit={handleLinkSubaccount} className="space-y-4">
            {mode === 'create' ? (
              /* AUTO-CREATE FIELDS */
              <div className="space-y-4">
                <div className="p-4 bg-surface-50/50 rounded-xl border border-surface-100 text-xs text-surface-500 space-y-1.5 leading-relaxed">
                  <span className="font-bold text-surface-700 block">How does this work?</span>
                  By selecting your local bank or Mobile Money (MTN, Telecel, AirtelTigo) provider and entering your number, we will automatically register a new subaccount in Paystack. Payments made by customers on your storefront will split and transfer instantly to this account.
                </div>

                <div>
                  <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                    Settlement Bank or Mobile Money Provider
                  </label>
                  <select
                    required
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-hairline bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
                  >
                    <option value="" disabled>Select your bank/payout network</option>
                    {banks.map((bank) => (
                      <option key={bank.code} value={bank.code}>
                        {bank.name} {bank.type === 'mobile_money' ? '(Mobile Money)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                    Account / Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0551109602 or standard account number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-hairline bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs font-mono"
                  />
                </div>
              </div>
            ) : (
              /* MANUAL LINK FIELDS */
              <div className="space-y-4">
                <div className="p-4 bg-surface-50/50 rounded-xl border border-surface-100 text-xs text-surface-500 space-y-1.5 leading-relaxed">
                  <span className="font-bold text-surface-700 block">Link Existing Subaccount</span>
                  If you have already configured a subaccount directly on your Paystack Dashboard, enter the subaccount code starting with <code className="font-mono text-brand-600 bg-brand-50/50 px-1 py-0.5 rounded">ACCT_</code> below to map it to this store.
                </div>

                <div>
                  <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                    Paystack Subaccount Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ACCT_xxxxxxxxxxxx"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-hairline bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Linking Account...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Link Payout Account
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
