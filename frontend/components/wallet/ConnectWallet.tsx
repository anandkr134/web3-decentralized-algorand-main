'use client';

import React from 'react';
import { useWallet } from '@/hooks/useWallet';

export const ConnectWallet = () => {
  const { address, connectWallet, disconnectWallet } = useWallet();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <div>
      {address ? (
        <button
          onClick={disconnectWallet}
          className="bg-error text-on-error border-2 border-black px-4 py-2 rounded-full font-bold text-sm uppercase active:scale-95 transition-all hover:translate-x-[1px] hover:translate-y-[1px]"
        >
          {formatAddress(address)}
        </button>
      ) : (
        <button
          onClick={connectWallet}
          className="bg-black text-[#f3f1dc] px-6 py-2 rounded-full font-bold text-sm uppercase active:scale-95 transition-all hover:translate-x-[1px] hover:translate-y-[1px]"
        >
          Connect
        </button>
      )}
    </div>
  );
};
