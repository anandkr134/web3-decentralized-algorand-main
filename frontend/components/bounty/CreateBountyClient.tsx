'use client';

import { FormEvent, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useWallet } from '@/hooks/useWallet';
import { algodClient } from '@/lib/algorand';
import { readApiError } from '@/lib/api';
import { buildContractFundingGroup, signAndSendTransactionGroup } from '@/lib/contract-bounty';

interface CreatedBounty {
  bountyId: string;
  escrowAddress: string;
  reward: number;
  requiredFundingAmount: number;
  requiredFundingMicroalgos: number;
  payoutFeeBufferAmount: number;
  escrowMode?: 'account' | 'contract';
  contractAppId?: number;
  contractDeploymentTxId?: string;
  contractBootstrapTxId?: string;
}

export function CreateBountyClient() {
  const { address, authToken, connectWallet, getAuthHeaders } = useWallet();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('100');
  const [deadline, setDeadline] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [createdBounty, setCreatedBounty] = useState<CreatedBounty | null>(null);
  const [fundingTxId, setFundingTxId] = useState<string | null>(null);

  const rewardValue = Number(reward) || 0;
  const minDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!address) {
      await connectWallet();
      return;
    }

    if (!authToken) {
      toast.error('Wallet authentication is still syncing. Please reconnect and try again.');
      return;
    }

    setIsCreating(true);
    const toastId = toast.loading('Creating bounty escrow...');

    try {
      const response = await fetch('/api/bounty/create', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title,
          description,
          reward: rewardValue,
          deadline,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = await response.json();
      setCreatedBounty({
        bountyId: payload.bountyId,
        escrowAddress: payload.escrowAddress,
        reward: payload.reward,
        requiredFundingAmount: payload.requiredFundingAmount,
        requiredFundingMicroalgos: payload.requiredFundingMicroalgos,
        payoutFeeBufferAmount: payload.payoutFeeBufferAmount,
        escrowMode: payload.escrowMode,
        contractAppId: payload.contractAppId,
        contractDeploymentTxId: payload.contractDeploymentTxId,
        contractBootstrapTxId: payload.contractBootstrapTxId,
      });
      setFundingTxId(null);
      toast.success('Escrow created. Fund it to open the bounty.', { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to create bounty right now.',
        { id: toastId }
      );
    } finally {
      setIsCreating(false);
    }
  };

  const confirmFunding = async (txId: string) => {
    if (!createdBounty) {
      throw new Error('No bounty is waiting for funding confirmation.');
    }

    const confirmResponse = await fetch('/api/bounty/confirm', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        bountyId: createdBounty.bountyId,
        txId,
      }),
    });

    if (!confirmResponse.ok) {
      throw new Error(await readApiError(confirmResponse));
    }

    setFundingTxId(txId);
  };

  const handleFundEscrow = async () => {
    if (!address || !authToken || !createdBounty) {
      return;
    }

    setIsFunding(true);
    const toastId = toast.loading('Preparing ALGO funding transaction...');

    try {
      const suggestedParams = await algodClient.getTransactionParams().do();
      toast.loading('Waiting for on-chain confirmation...', { id: toastId });

      let fundingTxId: string;
      if (createdBounty.escrowMode === 'contract') {
        if (!createdBounty.contractAppId) {
          throw new Error('Contract-backed bounty is missing its app ID.');
        }

        const { txns, txIds } = buildContractFundingGroup({
          appId: createdBounty.contractAppId,
          amount: createdBounty.requiredFundingMicroalgos,
          receiver: createdBounty.escrowAddress,
          sender: address,
          suggestedParams,
        });
        await signAndSendTransactionGroup({
          signerAddress: address,
          txns,
          walletMessage: `Fund bounty contract with ${createdBounty.requiredFundingAmount} ALGO`,
        });
        fundingTxId = txIds[0];
      } else {
        const fundingTxn = (await import('algosdk')).default.makePaymentTxnWithSuggestedParamsFromObject({
          sender: address,
          receiver: createdBounty.escrowAddress,
          amount: createdBounty.requiredFundingMicroalgos,
          suggestedParams,
        });
        const txIds = await signAndSendTransactionGroup({
          signerAddress: address,
          txns: [fundingTxn],
          walletMessage: `Fund bounty escrow with ${createdBounty.requiredFundingAmount} ALGO`,
        });
        fundingTxId = txIds[0];
      }

      setFundingTxId(fundingTxId);
      await confirmFunding(fundingTxId);
      toast.success('Escrow funded. Your bounty is now open.', { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Funding failed before backend confirmation. If the payment was sent, retry confirmation below.',
        { id: toastId }
      );
    } finally {
      setIsFunding(false);
    }
  };

  const handleCopyEscrow = async () => {
    if (!createdBounty?.escrowAddress) return;

    try {
      await navigator.clipboard.writeText(createdBounty.escrowAddress);
      toast.success('Escrow address copied.');
    } catch {
      toast.error('Could not copy the escrow address.');
    }
  };

  return (
    <>
      <header className="mb-12">
        <h1 className="font-headline text-4xl md:text-6xl text-primary-container uppercase tracking-tight mb-4">
          Launch New Bounty
        </h1>
        <p className="text-on-surface-variant text-lg max-w-2xl">
          Create the bounty first, then fund the generated escrow with your Pera wallet to publish it live.
          The funding total includes a small on-chain fee buffer so the escrow can pay the winner and close out cleanly.
        </p>
      </header>

      <form className="grid grid-cols-1 md:grid-cols-12 gap-8" onSubmit={handleCreate}>
        <div className="md:col-span-8 space-y-8">
          <section className="bg-surface-container p-8 rounded-xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-secondary text-on-secondary w-8 h-8 flex items-center justify-center rounded-full font-headline text-sm">01</span>
              <h2 className="font-headline text-xl uppercase">Core Mission</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block font-bold mb-2 uppercase text-sm tracking-wider">Bounty Title</label>
                <input
                  className="w-full bg-surface-container-highest border-4 border-black rounded-lg p-4 focus:ring-0 focus:border-primary-container text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-shadow focus:shadow-[4px_4px_0px_0px_#D1ED96]"
                  placeholder="e.g., Build an AVM indexer"
                  type="text"
                  minLength={3}
                  maxLength={140}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block font-bold mb-2 uppercase text-sm tracking-wider">Mission Brief</label>
                <textarea
                  className="w-full bg-surface-container-highest border-4 border-black rounded-lg p-4 focus:ring-0 focus:border-primary-container text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-shadow focus:shadow-[4px_4px_0px_0px_#D1ED96]"
                  placeholder="Describe the technical requirements and acceptance criteria..."
                  rows={8}
                  minLength={10}
                  maxLength={5000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                />
              </div>
            </div>
          </section>

          {createdBounty ? (
            <section className="bg-surface-container-high border-4 border-black rounded-xl p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-primary-container text-black w-8 h-8 flex items-center justify-center rounded-full font-headline text-sm">02</span>
                <h2 className="font-headline text-xl uppercase">Escrow Funding</h2>
              </div>

              <p className="text-on-surface-variant mb-6">
                {createdBounty.escrowMode === 'contract'
                  ? 'The backend deployed and bootstrapped a contract-backed bounty app. Fund the app address with exactly '
                  : 'The backend generated a dedicated escrow account. Fund it with exactly '}
                {createdBounty.requiredFundingAmount} ALGO to move the bounty into the open marketplace.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-surface border-4 border-black rounded-xl p-5">
                  <p className="text-xs uppercase font-bold text-on-surface-variant mb-2">Winner Reward</p>
                  <p className="font-headline text-2xl text-primary-container">
                    {createdBounty.reward} ALGO
                  </p>
                </div>
                <div className="bg-surface border-4 border-black rounded-xl p-5">
                  <p className="text-xs uppercase font-bold text-on-surface-variant mb-2">
                    {createdBounty.escrowMode === 'contract' ? 'Contract Reserve' : 'Payout Fee Buffer'}
                  </p>
                  <p className="font-headline text-2xl text-primary-container">
                    {createdBounty.payoutFeeBufferAmount} ALGO
                  </p>
                </div>
              </div>

              <div className="bg-surface border-4 border-black rounded-xl p-5 mb-6">
                <p className="text-xs uppercase font-bold text-on-surface-variant mb-2">Escrow Address</p>
                <p className="break-all font-mono text-sm">{createdBounty.escrowAddress}</p>
              </div>

              {createdBounty.escrowMode === 'contract' ? (
                <div className="bg-surface border-4 border-black rounded-xl p-5 mb-6 space-y-3">
                  <div>
                    <p className="text-xs uppercase font-bold text-on-surface-variant mb-2">Escrow Mode</p>
                    <p className="font-headline text-lg text-primary-container">Contract-backed</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase font-bold text-on-surface-variant mb-2">Contract App ID</p>
                    <p className="break-all font-mono text-sm">{createdBounty.contractAppId}</p>
                  </div>
                </div>
              ) : null}

              <p className="text-sm text-on-surface-variant mb-6">
                The winner still receives exactly {createdBounty.reward} ALGO. For contract-backed bounties, the reserve keeps the app account above Algorand minimum-balance rules during payout and the first submission box. Extra submissions can still require a small approval-time top-up. For account-backed escrows, the remaining fee buffer covers payout execution costs.
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={handleFundEscrow}
                  disabled={isFunding}
                  className="bg-primary-container text-black border-4 border-black rounded-full px-8 py-4 font-headline text-lg uppercase shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isFunding ? 'Funding Escrow...' : 'Fund With Pera'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyEscrow}
                  className="bg-surface border-4 border-primary-container text-primary-container px-6 py-4 rounded-full font-bold uppercase"
                >
                  Copy Address
                </button>
                {fundingTxId ? (
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const toastId = toast.loading('Retrying funding confirmation...');
                        try {
                          await confirmFunding(fundingTxId);
                          toast.success('Funding confirmed with the backend.', { id: toastId });
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : 'Retry confirmation failed.',
                            { id: toastId }
                          );
                        }
                      })();
                    }}
                    className="bg-secondary text-black border-4 border-black px-6 py-4 rounded-full font-bold uppercase"
                  >
                    Retry Confirmation
                  </button>
                ) : null}
              </div>

              {fundingTxId ? (
                <p className="mt-6 text-sm text-primary-container break-all">
                  Funding transaction: {fundingTxId}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>

        <aside className="md:col-span-4 space-y-8">
          <section className="bg-primary-container text-black p-8 rounded-xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10">
              <span className="material-symbols-outlined text-9xl">payments</span>
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="bg-black text-white w-8 h-8 flex items-center justify-center rounded-full font-headline text-sm">03</span>
                <h2 className="font-headline text-xl uppercase">Reward Pool</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block font-bold mb-2 uppercase text-xs tracking-wider">Prize (ALGO)</label>
                  <input
                    className="w-full bg-white/20 border-4 border-black rounded-lg p-4 font-headline text-2xl focus:ring-0 focus:border-black text-black outline-none"
                  type="number"
                  min="1"
                  step="0.1"
                  value={reward}
                  onChange={(event) => setReward(event.target.value)}
                    required
                  />
                </div>

                <div className="p-4 bg-white/10 rounded-lg border-2 border-black/20">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold opacity-70">Escrow Funding</span>
                    <span className="font-bold">{rewardValue || 0} ALGO</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-black/10">
                    <span className="text-sm font-bold uppercase">Creator Wallet</span>
                    <span className="font-headline text-sm">
                      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-secondary-container text-on-secondary-container p-8 rounded-xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-black text-white w-8 h-8 flex items-center justify-center rounded-full font-headline text-sm">04</span>
              <h2 className="font-headline text-xl uppercase">Timeline</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-bold mb-1 uppercase text-xs tracking-wider">Submission Deadline</label>
                <input
                  className="w-full bg-black/20 border-4 border-black rounded-lg p-3 focus:ring-0 focus:border-black text-white outline-none cursor-pointer"
                  type="date"
                  min={minDate}
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  required
                />
              </div>
              <p className="text-xs opacity-70 leading-relaxed italic">
                The backend rejects deadlines in the past and keeps the bounty pending until escrow is funded.
              </p>
            </div>
          </section>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isCreating}
              className="w-full bg-primary-container text-black border-4 border-black rounded-full py-5 font-headline text-xl uppercase shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Deploying Escrow...' : 'Deploy Bounty'}
              <span className="material-symbols-outlined">rocket_launch</span>
            </button>
            <p className="text-center text-xs mt-4 uppercase font-bold tracking-widest opacity-50">
              {address ? 'Authenticated wallet ready' : 'Connect wallet to create'}
            </p>
          </div>
        </aside>
      </form>
    </>
  );
}
