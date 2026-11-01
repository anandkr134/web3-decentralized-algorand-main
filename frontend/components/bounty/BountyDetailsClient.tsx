'use client';

import Link from 'next/link';
import toast from 'react-hot-toast';
import { useEffect, useState, useTransition } from 'react';
import { DaoDisputePanel } from '@/components/bounty/DaoDisputePanel';
import { SubmissionForm } from '@/components/bounty/SubmissionForm';
import { SubmissionCard } from '@/components/bounty/SubmissionCard';
import { readApiError } from '@/lib/api';
import { algodClient } from '@/lib/algorand';
import { buildContractMethodGroup, signAndSendTransactionGroup } from '@/lib/contract-bounty';
import { getDisputeCaseStatus } from '@/services/dao.service';
import { getBountyById } from '@/services/bounty.service';
import { getSubmissionsForBounty } from '@/services/submission.service';
import { useWallet } from '@/hooks/useWallet';
import { DisputeCase } from '@/types/dao';
import { Bounty } from '@/types/bounty';
import { Submission } from '@/types/submission';
import { formatAddress, formatBountyStatus, formatDate, isExpired } from '@/lib/utils';

interface BountyDetailsClientProps {
  bounty: Bounty;
  initialSubmissions: Submission[];
}

const statusToneMap: Record<Bounty['status'], string> = {
  pending_funding: 'bg-secondary-container text-secondary-fixed',
  open: 'bg-primary-container text-black',
  under_review: 'bg-secondary text-black',
  disputed: 'bg-error text-on-error',
  expired: 'bg-surface-container-highest text-on-surface',
  completed: 'bg-tertiary-container text-black',
  refunded: 'bg-error-container text-black',
};

const statusNarrativeMap: Record<Bounty['status'], string> = {
  pending_funding: 'Escrow has been generated, but the creator still needs to fund it before the bounty can go live.',
  open: 'Escrow is funded and the bounty is still live. Freelancers can submit deliverables until the deadline.',
  under_review: 'The deadline has passed and submissions are locked. The creator must now approve a winner or mark the review as disputed.',
  disputed: 'The creator escalated this review. Escrow remains locked while the DAO juror council votes on the outcome.',
  expired: 'The deadline passed without a reviewable submission, so the bounty is no longer accepting work.',
  completed: 'A winner was approved and the payout was released from the Algorand escrow wallet.',
  refunded: 'The DAO resolved this dispute in favor of the creator, so escrow was refunded and the bounty is now closed.',
};

