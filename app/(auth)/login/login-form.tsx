'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';

export default function LoginForm() {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Selalu pakai domain yang konsisten
  const redirectOrigin = useMemo(() => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl && siteUrl.length > 0) {
      return siteUrl;
    }

    if (typeof window !== 'undefined' && window.location) {
      return window.location.origin;
    }

    return 'http://localhost:3000';
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    if (!supabase) {
      showToast({
        title: 'Konfigurasi belum lengkap',
        description: 'Supabase belum terkonfigurasi. Hubungi administrator.',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: new URL('/auth/callback', redirectOrigin).toString(),
        },
      });
      if (error) throw error;

      showToast({
        title: 'Email terkirim',
        description: 'Cek inbox kamu dan klik magic link terbaru.',
        variant: 'success',
      });
    } catch (err: any) {
      showToast({
        title: 'Gagal login',
        description: err?.message ?? 'Terjadi kesalahan.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@kamu.com"
        disabled={loading}
        required
      />
      <Button type="submit" disabled={loading}>
        {loading ? 'Mengirim…' : 'Kirim Magic Link'}
      </Button>
    </form>
  );
}
