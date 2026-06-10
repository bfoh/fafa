'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

const DISMISS_KEY = 'didi_install_dismissed_v2';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    // Inside the native Capacitor shell the app is ALREADY installed — a PWA
    // "Add to Home Screen" prompt makes no sense there and it was covering the
    // Fafa concierge button. Never show it in the native app.
    const isNative = !!(
      window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
    ).Capacitor?.isNativePlatform?.();
    if (isNative) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* ignore */
    }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS Safari non-standard flag
      window.navigator.standalone === true;
    if (standalone) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    // iOS has no beforeinstallprompt — detect iOS Safari and show a manual hint.
    // (iPadOS 13+ reports as "MacIntel" with touch points; other iOS browsers —
    // Chrome/Firefox/Edge/Opera — can't Add to Home Screen, so skip them.)
    const ua = window.navigator.userAgent;
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isOtherIOSBrowser = /crios|fxios|edgios|opios|mercury/i.test(ua);
    if (isIOS && !isOtherIOSBrowser) {
      const t = setTimeout(() => {
        setIosHint(true);
        setShow(true);
      }, 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBIP);
      };
    }
    return () => window.removeEventListener('beforeinstallprompt', onBIP);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="md:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-[55] animate-slide-up">
      <div className="flex items-center gap-3 rounded-2xl bg-white text-surface-900 shadow-2xl border border-surface-100 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Install Didi</p>
          {iosHint ? (
            <p className="text-xs text-surface-500 flex items-center gap-1">
              Tap <Share className="w-3.5 h-3.5 inline" /> then “Add to Home
              Screen”
            </p>
          ) : (
            <p className="text-xs text-surface-500">
              Add to your home screen for the app experience.
            </p>
          )}
        </div>
        {!iosHint && (
          <button
            onClick={install}
            className="shrink-0 flex items-center gap-1.5 px-3.5 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white text-xs font-bold active:scale-95 transition-transform"
          >
            <Download className="w-4 h-4" /> Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 w-8 h-8 grid place-items-center rounded-lg hover:bg-surface-100"
        >
          <X className="w-4 h-4 text-surface-400" />
        </button>
      </div>
    </div>
  );
}
