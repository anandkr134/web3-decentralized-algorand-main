import { Bounty } from '@/types/bounty';
import { getApiUrl, readApiError, readJsonIfPresent } from '@/lib/api';

export async function getActiveBounties(): Promise<Bounty[]> {
  try {
    const res = await fetch(getApiUrl('/api/bounty/get'), { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await readJsonIfPresent<{ success?: boolean; data?: Bounty[] }>(res);
    if (!json) return [];
    if (json.success) return json.data as Bounty[];
    return [];
  } catch (error) {
    console.error("Error fetching bounties:", error);
    return [];
  }
}

export async function getBountyById(bountyId: string): Promise<Bounty | null> {
  try {
    const res = await fetch(getApiUrl(`/api/bounty/get?id=${bountyId}`), { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await readJsonIfPresent<{ success?: boolean; data?: Bounty }>(res);
    if (!json) return null;
    if (json.success) return json.data as Bounty;
    return null;
  } catch (error) {
    console.error("Error fetching bounty:", error);
    return null;
  }
}

export async function getMyBounties(authToken: string): Promise<Bounty[]> {
  const res = await fetch(getApiUrl('/api/dashboard/my-bounties'), {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  const json = await readJsonIfPresent<{ success?: boolean; data?: Bounty[] }>(res);
  if (!json) {
    throw new Error('Dashboard returned an empty response.');
  }
  if (json.success) return json.data as Bounty[];
  throw new Error('Unable to load dashboard bounties.');
}
