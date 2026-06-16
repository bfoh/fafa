'use client';

import { useEffect, useState } from 'react';

/**
 * Tiny module-level signal for "is a full-screen overlay open?" (cart drawer,
 * chop-bar customiser, bottom sheets). Floating UI like the Fafa concierge
 * button subscribes and hides while a sheet is open, so it never covers the
 * sheet's controls (e.g. the cart's quantity stepper). Module-level so unrelated
 * components coordinate without prop-drilling.
 */
let count = 0;
const subscribers = new Set<(open: boolean) => void>();

function emit() {
  const open = count > 0;
  subscribers.forEach((fn) => fn(open));
}

export function subscribeOverlay(fn: (open: boolean) => void): () => void {
  subscribers.add(fn);
  fn(count > 0);
  return () => {
    subscribers.delete(fn);
  };
}

/** Count this overlay as open while `active` is true; auto-releases on cleanup. */
export function useOverlayLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    count += 1;
    emit();
    return () => {
      count = Math.max(0, count - 1);
      emit();
    };
  }, [active]);
}

/** Reactive: true while any overlay registered via useOverlayLock is open. */
export function useAnyOverlayOpen(): boolean {
  const [open, setOpen] = useState(count > 0);
  useEffect(() => subscribeOverlay(setOpen), []);
  return open;
}
