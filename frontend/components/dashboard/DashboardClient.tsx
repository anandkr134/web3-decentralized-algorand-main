'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { getMyBounties } from '@/services/bounty.service';
import { Bounty } from '@/types/bounty';
import { formatBountyStatus, formatDate } from '@/lib/utils';

export function DashboardClient() {
  const { address, authToken } = useWallet();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setBounties([]);
      setError(null);
      return;
    }

    if (!authToken) {
      setBounties([]);
      setError('Wallet connected, but dashboard access is waiting for authentication.');
      return;
    }

    const loadBounties = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextBounties = await getMyBounties(authToken);
        setBounties(nextBounties);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load your bounty dashboard.'
        );
      } finally {
        setLoading(false);
      }
    };

    void loadBounties();
  }, [address, authToken]);

  const openCount = bounties.filter((bounty) => bounty.status === 'open').length;
  const pendingFundingCount = bounties.filter((bounty) => bounty.status === 'pending_funding').length;
  const underReviewCount = bounties.filter((bounty) => bounty.status === 'under_review').length;
  const disputedCount = bounties.filter((bounty) => bounty.status === 'disputed').length;
  const expiredCount = bounties.filter((bounty) => bounty.status === 'expired').length;
  const completedCount = bounties.filter((bounty) => bounty.status === 'completed').length;
  const refundedCount = bounties.filter((bounty) => bounty.status === 'refunded').length;
  const totalReward = bounties.reduce((sum, bounty) => sum + Number(bounty.reward || 0), 0);

  if (!address) {
    return (
      <>
        <header className="mb-12">
          <h1 className="font-headline text-5xl md:text-7xl uppercase tracking-tighter text-primary-fixed mb-4">
            Client <span className="text-secondary">Dashboard</span>
          </h1>
          <p className="text-on-surface-variant max-w-2xl text-lg font-medium">
            Connect your client wallet to load your live bounties, escrow states, and payout progress.
          </p>
        </header>
        <div className="bg-surface-container border-[4px] border-black rounded-3xl p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          No wallet connected yet.
        </div>
      </>
    );
  }

  return (
    <>
      <header className="mb-12">
        <h1 className="font-headline text-5xl md:text-7xl uppercase tracking-tighter text-primary-fixed mb-4">
          Client <span className="text-secondary">Dashboard</span>
        </h1>
        <p className="text-on-surface-variant max-w-2xl text-lg font-medium">
          Live client view for wallet {address.slice(0, 6)}...{address.slice(-4)}.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-12">
        <div className="md:col-span-2 bg-primary-container border-[4px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8 rounded-xl min-h-[220px]">
          <span className="bg-black text-primary-container px-3 py-1 rounded-full text-xs font-black uppercase mb-4 inline-block">
            Total Reward Pool
          </span>
          <h2 className="text-black text-5xl font-headline tracking-tighter">{totalReward.toLocaleString()} ALGO</h2>
          <p className="text-black font-bold mt-4">
            {bounties.length} total bounty{bounties.length === 1 ? '' : 'ies'} tracked from this wallet.
          </p>
        </div>

        <div className="bg-secondary p-6 border-[4px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
          <h3 className="text-black font-black uppercase text-xs tracking-widest mb-1 opacity-60">Open</h3>
          <p className="text-black text-4xl font-headline">{openCount}</p>
        </div>

        <div className="bg-surface-container-highest p-6 border-[4px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
          <h3 className="text-primary-container font-black uppercase text-xs tracking-widest mb-1">Pending Funding</h3>
          <p className="text-primary-fixed text-4xl font-headline">{pendingFundingCount}</p>
        </div>

        <div className="bg-tertiary-container p-6 border-[4px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl text-black">
          <h3 className="font-black uppercase text-xs tracking-widest mb-1 opacity-60">Under Review</h3>
          <p className="text-4xl font-headline">{underReviewCount}</p>
        </div>
      </div>

      <section className="bg-surface-container border-[4px] border-black rounded-3xl p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-headline text-3xl uppercase tracking-tighter">Your Bounties</h2>
            <p className="text-on-surface-variant text-sm mt-2">
              Completed: {completedCount} • Refunded: {refundedCount} • Under review: {underReviewCount} • Disputed: {disputedCount} • Expired: {expiredCount}
            </p>
          </div>
          <Link
            href="/create"
            className="bg-primary-container text-black border-[4px] border-black px-6 py-3 rounded-full font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
          >
            Post Another
          </Link>
        </div>

        {loading ? (
          <div className="text-on-surface-variant">Loading your bounties...</div>
        ) : error ? (
          <div className="bg-error text-on-error rounded-2xl border-[3px] border-black p-4 font-bold">
            {error}
          </div>
        ) : bounties.length ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {bounties.map((bounty) => (
              <Link
                key={bounty.id}
                href={`/bounties/${bounty.id}`}
                className="block bg-surface-container-high border-[4px] border-black rounded-3xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform"
              >
                <div className="flex justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-2xl font-headline text-primary-container uppercase leading-tight">
                      {bounty.title}
                    </h3>
                    <p className="text-on-surface-variant text-sm mt-2 line-clamp-2">
                      {bounty.description}
                    </p>
                  </div>
                  <span className="h-fit rounded-full border-[3px] border-black px-3 py-1 text-[10px] font-black uppercase bg-primary-container text-black">
                    {formatBountyStatus(bounty.status)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs uppercase font-bold text-on-surface-variant">
                  <div>
                    <p>Reward</p>
                    <p className="mt-1 text-primary-fixed font-headline text-lg">{bounty.reward} ALGO</p>
                  </div>
                  <div>
                    <p>Deadline</p>
                    <p className="mt-1 text-on-surface">{formatDate(bounty.deadline)}</p>
                  </div>
                  <div>
                    <p>Escrow</p>
                    <p className="mt-1 text-on-surface">{bounty.escrowAddress.slice(0, 6)}...{bounty.escrowAddress.slice(-4)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-on-surface-variant">
            No bounties created from this wallet yet.
          </div>
        )}
      </section>
    </>
  );
}
