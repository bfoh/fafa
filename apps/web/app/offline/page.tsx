export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <div className="min-h-[100dvh] grid place-items-center bg-[#0b0910] text-white px-6 text-center">
      <div>
        <div className="text-5xl mb-4">📶</div>
        <h1 className="text-xl font-bold">You&apos;re offline</h1>
        <p className="text-white/50 mt-2 text-sm">
          Check your connection and try again. Didi needs the internet to load
          kitchens.
        </p>
      </div>
    </div>
  );
}
