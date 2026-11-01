'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ConnectWallet } from '@/components/wallet/ConnectWallet';
import { SiteLogo } from '@/components/layout/SiteLogo';
import { useAuth } from '@/hooks/useAuth';

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, role, signOut } = useAuth();
  const createHref = role === 'freelancer' ? '/dashboard/freelancer' : role === 'client' ? '/create' : '/auth';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-[#f3f1dc] dark:bg-[#f3f1dc] rounded-[40px] border-[3px] border-black mt-4 mx-auto w-[95%] max-w-7xl h-[70px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
      <div className="flex items-center gap-2">
        <SiteLogo />
      </div>
      
      <div className="hidden md:flex items-center gap-8">
        <Link href="/" className="text-black border-b-4 border-black font-bold uppercase text-sm tracking-tight transition-all py-1">
          Explore
        </Link>
        <Link href="/team" className="text-black/70 hover:text-black font-bold uppercase text-sm tracking-tight transition-all py-1">
          Team
        </Link>
        <Link href="/bounties" className="text-black/70 hover:text-black font-bold uppercase text-sm tracking-tight transition-all py-1">
          Bounties
        </Link>
        <Link href={createHref} className="text-black/70 hover:text-black font-bold uppercase text-sm tracking-tight transition-all py-1">
          {role === 'freelancer' ? 'Workspace' : 'Create'}
        </Link>
        <Link href="/dashboard" className="text-black/70 hover:text-black font-bold uppercase text-sm tracking-tight transition-all py-1">
          Dashboard
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <div className="hidden lg:flex items-center gap-3">
            <span className="rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase text-black">
              {role ?? 'member'}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase text-black"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <Link
            href="/auth"
            className="hidden rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase text-black lg:inline-flex"
          >
            Sign In
          </Link>
        )}

        <div className="hidden sm:flex items-center gap-3">
          <button className="material-symbols-outlined p-2 text-black hover:translate-x-[2px] hover:translate-y-[2px] transition-all">send</button>
          <button className="material-symbols-outlined p-2 text-black hover:translate-x-[2px] hover:translate-y-[2px] transition-all">groups</button>
        </div>
        
        <div className="flex items-center pl-2">
          {/* We'll use the existing ConnectWallet logic but it may need internal styling to match neo-brutalism */}
          <ConnectWallet />
        </div>
        
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="material-symbols-outlined p-2 text-black md:hidden"
        >
          {isMenuOpen ? "close" : "menu"}
        </button>
      </div>

      {isMenuOpen && (
        <div className="absolute top-[80px] left-0 right-0 bg-[#f3f1dc] border-[3px] border-black rounded-[20px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 flex flex-col gap-4 md:hidden">
          <Link onClick={() => setIsMenuOpen(false)} href="/" className="text-black font-bold uppercase text-sm tracking-tight border-b-2 border-black/10 pb-2">Explore</Link>
          <Link onClick={() => setIsMenuOpen(false)} href="/team" className="text-black font-bold uppercase text-sm tracking-tight border-b-2 border-black/10 pb-2">Team</Link>
          <Link onClick={() => setIsMenuOpen(false)} href="/bounties" className="text-black font-bold uppercase text-sm tracking-tight border-b-2 border-black/10 pb-2">Bounties</Link>
          <Link onClick={() => setIsMenuOpen(false)} href={createHref} className="text-black font-bold uppercase text-sm tracking-tight border-b-2 border-black/10 pb-2">
            {role === 'freelancer' ? 'Workspace' : 'Create'}
          </Link>
          <Link onClick={() => setIsMenuOpen(false)} href="/dashboard" className="text-black font-bold uppercase text-sm tracking-tight pb-2">Dashboard</Link>
          {user ? (
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                void signOut();
              }}
              className="text-left text-black font-bold uppercase text-sm tracking-tight pb-2"
            >
              Sign Out
            </button>
          ) : (
            <Link onClick={() => setIsMenuOpen(false)} href="/auth" className="text-black font-bold uppercase text-sm tracking-tight pb-2">Sign In</Link>
          )}
        </div>
      )}
    </nav>
  );
};
