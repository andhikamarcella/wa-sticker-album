'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/useToast';

interface PublicDownloadButtonProps {
  stickerIds: string[];
  albumName: string;
}

export function PublicDownloadButton({ stickerIds, albumName }: PublicDownloadButtonProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const response = await fetch('/api/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stickerIds, packName: albumName })
    });
    setLoading(false);
    if (!response.ok) {
      showToast({ title: 'Gagal', description: 'Tidak dapat membuat ZIP', variant: 'destructive' });
      return;
    }
    const data = await response.json();
    if (data.url) {
      window.open(data.url, '_blank');
    }
  };

  return (
    <Button variant="outline" onClick={handleClick} disabled={loading || stickerIds.length === 0}>
      {loading ? 'Menyiapkan...' : 'Download Semua'}
    </Button>
  );
}