export function BountyDetailsClient({
  bounty,
  initialSubmissions,
}: BountyDetailsClientProps) {
  const { address, authToken, getAuthHeaders } = useWallet();
  const [currentBounty, setCurrentBounty] = useState(bounty);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [disputeCase, setDisputeCase] = useState<DisputeCase | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDisputing, setIsDisputing] = useState(false);

  const expired = isExpired(currentBounty.deadline);
  const isCreator = address === currentBounty.creator;
  const pendingReviewCount = submissions.filter((submission) => submission.status === 'pending').length;
  const canSubmit = currentBounty.status === 'open' && !expired;
  const canDispute =
    isCreator &&
    Boolean(authToken) &&
    currentBounty.status === 'under_review' &&
    pendingReviewCount > 0;

  const loadDisputeCase = async (token?: string | null) => {
    try {
      const nextCase = await getDisputeCaseStatus(currentBounty.id, token || authToken || undefined);
      setDisputeCase(nextCase);
    } catch (error) {
      console.warn('Unable to load DAO dispute case:', error);
      setDisputeCase(null);
    }
  };

  useEffect(() => {
    void loadDisputeCase();
  }, [currentBounty.id, authToken]);

  const refreshBountyData = () => {
    startTransition(() => {
      void (async () => {
        try {
          setRefreshError(null);
          const [latestBounty, latestSubmissions, latestDisputeCase] = await Promise.all([
            getBountyById(currentBounty.id),
            getSubmissionsForBounty(currentBounty.id),
            getDisputeCaseStatus(currentBounty.id, authToken || undefined).catch(() => null),
          ]);

          if (!latestBounty) {
            throw new Error('Unable to refresh the bounty right now.');
          }

          setCurrentBounty(latestBounty);
          setSubmissions(latestSubmissions);
          setDisputeCase(latestDisputeCase);
        } catch (error) {
          setRefreshError(
            error instanceof Error ? error.message : 'Unable to refresh bounty details right now.'
          );
        }
      })();
    });
  };

  const handleDispute = async () => {
    if (!canDispute) {
      return;
    }

    setIsDisputing(true);
    const toastId = toast.loading('Marking bounty as disputed...');

    try {
      let txId: string | undefined;
      if (currentBounty.escrowMode === 'contract') {
        if (!currentBounty.contractAppId || !address) {
          throw new Error('Contract-backed bounty is missing its app ID.');
        }
        const suggestedParams = await algodClient.getTransactionParams().do();
        const { txns, txIds } = buildContractMethodGroup({
          appId: currentBounty.contractAppId,
          methodSignature: 'mark_disputed()void',
          methodArgs: [],
          sender: address,
          suggestedParams,
        });
        await signAndSendTransactionGroup({
          signerAddress: address,
          txns,
          walletMessage: 'Mark this bounty as disputed on-chain',
        });
        txId = txIds[0];
      }

      const response = await fetch('/api/bounty/dispute', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ bountyId: currentBounty.id, txId }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = await response.json();
      toast.success(payload.message || 'Bounty moved to disputed review.', { id: toastId });
      refreshBountyData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to move the bounty into disputed review.',
        { id: toastId }
      );
    } finally {
      setIsDisputing(false);
    }
  };

  const statusTone = statusToneMap[currentBounty.status];
  const statusLabel = formatBountyStatus(currentBounty.status);

  return (
    <>
      <div className="mb-12">
        <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          <Link href="/bounties">Active Bounties</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-primary-fixed">{currentBounty.title}</span>
        </div>
        <h1 className="mb-6 font-headline text-4xl leading-tight uppercase md:text-6xl">
          {currentBounty.title}
        </h1>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 rounded-full border-[3px] border-black bg-secondary-container px-6 py-2 font-black text-on-secondary-container shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              payments
            </span>
            {currentBounty.reward.toLocaleString()} ALGO
          </div>
          <div className="flex items-center gap-2 rounded-full border-[3px] border-black bg-surface-container-highest px-6 py-2 font-bold text-on-surface">
            <span className="material-symbols-outlined">event</span>
            DEADLINE: {formatDate(currentBounty.deadline)}
          </div>
          <div className={`rounded-full border-[3px] border-black px-6 py-2 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${statusTone}`}>
            {statusLabel}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <section className="rounded-xl border-[4px] border-black bg-surface-container p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="mb-6 flex items-center gap-3 font-headline text-2xl">
              <span className="material-symbols-outlined text-primary-fixed">description</span>
              MISSION OBJECTIVE
            </h2>
            <div className="space-y-4 text-lg leading-relaxed text-on-surface/80">
              <p>{currentBounty.description}</p>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section className="rounded-xl border-[4px] border-black bg-secondary p-8 text-on-secondary shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="mb-4 font-headline text-xl">FAIR REVIEW FLOW</h2>
              <ul className="space-y-3 font-bold">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined mt-1 text-sm">check_circle</span>
                  The bounty only opens after Algorand escrow funding is confirmed.
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined mt-1 text-sm">check_circle</span>
                  One wallet gets one submission, and creators cannot submit to their own bounty.
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined mt-1 text-sm">check_circle</span>
                  After the deadline, the bounty shifts into review instead of silently staying open.
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined mt-1 text-sm">check_circle</span>
                  Creators can approve a winner or mark the review disputed to keep escrow locked.
                </li>
              </ul>
            </section>

            <section className="rounded-xl border-[4px] border-black bg-primary-container p-8 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <h2 className="mb-4 font-headline text-xl">ESCROW PROOF</h2>
              <div className="space-y-4 text-sm font-bold uppercase">
                <div>
                  <p className="opacity-60">Creator Wallet</p>
                  <p className="mt-1 break-all normal-case">{currentBounty.creator}</p>
                </div>
                <div>
                  <p className="opacity-60">Escrow Address</p>
                  <p className="mt-1 break-all normal-case">{currentBounty.escrowAddress}</p>
                </div>
                <div>
                  <p className="opacity-60">Escrow Mode</p>
                  <p className="mt-1 break-all normal-case">{currentBounty.escrowMode || 'account'}</p>
                </div>
                <div>
                  <p className="opacity-60">Funding Tx</p>
                  <p className="mt-1 break-all normal-case">
                    {currentBounty.fundingTxId || 'Pending funding confirmation'}
                  </p>
                </div>
                {currentBounty.contractAppId ? (
                  <div>
                    <p className="opacity-60">Contract App ID</p>
                    <p className="mt-1 break-all normal-case">{currentBounty.contractAppId}</p>
                  </div>
                ) : null}
                <div>
                  <p className="opacity-60">Payout Tx</p>
                  <p className="mt-1 break-all normal-case">
                    {currentBounty.payoutTxId || 'Not released yet'}
                  </p>
                </div>
                <div>
                  <p className="opacity-60">Submission Count</p>
                  <p className="mt-1 font-headline text-2xl">{submissions.length}</p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <aside className="space-y-8 lg:col-span-4">
          <div className="rounded-3xl border-[4px] border-black bg-surface-container-highest p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="mb-2 font-headline text-2xl">ESCROW STATUS</h3>
            <p className="mb-6 text-sm text-on-surface-variant">
              {statusNarrativeMap[currentBounty.status]}
            </p>

            <div className="space-y-4 text-sm font-bold uppercase">
              <div className="flex items-center justify-between gap-4">
                <span className="text-on-surface/60">Status</span>
                <span>{statusLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-on-surface/60">Deadline</span>
                <span>{formatDate(currentBounty.deadline)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-on-surface/60">Reward</span>
                <span>{currentBounty.reward} ALGO</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-on-surface/60">Creator</span>
                <span>{formatAddress(currentBounty.creator, 8, 5)}</span>
              </div>
            </div>

            {canSubmit ? (
              <SubmissionForm bounty={currentBounty} onSubmitted={refreshBountyData} />
            ) : (
              <div className="mt-8 rounded-2xl border-[3px] border-black bg-surface-container p-5 text-sm text-on-surface-variant">
                {currentBounty.status === 'pending_funding'
                  ? 'Funding confirmation is still pending.'
                  : currentBounty.status === 'completed'
                    ? `Winner: ${currentBounty.winner ? formatAddress(currentBounty.winner) : 'Recorded on-chain'}`
                    : currentBounty.status === 'refunded'
                      ? 'The DAO refunded this dispute back to the creator wallet.'
                    : currentBounty.status === 'under_review'
                      ? 'Submissions are closed. The creator is now reviewing every pending deliverable.'
                      : currentBounty.status === 'disputed'
                        ? 'This bounty is locked while the DAO juror council votes on the outcome.'
                        : 'Submissions are closed for this bounty.'}
              </div>
            )}
          </div>

          <div className="rounded-3xl border-[4px] border-black bg-surface-container p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h4 className="mb-6 text-xs font-black uppercase tracking-tighter text-on-surface-variant">
              Creator Controls
            </h4>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              {isCreator
                ? currentBounty.status === 'under_review'
                  ? 'Approve a valid submission to release escrow, or move the bounty into disputed review if the outcome needs manual resolution.'
                  : currentBounty.status === 'disputed'
                    ? 'The bounty is now in DAO review. Juror votes decide whether escrow is released to a submission or refunded back to the creator.'
                    : currentBounty.status === 'refunded'
                      ? 'This dispute has already been resolved in favor of refunding the creator.'
                      : 'While the bounty is live, you can approve a strong submission at any time. After the deadline it automatically shifts into creator review.'
                : 'Only the creator wallet can approve a winning submission, release escrow, or mark a finished review as disputed.'}
            </p>

            {canDispute ? (
              <button
                type="button"
                onClick={handleDispute}
                disabled={isDisputing}
                className="mt-6 w-full rounded-full border-[4px] border-black bg-error px-6 py-4 font-black uppercase text-on-error shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isDisputing ? 'Locking Review...' : 'Mark As Disputed'}
              </button>
            ) : null}
          </div>

          {disputeCase ? (
            <DaoDisputePanel
              bountyId={currentBounty.id}
              disputeCase={disputeCase}
              submissions={submissions}
              onUpdated={refreshBountyData}
            />
          ) : null}
        </aside>
      </div>

      <section className="mt-24">
        <div className="mb-12 flex items-center justify-between gap-4">
          <h2 className="font-headline text-4xl">
            RECENT <span className="text-primary-fixed">TRANSMISSIONS</span>
          </h2>
          <button
            type="button"
            onClick={refreshBountyData}
            className="rounded-full border-[3px] border-black bg-primary-container px-5 py-3 text-xs font-bold uppercase tracking-widest text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            {isPending ? 'Refreshing...' : 'Refresh Feed'}
          </button>
        </div>

        {refreshError ? (
          <div className="mb-6 rounded-2xl border-[3px] border-black bg-error p-4 font-bold text-on-error">
            {refreshError}
          </div>
        ) : null}

        {submissions.length ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {submissions.map((submission) => (
              <SubmissionCard
                key={submission.id}
                bounty={currentBounty}
                submission={submission}
                isCreator={isCreator}
                onUpdated={refreshBountyData}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-[4px] border-black bg-surface-container-high p-8 text-on-surface-variant">
            No submissions yet. Once builders submit work, they&apos;ll appear here.
          </div>
        )}
      </section>
    </>
  );
}
