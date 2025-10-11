'use client';

import { type ChangeEvent, useMemo } from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';

import { ThemeToggle } from './ThemeToggle';
import { Input } from './ui/input';

export type NavBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  userLabel?: string | null;
};

export function NavBar({ searchValue, onSearchChange, userLabel }: NavBarProps) {
  const initials = useMemo(() => {
    const source = userLabel?.trim();
    if (!source) {
      return '?';
    }

    const [firstWord] = source.split(/\s+/);
    return firstWord?.charAt(0)?.toUpperCase() || '?';
  }, [userLabel]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  return (
    <header className="w-full px-4 py-4">
      <div
        className={cn(
          'mx-auto flex w-full max-w-6xl flex-col gap-4 rounded-3xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur-sm transition-colors',
          'md:flex-row md:items-center md:justify-between md:gap-6',
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">Sticker Album</span>
            <span className="text-xs text-muted-foreground">Organize and share your WhatsApp stickers</span>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
              {initials}
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={handleChange}
              placeholder="Search albums"
              className="h-11 rounded-2xl border-border pl-10"
              aria-label="Search albums"
            />
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
              {initials}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
