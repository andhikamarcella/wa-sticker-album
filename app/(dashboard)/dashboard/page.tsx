import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlbumCard } from '@/components/AlbumCard';
import { AlbumWizard } from '@/components/AlbumWizard';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

export default async function DashboardPage() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: albums } = await supabase
    .from('albums')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Album Kamu</h1>
          <p className="text-sm text-muted-foreground">
            Kelola koleksi sticker dan bagikan ke teman lewat WhatsApp.
          </p>
        </div>
        <AlbumWizard>
          <Button size="lg">Buat Album</Button>
        </AlbumWizard>
      </div>
      {albums && albums.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <AlbumCard key={album.id} {...album} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-background p-16 text-center">
          <p className="text-lg font-semibold">Belum ada album</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Mulai dengan membuat album baru dan unggah sticker pertama kamu.
          </p>
          <AlbumWizard>
            <Button className="mt-6">Buat Album Pertama</Button>
          </AlbumWizard>
          <div className="mt-6 text-xs text-muted-foreground">
            Butuh inspirasi?{' '}
            <Link href="/(public)/albums" className="text-primary underline">
              Lihat album publik
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
