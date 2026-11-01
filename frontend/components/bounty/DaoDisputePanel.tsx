'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { readApiError } from '@/lib/api';
import { formatAddress, formatDate } from '@/lib/utils';
import { useWallet } from '@/hooks/useWallet';
import { DisputeCase, DaoDecision } from '@/types/dao';
import { Submission } from '@/types/submission';
import { formatAiReviewMode, getAiCodeSignalBadges } from '@/lib/ai-review';

interface DaoDisputePanelProps {
  bountyId: string;
  disputeCase: DisputeCase | null;
  submissions: Submission[];
  onUpdated?: () => void;
}

const decisionLabel: Record<DaoDecision, string> = {
  approve_submission: 'Release To Submission',
  refund_creator: 'Refund Creator',
};

export function DaoDisputePanel({
  bountyId,
  disputeCase,
  submissions,
  onUpdated,
}: DaoDisputePanelProps) {
  const { authToken, getAuthHeaders } = useWallet();
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('');
  const [isVoting, setIsVoting] = useState(false);

  const pendingSubmissions = submissions.filter((submission) => submission.status === 'pending');
  const selectedSubmission = pendingSubmissions.find((submission) => submission.id === selectedSubmissionId) || null;
  const selectedSubmissionAiBadges = getAiCodeSignalBadges(selectedSubmission?.aiReview?.codeSignals);

  useEffect(() => {
    if (!pendingSubmissions.length) {
      setSelectedSubmissionId('');
      return;
    }
    setSelectedSubmissionId((current) =>
      current && pendingSubmissions.some((submission) => submission.id === current)
        ? current
        : pendingSubmissions[0].id
    );
  }, [pendingSubmissions]);

  const handleVote = async (decision: DaoDecision) => {
    if (!authToken || !disputeCase?.isJuror) {
      return;
    }

    if (decision === 'approve_submission' && !selectedSubmissionId) {
      toast.error('Choose a submission before voting to release escrow.');
      return;
    }

    setIsVoting(true);
    const toastId = toast.loading('Recording DAO vote...');

    try {
      const response = await fetch('/api/dao/vote', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          bountyId,
          decision,
          submissionId: decision === 'approve_submission' ? selectedSubmissionId : null,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = await response.json();
      toast.success(payload.message || 'DAO vote recorded.', { id: toastId });
      onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to cast DAO vote.', {
        id: toastId,
      });
    } finally {
      setIsVoting(false);
    }
  };

  if (!disputeCase) {
    return null;
  }

  return (
    <div className="rounded-3xl border-[4px] border-black bg-secondary-container p-8 text-secondary-fixed shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <h4 className="font-headline text-2xl uppercase text-black">DAO Review Council</h4>
      <p className="mt-3 text-sm font-bold uppercase tracking-widest text-black/70">
        {disputeCase.voteCount} vote{disputeCase.voteCount === 1 ? '' : 's'} recorded • quorum {disputeCase.quorum}
      </p>

      <div className="mt-6 space-y-3 text-sm text-black">
        <div className="flex items-center justify-between gap-3">
          <span className="font-black uppercase opacity-60">Case Status</span>
          <span className="font-black uppercase">{disputeCase.status.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-black uppercase opacity-60">Juror Seats</span>
          <span className="font-black">{disputeCase.eligibleJurors.length}</span>
        </div>
        {disputeCase.currentUserVote ? (
          <div className="rounded-2xl border-[3px] border-black bg-white/70 p-4 text-sm font-bold text-black">
            Your vote: {decisionLabel[disputeCase.currentUserVote.decision]}
            {disputeCase.currentUserVote.submissionId
              ? ` • Submission ${disputeCase.currentUserVote.submissionId.slice(0, 8)}`
              : ''}
          </div>
        ) : null}
      </div>

      {disputeCase.tallies.length ? (
        <div className="mt-6 space-y-3">
          {disputeCase.tallies.map((tally) => (
            <div
              key={`${tally.decision}:${tally.submissionId || 'creator'}`}
              className="rounded-2xl border-[3px] border-black bg-white/80 p-4 text-black"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest opacity-60">
                    {decisionLabel[tally.decision]}
                  </p>
                  {tally.winnerAddress ? (
                    <p className="mt-2 text-sm font-bold">Winner wallet: {formatAddress(tally.winnerAddress, 10, 6)}</p>
                  ) : null}
                </div>
                <span className="rounded-full border-[3px] border-black bg-black px-3 py-1 text-[11px] font-black uppercase text-secondary-container">
                  {tally.voteCount} vote{tally.voteCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border-[3px] border-black bg-white/70 p-4 text-sm font-bold text-black">
          No juror votes recorded yet.
        </div>
      )}

      {disputeCase.status === 'resolved' || disputeCase.status === 'manual_execution_required' ? (
        <div className="mt-6 rounded-2xl border-[3px] border-black bg-black p-4 text-sm font-bold text-secondary-container">
          {disputeCase.status === 'resolved'
            ? 'DAO verdict finalized.'
            : 'DAO verdict reached, but contract execution is still pending.'}
          {disputeCase.resolutionWinner ? ` Winner: ${formatAddress(disputeCase.resolutionWinner, 10, 6)}.` : ''}
          {disputeCase.resolutionTxId ? ` Resolution Tx: ${disputeCase.resolutionTxId}.` : ''}
          {disputeCase.resolvedAt ? ` Resolved: ${formatDate(disputeCase.resolvedAt)}.` : ''}
        </div>
      ) : disputeCase.isJuror ? (
        <div className="mt-6 space-y-4 rounded-2xl border-[3px] border-black bg-white/80 p-4 text-black">
          <p className="text-sm font-bold">
            You are a configured juror for this dispute. Vote to refund the creator or release escrow to one pending submission.
          </p>
          <select
            value={selectedSubmissionId}
            onChange={(event) => setSelectedSubmissionId(event.target.value)}
            className="w-full rounded-xl border-[3px] border-black bg-surface px-4 py-3 font-bold"
          >
            {pendingSubmissions.length ? (
              pendingSubmissions.map((submission) => (
                <option key={submission.id} value={submission.id}>
                  Submission {submission.id.slice(0, 8)} • {formatAddress(submission.submitter, 8, 5)}
                </option>
              ))
            ) : (
              <option value="">No pending submissions left</option>
            )}
          </select>
          {selectedSubmission?.aiReview ? (
            <div className="rounded-2xl border-[3px] border-black bg-surface p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                {formatAiReviewMode(selectedSubmission.aiReview.reviewMode)}
              </p>
              <p className="mt-2 text-sm font-bold text-on-surface">
                {selectedSubmission.aiReview.summary}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] font-bold uppercase text-on-surface-variant">
                <p>Confidence: {selectedSubmission.aiReview.confidence}</p>
                <p>Risk: {selectedSubmission.aiReview.riskScore}</p>
                <p>Relevance: {selectedSubmission.aiReview.relevanceScore}</p>
                <p>Complete: {selectedSubmission.aiReview.completenessScore}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase">
                <span className="rounded-full border-[3px] border-black bg-surface-container px-3 py-1 text-on-surface">
                  Provider: {selectedSubmission.aiReview.provider}
                </span>
                {selectedSubmissionAiBadges.slice(0, 5).map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border-[3px] border-black bg-secondary-container px-3 py-1 text-secondary-fixed"
                  >
                    {badge}
                  </span>
                ))}
              </div>
              {selectedSubmission.aiReview.evidencePreview ? (
                <div className="mt-4 rounded-2xl border-[3px] border-black bg-white/70 p-4 text-sm font-medium text-black">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                    Evidence Snapshot
                  </p>
                  <p className="mt-2 whitespace-pre-line text-xs">
                    {selectedSubmission.aiReview.evidencePreview}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => handleVote('approve_submission')}
              disabled={isVoting || !pendingSubmissions.length}
              className="rounded-full border-[4px] border-black bg-primary-container px-4 py-3 font-black uppercase text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isVoting ? 'Submitting Vote...' : 'Vote To Release Escrow'}
            </button>
            <button
              type="button"
              onClick={() => handleVote('refund_creator')}
              disabled={isVoting}
              className="rounded-full border-[4px] border-black bg-error px-4 py-3 font-black uppercase text-on-error shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isVoting ? 'Submitting Vote...' : 'Vote To Refund Creator'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border-[3px] border-black bg-white/70 p-4 text-sm font-bold text-black">
          This panel is read-only unless your connected wallet is on the DAO juror council.
        </div>
      )}

      {disputeCase.eligibleJurors.length ? (
        <div className="mt-6">
          <p className="text-xs font-black uppercase tracking-widest text-black/60">Juror Wallets</p>
          <div className="mt-3 space-y-2">
            {disputeCase.eligibleJurors.map((juror) => (
              <p key={juror} className="text-sm font-bold text-black">
                {formatAddress(juror, 10, 6)}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border-[3px] border-dashed border-black p-4 text-sm font-bold text-black">
          DAO juror wallets are not configured yet. Add `DAO_JUROR_ADDRESSES` on the backend to activate voting.
        </div>
      )}
    </div>
  );
}
