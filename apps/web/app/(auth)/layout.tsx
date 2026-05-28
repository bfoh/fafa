export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/pattern.svg')] opacity-10" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Fafa</h1>
            <p className="text-brand-100 mt-1 text-lg">Food Ordering Made Simple</p>
          </div>

          <div className="space-y-8">
            <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                  📋
                </div>
                <div>
                  <h3 className="font-semibold">Share Your Menu</h3>
                  <p className="text-sm text-brand-100">
                    Customers scan your QR code or click your link
                  </p>
                </div>
              </div>
            </div>

            <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                  💳
                </div>
                <div>
                  <h3 className="font-semibold">Accept Payments</h3>
                  <p className="text-sm text-brand-100">
                    Mobile Money, Card, or Cash on Delivery
                  </p>
                </div>
              </div>
            </div>

            <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                  📦
                </div>
                <div>
                  <h3 className="font-semibold">Manage Orders</h3>
                  <p className="text-sm text-brand-100">
                    Real-time dashboard with instant notifications
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-brand-200">
            Trusted by restaurants across Ghana 🇬🇭
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-surface-50">
        <div className="w-full max-w-md animate-fade-in">{children}</div>
      </div>
    </div>
  );
}
