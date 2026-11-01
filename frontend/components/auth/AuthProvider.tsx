'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Profile, UserRole } from '@/types/profile';
import {
  clearStoredSession,
  isSupabaseConfigured,
  readStoredSession,
  refreshSupabaseSession,
  signInWithSupabase,
  signOutSupabase,
  signUpWithSupabase,
  shouldRefreshSession,
  storeSession,
  updateSupabaseRole,
  type AuthCredentials,
  type AuthResult,
  type AuthSession,
  type SignUpCredentials,
} from '@/lib/supabase-auth';

type AuthStatus = 'loading' | 'ready';

interface AuthContextType {
  status: AuthStatus;
  isConfigured: boolean;
  session: AuthSession | null;
  user: Profile | null;
  role: UserRole | null;
  signIn: (credentials: AuthCredentials) => Promise<AuthResult>;
  signUp: (credentials: SignUpCredentials) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!configured) {
        if (active) {
          setStatus('ready');
        }
        return;
      }

      const storedSession = readStoredSession();
      if (!storedSession) {
        if (active) {
          setStatus('ready');
        }
        return;
      }

      try {
        const nextSession = shouldRefreshSession(storedSession)
          ? await refreshSupabaseSession(storedSession.refreshToken)
          : storedSession;

        if (!active) {
          return;
        }

        storeSession(nextSession);
        setSession(nextSession);
      } catch {
        clearStoredSession();
        if (active) {
          setSession(null);
        }
      } finally {
        if (active) {
          setStatus('ready');
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [configured]);

  const signIn = async (credentials: AuthCredentials) => {
    const result = await signInWithSupabase(credentials);
    if (result.session) {
      storeSession(result.session);
      setSession(result.session);
    }
    return result;
  };

  const signUp = async (credentials: SignUpCredentials) => {
    const result = await signUpWithSupabase(credentials);
    if (result.session) {
      storeSession(result.session);
      setSession(result.session);
    }
    return result;
  };

  const signOut = async () => {
    const activeSession = session;
    clearStoredSession();
    setSession(null);

    if (activeSession) {
      try {
        await signOutSupabase(activeSession.accessToken);
      } catch {
        // Ignore logout network errors and still clear the local session.
      }
    }
  };

  const refresh = async () => {
    if (!session) {
      return;
    }

    const refreshedSession = await refreshSupabaseSession(session.refreshToken);
    storeSession(refreshedSession);
    setSession(refreshedSession);
  };

  const setRole = async (role: UserRole) => {
    if (!session) {
      throw new Error('You need to sign in before setting a role.');
    }

    const nextUser = await updateSupabaseRole(session.accessToken, role);
    const nextSession = {
      ...session,
      user: nextUser,
    };

    storeSession(nextSession);
    setSession(nextSession);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      status,
      isConfigured: configured,
      session,
      user: session?.user ?? null,
      role: session?.user.role ?? null,
      signIn,
      signUp,
      signOut,
      refresh,
      setRole,
    }),
    [configured, session, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
