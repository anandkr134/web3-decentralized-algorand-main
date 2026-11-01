'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

export function DashboardRouterClient() {
  const router = useRouter();
  const { status, user, role } = useAuth();

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    if (!user) {
      router.replace('/auth?next=/dashboard');
      return;
    }

    if (!role) {
      router.replace('/auth?next=/dashboard');
      return;
    }

    router.replace(role === 'freelancer' ? '/dashboard/freelancer' : '/dashboard/client');
  }, [role, router, status, user]);

  return (
    <div className="rounded-3xl border-[4px] border-black bg-surface-container p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      Routing you to the right dashboard...
    </div>
  );
}
