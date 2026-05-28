import Link from 'next/link';
import {
  QrCode,
  Smartphone,
  CreditCard,
  BarChart3,
  ShoppingBag,
  Zap,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

export default function LandingPage() {
  const features = [
    {
      icon: QrCode,
      title: 'QR Code & Links',
      desc: 'Share your menu via QR code or a simple link. Customers scan and order instantly.',
    },
    {
      icon: Smartphone,
      title: 'Mobile Money',
      desc: 'Accept MTN MoMo, Vodafone Cash, and AirtelTigo Money. Ghana\'s preferred payments.',
    },
    {
      icon: CreditCard,
      title: 'Card Payments',
      desc: 'Visa and Mastercard accepted via Paystack. Or let customers pay at delivery.',
    },
    {
      icon: ShoppingBag,
      title: 'Order Management',
      desc: 'Real-time dashboard. See orders as they come in. Confirm, prepare, and deliver.',
    },
    {
      icon: BarChart3,
      title: 'Customer Insights',
      desc: 'Track your regulars. See popular items. Understand your business.',
    },
    {
      icon: Zap,
      title: 'SMS Notifications',
      desc: 'Customers get SMS updates at every step. No app download needed.',
    },
  ];

  const steps = [
    { num: '01', title: 'Sign up free', desc: 'Create your restaurant account in 2 minutes.' },
    { num: '02', title: 'Add your menu', desc: 'Upload your dishes, prices, and photos.' },
    { num: '03', title: 'Share your QR code', desc: 'Print it, share it on WhatsApp, or post it in your shop.' },
    { num: '04', title: 'Receive orders', desc: 'Customers order and pay. You deliver. Done.' },
  ];

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b border-surface-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-brand-500">
            Fafa
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors px-4 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 px-5 py-2.5 rounded-xl transition-all active:scale-[0.98]"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-brand-50" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 text-brand-600 text-sm font-medium mb-6 animate-fade-in">
              <span>🇬🇭</span>
              <span>Built for Ghana&apos;s food businesses</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-surface-900 tracking-tight leading-tight animate-fade-in">
              Accept food orders{' '}
              <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
                online
              </span>
              , the easy way
            </h1>

            <p className="mt-6 text-lg text-surface-500 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Share your QR code. Customers scan, order, and pay with Mobile
              Money or Card. No app download. No complicated setup. Just more
              orders.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <Link
                href="/register"
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-brand-500 text-white font-semibold text-lg hover:bg-brand-600 transition-all active:scale-[0.98] shadow-lg shadow-brand-500/20"
              >
                Start for Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-sm text-surface-400">
                No credit card required · Set up in 5 minutes
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-surface-900">
              How it works
            </h2>
            <p className="text-surface-500 mt-2">
              From sign-up to first order in under 5 minutes
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-brand-500">
                    {step.num}
                  </span>
                </div>
                <h3 className="font-semibold text-surface-900">{step.title}</h3>
                <p className="text-sm text-surface-500 mt-1">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-surface-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-surface-900">
              Everything you need
            </h2>
            <p className="text-surface-500 mt-2">
              Built for how Ghanaian food businesses actually work
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-white rounded-2xl p-6 border border-surface-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-brand-500" />
                  </div>
                  <h3 className="font-semibold text-surface-900">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-surface-500 mt-2">
                    {feature.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-surface-900">
              Simple pricing
            </h2>
            <p className="text-surface-500 mt-2">
              Free to start. Pay only when you earn.
            </p>
          </div>

          <div className="max-w-md mx-auto bg-gradient-to-br from-surface-900 to-surface-800 rounded-3xl p-8 text-white">
            <p className="text-sm text-surface-400 font-medium uppercase tracking-wider">
              Standard Plan
            </p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold">2%</span>
              <span className="text-surface-400">per transaction</span>
            </div>
            <p className="text-sm text-surface-400 mt-2">
              No monthly fees. No setup costs. No hidden charges.
            </p>

            <div className="mt-8 space-y-3">
              {[
                'Unlimited menu items',
                'Unlimited orders',
                'QR code & link sharing',
                'Mobile Money + Card payments',
                'SMS notifications',
                'Customer management',
                'Analytics dashboard',
                'Branded storefront',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success-500 flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>

            <Link
              href="/register"
              className="mt-8 flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-all active:scale-[0.98]"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-brand-500 to-brand-700">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl font-bold">
            Ready to grow your food business?
          </h2>
          <p className="mt-3 text-brand-100 text-lg">
            Join restaurants across Ghana already using Fafa to accept
            orders online.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 mt-8 px-8 py-3.5 rounded-2xl bg-white text-brand-600 font-semibold text-lg hover:bg-brand-50 transition-all active:scale-[0.98] shadow-xl"
          >
            Create Your Free Account
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-900 text-surface-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xl font-bold text-white">Fafa</span>
            <p className="text-sm mt-1">Food ordering made simple 🇬🇭</p>
          </div>
          <p className="text-sm">
            © {new Date().getFullYear()} Fafa. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
