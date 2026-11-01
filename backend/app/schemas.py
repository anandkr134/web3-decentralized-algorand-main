from typing import Literal, Optional

from pydantic import BaseModel, Field


class BountyCreate(BaseModel):
    """Request body for creating a bounty. Creator comes from JWT auth."""
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=10, max_length=5000)
    reward: float = Field(gt=0)
    deadline: str = Field(min_length=10, max_length=64)


class BountyResponse(BaseModel):
    id: str
    title: str
    description: str
    reward: float
    deadline: str
    creator: str
    escrowAddress: str
    status: str
    createdAt: Optional[str] = None
    fundingTxId: Optional[str] = None
    winner: Optional[str] = None
    winnerSubmissionId: Optional[str] = None
    payoutTxId: Optional[str] = None
    escrowMode: Optional[str] = None
    contractAppId: Optional[int] = None
    contractDeploymentTxId: Optional[str] = None
    contractBootstrapTxId: Optional[str] = None

class BountyConfirm(BaseModel):
    bountyId: str = Field(min_length=36, max_length=64)
    txId: str = Field(min_length=20, max_length=128)


class BountyCreateResponse(BaseModel):
    success: bool
    bountyId: str
    escrowAddress: str
    reward: float
    rewardMicroalgos: int
    requiredFundingAmount: float
    requiredFundingMicroalgos: int
    payoutFeeBufferAmount: float
    payoutFeeBufferMicroalgos: int
    escrowMode: str
    contractAppId: Optional[int] = None
    contractDeploymentTxId: Optional[str] = None
    contractBootstrapTxId: Optional[str] = None


class BountyApprove(BaseModel):
    """Request body for approving a bounty. Creator comes from JWT auth."""
    bountyId: str = Field(min_length=36, max_length=64)
    submissionId: str = Field(min_length=36, max_length=64)
    winnerAddress: str = Field(min_length=58, max_length=58)
    txId: Optional[str] = Field(default=None, min_length=20, max_length=128)


class BountyDispute(BaseModel):
    """Request body for moving a bounty into disputed review."""
    bountyId: str = Field(min_length=36, max_length=64)
    txId: Optional[str] = Field(default=None, min_length=20, max_length=128)


class DaoVoteCreate(BaseModel):
    bountyId: str = Field(min_length=36, max_length=64)
    decision: Literal["approve_submission", "refund_creator"]
    submissionId: Optional[str] = Field(default=None, min_length=36, max_length=64)


class SubmissionCreate(BaseModel):
    """Request body for submitting work. Submitter comes from JWT auth."""
    bountyId: str = Field(min_length=36, max_length=64)
    description: str = Field(min_length=10, max_length=5000)
    proofLink: str = Field(min_length=8, max_length=2048)
    txId: Optional[str] = Field(default=None, min_length=20, max_length=128)


class SubmissionReviewRefresh(BaseModel):
    submissionId: str = Field(min_length=36, max_length=64)


class SubmissionResponse(BaseModel):
    id: str
    bountyId: str
    submitter: str
    description: str
    proofLink: str
    status: str
    submittedAt: Optional[str] = None
    aiReview: Optional[dict] = None
