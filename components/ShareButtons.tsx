'use client';

import { useState } from 'react';
import { Copy, QrCode, Share2, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useToast } from '@/hooks/useToast';

interface ShareButtonsProps {
  albumId: string;
  albumName: string;
  publicUrl: string;
}

export function ShareButtons({ albumId, albumName, publicUrl }: ShareButtonsProps) {
  const { showToast } = useToast();
  const [qrData, setQrData] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    showToast({ title: 'Tautan disalin', variant: 'success' });
  };

  const shareWhatsapp = async () => {
    setLoading(true);
    const response = await fetch('/api/share/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ albumUrl: publicUrl, albumName })
    });
    setLoading(false);
    if (!response.ok) {
      showToast({ title: 'Gagal', description: 'Tidak dapat membuat tautan WhatsApp', variant: 'destructive' });
      return;
    }
    const data = await response.json();
    window.open(data.waUrl, '_blank');
    setQrData(data.qrDataUrl);
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={copyLink} variant="secondary">
        <Copy className="mr-2 h-4 w-4" /> Salin Link
      </Button>
      <Button onClick={shareWhatsapp} disabled={loading}>
        <Smartphone className="mr-2 h-4 w-4" /> {loading ? 'Menyiapkan...' : 'Bagikan ke WhatsApp'}
      </Button>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">
            <QrCode className="mr-2 h-4 w-4" /> QR Code
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR Code Album</DialogTitle>
            <DialogDescription>Pindai untuk membuka album ini.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {qrData ? (
              <img src={qrData} alt="QR" className="h-48 w-48" />
            ) : (
              <p className="text-sm text-muted-foreground">Bagikan ke WhatsApp terlebih dahulu untuk membuat QR.</p>
            )}
            <a href={publicUrl} className="text-sm text-primary underline" target="_blank" rel="noreferrer">
              {publicUrl}
            </a>
          </div>
        </DialogContent>
      </Dialog>
      <Button variant="ghost" onClick={() => window.open(publicUrl, '_blank')}>
        <Share2 className="mr-2 h-4 w-4" /> Buka Publik
      </Button>
    </div>
  );
}
