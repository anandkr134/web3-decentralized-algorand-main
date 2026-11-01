export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  deadline: string;
  creator: string;
  escrowAddress: string;
  status: 'pending_funding' | 'open' | 'under_review' | 'disputed' | 'expired' | 'completed' | 'refunded';
  fundingTxId?: string;
  winner?: string;
  winnerSubmissionId?: string;
  payoutTxId?: string;
  escrowMode?: 'account' | 'contract';
  contractAppId?: number;
  contractDeploymentTxId?: string;
  contractBootstrapTxId?: string;
  createdAt?: string;
}
