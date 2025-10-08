import { Suspense } from 'react';
import AuthCallback from './AuthCallback';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm">Menyelesaikan login…</div>}>
      <AuthCallback />
    </Suspense>
  );
}
