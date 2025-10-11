'use client';

import { Suspense, useMemo, useState } from 'react';

import { NavBar } from '@/components/NavBar';
import { Skeleton } from '@/components/ui/skeleton';

type DashboardShellProps = {
  userLabel?: string | null;
};

export function DashboardShell({ userLabel }: DashboardShellProps) {
  const [searchValue, setSearchValue] = useState('');
  const normalizedLabel = useMemo(() => userLabel?.trim() || undefined, [userLabel]);

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <NavBar searchValue={searchValue} onSearchChange={setSearchValue} userLabel={normalizedLabel} />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <Suspense fallback={<AlbumGridSkeleton />}>
            <div className="rounded-3xl border border-dashed border-border bg-card/40 px-6 py-20 text-center text-muted-foreground">
              Album grid coming soon.
            </div>
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function AlbumGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-40 w-full rounded-3xl" />
      ))}
    </div>
  );
}
