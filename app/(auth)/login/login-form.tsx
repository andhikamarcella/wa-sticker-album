'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';

export default function LoginForm() {
  const supabase = createClient();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Pakai domain yang konsisten (production atau preview) via ENV
  // Pastikan kamu set di Vercel: NEXT_PUBLIC_SITE_URL=https://<domain-kamu>
  const redirectOrigin =
    process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

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
