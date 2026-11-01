import type { Profile, UserRole } from '@/types/profile';
import { readJsonIfPresent } from '@/lib/api';

const STORAGE_KEY = 'bountybase.supabase.session';
const REFRESH_BUFFER_SECONDS = 60;

type SupabaseUserPayload = {
  id?: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: {
    full_name?: string | null;
    role?: string | null;
  };
};

type SupabaseSessionPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: SupabaseUserPayload;
};

type SupabaseResponsePayload = SupabaseSessionPayload & {
  session?: SupabaseSessionPayload | null;
  user?: SupabaseUserPayload | null;
  id?: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    role?: string | null;
  };
  error?: string;
  msg?: string;
  message?: string;
  error_description?: string;
};

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: Profile;
}

export interface AuthResult {
  session: AuthSession | null;
  user: Profile | null;
  message?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
  roleHint?: UserRole;
}

export interface SignUpCredentials extends AuthCredentials {
  fullName: string;
  role: UserRole;
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseConfig());
}

function readErrorMessage(payload: SupabaseResponsePayload) {
  return (
    payload.msg ||
    payload.error_description ||
    payload.error ||
    payload.message ||
    'Supabase authentication request failed.'
  );
}

function normalizeRole(role: string | null | undefined): UserRole | null {
  if (role === 'client' || role === 'freelancer') {
    return role;
  }

  if (role === 'hirer') {
    return 'client';
  }

  return null;
}

function normalizeUser(user: SupabaseUserPayload | null | undefined): Profile | null {
  if (!user?.id) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: user.user_metadata?.full_name ?? null,
    role: normalizeRole(user.user_metadata?.role),
  };
}

function extractUser(payload: SupabaseResponsePayload): Profile | null {
  return normalizeUser(payload.user ?? payload);
}

function sessionFromPayload(payload: SupabaseResponsePayload): AuthSession | null {
  const source = payload.session ?? payload;

  if (!source.access_token || !source.refresh_token) {
    return null;
  }

  const user = normalizeUser(source.user ?? payload.user);
  if (!user) {
    return null;
  }

  const expiresAt =
    typeof source.expires_at === 'number'
      ? source.expires_at
      : Math.floor(Date.now() / 1000) + Number(source.expires_in || 3600);

  return {
    accessToken: source.access_token,
    refreshToken: source.refresh_token,
    expiresAt,
    user,
  };
}

async function requestSupabase<T extends SupabaseResponsePayload>(
  path: string,
  init: RequestInit
): Promise<T> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error('Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.anonKey,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const payload = await readJsonIfPresent<T>(response);
  if (!payload) {
    throw new Error(
      response.ok
        ? 'Supabase returned an empty response.'
        : `Supabase request failed with status ${response.status}.`
    );
  }

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return payload;
}

export async function signUpWithSupabase({
  email,
  password,
  fullName,
  role,
}: SignUpCredentials): Promise<AuthResult> {
  const payload = await requestSupabase<SupabaseResponsePayload>('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    }),
  });

  let session = sessionFromPayload(payload);
  let user = session?.user ?? extractUser(payload);

  if (session) {
    const updatedUser = await updateSupabaseRole(session.accessToken, role);
    session = {
      ...session,
      user: updatedUser,
    };
    user = updatedUser;
  }

  return {
    session,
    user,
    message: session
      ? 'Account created successfully.'
      : 'Account created. Check your email to confirm your Supabase account before signing in.',
  };
}

export async function signInWithSupabase({
  email,
  password,
  roleHint,
}: AuthCredentials): Promise<AuthResult> {
  const payload = await requestSupabase<SupabaseResponsePayload>(
    '/auth/v1/token?grant_type=password',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }
  );

  let session = sessionFromPayload(payload);
  if (!session) {
    throw new Error('Supabase did not return a session for this sign-in.');
  }

  if (!session.user.role && roleHint) {
    const updatedUser = await updateSupabaseRole(session.accessToken, roleHint);
    session = {
      ...session,
      user: updatedUser,
    };
  }

  return {
    session,
    user: session.user,
  };
}

export async function refreshSupabaseSession(refreshToken: string): Promise<AuthSession> {
  const payload = await requestSupabase<SupabaseResponsePayload>(
    '/auth/v1/token?grant_type=refresh_token',
    {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }
  );

  const session = sessionFromPayload(payload);
  if (!session) {
    throw new Error('Unable to refresh the Supabase session.');
  }

  return session;
}

export async function updateSupabaseRole(
  accessToken: string,
  role: UserRole
): Promise<Profile> {
  const payload = await requestSupabase<SupabaseResponsePayload>('/auth/v1/user', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      data: {
        role,
      },
    }),
  });

  const user = extractUser(payload);
  if (!user) {
    throw new Error('Unable to update the Supabase profile role.');
  }

  return user;
}

export async function signOutSupabase(accessToken: string) {
  const config = getSupabaseConfig();
  if (!config) {
    return;
  }

  await fetch(`${config.url}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
}

export function readStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw || !raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAt || !parsed.user) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function storeSession(session: AuthSession) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function shouldRefreshSession(session: AuthSession) {
  return session.expiresAt <= Math.floor(Date.now() / 1000) + REFRESH_BUFFER_SECONDS;
}
