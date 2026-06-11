import Link from 'next/link';
import { Moon, Sun, ArrowRight } from 'lucide-react';

export const metadata = { title: 'Didi — Redesign preview' };

export default function RedesignChooser() {
  return (
    <div className="min-h-[100dvh] grid place-items-center px-5 py-10 text-white" style={{ backgroundColor: '#0b0910' }}>
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-orange-300/80 mb-2">Phase 1 · Marketplace landing</p>
          <h1 className="text-3xl font-extrabold">Pick a direction</h1>
          <p className="text-white/50 mt-2 text-sm max-w-md mx-auto">
            Same content + data, two design directions. Open each, compare on your phone and desktop, then tell me which to ship.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/redesign/dark"
            className="group rounded-3xl border border-white/12 bg-white/[0.05] p-6 hover:border-orange-400/50 hover:bg-white/[0.08] transition"
          >
            <div className="w-12 h-12 rounded-2xl grid place-items-center mb-4 bg-gradient-to-br from-orange-400 to-orange-600">
              <Moon className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-bold">Refined dark premium</h2>
            <p className="text-sm text-white/50 mt-1.5">Your current dark + orange identity, elevated — cleaner hierarchy, trust strip, polished cards.</p>
            <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-orange-300 group-hover:gap-2.5 transition-all">
              View dark <ArrowRight className="w-4 h-4" />
            </span>
          </Link>

          <Link
            href="/redesign/light"
            className="group rounded-3xl border border-white/12 bg-white/[0.05] p-6 hover:border-blue-400/50 hover:bg-white/[0.08] transition"
          >
            <div className="w-12 h-12 rounded-2xl grid place-items-center mb-4 bg-gradient-to-br from-orange-400 to-blue-500">
              <Sun className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-bold">Vibrant light marketplace</h2>
            <p className="text-sm text-white/50 mt-1.5">Warm light base, orange + trust-blue, bold blocks — bright, fresh, conversion-focused.</p>
            <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-blue-300 group-hover:gap-2.5 transition-all">
              View light <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>

        <p className="text-center text-xs text-white/35 mt-8">
          Preview only · production (ghdidi.com) is untouched · functionality unchanged
        </p>
      </div>
    </div>
  );
}
