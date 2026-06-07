'use client';

import { usePush } from './hooks/use-push';
import { useDeepLinks } from './hooks/use-deep-links';

/**
 * Mounts the native integrations (push registration + deep-link routing) once,
 * at the app root. Renders nothing. All hooks are no-ops off-device, so this is
 * safe in the static export / web dev.
 */
export function NativeBridge() {
  usePush();
  useDeepLinks();
  return null;
}
