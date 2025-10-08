import { cn } from '@/lib/utils';

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div
        className={cn('h-2 rounded-full bg-primary transition-all')}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
