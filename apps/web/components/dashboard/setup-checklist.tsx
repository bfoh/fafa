'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase/client';
import { getBaseUrl } from '@/lib/utils';
import {
  UtensilsCrossed,
  CreditCard,
  Palette,
  Store,
  Check,
  ChevronRight,
  Sparkles,
  Loader2,
  Copy,
  X,
  CheckCircle2,
} from 'lucide-react';

interface SetupChecklistProps {
  tenantId: string;
  slug: string;
  menuDone: boolean;
  paymentsDone: boolean;
  brandingDone: boolean;
  shareDone: boolean;
}

const DISMISS_KEY = 'didi:setup-dismissed';

// Sample Ghanaian dishes seeded into the default categories created at signup.
const SAMPLE_MENU: {
  category: string;
  name: string;
  description: string;
  price: number;
}[] = [
  {
    category: 'Main Dishes',
    name: 'Jollof Rice with Chicken',
    description: 'Smoky party jollof served with grilled chicken',
    price: 45,
  },
  {
    category: 'Main Dishes',
    name: 'Waakye Special',
    description: 'Rice and beans with spaghetti, egg, gari and shito',
    price: 35,
  },
  {
    category: 'Main Dishes',
    name: 'Banku with Tilapia',
    description: 'Fresh grilled tilapia with hot pepper and banku',
    price: 50,
  },
  {
    category: 'Main Dishes',
    name: 'Fried Rice with Chicken',
    description: 'Vegetable fried rice with seasoned chicken',
    price: 45,
  },
  {
    category: 'Sides & Extras',
    name: 'Kelewele',
    description: 'Spicy fried ripe plantain cubes',
    price: 15,
  },
  {
    category: 'Sides & Extras',
    name: 'Fried Plantain',
    description: 'Golden fried ripe plantain',
    price: 12,
  },
  {
    category: 'Drinks',
    name: 'Sobolo',
    description: 'Chilled hibiscus drink',
    price: 10,
  },
  {
    category: 'Drinks',
    name: 'Bottled Water',
    description: '500ml bottled water',
    price: 5,
  },
];

export default function SetupChecklist({
  tenantId,
  slug,
  menuDone,
  paymentsDone,
  brandingDone,
  shareDone,
}: SetupChecklistProps) {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState('');
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const allDone = menuDone && paymentsDone && brandingDone && shareDone;

  // Read the dismissed flag after mount to keep server/client render in sync.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    }
  }, []);

  async function handleSeedSample() {
    setSeeding(true);
    setSeedError('');
    try {
      const supabase = createBrowserClient();

      // Guard against double-seed: only proceed if the store still has 0 items.
      const { count } = await supabase
        .from('menu_items')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if ((count || 0) > 0) {
        router.refresh();
        return;
      }

      const { data: categories } = await supabase
        .from('menu_categories')
        .select('id, name, sort_order')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });

      if (!categories || categories.length === 0) {
        setSeedError('No menu categories found. Add a category first.');
        return;
      }

      const byName = new Map(categories.map((c) => [c.name, c.id]));
      const fallbackId = categories[0].id;

      const rows = SAMPLE_MENU.map((dish, i) => ({
        tenant_id: tenantId,
        category_id: byName.get(dish.category) ?? fallbackId,
        name: dish.name,
        description: dish.description,
        price: dish.price,
        is_available: true,
        sort_order: i,
      }));

      const { error } = await supabase.from('menu_items').insert(rows);
      if (error) {
        setSeedError(error.message);
        return;
      }

      router.refresh();
    } catch (err) {
      setSeedError(
        err instanceof Error ? err.message : 'Could not add sample menu.'
      );
    } finally {
      setSeeding(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(`${getBaseUrl()}/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — no-op; link is still visible via the Share page.
    }
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  // Fully set up: show a dismissible "live" banner, then nothing.
  if (allDone) {
    if (dismissed) return null;
    return (
      <div className="relative bg-success-500/10 border border-success-500/20 rounded-2xl p-5 animate-fade-in">
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="absolute top-4 right-4 text-surface-400 hover:text-surface-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-success-500/15 shrink-0">
            <CheckCircle2 className="w-5 h-5 text-success-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-surface-900">
              🎉 Your store is live!
            </h2>
            <p className="text-sm text-surface-500 mt-0.5">
              Share your link and start taking orders.
            </p>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors active:scale-[0.98]"
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied!' : 'Copy store link'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    {
      key: 'menu',
      label: 'Add your first dish',
      hint: 'Build your menu so customers can order',
      href: '/menu',
      icon: UtensilsCrossed,
      done: menuDone,
    },
    {
      key: 'payments',
      label: 'Turn on payments',
      hint: 'Connect Paystack to accept card & MoMo',
      href: '/settings/payments',
      icon: CreditCard,
      done: paymentsDone,
    },
    {
      key: 'branding',
      label: 'Brand your store',
      hint: 'Add your logo and colors',
      href: '/settings/branding',
      icon: Palette,
      done: brandingDone,
    },
    {
      key: 'share',
      label: 'Share your link',
      hint: 'Get your QR code and start receiving orders',
      href: '/share',
      icon: Store,
      done: shareDone,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="bg-white rounded-2xl border border-hairline shadow-card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-5 border-b border-surface-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-500" />
          <h2 className="text-lg font-semibold text-surface-900">
            Get your store live
          </h2>
        </div>
        <p className="text-sm text-surface-500 mt-1">
          {doneCount} of {steps.length} done — finish setup to start selling.
        </p>
        <div className="mt-3 h-2 w-full rounded-full bg-surface-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-surface-100">
        {steps.map((step) => {
          const Icon = step.icon;
          const showSeed = step.key === 'menu' && !step.done;
          return (
            <div key={step.key}>
              <Link
                href={step.href}
                className="flex items-center gap-4 p-4 hover:bg-surface-50 transition-colors group"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    step.done
                      ? 'bg-success-500/15 text-success-600'
                      : 'bg-brand-500/10 text-brand-600'
                  }`}
                >
                  {step.done ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-medium ${
                      step.done
                        ? 'text-surface-400 line-through'
                        : 'text-surface-900 group-hover:text-brand-600'
                    } transition-colors`}
                  >
                    {step.label}
                  </p>
                  {!step.done && (
                    <p className="text-sm text-surface-400">{step.hint}</p>
                  )}
                </div>
                {!step.done && (
                  <ChevronRight className="w-5 h-5 text-surface-300 group-hover:text-brand-500 transition-colors shrink-0" />
                )}
              </Link>

              {showSeed && (
                <div className="px-4 pb-4 -mt-1 pl-[68px]">
                  <button
                    onClick={handleSeedSample}
                    disabled={seeding}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-500/30 bg-brand-500/5 text-brand-600 text-xs font-semibold hover:bg-brand-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {seeding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {seeding ? 'Adding…' : 'Add a sample menu for me'}
                  </button>
                  {seedError && (
                    <p className="text-xs text-error-600 mt-2">{seedError}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
