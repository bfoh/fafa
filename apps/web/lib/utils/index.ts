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
