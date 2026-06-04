import { cn } from '@/lib/utils';

type Tone = 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

const tones: Record<Tone, string> = {
  brand: 'bg-brand-500/10 text-brand-600',
  success: 'bg-success-500/10 text-success-600',
  warning: 'bg-warning-500/10 text-warning-600',
  error: 'bg-error-500/10 text-error-600',
  info: 'bg-info-500/10 text-info-600',
  neutral: 'bg-surface-100 text-surface-600',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: { tone?: Tone } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
