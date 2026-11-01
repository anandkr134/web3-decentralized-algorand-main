'use client';

import algosdk from 'algosdk';
import { peraWallet } from '@/components/wallet/WalletProvider';
import { algodClient } from '@/lib/algorand';

const EMPTY_SIGNER = algosdk.makeEmptyTransactionSigner();
const CONTRACT_APP_ACCOUNT_MIN_BALANCE_MICROALGOS = 100_000;
const CONTRACT_BOX_FLAT_MIN_BALANCE_MICROALGOS = 2_500;
const CONTRACT_BOX_BYTE_MIN_BALANCE_MICROALGOS = 400;
const SUBMISSION_BOX_PREFIX_LENGTH = new TextEncoder().encode('submission:').length;
const SUBMISSION_BOX_KEY_LENGTH = SUBMISSION_BOX_PREFIX_LENGTH + 32;
const SUBMISSION_BOX_VALUE_LENGTH = 32;

export const CONTRACT_SINGLE_SUBMISSION_BOX_MIN_BALANCE_MICROALGOS =
  CONTRACT_BOX_FLAT_MIN_BALANCE_MICROALGOS +
  CONTRACT_BOX_BYTE_MIN_BALANCE_MICROALGOS *
    (SUBMISSION_BOX_KEY_LENGTH + SUBMISSION_BOX_VALUE_LENGTH);

export const CONTRACT_BASE_FUNDING_RESERVE_MICROALGOS =
  CONTRACT_APP_ACCOUNT_MIN_BALANCE_MICROALGOS +
  CONTRACT_SINGLE_SUBMISSION_BOX_MIN_BALANCE_MICROALGOS;

function getBuiltTransactions(atc: algosdk.AtomicTransactionComposer) {
  const txns = atc.buildGroup().map((txnWithSigner) => txnWithSigner.txn);
  return {
    txns,
    txIds: txns.map((txn) => txn.txID()),
  };
}

export async function getSubmissionProofHash(description: string, proofLink: string): Promise<Uint8Array> {
  const normalizedPayload = `description:${description.trim()}\nproofLink:${proofLink.trim()}`;
  const encodedPayload = new TextEncoder().encode(normalizedPayload);
  const digest = await crypto.subtle.digest('SHA-256', encodedPayload);
  return new Uint8Array(digest);
}

export function getSubmissionBoxReference(address: string): algosdk.BoxReference {
  const prefix = new TextEncoder().encode('submission:');
  const accountBytes = algosdk.decodeAddress(address).publicKey;
  const boxName = new Uint8Array(prefix.length + accountBytes.length);
  boxName.set(prefix, 0);
  boxName.set(accountBytes, prefix.length);
  return {
    appIndex: 0,
    name: boxName,
  };
}

export function buildContractFundingGroup({
  amount,
  appId,
  receiver,
  sender,
  suggestedParams,
}: {
  amount: number;
  appId: number;
  receiver: string;
  sender: string;
  suggestedParams: algosdk.SuggestedParams;
}) {
  const fundingTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver,
    amount,
    suggestedParams,
  });

  const atc = new algosdk.AtomicTransactionComposer();
  atc.addMethodCall({
    appID: appId,
    method: algosdk.ABIMethod.fromSignature('fund_bounty(pay)void'),
    methodArgs: [{ txn: fundingTxn, signer: EMPTY_SIGNER }],
    sender,
    suggestedParams,
    signer: EMPTY_SIGNER,
  });

  return getBuiltTransactions(atc);
}

export function buildContractMethodGroup({
  appId,
  methodSignature,
  methodArgs,
  sender,
  suggestedParams,
  boxes,
  appAccounts,
  topUpPayment,
}: {
  appId: number;
  methodSignature: string;
  methodArgs: algosdk.ABIArgument[];
  sender: string;
  suggestedParams: algosdk.SuggestedParams;
  boxes?: algosdk.BoxReference[];
  appAccounts?: string[];
  topUpPayment?: {
    amount: number;
    receiver: string;
  };
}) {
  const atc = new algosdk.AtomicTransactionComposer();
  if (topUpPayment && topUpPayment.amount > 0) {
    atc.addTransaction({
      txn: algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender,
        receiver: topUpPayment.receiver,
        amount: topUpPayment.amount,
        suggestedParams,
      }),
      signer: EMPTY_SIGNER,
    });
  }
  atc.addMethodCall({
    appID: appId,
    method: algosdk.ABIMethod.fromSignature(methodSignature),
    methodArgs,
    sender,
    suggestedParams,
    signer: EMPTY_SIGNER,
    boxes,
    appAccounts,
  });

  return getBuiltTransactions(atc);
}

export async function getContractAppAccountSnapshot(appId: number) {
  const appAddress = algosdk.getApplicationAddress(appId);
  const accountInfo = await algodClient.accountInformation(appAddress).do();

  return {
    appAddress: appAddress.toString(),
    amount: Number(accountInfo.amount ?? 0),
    minBalance: Number(accountInfo.minBalance ?? 0),
    totalBoxes: Number(accountInfo.totalBoxes ?? 0),
  };
}

export function getContractPayoutTopUpAmount({
  appAmount,
  appMinBalance,
  rewardMicroalgos,
}: {
  appAmount: number;
  appMinBalance: number;
  rewardMicroalgos: number;
}) {
  return Math.max(0, rewardMicroalgos + appMinBalance - appAmount);
}

export async function signAndSendTransactionGroup({
  signerAddress,
  txns,
  walletMessage,
}: {
  signerAddress: string;
  txns: algosdk.Transaction[];
  walletMessage: string;
}) {
  if (!peraWallet) {
    throw new Error('Pera Wallet is not ready yet. Reconnect and try again.');
  }

  const signedTransactions = await peraWallet.signTransaction([
    txns.map((txn) => ({
      txn,
      signers: [signerAddress],
      message: walletMessage,
    })),
  ]);

  const txIds = txns.map((txn) => txn.txID());
  await algodClient.sendRawTransaction(signedTransactions).do();
  await algosdk.waitForConfirmation(algodClient, txIds[txIds.length - 1], 8);
  return txIds;
}
