'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { PeraWalletConnect } from '@perawallet/connect';
import toast from 'react-hot-toast';

interface WalletContextType {
  address: string | null;
  authToken: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Define type for error locally if not exported from package
interface PeraWalletError extends Error {
  data?: {
    type?: string;
  };
}

// Global instance to handle singleton pattern on client side
export let peraWallet: PeraWalletConnect;

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Authenticate with the backend after wallet connect
  const authenticate = useCallback(async (walletAddress: string, toastId?: string) => {
    try {
      // 1. Get challenge nonce from backend
      const challengeRes = await fetch(`/api/auth/challenge?address=${walletAddress}`);
      if (!challengeRes.ok) throw new Error(`Challenge request failed: ${challengeRes.status}`);
      const challengeData = await challengeRes.json();
      if (!challengeData.success) throw new Error('Failed to get challenge');
      
      const nonce = challengeData.nonce;

      // 2. Sign the nonce using Pera Wallet
      const encoder = new TextEncoder();
      const dataToSign = encoder.encode(nonce);

      if (toastId) toast.loading('Please confirm signature in Pera Wallet...', { id: toastId });

      const signedData = await peraWallet.signData(
        [{ data: dataToSign, message: 'Sign to authenticate with BountyBase' }],
        walletAddress
      );

      // 3. Convert signature to base64
      const signatureBytes = signedData[0];
      const signatureB64 = btoa(String.fromCharCode(...signatureBytes));

      // 4. Verify signature with backend and get JWT
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: walletAddress,
          nonce,
          signature: signatureB64,
        }),
      });

      if (!verifyRes.ok) throw new Error(`Verify request failed: ${verifyRes.status}`);
      const verifyData = await verifyRes.json();
      if (!verifyData.success) throw new Error('Authentication failed');

      setAuthToken(verifyData.token);
      if (toastId) toast.success('Wallet authenticated successfully!', { id: toastId });
      console.log('Wallet authenticated successfully');
    } catch (err: any) {
      console.warn('Authentication skipped (backend may be offline):', err?.message);
      setAuthToken(null);
      if (toastId) {
        toast.error(
          'Wallet connected, but backend auth failed. Protected actions will stay locked until this is fixed.',
          { id: toastId }
        );
      }
      // Still allow wallet connection even if auth fails
      // User can retry auth by disconnecting and reconnecting
    }
  }, []);

  useEffect(() => {
    if (!peraWallet) {
      peraWallet = new PeraWalletConnect({
        shouldShowSignTxnToast: true
      });
    }

    // Reconnect to the session when the component is mounted
    peraWallet.reconnectSession().then((accounts) => {
      // Setup the disconnect event listener
      peraWallet.connector?.on('disconnect', disconnectWallet);

      if (accounts.length) {
        setAddress(accounts[0]);
        // Re-authenticate on reconnect
        authenticate(accounts[0]);
      }
    });

    // Cleanup listener on unmount
    return () => {
      peraWallet.disconnect();
    };
  }, []);

  const connectWallet = async () => {
    const toastId = toast.loading('Waiting for Pera Wallet connection...');
    try {
      const newAccounts = await peraWallet.connect();
      // Setup the disconnect event listener
      peraWallet.connector?.on('disconnect', disconnectWallet);
      const walletAddress = newAccounts[0];
      setAddress(walletAddress);
      
      // Authenticate after connecting
      await authenticate(walletAddress, toastId);
    } catch (err: unknown) {
      const error = err as PeraWalletError;
      if (error?.data?.type !== 'SESSION_CONNECT') {
        console.log('Failed to connect to Pera Wallet:', error);
        toast.error('Failed to connect to Pera Wallet.', { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    }
  };

  const disconnectWallet = () => {
    peraWallet.disconnect();
    setAddress(null);
    setAuthToken(null);
  };

  // Helper to get auth headers for API calls
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
  }, [authToken]);

  return (
    <WalletContext.Provider value={{ address, authToken, connectWallet, disconnectWallet, getAuthHeaders }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
