import { notFound } from 'next/navigation';
import { BountyDetailsClient } from '@/components/bounty/BountyDetailsClient';
import { getBountyById } from '@/services/bounty.service';
import { getSubmissionsForBounty } from '@/services/submission.service';

export const dynamic = 'force-dynamic';

type BountyDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BountyDetailsPage({ params }: BountyDetailsPageProps) {
  const { id } = await params;
  const bounty = await getBountyById(id);

  if (!bounty) {
    notFound();
  }

  const submissions = await getSubmissionsForBounty(id);

  return <BountyDetailsClient bounty={bounty} initialSubmissions={submissions} />;
}
