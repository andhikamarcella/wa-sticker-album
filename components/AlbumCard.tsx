import Link from 'next/link';
import Image from 'next/image';
import { MoreVertical, Shield, Users } from 'lucide-react';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Button } from './ui/button';

export interface AlbumCardProps {
  id: string;
  slug: string;
  name: string;
  cover_url?: string | null;
  visibility: 'public' | 'unlisted' | 'private';
  hideActions?: boolean;
}

const visibilityMap: Record<AlbumCardProps['visibility'], { label: string; icon: React.ReactNode }> = {
  public: { label: 'Publik', icon: <Users className="h-4 w-4" /> },
  unlisted: { label: 'Tersembunyi', icon: <Shield className="h-4 w-4" /> },
  private: { label: 'Pribadi', icon: <Shield className="h-4 w-4" /> }
};

export function AlbumCard({ id, slug, name, cover_url, visibility, hideActions = false }: AlbumCardProps) {
  const visibilityProps = visibilityMap[visibility];
  const publicLink = `/albums/${slug}`;
  const manageLink = `/albums/${id}`;
  return (
    <Card className="overflow-hidden transition hover:-translate-y-1 hover:shadow-lg">
      <Link href={hideActions ? publicLink : manageLink} className="block">
        <div className="relative h-48 w-full overflow-hidden bg-muted">
          {cover_url ? (
            <Image src={cover_url} alt={name} fill className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">No cover</div>
          )}
        </div>
      </Link>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">{name}</CardTitle>
          <Badge className="mt-2 flex items-center gap-1">
            {visibilityProps.icon}
            {visibilityProps.label}
          </Badge>
        </div>
        {!hideActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={manageLink}>Kelola</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={publicLink}>Lihat Publik</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{hideActions ? `Slug: ${slug}` : `ID: ${id}`}</p>
      </CardContent>
    </Card>
  );
}
