from algopy import (
    Account,
    ARC4Contract,
    BoxMap,
    Bytes,
    Global,
    Txn,
    UInt64,
    arc4,
    gtxn,
    itxn,
)


class BountyEscrowContract(ARC4Contract):
    """
    Contract-level bounty escrow for the decentralized v2 path.

    This contract is designed to replace the current backend-managed escrow model.
    One application instance should represent one bounty.
    """

    def __init__(self) -> None:
        self.creator = Account()
        self.reward_microalgos = UInt64(0)
        self.deadline = UInt64(0)
        self.status = Bytes(b"draft")
        self.winner = Account()
        self.submission_count = UInt64(0)
        self.review_started_at = UInt64(0)
        self.submissions = BoxMap(Account, Bytes, key_prefix="submission:")

    @arc4.abimethod
    def bootstrap_bounty(self, creator: Account, reward_microalgos: UInt64, deadline: UInt64) -> None:
        assert self.status == b"draft", "bounty already initialized"
        assert reward_microalgos > 0, "reward must be greater than zero"
        assert deadline > Global.latest_timestamp, "deadline must be in the future"

        self.creator = creator
        self.reward_microalgos = reward_microalgos
        self.deadline = deadline
        self.status = Bytes(b"pending_funding")

    @arc4.abimethod
    def minimum_funding_amount(self) -> UInt64:
        # reward + buffer for two inner payment transactions during approval/refund flows
        return self.reward_microalgos + UInt64(3_000)

    @arc4.abimethod
    def fund_bounty(self, pay: gtxn.PaymentTransaction) -> None:
        assert self.status == b"pending_funding", "bounty is not waiting for funding"
        assert Txn.sender == self.creator, "only creator can fund the bounty"
        assert pay.sender == Txn.sender, "payment sender must match app call sender"
        assert pay.receiver == Global.current_application_address, "payment must fund the app account"
        assert pay.amount >= self.minimum_funding_amount(), "insufficient funding amount"

        self.status = Bytes(b"open")

    @arc4.abimethod
    def submit_work(self, proof_hash: arc4.DynamicBytes) -> None:
        assert self.status == b"open", "bounty is not accepting submissions"
        assert Global.latest_timestamp <= self.deadline, "submission deadline has passed"
        assert Txn.sender != self.creator, "creator cannot submit to their own bounty"
        assert Txn.sender not in self.submissions, "only one submission per wallet is allowed"

        self.submissions[Txn.sender] = proof_hash.native
        self.submission_count = self.submission_count + 1

    @arc4.abimethod
    def close_submissions(self) -> None:
        assert self.status == b"open", "bounty is not open"
        assert Global.latest_timestamp > self.deadline, "deadline has not passed yet"

        if self.submission_count > 0:
            self.status = Bytes(b"under_review")
            self.review_started_at = Global.latest_timestamp
        else:
            self.status = Bytes(b"expired")

    @arc4.abimethod
    def mark_disputed(self) -> None:
        assert Txn.sender == self.creator, "only creator can mark the bounty disputed"
        assert self.status == b"under_review", "bounty is not under review"

        self.status = Bytes(b"disputed")

    @arc4.abimethod
    def approve_winner(self, winner: Account) -> None:
        assert Txn.sender == self.creator, "only creator can approve the winner"
        assert self.status == b"open" or self.status == b"under_review", "bounty is not reviewable"
        assert winner in self.submissions, "winner must have a recorded submission"
        assert winner != self.creator, "creator cannot be the winner"

        itxn.Payment(
            receiver=winner,
            amount=self.reward_microalgos,
        ).submit()

        self.winner = winner
        self.status = Bytes(b"completed")

    @arc4.abimethod
    def refund_creator(self) -> None:
        assert Txn.sender == self.creator, "only creator can refund the bounty"
        assert self.status == b"expired" or self.status == b"disputed", "refunds are only allowed after expiry or dispute"

        itxn.Payment(
            receiver=self.creator,
            amount=UInt64(0),
        ).submit()

    @arc4.abimethod
    def get_status(self) -> Bytes:
        return self.status

    @arc4.abimethod
    def get_submission_count(self) -> UInt64:
        return self.submission_count

    @arc4.abimethod
    def has_submission(self, submitter: Account) -> bool:
        return submitter in self.submissions

    @arc4.abimethod
    def get_submission_hash(self, submitter: Account) -> Bytes:
        return self.submissions.get(submitter, default=Bytes())

    def clear_state_program(self) -> bool:
        return True
