'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { formatGHS } from '@/lib/utils/currency';
import { formatDateTime } from '@/lib/utils';
import {
  Users,
  Search,
  ChevronDown,
  ArrowUpDown,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  ShoppingBag,
  Loader2,
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
}

type SortField = 'name' | 'total_orders' | 'total_spent' | 'last_order_at';
type SortOrder = 'asc' | 'desc';

export default function CustomersPage() {
  const supabase = createBrowserClient();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('last_order_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    async function loadCustomers() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: member } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', session.user.id)
        .single();

      if (member) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', member.tenant_id);

        if (!error && data) {
          const formatted = data.map((c) => ({
            ...c,
            total_spent: Number(c.total_spent),
            total_orders: Number(c.total_orders),
          }));
          setCustomers(formatted);
        }
        setLoading(false);
      }
    }
    loadCustomers();
  }, []);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }

  // Sort and filter customers
  const sortedAndFilteredCustomers = customers
    .filter((c) => {
      const query = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query) ||
        (c.email && c.email.toLowerCase().includes(query)) ||
        (c.address && c.address.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'total_orders') {
        comparison = a.total_orders - b.total_orders;
      } else if (sortField === 'total_spent') {
        comparison = a.total_spent - b.total_spent;
      } else if (sortField === 'last_order_at') {
        const dateA = a.last_order_at ? new Date(a.last_order_at).getTime() : 0;
        const dateB = b.last_order_at ? new Date(b.last_order_at).getTime() : 0;
        comparison = dateA - dateB;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-brand-500" />
          Customer Directory
        </h1>
        <p className="text-surface-500 text-sm mt-1">
          View your restaurant&apos;s regular client base. Customer records are automatically saved during storefront checkouts.
        </p>
      </div>

      {/* Table controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, phone or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs shadow-sm"
          />
        </div>
      </div>

      {/* Directory table */}
      <div className="bg-white rounded-2xl border border-surface-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            <p className="text-xs text-surface-500 mt-2">Loading directory...</p>
          </div>
        ) : sortedAndFilteredCustomers.length === 0 ? (
          <div className="py-20 text-center">
            <Users className="w-12 h-12 text-surface-300 mx-auto mb-2" />
            <p className="text-sm text-surface-500 font-medium">No customers found</p>
            <p className="text-xs text-surface-400 mt-1">
              {searchQuery
                ? 'Try adjusting your search criteria.'
                : 'Customer profiles will appear here once they complete their first checkout.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-150 text-[10px] font-bold text-surface-500 uppercase select-none">
                  <th
                    className="p-4 cursor-pointer hover:bg-surface-100/70 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Customer Name
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                  </th>
                  <th className="p-4">Contact Info</th>
                  <th className="p-4">Delivery Address</th>
                  <th
                    className="p-4 cursor-pointer hover:bg-surface-100/70 transition-colors text-center"
                    onClick={() => handleSort('total_orders')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Orders Count
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-surface-100/70 transition-colors text-right"
                    onClick={() => handleSort('total_spent')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total Spent
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                  </th>
                  <th
                    className="p-4 cursor-pointer hover:bg-surface-100/70 transition-colors text-right"
                    onClick={() => handleSort('last_order_at')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Last Order Date
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-surface-700">
                {sortedAndFilteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-surface-50/50 transition-colors">
                    <td className="p-4 font-bold text-surface-900 text-sm">
                      {cust.name}
                    </td>
                    <td className="p-4 space-y-1">
                      <a
                        href={`tel:${cust.phone}`}
                        className="text-xs text-brand-500 font-semibold flex items-center gap-1 hover:underline"
                      >
                        <Phone className="w-3.5 h-3.5 text-surface-400" />
                        {cust.phone}
                      </a>
                      {cust.email && (
                        <p className="text-[11px] text-surface-500 flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-surface-400" />
                          {cust.email}
                        </p>
                      )}
                    </td>
                    <td className="p-4 max-w-[200px] truncate text-surface-600 font-medium">
                      {cust.address ? (
                        <span className="flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-surface-400 shrink-0 mt-0.5" />
                          <span className="truncate">{cust.address}</span>
                        </span>
                      ) : (
                        <span className="text-surface-400 italic">No address saved</span>
                      )}
                    </td>
                    <td className="p-4 text-center font-extrabold text-sm text-surface-800">
                      {cust.total_orders}
                    </td>
                    <td className="p-4 text-right font-extrabold text-sm text-brand-500">
                      {formatGHS(cust.total_spent)}
                    </td>
                    <td className="p-4 text-right text-surface-500">
                      {cust.last_order_at ? (
                        <span className="flex items-center justify-end gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-surface-400" />
                          {formatDateTime(cust.last_order_at)}
                        </span>
                      ) : (
                        <span className="italic text-surface-400">Never ordered</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
