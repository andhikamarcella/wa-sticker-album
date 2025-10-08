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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) throw error;
      showToast({
        title: 'Email terkirim',
        description: 'Cek inbox kamu untuk magic link.',
        variant: 'success',
      });
    } catch (err: any) {
      showToast({ title: 'Gagal', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@kamu.com"
        required
      />
      <Button type="submit" disabled={loading}>
        {loading ? 'Mengirim…' : 'Kirim Magic Link'}
      </Button>
    </form>
  );
}
