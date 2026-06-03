'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { formatGHS } from '@/lib/utils/currency';
import { timeAgo, formatDateTime } from '@/lib/utils';
import {
  ShoppingBag,
  Clock,
  Phone,
  MapPin,
  FileText,
  CheckCircle,
  Truck,
  XCircle,
  Play,
  Check,
  AlertCircle,
  Loader2,
  Calendar,
  DollarSign,
  Printer,
  ChevronRight,
  Bell,
  Search,
  X,
  Send,
  MessageSquare,
  Star,
} from 'lucide-react';
import { getResolvedTenantIdClient } from '@/lib/admin/impersonate';
import { isVisibleToRestaurant, VISIBLE_ORDER_FILTER } from '@/lib/orders/visibility';
import Link from 'next/link';

interface OrderItem {
  id: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  options_json: Array<{ name: string; price_modifier: number }> | null;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_type: string;
  delivery_address: string | null;
  delivery_notes: string | null;
  estimated_ready_at: string | null;
  created_at: string;
}

interface StatusHistory {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
}

interface ChatMessage {
  id: string;
  sender: 'customer' | 'restaurant';
  body: string;
  created_at: string;
}

export default function OrdersPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [selectedOrderHistory, setSelectedOrderHistory] = useState<StatusHistory[]>([]);
  const [selectedOrderReview, setSelectedOrderReview] = useState<{ rating: number; comment: string | null; owner_reply: string | null } | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Filters & Search
  const [activeTab, setActiveTab] = useState<string>('active'); // active, pending, ready, completed, cancelled, all
  const [searchQuery, setSearchQuery] = useState('');

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgDraft, setMsgDraft] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [unreadByOrder, setUnreadByOrder] = useState<Record<string, number>>({});
  const msgThreadRef = useRef<HTMLDivElement>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [estimatedReadyMinutes, setEstimatedReadyMinutes] = useState('30');

  // Play synthetic double ding sound
  function playBeep() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Dual-chime: D5 then A5
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (err) {
      console.error('Audio beep failed:', err);
    }
  }

  // Load session
  useEffect(() => {
    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const tId = await getResolvedTenantIdClient(supabase, session);
      if (tId) {
        setTenantId(tId);
        // Reconcile momo/card orders Paystack confirmed but the webhook missed;
        // newly-settled ones then arrive via the realtime subscription.
        try {
          await fetch('/api/orders/tenant-reconcile', { method: 'POST' });
        } catch {
          // Best-effort; the list still loads without it.
        }
        fetchOrders(tId);
      }
    }
    loadSession();
  }, []);

  // Fetch orders list
  async function fetchOrders(tId: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('tenant_id', tId)
        .or(VISIBLE_ORDER_FILTER)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((o) => ({
        ...o,
        subtotal: Number(o.subtotal),
        delivery_fee: Number(o.delivery_fee),
        total: Number(o.total),
      }));

      setOrders(formatted);

      // Auto-select: the order deep-linked via ?order=<id> (e.g. from the
      // dashboard's recent-orders list), else the most recent order.
      if (formatted.length > 0) {
        const targetId =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('order')
            : null;
        const initial =
          (targetId && formatted.find((o) => o.id === targetId)) || formatted[0];
        setSelectedOrder(initial);
        fetchOrderDetails(initial.id);
        loadOwnerMessages(initial.id);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  }

  // Realtime subscription
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const newOrder = payload.new as any;
          
          if (payload.eventType === 'INSERT') {
            // Only surface paid online orders or cash-on-delivery; unpaid online
            // orders stay hidden until payment is confirmed (an UPDATE then
            // promotes them into the list).
            if (!isVisibleToRestaurant(newOrder)) return;
            const formatted = {
              ...newOrder,
              subtotal: Number(newOrder.subtotal),
              delivery_fee: Number(newOrder.delivery_fee),
              total: Number(newOrder.total),
            };
            setOrders((prev) => [formatted, ...prev]);
            playBeep();
          } else if (payload.eventType === 'UPDATE') {
            const formatted = {
              ...newOrder,
              subtotal: Number(newOrder.subtotal),
              delivery_fee: Number(newOrder.delivery_fee),
              total: Number(newOrder.total),
            };
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === formatted.id);
              if (exists) {
                return prev.map((o) => (o.id === formatted.id ? formatted : o));
              }
              // A previously-hidden online order just became paid — promote it.
              if (isVisibleToRestaurant(formatted)) {
                playBeep();
                return [formatted, ...prev];
              }
              return prev;
            });
            // If active order was updated, sync its details
            setSelectedOrder((current) => {
              if (current && current.id === formatted.id) {
                return formatted;
              }
              return current;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  // Fetch items & timeline details for selected order
  async function fetchOrderDetails(orderId: string) {
    setItemsLoading(true);
    try {
      // 1. Fetch order items
      const { data: items, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsErr) throw itemsErr;
      setSelectedOrderItems(
        (items || []).map((i) => ({
          ...i,
          unit_price: Number(i.unit_price),
          line_total: Number(i.line_total),
        }))
      );

      // 2. Fetch history
      const { data: hist, error: histErr } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (histErr) throw histErr;
      setSelectedOrderHistory(hist || []);

      // 3. Fetch review (if the customer left one)
      const { data: rev } = await supabase
        .from('reviews')
        .select('rating, comment, owner_reply')
        .eq('order_id', orderId)
        .maybeSingle();
      setSelectedOrderReview(rev || null);
      setReplyDraft('');
    } catch (err) {
      console.error('Error fetching order details:', err);
    } finally {
      setItemsLoading(false);
    }
  }

  // Handle clicking an order in the master list
  function handleSelectOrder(order: Order) {
    setSelectedOrder(order);
    setMessages([]);
    fetchOrderDetails(order.id);
    loadOwnerMessages(order.id);
  }

  // ─── Customer chat (owner side) ───────────────────────────
  async function loadOwnerMessages(orderId: string) {
    try {
      const { data } = await supabase
        .from('order_messages')
        .select('id, sender, body, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      setMessages((data as ChatMessage[]) || []);
      // Mark the customer's messages as read.
      await supabase
        .from('order_messages')
        .update({ read_by_restaurant_at: new Date().toISOString() })
        .eq('order_id', orderId)
        .eq('sender', 'customer')
        .is('read_by_restaurant_at', null);
      setUnreadByOrder((prev) => ({ ...prev, [orderId]: 0 }));
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  async function loadUnread(tId: string) {
    try {
      const { data } = await supabase
        .from('order_messages')
        .select('order_id')
        .eq('tenant_id', tId)
        .eq('sender', 'customer')
        .is('read_by_restaurant_at', null);
      const counts: Record<string, number> = {};
      (data || []).forEach((r: { order_id: string }) => {
        counts[r.order_id] = (counts[r.order_id] || 0) + 1;
      });
      setUnreadByOrder(counts);
    } catch {
      /* ignore */
    }
  }

  async function sendOwnerMessage() {
    const text = msgDraft.trim();
    if (!text || msgSending || !selectedOrder) return;
    setMsgSending(true);
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      sender: 'restaurant',
      body: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setMsgDraft('');
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((m) => m.map((x) => (x.id === optimistic.id ? (data.message as ChatMessage) : x)));
      } else {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setMsgDraft(text);
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setMsgDraft(text);
    } finally {
      setMsgSending(false);
    }
  }

  async function sendReply() {
    const text = replyDraft.trim();
    if (!text || replySending || !selectedOrder) return;
    setReplySending(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: text }),
      });
      if (res.ok) {
        const d = await res.json();
        setSelectedOrderReview((r) => (r ? { ...r, owner_reply: d.review.owner_reply } : r));
        setReplyDraft('');
      }
    } catch {
      /* ignore */
    } finally {
      setReplySending(false);
    }
  }

  // Poll the selected order's chat thread.
  useEffect(() => {
    if (!selectedOrder) return;
    const id = selectedOrder.id;
    const iv = setInterval(async () => {
      const { data } = await supabase
        .from('order_messages')
        .select('id, sender, body, created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as ChatMessage[]);
      await supabase
        .from('order_messages')
        .update({ read_by_restaurant_at: new Date().toISOString() })
        .eq('order_id', id)
        .eq('sender', 'customer')
        .is('read_by_restaurant_at', null);
    }, 8000);
    return () => clearInterval(iv);
  }, [selectedOrder?.id]);

  // Poll unread message counts across all orders (for the badges).
  useEffect(() => {
    if (!tenantId) return;
    loadUnread(tenantId);
    const iv = setInterval(() => loadUnread(tenantId), 15000);
    return () => clearInterval(iv);
  }, [tenantId]);

  // Keep the chat thread scrolled to the newest message.
  useEffect(() => {
    msgThreadRef.current?.scrollTo({ top: msgThreadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Patch order status helper
  async function updateOrderStatus(
    status: string,
    cReason?: string,
    minutes?: string
  ) {
    if (!selectedOrder) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          cancellationReason: cReason,
          estimatedReadyMinutes: minutes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update order');
      }

      const data = await res.json();
      
      // Update local state list
      const formatted = {
        ...data.order,
        subtotal: Number(data.order.subtotal),
        delivery_fee: Number(data.order.delivery_fee),
        total: Number(data.order.total),
      };

      setOrders((prev) =>
        prev.map((o) => (o.id === formatted.id ? formatted : o))
      );
      setSelectedOrder(formatted);
      await fetchOrderDetails(formatted.id);

      setCancelModalOpen(false);
      setConfirmModalOpen(false);
      setCancellationReason('');
    } catch (err) {
      console.error('Transition error:', err);
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  }

  // Status mapping
  const statusConfig: Record<string, { label: string; class: string; dot: string }> = {
    pending: { label: 'New Order', class: 'bg-brand-500/10 text-brand-600', dot: 'bg-brand-500' },
    confirmed: { label: 'Confirmed', class: 'bg-info-500/10 text-info-600', dot: 'bg-info-500' },
    preparing: { label: 'Cooking', class: 'bg-warning-500/10 text-warning-700', dot: 'bg-warning-500' },
    ready: { label: 'Ready', class: 'bg-success-500/10 text-success-700', dot: 'bg-success-500' },
    out_for_delivery: { label: 'Dispatched', class: 'bg-purple-500/10 text-purple-600', dot: 'bg-purple-500' },
    delivered: { label: 'Delivered', class: 'bg-success-500/15 text-success-800', dot: 'bg-success-600' },
    cancelled: { label: 'Cancelled', class: 'bg-error-500/10 text-error-600', dot: 'bg-error-500' },
  };

  // Filter logic
  const filteredOrders = orders.filter((order) => {
    // 1. Tab filter
    let matchTab = true;
    if (activeTab === 'active') {
      matchTab = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status);
    } else if (activeTab !== 'all') {
      matchTab = order.status === activeTab;
    }

    // 2. Search query filter
    const matchSearch =
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_phone.includes(searchQuery);

    return matchTab && matchSearch;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto h-[calc(100vh-6rem)] flex flex-col">
      {/* Upper header summary */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-brand-500" />
            Live Orders Feed
          </h1>
          <p className="text-surface-500 text-sm mt-1">
            Incoming food requests from customers in real-time. Click to action.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={playBeep}
            className="p-2 border border-surface-200 hover:bg-surface-50 rounded-xl text-surface-500"
            title="Test notification chime"
          >
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs & Search controls */}
      <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none flex-1">
          {[
            { id: 'active', label: 'Active' },
            { id: 'pending', label: 'New' },
            { id: 'confirmed', label: 'Confirmed' },
            { id: 'preparing', label: 'Cooking' },
            { id: 'ready', label: 'Ready' },
            { id: 'delivered', label: 'Delivered' },
            { id: 'cancelled', label: 'Cancelled' },
            { id: 'all', label: 'All Orders' },
          ].map((tab) => {
            const count = tab.id === 'active'
              ? orders.filter((o) => ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)).length
              : tab.id === 'all'
                ? orders.length
                : orders.filter((o) => o.status === tab.id).length;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-brand-500 text-white'
                    : 'bg-white text-surface-600 hover:bg-surface-50 border border-surface-150'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64 flex-shrink-0">
          <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search order number or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs shadow-sm"
          />
        </div>
      </div>

      {/* Main split-pane content */}
      <div className="flex-1 min-h-0 grid lg:grid-cols-5 gap-6">
        {/* Left Side: Order Master List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-surface-100 flex flex-col min-h-0 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-surface-100 bg-surface-50/50 flex-shrink-0 flex justify-between">
            <h2 className="text-xs font-bold text-surface-500 uppercase tracking-wider">
              Orders Queue
            </h2>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
              <p className="text-xs text-surface-500 mt-2">Loading queue...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <ShoppingBag className="w-10 h-10 text-surface-300 mb-2" />
              <p className="text-xs text-surface-500 font-medium">No orders in this state</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-surface-100 scrollbar-thin">
              {filteredOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                const status = statusConfig[order.status] || {
                  label: order.status,
                  class: '',
                  dot: '',
                };

                return (
                  <button
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className={`w-full text-left p-4 transition-colors hover:bg-surface-50/70 flex justify-between items-start gap-3 ${
                      isSelected ? 'bg-brand-500/[0.03]' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-surface-900 text-sm">
                          {order.order_number}
                        </span>
                        <span className="text-[10px] text-surface-400">
                          {timeAgo(order.created_at)}
                        </span>
                        {(unreadByOrder[order.id] ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-brand-500 text-white text-[9px] font-bold">
                            <MessageSquare className="w-2.5 h-2.5" />
                            {unreadByOrder[order.id]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-surface-700 truncate mt-1">
                        {order.customer_name}
                      </p>
                      <div className="flex gap-2 items-center text-[10px] text-surface-500 mt-1">
                        <span>{order.delivery_type === 'delivery' ? '🚗 Delivery' : '🏪 Pickup'}</span>
                        <span>·</span>
                        <span>{order.payment_method === 'cash_on_delivery' ? 'COD' : order.payment_method === 'momo' ? 'MoMo' : 'Card'}</span>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm text-surface-900">
                        {formatGHS(order.total)}
                      </p>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1.5 ${status.class}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Order Detail Panel */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-surface-100 flex flex-col min-h-0 shadow-sm overflow-hidden">
          {selectedOrder ? (
            <>
              {/* Detail Header */}
              <div className="p-4 sm:p-5 border-b border-surface-100 flex-shrink-0 flex justify-between items-center bg-surface-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold text-surface-950">
                      Order {selectedOrder.order_number}
                    </span>
                    <span className="text-xs text-surface-400">
                      placed {formatDateTime(selectedOrder.created_at)}
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                    statusConfig[selectedOrder.status]?.class || ''
                  }`}>
                    {statusConfig[selectedOrder.status]?.label || selectedOrder.status}
                  </span>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 border border-surface-200 hover:bg-surface-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-surface-700 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
                </button>
              </div>

              {/* Detail body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 scrollbar-thin">
                {/* Status action control banner */}
                <div className="p-4 rounded-2xl bg-brand-500/[0.04] border border-brand-500/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-surface-800">Order Action</h3>
                    <p className="text-xs text-surface-500 mt-0.5">
                      Ready to advance this order? Move it to the next step.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedOrder.status === 'pending' && (
                      <>
                        <button
                          onClick={() => setConfirmModalOpen(true)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-[0.98]"
                        >
                          Confirm & Cook
                        </button>
                        <button
                          onClick={() => setCancelModalOpen(true)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 border border-error-200 text-error-600 hover:bg-error-50 rounded-xl text-xs font-semibold"
                        >
                          Cancel Order
                        </button>
                      </>
                    )}
                    {selectedOrder.status === 'confirmed' && (
                      <button
                        onClick={() => updateOrderStatus('preparing')}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                      >
                        Start Cooking
                      </button>
                    )}
                    {selectedOrder.status === 'preparing' && (
                      <button
                        onClick={() => updateOrderStatus('ready')}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Mark as Ready
                      </button>
                    )}
                    {selectedOrder.status === 'ready' && (
                      <>
                        {selectedOrder.delivery_type === 'delivery' ? (
                          <button
                            onClick={() => updateOrderStatus('out_for_delivery')}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            Dispatch Rider
                          </button>
                        ) : (
                          <button
                            onClick={() => updateOrderStatus('delivered')}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                          >
                            Mark Picked Up / Done
                          </button>
                        )}
                      </>
                    )}
                    {selectedOrder.status === 'out_for_delivery' && (
                      <button
                        onClick={() => updateOrderStatus('delivered')}
                        disabled={actionLoading}
                        className="px-3 py-1.5 bg-success-600 hover:bg-success-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Complete / Delivered
                      </button>
                    )}
                    {['delivered', 'cancelled'].includes(selectedOrder.status) && (
                      <span className="text-xs font-semibold text-surface-400 py-1.5 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-success-600" />
                        No further action needed
                      </span>
                    )}
                  </div>
                </div>

                {/* Split grid: customer & delivery details */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="border border-surface-150 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">
                      Customer Info
                    </h4>
                    <p className="text-sm font-semibold text-surface-900">{selectedOrder.customer_name}</p>
                    <a
                      href={`tel:${selectedOrder.customer_phone}`}
                      className="text-xs text-brand-500 font-semibold flex items-center gap-1 hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {selectedOrder.customer_phone}
                    </a>
                    {selectedOrder.customer_email && (
                      <p className="text-xs text-surface-500 truncate">{selectedOrder.customer_email}</p>
                    )}
                  </div>

                  <div className="border border-surface-150 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">
                      Delivery Details
                    </h4>
                    <p className="text-sm font-medium text-surface-800">
                      {selectedOrder.delivery_type === 'delivery' ? '🚗 Home Delivery' : '🏪 Self Pickup'}
                    </p>
                    {selectedOrder.delivery_type === 'delivery' && (
                      <>
                        <p className="text-xs text-surface-600 font-medium flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-surface-400 mt-0.5 shrink-0" />
                          <span>{selectedOrder.delivery_address || 'No address specified'}</span>
                        </p>
                        {selectedOrder.delivery_notes && (
                          <p className="text-xs text-surface-500 bg-surface-50 border border-surface-150 rounded-lg p-2 mt-1">
                            <strong>Note:</strong> {selectedOrder.delivery_notes}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Items details table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">
                    Ordered Dishes
                  </h4>
                  {itemsLoading ? (
                    <div className="py-8 flex justify-center">
                      <Loader2 className="w-5 h-5 text-surface-400 animate-spin" />
                    </div>
                  ) : (
                    <div className="bg-white border border-surface-150 rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-surface-50/70 border-b border-surface-150 text-[10px] font-bold text-surface-500 uppercase">
                            <th className="p-3">Dish</th>
                            <th className="p-3 text-center">Qty</th>
                            <th className="p-3 text-right">Price</th>
                            <th className="p-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                          {selectedOrderItems.map((item) => (
                            <tr key={item.id}>
                              <td className="p-3">
                                <p className="font-semibold text-surface-900 text-xs">{item.item_name}</p>
                                {item.options_json && item.options_json.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.options_json.map((opt, oidx) => (
                                      <span
                                        key={oidx}
                                        className="bg-surface-100 text-surface-600 text-[9px] font-medium px-1.5 py-0.5 rounded"
                                      >
                                        +{opt.name} ({formatGHS(opt.price_modifier)})
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-center font-bold text-xs">{item.quantity}</td>
                              <td className="p-3 text-right text-xs text-surface-500">{formatGHS(item.unit_price)}</td>
                              <td className="p-3 text-right font-bold text-xs text-surface-900">{formatGHS(item.line_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Pricing & payment breakdown */}
                <div className="bg-surface-50/70 border border-surface-150 rounded-2xl p-4 flex flex-col gap-2.5 text-xs text-surface-600">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-medium text-surface-900">{formatGHS(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.delivery_type === 'delivery' && (
                    <div className="flex justify-between">
                      <span>Delivery Fee</span>
                      <span className="font-medium text-surface-900">{formatGHS(selectedOrder.delivery_fee)}</span>
                    </div>
                  )}
                  <div className="border-t border-surface-200 pt-2.5 flex justify-between font-extrabold text-sm text-surface-950">
                    <span>Total Amount</span>
                    <span className="text-brand-500">{formatGHS(selectedOrder.total)}</span>
                  </div>
                  <div className="border-t border-surface-150 pt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px]">
                    <span className="flex items-center gap-1">
                      <strong>Method:</strong>
                      <span className="bg-surface-200/80 px-2 py-0.5 rounded text-surface-700 font-semibold">
                        {selectedOrder.payment_method === 'cash_on_delivery' ? 'Pay on Delivery' : selectedOrder.payment_method === 'momo' ? 'Mobile Money' : 'Card'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <strong>Status:</strong>
                      <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                        selectedOrder.payment_status === 'paid'
                          ? 'bg-success-500/10 text-success-700'
                          : selectedOrder.payment_status === 'failed'
                            ? 'bg-error-500/10 text-error-700'
                            : 'bg-warning-500/10 text-warning-700'
                      }`}>
                        {selectedOrder.payment_status}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Audit Timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider">
                    Order Timeline & Notes
                  </h4>
                  {itemsLoading ? (
                    <div className="py-4 flex justify-center">
                      <Loader2 className="w-5 h-5 text-surface-400 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-3 relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-100">
                      {selectedOrderHistory.map((hist) => (
                        <div key={hist.id} className="relative text-xs">
                          <span className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-surface-300 border-2 border-white ring-2 ring-surface-50" />
                          <div className="flex justify-between font-semibold text-surface-800">
                            <span>Status changed to &quot;{statusConfig[hist.to_status]?.label || hist.to_status}&quot;</span>
                            <span className="text-[10px] text-surface-400 font-normal">
                              {formatDateTime(hist.created_at)}
                            </span>
                          </div>
                          {hist.note && (
                            <p className="text-surface-500 text-[11px] mt-0.5 italic">
                              &ldquo;{hist.note}&rdquo;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Customer review */}
                {selectedOrderReview && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5" /> Customer Review
                    </h4>
                    <div className="border border-surface-150 rounded-2xl p-4">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className="w-4 h-4"
                            style={{ color: n <= selectedOrderReview.rating ? '#F59E0B' : 'var(--color-surface-300)' }}
                            fill={n <= selectedOrderReview.rating ? '#F59E0B' : 'none'}
                          />
                        ))}
                        <span className="ml-1 text-sm font-bold text-surface-800">{selectedOrderReview.rating}.0</span>
                      </div>
                      {selectedOrderReview.comment && (
                        <p className="text-sm text-surface-600 mt-2 italic">“{selectedOrderReview.comment}”</p>
                      )}

                      {selectedOrderReview.owner_reply ? (
                        <div className="mt-3 pl-3 border-l-2 border-brand-200 bg-brand-500/[0.03] rounded-r-lg py-2 pr-2">
                          <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Your reply</p>
                          <p className="text-sm text-surface-700 mt-0.5">{selectedOrderReview.owner_reply}</p>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-end gap-2">
                          <textarea
                            value={replyDraft}
                            onChange={(e) => setReplyDraft(e.target.value)}
                            rows={1}
                            placeholder="Reply to this review…"
                            className="flex-1 resize-none px-3 py-2 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 max-h-24"
                          />
                          <button
                            type="button"
                            onClick={sendReply}
                            disabled={!replyDraft.trim() || replySending}
                            className="px-3 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {replySending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reply'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Customer chat */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> Chat with Customer
                  </h4>
                  <div className="border border-surface-150 rounded-2xl overflow-hidden">
                    <div ref={msgThreadRef} className="max-h-64 overflow-y-auto p-3 space-y-2 bg-surface-50/40 scrollbar-thin">
                      {messages.length === 0 ? (
                        <p className="text-center text-[11px] text-surface-400 py-6">
                          No messages yet. If the customer reaches out, reply here.
                        </p>
                      ) : (
                        messages.map((m) => {
                          const mine = m.sender === 'restaurant';
                          return (
                            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                                  mine
                                    ? 'bg-brand-500 text-white rounded-br-md'
                                    : 'bg-white border border-surface-150 text-surface-800 rounded-bl-md'
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                                <p className={`text-[10px] mt-0.5 ${mine ? 'text-white/70' : 'text-surface-400'}`}>
                                  {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="border-t border-surface-150 p-2.5 flex items-end gap-2 bg-white">
                      <textarea
                        value={msgDraft}
                        onChange={(e) => setMsgDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendOwnerMessage();
                          }
                        }}
                        rows={1}
                        placeholder="Reply to customer…"
                        className="flex-1 resize-none px-3 py-2 rounded-xl border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 max-h-24"
                      />
                      <button
                        type="button"
                        onClick={sendOwnerMessage}
                        disabled={!msgDraft.trim() || msgSending}
                        className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-brand-500 hover:bg-brand-600 text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Send message"
                      >
                        {msgSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <ShoppingBag className="w-16 h-16 text-surface-150 mb-3" />
              <p className="text-surface-500 font-semibold">Select an order</p>
              <p className="text-xs text-surface-400 mt-1">
                Choose an item from the sidebar queue to inspect details and perform actions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation & Cook Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="text-lg font-bold text-surface-900">Confirm Order</h2>
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
              >
                <X className="w-5 h-5 text-surface-500" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-xs text-surface-500">
                Accept this order and notify the kitchen. Choose the estimated ready time to send to the customer via SMS.
              </p>
              
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                  Est. Preparation Time (minutes)
                </label>
                <select
                  value={estimatedReadyMinutes}
                  onChange={(e) => setEstimatedReadyMinutes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                >
                  <option value="15">15 minutes</option>
                  <option value="20">20 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setConfirmModalOpen(false)}
                  className="flex-1 py-2.5 border border-surface-200 hover:bg-surface-50 text-surface-700 rounded-xl text-sm font-semibold transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={() => updateOrderStatus('confirmed', undefined, estimatedReadyMinutes)}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="text-lg font-bold text-surface-900">Cancel Order</h2>
              <button
                onClick={() => setCancelModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
              >
                <X className="w-5 h-5 text-surface-500" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-xs text-surface-500">
                Provide a reason for cancellation. This will be sent directly to the customer via SMS.
              </p>
              
              <div>
                <label className="block text-xs font-semibold text-surface-700 mb-1.5">
                  Cancellation Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ingredients out of stock / Shop closed"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setCancelModalOpen(false)}
                  className="flex-1 py-2.5 border border-surface-200 hover:bg-surface-50 text-surface-700 rounded-xl text-sm font-semibold transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={() => updateOrderStatus('cancelled', cancellationReason)}
                  disabled={actionLoading || !cancellationReason.trim()}
                  className="flex-1 py-2.5 bg-error-600 hover:bg-error-700 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
