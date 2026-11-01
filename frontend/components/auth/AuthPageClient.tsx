'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import type { UserRole } from '@/types/profile';

type AuthMode = 'signin' | 'signup';

const roleCards: Array<{
  role: UserRole;
  title: string;
  eyebrow: string;
  description: string;
  cta: string;
}> = [
  {
    role: 'client',
    title: 'Hire a Freelancer',
    eyebrow: 'Client Mode',
    description: 'Launch funded bounties, manage submissions, and release rewards when the work is approved.',
    cta: 'Open Client Dashboard',
  },
  {
    role: 'freelancer',
    title: 'Earn Money Freelancing',
    eyebrow: 'Freelancer Mode',
    description: 'Discover open bounties, submit deliverables from your wallet, and track pending or approved work.',
    cta: 'Open Freelancer Dashboard',
  },
];

function normalizeRole(value: string | null): UserRole {
  return value === 'freelancer' ? 'freelancer' : 'client';
}

function normalizeMode(value: string | null): AuthMode {
  return value === 'signin' ? 'signin' : 'signup';
}

function normalizeNextPath(value: string | null) {
  if (!value || !value.startsWith('/')) {
    return '/dashboard';
  }
  return value;
}

export function AuthPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConfigured, user, role, signIn, signOut, signUp, setRole, status } = useAuth();
  const [mode, setMode] = useState<AuthMode>(() => normalizeMode(searchParams.get('mode')));
  const [selectedRole, setSelectedRole] = useState<UserRole>(() => normalizeRole(searchParams.get('role')));
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = useMemo(() => normalizeNextPath(searchParams.get('next')), [searchParams]);

  const pushPostAuth = () => {
    router.push(nextPath);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading(mode === 'signup' ? 'Creating your account...' : 'Signing you in...');

    try {
      if (mode === 'signup') {
        const result = await signUp({
          email,
          password,
          fullName,
          role: selectedRole,
        });

        if (result.session) {
          toast.success('Account ready. Choose your dashboard.', { id: toastId });
          pushPostAuth();
        } else {
          toast.success(result.message || 'Account created. Check your inbox for the confirmation email.', {
            id: toastId,
          });
          setMode('signin');
        }
      } else {
        await signIn({ email, password, roleHint: selectedRole });
        toast.success('Welcome back.', { id: toastId });
        pushPostAuth();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Authentication failed.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleUpdate = async (nextRole: UserRole) => {
    const toastId = toast.loading('Updating your workspace role...');
    try {
      await setRole(nextRole);
      toast.success(`Role updated to ${nextRole}.`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update your role.', {
        id: toastId,
      });
    }
  };

  if (status === 'loading') {
    return (
      <div className="rounded-3xl border-[4px] border-black bg-surface-container p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        Loading auth workspace...
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="font-black uppercase tracking-[0.3em] text-primary-container">Choose Your Lane</p>
          <h1 className="mt-4 font-headline text-5xl uppercase leading-none text-primary-fixed md:text-7xl">
            Two Roles. Two Workflows. One Bounty Engine.
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-on-surface-variant">
            Sign in with Supabase to lock in your account role, then connect Pera when you want to post or complete
            on-chain work.
          </p>
        </div>

        <div className="rounded-3xl border-[4px] border-black bg-surface-container-high p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="font-headline text-3xl uppercase text-primary-fixed">Auth Status</h2>
          <p className="mt-4 text-on-surface-variant">
            {isConfigured
              ? 'Supabase auth is configured for this frontend.'
              : 'Supabase env vars are missing. Add them before using sign-in or role dashboards.'}
          </p>
          {user ? (
            <div className="mt-6 space-y-3 rounded-2xl border-[3px] border-black bg-surface p-5">
              <p className="font-bold uppercase text-on-surface-variant">Signed in as</p>
              <p className="font-headline text-2xl text-primary-container">{user.email}</p>
              <p className="font-bold uppercase text-on-surface-variant">
                Current role: {role ?? 'not selected'}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {roleCards.map((card) => (
          <button
            key={card.role}
            type="button"
            onClick={() => {
              setSelectedRole(card.role);
              setMode('signup');
            }}
            className={`rounded-3xl border-[4px] border-black p-8 text-left shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1 ${
              selectedRole === card.role
                ? 'bg-primary-container text-black'
                : 'bg-surface-container-high text-on-surface'
            }`}
          >
            <p className="font-black uppercase tracking-[0.25em] opacity-70">{card.eyebrow}</p>
            <h2 className="mt-4 font-headline text-4xl uppercase">{card.title}</h2>
            <p className="mt-4 text-base opacity-80">{card.description}</p>
            <p className="mt-6 font-bold uppercase">{card.cta}</p>
          </button>
        ))}
      </section>

      {user ? (
        <section className="rounded-3xl border-[4px] border-black bg-surface-container p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-headline text-4xl uppercase text-primary-fixed">Your Account Is Ready</h2>
              <p className="mt-4 max-w-2xl text-on-surface-variant">
                Use the role buttons below to keep your dashboard pointed at the right workflow.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="rounded-full border-[4px] border-black bg-primary-container px-6 py-3 font-headline text-lg uppercase text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                Open Dashboard
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-full border-[4px] border-black bg-error px-6 py-3 font-headline text-lg uppercase text-on-error"
              >
                Sign Out
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            {roleCards.map((card) => (
              <button
                key={card.role}
                type="button"
                onClick={() => void handleRoleUpdate(card.role)}
                className={`rounded-full border-[4px] border-black px-6 py-3 font-bold uppercase ${
                  role === card.role
                    ? 'bg-secondary text-black'
                    : 'bg-surface text-on-surface'
                }`}
              >
                Switch to {card.role}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border-[4px] border-black bg-surface-container-high p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <p className="font-black uppercase tracking-[0.25em] text-primary-container">
              {mode === 'signup' ? 'Create Account' : 'Sign In'}
            </p>
            <h2 className="mt-4 font-headline text-4xl uppercase">
              {mode === 'signup' ? 'Start With Supabase Auth' : 'Return To Your Workspace'}
            </h2>
            <p className="mt-4 text-on-surface-variant">
              {mode === 'signup'
                ? 'We store your role in Supabase auth metadata so the app can route you to the correct dashboard.'
                : 'Use the same email and password you registered with in Supabase.'}
            </p>
            <div className="mt-8 flex gap-4">
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`rounded-full border-[4px] border-black px-5 py-3 font-bold uppercase ${
                  mode === 'signup' ? 'bg-primary-container text-black' : 'bg-surface text-on-surface'
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`rounded-full border-[4px] border-black px-5 py-3 font-bold uppercase ${
                  mode === 'signin' ? 'bg-secondary text-black' : 'bg-surface text-on-surface'
                }`}
              >
                Sign In
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border-[4px] border-black bg-primary-container p-8 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="grid gap-5">
              {mode === 'signup' ? (
                <label className="grid gap-2">
                  <span className="font-bold uppercase text-sm">Full Name</span>
                  <input
                    className="rounded-2xl border-[3px] border-black bg-white px-4 py-4 outline-none"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Bounty commander"
                    required
                  />
                </label>
              ) : null}

              <label className="grid gap-2">
                <span className="font-bold uppercase text-sm">Email</span>
                <input
                  type="email"
                  className="rounded-2xl border-[3px] border-black bg-white px-4 py-4 outline-none"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="font-bold uppercase text-sm">Password</span>
                <input
                  type="password"
                  className="rounded-2xl border-[3px] border-black bg-white px-4 py-4 outline-none"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </label>

              {mode === 'signup' ? (
                <div className="grid gap-3">
                  <span className="font-bold uppercase text-sm">Selected Role</span>
                  <div className="flex flex-wrap gap-3">
                    {roleCards.map((card) => (
                      <button
                        key={card.role}
                        type="button"
                        onClick={() => setSelectedRole(card.role)}
                        className={`rounded-full border-[3px] border-black px-4 py-3 font-bold uppercase ${
                          selectedRole === card.role ? 'bg-black text-white' : 'bg-white text-black'
                        }`}
                      >
                        {card.title}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={!isConfigured || isSubmitting}
              className="mt-8 inline-flex rounded-full border-[4px] border-black bg-black px-8 py-4 font-headline text-lg uppercase text-white shadow-[6px_6px_0px_0px_rgba(255,255,255,0.2)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
