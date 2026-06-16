'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useOverlayLock } from '@fafa/storefront/overlay';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Max height of the sheet (default 88dvh). */
  maxHeight?: string;
  /** Hide the default header (drag handle stays). */
  hideHeader?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = '88dvh',
  hideHeader = false,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Hide the floating concierge while this sheet is open.
  useOverlayLock(open);

  // Lock body scroll + close on Escape / Android back.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 bg-white text-surface-900 rounded-t-3xl shadow-2xl animate-slide-up flex flex-col overscroll-contain-y pb-safe"
        style={{ maxHeight }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-300" />
        </div>
        {!hideHeader && (
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-surface-100 shrink-0">
            <h2 className="text-base font-bold">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-10 h-10 grid place-items-center rounded-xl hover:bg-surface-100 active:scale-95 transition-all"
            >
              <X className="w-5 h-5 text-surface-500" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain-y flex-1 scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  );
}
