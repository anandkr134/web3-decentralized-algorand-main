import { Suspense } from 'react';
import { AuthPageClient } from '@/components/auth/AuthPageClient';

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-3xl border-[4px] border-black bg-surface-container p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          Loading auth workspace...
        </div>
      }
    >
      <AuthPageClient />
    </Suspense>
  );
}
