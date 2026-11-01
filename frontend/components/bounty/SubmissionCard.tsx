'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useWallet } from '@/hooks/useWallet';
import { Bounty } from '@/types/bounty';
import { Submission } from '@/types/submission';
import { formatAddress, formatBountyStatus, formatDate } from '@/lib/utils';
import { readApiError } from '@/lib/api';
import { algodClient } from '@/lib/algorand';
import {
  buildContractMethodGroup,
  getContractAppAccountSnapshot,
  getContractPayoutTopUpAmount,
  getSubmissionBoxReference,
  signAndSendTransactionGroup,
} from '@/lib/contract-bounty';
import {
  formatAiProvider,
  formatAiReviewMode,
  getAiCodeSignalBadges,
  getAiRecommendationLabel,
  getAiRecommendationSummary,
  getCompactEvidencePreview,
} from '@/lib/ai-review';

interface SubmissionCardProps {
  bounty: Bounty;
  submission: Submission;
  isCreator: boolean;
  onUpdated?: () => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-secondary-container text-secondary-fixed',
  approved: 'bg-primary-container text-black',
  rejected: 'bg-error text-on-error',
};

const reviewToneMap: Record<string, string> = {
  recommended: 'bg-primary-container text-black',
  needs_review: 'bg-secondary text-black',
  high_risk: 'bg-error text-on-error',
};

