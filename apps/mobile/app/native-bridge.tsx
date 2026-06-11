'use client';

import { useDeepLinks } from './hooks/use-deep-links';

export function NativeBridge() {
  useDeepLinks();
  return null;
}
