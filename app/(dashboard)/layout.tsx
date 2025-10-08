import { NavBar } from '@/components/NavBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-10">{children}</div>
      </main>
    </div>
  );
}
