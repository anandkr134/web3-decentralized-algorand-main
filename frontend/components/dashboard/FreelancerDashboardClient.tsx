'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { getActiveBounties } from '@/services/bounty.service';
import { getSubmissionsByUser } from '@/services/submission.service';
import type { Bounty } from '@/types/bounty';
import type { Submission } from '@/types/submission';
import { formatDate } from '@/lib/utils';

export function FreelancerDashboardClient() {
  const { address, authToken } = useWallet();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setSubmissions([]);
      setBounties([]);
      setError(null);
      return;
    }

    if (!authToken) {
      setSubmissions([]);
      setBounties([]);
      setError('Wallet connected, but submission analytics are waiting for wallet authentication.');
      return;
    }

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const [nextSubmissions, nextBounties] = await Promise.all([
          getSubmissionsByUser(address, authToken),
          getActiveBounties(),
        ]);
        setSubmissions(nextSubmissions);
        setBounties(nextBounties);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load the freelancer dashboard.'
        );
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [address, authToken]);

  const approvedCount = submissions.filter((submission) => submission.status === 'approved').length;
  const pendingCount = submissions.filter((submission) => submission.status === 'pending').length;
  const rejectedCount = submissions.filter((submission) => submission.status === 'rejected').length;

  if (!address) {
    return (
      <>
        <header className="mb-12">
          <h1 className="font-headline text-5xl uppercase tracking-tighter text-primary-fixed md:text-7xl">
            Freelancer <span className="text-secondary">Dashboard</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-on-surface-variant">
            Connect your delivery wallet to track every submission, approval, and active bounty worth chasing.
          </p>
        </header>
        <div className="rounded-3xl border-[4px] border-black bg-surface-container p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          No wallet connected yet.
        </div>
      </>
    );
  }

  return (
    <>
      <header className="mb-12">
        <h1 className="font-headline text-5xl uppercase tracking-tighter text-primary-fixed md:text-7xl">
          Freelancer <span className="text-secondary">Dashboard</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-on-surface-variant">
          Active builder view for wallet {address.slice(0, 6)}...{address.slice(-4)}.
        </p>
      </header>

      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-xl border-[4px] border-black bg-primary-container p-8 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:col-span-2">
          <span className="inline-block rounded-full bg-black px-3 py-1 text-xs font-black uppercase text-primary-container">
            Submission Volume
          </span>
          <h2 className="mt-4 font-headline text-5xl tracking-tighter">{submissions.length}</h2>
          <p className="mt-4 font-bold">Total freelance submissions sent from this wallet.</p>
        </div>

        <div className="rounded-xl border-[4px] border-black bg-secondary p-6 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-xs font-black uppercase tracking-widest opacity-60">Approved</h3>
          <p className="mt-2 font-headline text-4xl">{approvedCount}</p>
        </div>

        <div className="rounded-xl border-[4px] border-black bg-surface-container-highest p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="text-xs font-black uppercase tracking-widest text-primary-container">Awaiting Review</h3>
          <p className="mt-2 font-headline text-4xl text-primary-fixed">{pendingCount}</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border-[4px] border-black bg-surface-container p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-headline text-3xl uppercase tracking-tighter">Recent Submissions</h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Awaiting review: {pendingCount} • Approved: {approvedCount} • Rejected: {rejectedCount}
              </p>
            </div>
            <Link
              href="/bounties"
              className="rounded-full border-[4px] border-black bg-primary-container px-6 py-3 font-black uppercase text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              Browse Bounties
            </Link>
          </div>

          {loading ? (
            <div className="text-on-surface-variant">Loading submission telemetry...</div>
          ) : error ? (
            <div className="rounded-2xl border-[3px] border-black bg-error p-4 font-bold text-on-error">
              {error}
            </div>
          ) : submissions.length ? (
            <div className="space-y-5">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="rounded-2xl border-[4px] border-black bg-surface-container-high p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-headline text-2xl uppercase text-primary-container">
                        Submission #{submission.id.slice(0, 8)}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
                        {submission.description}
                      </p>
                    </div>
                    <span className="rounded-full border-[3px] border-black bg-primary-container px-3 py-1 text-[10px] font-black uppercase text-black">
                      {submission.status}
                    </span>
                  </div>
                  {submission.aiReview ? (
                    <div className="mt-4 rounded-2xl border-[3px] border-black bg-surface p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                        AI Validation
                      </p>
                      <p className="mt-2 text-sm font-bold text-on-surface">
                        {submission.aiReview.summary}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-6 text-xs font-bold uppercase text-on-surface-variant">
                    <p>Bounty: {submission.bountyId.slice(0, 8)}</p>
                    <p>Sent: {submission.submittedAt ? formatDate(submission.submittedAt) : 'Just now'}</p>
                    <Link
                      href={submission.proofLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary-fixed underline decoration-4 underline-offset-4"
                    >
                      Proof Link
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-on-surface-variant">
              No submissions from this wallet yet. Pick a live bounty and start shipping.
            </div>
          )}
        </section>

        <section className="rounded-3xl border-[4px] border-black bg-surface-container-high p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="font-headline text-3xl uppercase tracking-tighter">Open Market</h2>
          <p className="mt-3 text-on-surface-variant">
            A quick feed of live, escrow-funded bounties your freelancer account can jump into next.
          </p>

          <div className="mt-8 space-y-4">
            {bounties.slice(0, 4).map((bounty) => (
              <Link
                key={bounty.id}
                href={`/bounties/${bounty.id}`}
                className="block rounded-2xl border-[4px] border-black bg-surface p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1"
              >
                <h3 className="font-headline text-2xl uppercase text-primary-container">{bounty.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">{bounty.description}</p>
                <div className="mt-4 flex items-center justify-between text-xs font-bold uppercase text-on-surface-variant">
                  <span>{bounty.reward} ALGO</span>
                  <span>{formatDate(bounty.deadline)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
