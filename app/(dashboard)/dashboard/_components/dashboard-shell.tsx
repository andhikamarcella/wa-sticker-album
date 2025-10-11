'use client';

import { useMemo, useState } from 'react';

import { NavBar } from '@/components/NavBar';
import { AlbumGrid } from '@/components/AlbumGrid';

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
          <AlbumGrid search={searchValue} />
        </div>
      </main>
    </div>
  );
}
