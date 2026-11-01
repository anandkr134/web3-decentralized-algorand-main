'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import type { UserRole } from '@/types/profile';

interface RoleGateProps {
  allowedRoles?: UserRole[];
  children: ReactNode;
  title: string;
  description: string;
  authHref?: string;
}

export function RoleGate({
  allowedRoles,
  children,
  title,
  description,
  authHref = '/auth',
}: RoleGateProps) {
  const { status, isConfigured, user, role } = useAuth();

  if (status === 'loading') {
    return (
      <div className="rounded-3xl border-[4px] border-black bg-surface-container p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        Loading secure workspace...
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="rounded-3xl border-[4px] border-black bg-error p-8 text-on-error shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h1 className="font-headline text-3xl uppercase">{title}</h1>
        <p className="mt-4 text-lg">
          Supabase auth is not configured yet. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
          to the frontend environment before using this area.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border-[4px] border-black bg-surface-container p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h1 className="font-headline text-4xl uppercase text-primary-fixed">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-on-surface-variant">{description}</p>
        <Link
          href={authHref}
          className="mt-8 inline-flex rounded-full border-[4px] border-black bg-primary-container px-8 py-4 font-headline text-lg uppercase text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          Sign In To Continue
        </Link>
      </div>
    );
  }

  if (allowedRoles?.length && (!role || !allowedRoles.includes(role))) {
    return (
      <div className="rounded-3xl border-[4px] border-black bg-surface-container-high p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h1 className="font-headline text-4xl uppercase text-primary-fixed">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-on-surface-variant">
          {role
            ? `This workspace is reserved for ${allowedRoles.join(' / ')} accounts. You are signed in as a ${role}.`
            : 'Pick a role before entering this workspace.'}
        </p>
        <Link
          href="/auth"
          className="mt-8 inline-flex rounded-full border-[4px] border-black bg-secondary px-8 py-4 font-headline text-lg uppercase text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          Review Account Role
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
