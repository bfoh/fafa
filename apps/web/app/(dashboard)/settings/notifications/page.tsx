'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils';
import {
  Bell,
  Mail,
  Smartphone,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import { getResolvedTenantIdClient } from '@/lib/admin/impersonate';

interface NotificationLog {
  id: string;
  recipient: string;
  channel: 'sms' | 'email';
  template: string;
  status: 'sent' | 'failed' | 'delivered';
  provider: string;
  error_message: string | null;
  created_at: string;
}

export default function NotificationsLogPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<NotificationLog[]>([]);

  useEffect(() => {
    async function loadLogs() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const tId = await getResolvedTenantIdClient(supabase, session);

        if (tId) {
          const { data, error } = await supabase
            .from('notification_log')
            .select('*')
            .eq('tenant_id', tId)
            .order('created_at', { ascending: false })
            .limit(50);

          if (!error && data) {
            setLogs(data as any);
          }
        }
      } catch (err) {
        console.error('Failed to load notification logs:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  const templateLabels: Record<string, string> = {
    order_placed: 'New Order Received',
    order_placed_tenant: 'New Order Alert (Tenant)',
    order_confirmed: 'Order Confirmed',
    order_ready: 'Order Ready Alert',
    order_out_for_delivery: 'Rider Dispatched Alert',
    order_delivered: 'Enjoy Meal / Delivered',
    payment_confirmed: 'Payment Confirmed Alert',
    payment_confirmed_tenant: 'Payment Received Alert (Tenant)',
    order_cancelled: 'Cancellation Alert',
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-base font-bold text-surface-900">Notifications Log</h2>
        <p className="text-xs text-surface-400 mt-0.5">
          History log of the last 50 automated email and SMS notification updates sent out.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-hairline overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            <p className="text-xs text-surface-500 mt-1">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-surface-400 italic">
            <Bell className="w-10 h-10 text-surface-200 mx-auto mb-2" />
            No notifications sent yet.
          </div>
        ) : (
          <div className="divide-y divide-surface-100 text-xs text-surface-700">
            {logs.map((log) => {
              const channelIcon =
                log.channel === 'email' ? (
                  <Mail className="w-3.5 h-3.5 text-surface-400" />
                ) : (
                  <Smartphone className="w-3.5 h-3.5 text-surface-400" />
                );

              const statusIcon =
                log.status === 'sent' || log.status === 'delivered' ? (
                  <CheckCircle className="w-4 h-4 text-success-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-error-600" />
                );

              return (
                <div key={log.id} className="p-4 hover:bg-surface-50/50 transition-colors flex justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-surface-900">
                        {templateLabels[log.template] || log.template}
                      </span>
                      <span className="text-[9px] bg-surface-155 px-1.5 py-0.5 rounded-full text-surface-500">
                        {log.provider}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-surface-500">
                      {channelIcon}
                      <span className="font-medium truncate">{log.recipient}</span>
                    </div>
                    {log.error_message && (
                      <p className="text-[10px] text-error-600 italic">
                        <strong>Error:</strong> {log.error_message}
                      </p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0 flex flex-col justify-between items-end">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-[10px] uppercase">
                        {log.status}
                      </span>
                      {statusIcon}
                    </div>
                    <span className="text-[10px] text-surface-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
