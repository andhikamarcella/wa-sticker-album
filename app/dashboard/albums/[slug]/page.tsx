import { redirect } from 'next/navigation';

export default function DashboardAlbumRedirect({ params }: { params: { slug: string } }) {
  redirect(`/albums/${params.slug}`);
}
