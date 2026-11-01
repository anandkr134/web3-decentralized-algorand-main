import { getApiUrl, readApiError } from '@/lib/api';
import { DisputeCase } from '@/types/dao';

export async function getDisputeCaseStatus(
  bountyId: string,
  authToken?: string
): Promise<DisputeCase | null> {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(getApiUrl(`/api/dao/status?bountyId=${bountyId}`), {
    cache: 'no-store',
    headers,
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error('Unable to load DAO dispute status.');
  }

  return json.data as DisputeCase;
}
