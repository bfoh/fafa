import { type ClassValue, clsx } from 'clsx';

/**
 * Merge class names conditionally.
 * Lightweight alternative to clsx + twMerge.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format a date relative to now (e.g. "3 min ago")
 */
export function timeAgo(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return d.toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format a date for display
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a date+time for display
 */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Resolves the base URL dynamically:
 * 1. process.env.NEXT_PUBLIC_URL if defined (with localhost/browser bypass check)
 * 2. window.location.origin if in browser context
 * 3. https://{process.env.NEXT_PUBLIC_VERCEL_URL} if running on Vercel (server context)
 * 4. Fallback to http://localhost:3000
 */
export function getBaseUrl(): string {
  // 1. If NEXT_PUBLIC_URL is explicitly set
  if (process.env.NEXT_PUBLIC_URL) {
    if (typeof window !== 'undefined' && window.location) {
      const isLocalhostEnv = process.env.NEXT_PUBLIC_URL.includes('localhost') || process.env.NEXT_PUBLIC_URL.includes('127.0.0.1');
      const isLocalhostWindow = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      // If env is default localhost but the user accessed the site on a real deployment,
      // override with the browser's active hostname
      if (isLocalhostEnv && !isLocalhostWindow) {
        return window.location.origin;
      }
    }
    return process.env.NEXT_PUBLIC_URL;
  }

  // 2. Browser origin fallback
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }

  // 3. Vercel deployment URL (useful on server-side SSR / metadata)
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    const host = process.env.NEXT_PUBLIC_VERCEL_URL;
    return host.startsWith('http') ? host : `https://${host}`;
  }

  return 'http://localhost:3000';
}

