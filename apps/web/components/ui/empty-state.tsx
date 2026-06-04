import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('text-center py-12 px-6', className)}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4 text-surface-400">
          {icon}
        </div>
      )}
      <p className="font-semibold text-surface-900">{title}</p>
      {description && <p className="text-sm text-surface-500 mt-1">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
