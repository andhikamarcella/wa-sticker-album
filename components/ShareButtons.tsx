'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';

export type ShareButtonsProps = {
  publicUrl: string;
  waUrl?: string;
  [key: string]: unknown;
};

export function ShareButtons({ publicUrl, waUrl }: ShareButtonsProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const shareUrl = useMemo(() => {
    if (waUrl && waUrl.trim().length > 0) {
      return waUrl.trim();
    }

    return `https://wa.me/?text=${encodeURIComponent(publicUrl)}`;
  }, [publicUrl, waUrl]);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicUrl);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = publicUrl;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopied(true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);

      showToast({
        title: 'Link copied',
        description: 'The public album link is ready to share.',
        variant: 'success',
      });
    } catch (error) {
      showToast({
        title: 'Unable to copy link',
        description:
          error instanceof Error ? error.message : 'Please copy the link manually.',
        variant: 'destructive',
      });
    }
  };

  const handleWhatsAppShare = () => {
    const targetUrl = shareUrl;
    if (!targetUrl) {
      showToast({
        title: 'Cannot open WhatsApp',
        description: 'No share URL available yet.',
        variant: 'destructive',
      });
      return;
    }

    if (typeof window !== 'undefined') {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex w-full flex-col gap-3 rounded-3xl border border-border/80 bg-card/80 p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4">
      <div className="flex-1 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Public link</p>
        <Input
          value={publicUrl}
          readOnly
          className="h-11 rounded-2xl border-muted bg-muted/40 font-mono text-xs text-muted-foreground sm:text-sm"
        />
      </div>
      <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant={copied ? 'secondary' : 'outline'}
          onClick={handleCopy}
          className="h-11 w-full rounded-full px-5 sm:w-auto sm:min-w-[140px]"
        >
          <Copy className="mr-2 h-4 w-4" aria-hidden />
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button
          type="button"
          onClick={handleWhatsAppShare}
          className="h-11 w-full rounded-full px-5 sm:w-auto sm:min-w-[140px]"
        >
          <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
          WhatsApp
        </Button>
      </div>
    </div>
  );
}
