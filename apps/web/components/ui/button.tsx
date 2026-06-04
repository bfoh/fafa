'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  brandColor?: string;
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-xs rounded-lg gap-1.5',
  md: 'h-11 px-5 text-sm rounded-xl gap-2',
  lg: 'h-14 px-6 text-base rounded-2xl gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  brandColor,
  className,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-semibold press select-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
  const brand = brandColor || '#FF6B35';
  const variantClass =
    variant === 'secondary'
      ? 'bg-white text-surface-800 border border-hairline hover:bg-surface-50'
      : variant === 'ghost'
      ? 'bg-transparent text-surface-600 hover:bg-surface-100'
      : variant === 'danger'
      ? 'bg-error-600 text-white hover:bg-error-700'
      : 'text-white shadow-sm hover:brightness-105';
  const brandStyle =
    variant === 'primary'
      ? { backgroundImage: `linear-gradient(135deg, ${brand}, ${brand}dd)`, ...style }
      : style;
  return (
    <button
      className={cn(base, sizes[size], variantClass, className)}
      style={brandStyle}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