export function SubmissionCard({
  bounty,
  submission,
  isCreator,
  onUpdated,
}: SubmissionCardProps) {
  const { address, authToken, getAuthHeaders } = useWallet();
  const [isApproving, setIsApproving] = useState(false);
  const [isRefreshingAi, setIsRefreshingAi] = useState(false);
  const [showFullEvidence, setShowFullEvidence] = useState(false);

  const canApprove =
    isCreator &&
    Boolean(authToken) &&
    (bounty.status === 'open' || bounty.status === 'under_review') &&
    submission.status === 'pending';
  const canRefreshAi = Boolean(authToken) && (isCreator || address === submission.submitter);
  const aiSignalBadges = getAiCodeSignalBadges(submission.aiReview?.codeSignals);
  const topFlags = submission.aiReview?.flags?.slice(0, 3) ?? [];
  const compactEvidencePreview = getCompactEvidencePreview(submission.aiReview?.evidencePreview);
  const formatAlgoAmount = (microalgos: number) =>
    (microalgos / 1_000_000).toFixed(6).replace(/\.?0+$/, '');

  const handleApprove = async () => {
    if (!address || !authToken) {
      return;
    }

    setIsApproving(true);
    const toastId = toast.loading('Approving submission and releasing funds...');

    try {
      let txId: string | undefined;
      if (bounty.escrowMode === 'contract') {
        if (!bounty.contractAppId) {
          throw new Error('Contract-backed bounty is missing its app ID.');
        }
        const suggestedParams = await algodClient.getTransactionParams().do();
        suggestedParams.flatFee = true;
        suggestedParams.fee = BigInt(3000);
        const rewardMicroalgos = Math.round(Number(bounty.reward) * 1_000_000);
        const contractSnapshot = await getContractAppAccountSnapshot(bounty.contractAppId);
        const topUpAmount = getContractPayoutTopUpAmount({
          appAmount: contractSnapshot.amount,
          appMinBalance: contractSnapshot.minBalance,
          rewardMicroalgos,
        });

        if (topUpAmount > 0) {
          toast.loading(
            `Contract reserve is short by ${formatAlgoAmount(topUpAmount)} ALGO. Grouping a top-up with the approval...`,
            { id: toastId }
          );
        }

        const { txns, txIds } = buildContractMethodGroup({
          appId: bounty.contractAppId,
          methodSignature: 'approve_winner(address)void',
          methodArgs: [submission.submitter],
          sender: address,
          suggestedParams,
          boxes: [getSubmissionBoxReference(submission.submitter)],
          appAccounts: [submission.submitter, bounty.creator],
          topUpPayment:
            topUpAmount > 0
              ? {
                  amount: topUpAmount,
                  receiver: contractSnapshot.appAddress,
                }
              : undefined,
        });
        await signAndSendTransactionGroup({
          signerAddress: address,
          txns,
          walletMessage:
            topUpAmount > 0
              ? `Top up contract by ${formatAlgoAmount(topUpAmount)} ALGO and approve this winner`
              : 'Approve this winner and release ALGO from the bounty contract',
        });
        txId = txIds[txIds.length - 1];
      }

      const response = await fetch('/api/bounty/approve', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          bountyId: bounty.id,
          submissionId: submission.id,
          winnerAddress: submission.submitter,
          txId,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = await response.json();
      toast.success(payload.message || 'Submission approved and payout released.', { id: toastId });
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval failed.', { id: toastId });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRefreshAi = async () => {
    if (!canRefreshAi) {
      return;
    }

    setIsRefreshingAi(true);
    const toastId = toast.loading('Refreshing AI validation...');
    try {
      const response = await fetch('/api/submission/review', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ submissionId: submission.id }),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      toast.success('AI validation refreshed.', { id: toastId });
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to refresh AI validation.', {
        id: toastId,
      });
    } finally {
      setIsRefreshingAi(false);
    }
  };

  return (
    <div className="rounded-2xl border-[4px] border-black bg-surface-container-high p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-1">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Builder Wallet
          </p>
          <p className="mt-2 font-mono text-sm text-on-surface">
            {formatAddress(submission.submitter, 10, 6)}
          </p>
        </div>
        <span
          className={`rounded-full border-[3px] border-black px-3 py-1 text-[10px] font-black uppercase ${statusColors[submission.status] || 'bg-surface text-on-surface'}`}
        >
          {formatBountyStatus(submission.status)}
        </span>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-on-surface-variant">
        {submission.description}
      </p>

      {submission.aiReview ? (
        <div className="mb-4 rounded-2xl border-[3px] border-black bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-[75%]">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                {formatAiReviewMode(submission.aiReview.reviewMode)}
              </p>
              <h4 className="mt-2 text-base font-black text-on-surface">
                {getAiRecommendationLabel(submission.aiReview.recommendation)}
              </h4>
              <p className="mt-1 text-sm font-medium text-on-surface-variant">
                {getAiRecommendationSummary(submission.aiReview.recommendation)}
              </p>
            </div>
            {submission.aiReview.recommendation ? (
              <span
                className={`rounded-full border-[3px] border-black px-3 py-1 text-[10px] font-black uppercase ${
                  reviewToneMap[submission.aiReview.recommendation] || 'bg-surface-container text-on-surface'
                }`}
              >
                {getAiRecommendationLabel(submission.aiReview.recommendation)}
              </span>
            ) : null}
          </div>

          <p className="mt-4 rounded-xl border-[3px] border-black bg-surface-container px-4 py-3 text-sm font-semibold leading-relaxed text-on-surface">
            {submission.aiReview.summary}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ['Confidence', submission.aiReview.confidence],
              ['Relevance', submission.aiReview.relevanceScore],
              ['Completeness', submission.aiReview.completenessScore],
              ['Risk', submission.aiReview.riskScore],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border-[3px] border-black bg-surface-container px-3 py-3"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  {label}
                </p>
                <p className="mt-2 font-headline text-2xl text-on-surface">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase">
            <span className="rounded-full border-[3px] border-black bg-surface-container px-3 py-1 text-on-surface">
              {formatAiProvider(submission.aiReview.provider)}
            </span>
            {aiSignalBadges.slice(0, 4).map((badge) => (
              <span
                key={badge}
                className="rounded-full border-[3px] border-black bg-secondary-container px-3 py-1 text-secondary-fixed"
              >
                {badge}
              </span>
            ))}
          </div>

          {topFlags.length ? (
            <div className="mt-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                Top Risk Signals
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {topFlags.map((flag) => (
                  <span
                    key={flag}
                    className="rounded-full border-[3px] border-black bg-error-container px-3 py-2 text-[11px] font-black uppercase text-black"
                  >
                    {flag}
                  </span>
                ))}
              </div>
              {submission.aiReview.flags && submission.aiReview.flags.length > 3 ? (
                <p className="mt-2 text-xs font-bold text-on-surface-variant">
                  +{submission.aiReview.flags.length - 3} more signals in the full AI review
                </p>
              ) : null}
            </div>
          ) : null}

          {compactEvidencePreview ? (
            <div className="mt-4 rounded-xl border-[3px] border-black bg-surface-container p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Evidence Snapshot
                </p>
                {submission.aiReview.evidencePreview &&
                submission.aiReview.evidencePreview !== compactEvidencePreview ? (
                  <button
                    type="button"
                    onClick={() => setShowFullEvidence((current) => !current)}
                    className="text-[10px] font-black uppercase text-primary-fixed underline decoration-2 underline-offset-4"
                  >
                    {showFullEvidence ? 'Show Less' : 'Show More'}
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-xs font-medium leading-relaxed text-on-surface-variant">
                {showFullEvidence ? submission.aiReview.evidencePreview : compactEvidencePreview}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-4 text-[11px] font-bold uppercase text-on-surface-variant">
        <p>Submitted: {submission.submittedAt ? formatDate(submission.submittedAt) : 'Just now'}</p>
        <p>Review Stage: {formatBountyStatus(bounty.status)}</p>
      </div>

      <a
        href={submission.proofLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 font-black uppercase text-primary-fixed underline decoration-4 underline-offset-4"
      >
        View Deliverable
        <span className="material-symbols-outlined text-base">open_in_new</span>
      </a>

      {canApprove ? (
        <button
          type="button"
          onClick={handleApprove}
          disabled={isApproving}
          className="mt-6 w-full rounded-full border-[4px] border-black bg-primary-container px-4 py-3 font-black uppercase text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isApproving ? 'Releasing Funds...' : 'Approve & Release ALGO'}
        </button>
      ) : null}

      {canRefreshAi ? (
        <button
          type="button"
          onClick={handleRefreshAi}
          disabled={isRefreshingAi}
          className="mt-3 w-full rounded-full border-[4px] border-black bg-secondary px-4 py-3 font-black uppercase text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isRefreshingAi ? 'Refreshing AI...' : 'Re-Run AI Review'}
        </button>
      ) : null}
    </div>
  );
}
