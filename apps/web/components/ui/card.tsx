import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const pads = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6' } as const;

export function Card({ interactive, padding = 'md', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-hairline shadow-card',
        interactive && 'lift cursor-pointer',
        pads[padding],
        className
      )}
      {...props}
    />
  );
}
