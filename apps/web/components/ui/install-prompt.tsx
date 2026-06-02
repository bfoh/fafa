'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

const DISMISS_KEY = 'didi_install_dismissed';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
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

    // iOS Safari has no beforeinstallprompt — detect and show a manual hint.
    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios/i.test(ua);
    if (isIOS && isSafari) {
      const t = setTimeout(() => {
        setIosHint(true);
        setShow(true);
      }, 3000);
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
