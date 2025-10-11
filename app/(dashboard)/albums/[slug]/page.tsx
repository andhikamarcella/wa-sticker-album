import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getServerClient } from '@/lib/supabaseServer';
import type { Database } from '@/types/database';

interface AlbumPageProps {
  params: {
    slug: string;
  };
}

type AlbumVisibility = Database['public']['Tables']['albums']['Row']['visibility'];
type AlbumSummary = Pick<Database['public']['Tables']['albums']['Row'], 'id' | 'name' | 'visibility'>;

const VISIBILITY_LABEL: Record<AlbumVisibility, string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

export default async function AlbumPage({ params }: AlbumPageProps) {
  const supabase = getServerClient();
  const { data: album, error } = await supabase
    .from('albums')
    .select('id, name, visibility')
    .eq('slug', params.slug)
    .maybeSingle<AlbumSummary>();

  if (error) {
    if (error.code === 'PGRST116' || error.code === '42501') {
      notFound();
    }

    throw error;
  }

  if (!album) {
    notFound();
  }

  return (
    <div className="space-y-10 pb-16">
      <header className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{album.name}</h1>
            <Badge className="rounded-full bg-secondary/80 text-secondary-foreground">
              {VISIBILITY_LABEL[album.visibility]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Album management tools will appear here soon.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-full" type="button">
            Share
          </Button>
          <Button className="rounded-full" type="button">
            Edit
          </Button>
        </div>
      </header>

      <Tabs defaultValue="stickers" className="space-y-6">
        <TabsList className="w-full justify-start gap-2 overflow-x-auto rounded-full bg-muted/60 p-1">
          <TabsTrigger value="stickers" className="rounded-full px-4 py-2">
            Stickers
          </TabsTrigger>
          <TabsTrigger value="pack" className="rounded-full px-4 py-2">
            Pack
          </TabsTrigger>
          <TabsTrigger value="share" className="rounded-full px-4 py-2">
            Share
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-full px-4 py-2">
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stickers" className="focus-visible:outline-none">
          <PlaceholderPanel label="Stickers tools coming soon." />
        </TabsContent>
        <TabsContent value="pack" className="focus-visible:outline-none">
          <PlaceholderPanel label="Pack builder will be available shortly." />
        </TabsContent>
        <TabsContent value="share" className="focus-visible:outline-none">
          <PlaceholderPanel label="Share options will appear here." />
        </TabsContent>
        <TabsContent value="settings" className="focus-visible:outline-none">
          <PlaceholderPanel label="Album settings form coming soon." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-muted-foreground/30 bg-card/40 p-10 text-center text-sm text-muted-foreground">
      <Suspense fallback={null}>{label}</Suspense>
    </div>
  );
}
