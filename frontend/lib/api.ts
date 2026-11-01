const SERVER_API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://127.0.0.1:8000';

export async function readJsonIfPresent<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return typeof window === 'undefined'
    ? `${SERVER_API_BASE}${normalizedPath}`
    : normalizedPath;
}

export async function readApiError(response: Response) {
  try {
    const payload = await readJsonIfPresent<{
      detail?: string | { loc?: unknown[]; msg?: string }[];
      error?: string;
      message?: string;
    }>(response);
    if (!payload) {
      return `Request failed with status ${response.status}`;
    }
    if (Array.isArray(payload.detail)) {
      return payload.detail
        .map((item: { loc?: unknown[]; msg?: string }) => {
          const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : 'field';
          return `${String(field)}: ${item.msg || 'invalid value'}`;
        })
        .join('; ');
    }
    return payload.detail || payload.error || payload.message || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}
