import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-6 text-center">
      <div className="max-w-2xl space-y-6">
        <p className="text-xs uppercase tracking-[0.4em] text-primary">WA Sticker Album</p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          Buat, kelola, dan bagikan sticker WhatsApp kamu dalam satu tempat.
        </h1>
        <p className="text-base text-muted-foreground">
          Proses otomatis konversi ke WEBP, buat pack, ekspor ke ZIP, dan bagikan lewat tautan atau QR.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard">Masuk Dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/albums">Album Publik</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
