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

  const signInWithEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setLoading(false);
    if (error) {
      showToast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      showToast({ title: 'Email terkirim', description: 'Cek inbox kamu untuk masuk.', variant: 'success' });
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) {
      showToast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card p-10 shadow-xl">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-primary">Masuk</p>
        <h1 className="text-2xl font-semibold">WA Sticker Album</h1>
        <p className="text-sm text-muted-foreground">Gunakan email atau Google untuk melanjutkan.</p>
      </div>
      <form onSubmit={signInWithEmail} className="space-y-4">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nama@contoh.com"
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Mengirim...' : 'Kirim Magic Link'}
        </Button>
      </form>
      <div className="relative text-center text-xs text-muted-foreground">
        <span className="bg-card px-2">atau</span>
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border" aria-hidden />
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={signInWithGoogle}>
        Masuk dengan Google
      </Button>
    </div>
  );
}
