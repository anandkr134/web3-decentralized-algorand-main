import { Submission } from '@/types/submission';
import { getApiUrl } from '@/lib/api';

export async function getSubmissionsForBounty(bountyId: string): Promise<Submission[]> {
  try {
    const res = await fetch(getApiUrl(`/api/submission/get?bountyId=${bountyId}`), { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    if (json.success) return json.data as Submission[];
    return [];
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return [];
  }
}

export async function getSubmissionsByUser(
  address: string,
  authToken: string
): Promise<Submission[]> {
  try {
    const res = await fetch(getApiUrl(`/api/submission/get?submitter=${address}`), {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (json.success) return json.data as Submission[];
    return [];
  } catch (error) {
    console.error('Error fetching user submissions:', error);
    return [];
  }
}
