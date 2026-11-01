export type DaoDecision = 'approve_submission' | 'refund_creator';
export type DaoCaseStatus = 'open' | 'resolved' | 'manual_execution_required';

export interface DaoVote {
  id: string;
  juror: string;
  decision: DaoDecision;
  submissionId?: string | null;
  createdAt?: string | null;
}

export interface DaoTally {
  decision: DaoDecision;
  submissionId?: string | null;
  winnerAddress?: string | null;
  voteCount: number;
}

export interface DisputeCase {
  id: string;
  bountyId: string;
  status: DaoCaseStatus;
  quorum: number;
  eligibleJurors: string[];
  isJuror: boolean;
  currentUserVote?: DaoVote | null;
  voteCount: number;
  votes: DaoVote[];
  tallies: DaoTally[];
  resolution?: DaoDecision | null;
  resolutionSubmissionId?: string | null;
  resolutionWinner?: string | null;
  resolutionTxId?: string | null;
  resolvedAt?: string | null;
  escrowMode: 'account' | 'contract';
}
