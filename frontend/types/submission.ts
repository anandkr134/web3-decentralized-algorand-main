export interface AiReview {
  id?: string;
  submissionId?: string;
  bountyId?: string;
  provider: string;
  status: 'completed' | 'failed' | 'skipped';
  reviewMode?: string;
  recommendation?: 'recommended' | 'needs_review' | 'high_risk' | null;
  summary: string;
  confidence: number;
  relevanceScore: number;
  completenessScore: number;
  riskScore: number;
  flags: string[];
  evidencePreview?: string | null;
  codeSignals?: Record<string, unknown> | null;
}

export interface Submission {
  id: string;
  bountyId: string;
  submitter: string; // Algorand wallet address
  description: string;
  proofLink: string; // link to the work (GitHub, IPFS, etc.)
  status: 'pending' | 'approved' | 'rejected';
  submittedAt?: string;
  aiReview?: AiReview | null;
}
