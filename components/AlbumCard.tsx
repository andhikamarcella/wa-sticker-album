'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { CalendarClock, EllipsisVertical, Globe2, Link2, Lock, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatCount } from '@/lib/utils';

export type AlbumVisibility = 'public' | 'unlisted' | 'private';

export type AlbumCardProps = {
  id: string;
  name: string;
  slug: string;
  visibility: AlbumVisibility;
  updatedAt: string;
  stickersCount?: number;
  thumbnails?: string[];
  onRename?: (albumId: string) => void;
  onShare?: (albumId: string) => void;
  onDelete?: (albumId: string) => void;
  href?: string;
};

const visibilityConfig: Record<AlbumVisibility, { label: string; icon: JSX.Element; badgeClass: string }> = {
  public: {
    label: 'Public',
    icon: <Globe2 className="h-3.5 w-3.5" aria-hidden />,
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  unlisted: {
    label: 'Unlisted',
    icon: <Link2 className="h-3.5 w-3.5" aria-hidden />,
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  private: {
    label: 'Private',
    icon: <Lock className="h-3.5 w-3.5" aria-hidden />,
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  },
};

const fallbackColors = ['bg-rose-200/60', 'bg-sky-200/60', 'bg-emerald-200/60', 'bg-violet-200/60'];

export function AlbumCard({
  id,
  name,
  slug,
  visibility,
  updatedAt,
  stickersCount,
  thumbnails,
  href,
  onRename,
  onShare,
  onDelete,
}: AlbumCardProps) {
  const previewSources = useMemo(() => (thumbnails ?? []).filter(Boolean).slice(0, 6), [thumbnails]);
  const visibilityProps = visibilityConfig[visibility];
  const albumHref = href ?? `/albums/${slug}`;

  const readableUpdatedAt = useMemo(() => {
    if (!updatedAt) {
      return '—';
    }

    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }, [updatedAt]);

  const handleRename = () => onRename?.(id);
  const handleShare = () => onShare?.(id);
  const handleDelete = () => onDelete?.(id);

  return (
    <Card className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border/80 bg-card/80 shadow-sm transition-all hover:-translate-y-1 hover:border-border hover:shadow-md">
      <Link
        href={albumHref}
        prefetch={false}
        className="relative block aspect-[3/2] bg-muted"
        aria-label={`Open album ${name}`}
      >
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-px overflow-hidden bg-border/40 p-2">
          {Array.from({ length: 6 }).map((_, index) => {
            const src = previewSources[index];
            return (
              <div
                key={index}
                className={cn(
                  'relative overflow-hidden rounded-xl bg-muted/80',
                  !src && fallbackColors[index % fallbackColors.length],
                )}
              >
                {src ? (
                  <Image
                    src={src}
                    alt={`${name} preview ${index + 1}`}
                    fill
                    loading="lazy"
                    sizes="(min-width: 1024px) 12vw, (min-width: 640px) 22vw, 40vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                    {name.slice(0, 2).toUpperCase() || 'SA'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Link>
      <CardHeader className="flex flex-col gap-3 space-y-0 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={albumHref}
              prefetch={false}
              className="min-w-0 truncate text-base font-semibold leading-tight transition hover:text-primary"
              aria-label={`Open album ${name}`}
            >
              {name}
            </Link>
            <Badge className={cn('flex items-center gap-1 whitespace-nowrap border-none px-2 py-0.5 text-xs', visibilityProps.badgeClass)}>
              {visibilityProps.icon}
              {visibilityProps.label}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" aria-hidden />
              <span>{formatCount(stickersCount ?? 0)} stickers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              <span>Updated {readableUpdatedAt}</span>
            </div>
          </div>
        </div>
        {(onRename || onShare || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full border border-transparent text-muted-foreground transition hover:border-border/80 hover:text-foreground"
                aria-label={`Album actions for ${name}`}
              >
                <EllipsisVertical className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur">
              {onRename && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={(event) => {
                    event.preventDefault();
                    handleRename();
                  }}
                >
                  Rename
                </DropdownMenuItem>
              )}
              {onShare && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={(event) => {
                    event.preventDefault();
                    handleShare();
                  }}
                >
                  Share
                </DropdownMenuItem>
              )}
              {(onRename || onShare) && onDelete && <DropdownMenuSeparator />}
              {onDelete && (
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onSelect={(event) => {
                    event.preventDefault();
                    handleDelete();
                  }}
                >
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="truncate text-xs text-muted-foreground">/{slug}</p>
      </CardContent>
    </Card>
  );
}
