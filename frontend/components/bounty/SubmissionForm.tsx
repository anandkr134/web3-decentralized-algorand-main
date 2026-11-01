'use client';

import React, { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { Bounty } from '@/types/bounty';
import { algodClient } from '@/lib/algorand';
import {
  buildContractMethodGroup,
  getSubmissionBoxReference,
  getSubmissionProofHash,
  signAndSendTransactionGroup,
} from '@/lib/contract-bounty';
import { readApiError } from '@/lib/api';

interface SubmissionFormProps {
  bounty: Bounty;
  onSubmitted: () => void;
}

export const SubmissionForm = ({ bounty, onSubmitted }: SubmissionFormProps) => {
  const { address, authToken, getAuthHeaders } = useWallet();
  const { user, role } = useAuth();
  const [description, setDescription] = useState('');
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !authToken) return;

    setIsLoading(true);
    const toastId = toast.loading('Submitting your work...');

    try {
      let txId: string | undefined;
      let recoverExistingOnChainSubmission = false;
      if (bounty.escrowMode === 'contract') {
        if (!bounty.contractAppId) {
          throw new Error('Contract-backed bounty is missing its app ID.');
        }
        const suggestedParams = await algodClient.getTransactionParams().do();
        const proofHash = await getSubmissionProofHash(description, deliverableUrl);
        try {
          const { txns, txIds } = buildContractMethodGroup({
            appId: bounty.contractAppId,
            methodSignature: 'submit_work(byte[])void',
            methodArgs: [proofHash],
            sender: address,
            suggestedParams,
            boxes: [getSubmissionBoxReference(address)],
            appAccounts: [bounty.creator],
          });
          await signAndSendTransactionGroup({
            signerAddress: address,
            txns,
            walletMessage: 'Record this submission on the bounty contract',
          });
          txId = txIds[0];
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Contract submission failed.';
          const looksLikeExistingOnChainSubmission =
            message.includes('pc=493') ||
            message.toLowerCase().includes('only one submission per wallet');

          if (!looksLikeExistingOnChainSubmission) {
            throw error;
          }

          recoverExistingOnChainSubmission = true;
        }
      }

      const res = await fetch('/api/submission/submit', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          bountyId: bounty.id,
          description,
          proofLink: deliverableUrl,
          txId,
        }),
      });

      if (!res.ok) throw new Error(await readApiError(res));

      toast.success(
        recoverExistingOnChainSubmission
          ? 'Recovered your existing on-chain submission and synced it into the platform.'
          : 'Submission sent successfully! The bounty creator will review your work.',
        { id: toastId }
      );
      setDescription('');
      setDeliverableUrl('');
      onSubmitted();
    } catch (err: any) {
      toast.error(err.message || 'Submission failed.', { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  if (!address) {
    return (
      <div className="mt-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-center">
        <p className="text-yellow-700 dark:text-yellow-400 font-medium">
          Connect your Pera Wallet to submit work for this bounty.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mt-8 rounded-2xl border-[3px] border-black bg-surface-container p-5 text-center text-on-surface-variant">
        Sign in with Supabase before submitting work for this bounty.
      </div>
    );
  }

  if (role !== 'freelancer') {
    return (
      <div className="mt-8 rounded-2xl border-[3px] border-black bg-surface-container p-5 text-center text-on-surface-variant">
        Only freelancer accounts can submit deliverables. Switch your role in the auth workspace if needed.
      </div>
    );
  }

  if (!authToken) {
    return (
      <div className="mt-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-center">
        <p className="text-yellow-700 dark:text-yellow-400 font-medium">
          Wallet connected, but authentication is still syncing. Reconnect if submission stays locked.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        Submit Your Work
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description of your work
          </label>
          <textarea
            className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 min-h-[120px] transition-shadow"
            placeholder="Explain what you built and how it meets the requirements..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Deliverable URL
          </label>
          <input
            type="url"
            className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 transition-shadow"
            placeholder="https://github.com/your-repo or IPFS link"
            value={deliverableUrl}
            onChange={(e) => setDeliverableUrl(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200 ${
            isLoading
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-[0.98]'
          }`}
        >
          {isLoading ? 'Submitting...' : 'Submit Work'}
        </button>
      </form>
    </div>
  );
};
