'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ThemeToggle } from './ThemeToggle';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { createClient } from '@/lib/supabaseClient';

export function NavBar() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (query) {
        params.set('q', query);
      } else {
        params.delete('q');
      }
      router.push(`?${params.toString()}`);
    }, 400);
    return () => clearTimeout(timeout);
  }, [query, router]);

  const supabase = createClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <span className="rounded-full bg-primary px-2 py-1 text-xs uppercase tracking-wide text-primary-foreground">
            WA
          </span>
          Sticker Album
        </Link>
        <div className="hidden flex-1 items-center gap-3 md:flex">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari album..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/dashboard">Dashboard</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}>Keluar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
