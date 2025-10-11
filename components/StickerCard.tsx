'use client';

import Image from 'next/image';
import { ArrowDown, ArrowUp, Check, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StickerCardProps {
  id: string;
  thumbUrl: string | null;
  title?: string | null;
  selected: boolean;
  onSelectToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function StickerCard({
  thumbUrl,
  title,
  selected,
  onSelectToggle,
  onMoveDown,
  onMoveUp,
  onDelete,
}: StickerCardProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-3xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/60',
        selected && 'ring-2 ring-primary',
      )}
    >
      <button
        type="button"
        onClick={onSelectToggle}
        aria-pressed={selected}
        className={cn(
          'absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-muted-foreground transition hover:border-primary hover:bg-primary hover:text-primary-foreground',
          selected && 'border-primary bg-primary text-primary-foreground',
        )}
      >
        {selected && <Check className="h-4 w-4" />}
        {!selected && <span className="text-xs font-medium">Pilih</span>}
      </button>

      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted">
        {thumbUrl ? (
          <Image
            src={thumbUrl}
            alt={title ?? 'Sticker'}
            fill
            sizes="(min-width: 1024px) 160px, (min-width: 768px) 25vw, 45vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Tidak ada preview
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <p className="truncate font-medium text-foreground">{title ?? 'Sticker'}</p>
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onMoveUp}
            aria-label="Geser ke atas"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onMoveDown}
            aria-label="Geser ke bawah"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            aria-label="Hapus sticker"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default StickerCard;
