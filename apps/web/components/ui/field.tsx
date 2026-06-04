'use client';

import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, optional, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-surface-700">
        {label}
        {optional && <span className="text-surface-400 font-normal"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-error-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-surface-400">{hint}</p>
      ) : null}
    </div>
  );
}

export const fieldInputClass =
  'w-full px-4 py-3 rounded-xl border border-hairline bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 transition-all text-sm';
