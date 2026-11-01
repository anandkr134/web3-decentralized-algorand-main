import React from 'react';
import Link from 'next/link';
import { getActiveBounties } from '@/services/bounty.service';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function getNextDeadline(deadlines: string[]) {
  if (!deadlines.length) {
    return 'No deadline scheduled';
  }

  const sorted = [...deadlines].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return formatDate(sorted[0]);
}

export default async function Home() {
  const bounties = await getActiveBounties();
  const featuredBounties = bounties.slice(0, 3);
  const totalRewardPool = bounties.reduce((sum, bounty) => sum + Number(bounty.reward || 0), 0);
  const highestReward = bounties.reduce(
    (maxReward, bounty) => Math.max(maxReward, Number(bounty.reward || 0)),
    0
  );
  const nextDeadline = getNextDeadline(bounties.map((bounty) => bounty.deadline));

  return (
    <>
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-24">
        <div className="lg:col-span-8 flex flex-col justify-center">
          <h1 className="font-headline text-5xl md:text-7xl lg:text-8xl mb-8 leading-none tracking-tighter text-primary">
            ESCROW-BACKED <span className="text-primary-container">ALGORAND</span><br/>FREELANCE BOUNTIES.
          </h1>
          <p className="font-body text-xl md:text-2xl text-on-surface-variant max-w-2xl mb-10">
            BountyBase helps clients fund ALGO bounties, lets freelancers submit real work, and releases payouts
            through Algorand escrow after the winner is approved. Supabase handles account roles, and Pera Wallet
            signs every protected on-chain action.
          </p>
          <div className="flex flex-wrap gap-6">
            <Link href="/auth?mode=signup&role=client&next=/dashboard/client" className="bg-primary-container text-black border-[4px] border-black px-10 py-5 rounded-xl font-headline text-xl neo-brutal-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:scale-95 inline-block text-center">
              HIRE A FREELANCER
            </Link>
            <Link href="/auth?mode=signup&role=freelancer&next=/dashboard/freelancer" className="bg-surface border-[4px] border-primary-container text-primary-container px-10 py-5 rounded-xl font-headline text-xl hover:bg-primary-container/10 transition-colors inline-block text-center">
              EARN MONEY FREELANCING
            </Link>
          </div>
        </div>
        <div className="lg:col-span-4 relative">
          <div className="w-full aspect-square rounded-xl border-[4px] border-black neo-brutal-shadow overflow-hidden relative rotate-3 hover:rotate-0 transition-transform duration-500 bg-[linear-gradient(135deg,#d1ed96_0%,#cbeada_48%,#001710_100%)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.4),transparent_40%)]" />
            <div className="relative flex h-full flex-col justify-between p-6 text-black">
              <div>
                <p className="font-black uppercase tracking-[0.3em] text-black/70">Live Marketplace</p>
                <h2 className="mt-4 font-headline text-4xl uppercase leading-tight">
                  {bounties.length ? `${bounties.length} Open Bount${bounties.length === 1 ? 'y' : 'ies'}` : 'Ready For The First Funded Bounty'}
                </h2>
              </div>

              <div className="space-y-4 rounded-2xl border-[3px] border-black bg-white/85 p-5 backdrop-blur">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold uppercase text-sm">Reward Pool</span>
                  <span className="font-headline text-2xl">{totalRewardPool.toLocaleString()} ALGO</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold uppercase text-sm">Largest Reward</span>
                  <span className="font-headline text-2xl">{highestReward.toLocaleString()} ALGO</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold uppercase text-sm">Next Deadline</span>
                  <span className="font-headline text-xl">{nextDeadline}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-24 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-3xl border-[4px] border-black bg-primary-container p-10 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-black uppercase tracking-[0.3em] opacity-70">Client Track</p>
          <h2 className="mt-4 font-headline text-4xl uppercase md:text-5xl">Fund A Mission. Review Deliveries. Pay The Winner.</h2>
          <p className="mt-5 text-lg font-medium opacity-80">
            Use the client workspace to post bounties, monitor escrow status, and approve the strongest submission.
          </p>
          <Link
            href="/auth?mode=signup&role=client&next=/dashboard/client"
            className="mt-8 inline-block rounded-full border-[4px] border-black bg-black px-8 py-4 font-headline text-lg uppercase text-white shadow-[6px_6px_0px_0px_rgba(255,255,255,0.2)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]"
          >
            Open Client Flow
          </Link>
        </div>

        <div className="rounded-3xl border-[4px] border-black bg-surface-container-high p-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-black uppercase tracking-[0.3em] text-secondary">Freelancer Track</p>
          <h2 className="mt-4 font-headline text-4xl uppercase md:text-5xl">Pick A Bounty. Ship Fast. Stack Wins.</h2>
          <p className="mt-5 text-lg text-on-surface-variant">
            Use the freelancer workspace to discover live challenges, submit proof links, and track every approval.
          </p>
          <Link
            href="/auth?mode=signup&role=freelancer&next=/dashboard/freelancer"
            className="mt-8 inline-block rounded-full border-[4px] border-black bg-secondary px-8 py-4 font-headline text-lg uppercase text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            Open Freelancer Flow
          </Link>
        </div>
      </section>

      {/* Bento Grid Stats & Actions */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-24">
        <div className="md:col-span-2 bg-surface-container border-[4px] border-black p-8 rounded-xl neo-brutal-shadow relative overflow-hidden group">
          <div className="relative z-10">
            <h3 className="font-headline text-3xl mb-4">THE PROTOCOL</h3>
            <p className="text-on-surface-variant mb-6">
              Each bounty is created by an authenticated client wallet, funded into a dedicated Algorand escrow,
              and released only after the client approves a freelancer submission.
            </p>
            <div className="flex gap-2">
              <span className="bg-secondary-container text-secondary px-4 py-1 rounded-full font-bold text-xs uppercase">Pera Wallet Auth</span>
              <span className="bg-primary-container text-black px-4 py-1 rounded-full font-bold text-xs uppercase">Algorand Escrow</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl group-hover:bg-secondary/20 transition-colors"></div>
        </div>
        
        <div className="bg-primary-container border-[4px] border-black p-8 rounded-xl neo-brutal-shadow text-black flex flex-col justify-between">
          <span className="material-symbols-outlined text-4xl">monitoring</span>
          <div>
            <h4 className="font-headline text-2xl">LIVE POOL</h4>
            <p className="font-headline text-4xl">{totalRewardPool.toLocaleString()} ALGO</p>
          </div>
        </div>
        
        <div className="bg-secondary border-[4px] border-black p-8 rounded-xl neo-brutal-shadow text-black flex flex-col justify-between">
          <span className="material-symbols-outlined text-4xl">bolt</span>
          <div>
            <h4 className="font-headline text-2xl">OPEN NOW</h4>
            <p className="font-headline text-4xl">{bounties.length}</p>
          </div>
        </div>
      </section>

      {/* Featured Bounties */}
      <section className="mb-24">
        <div className="flex items-center justify-between mb-12">
          <h2 className="font-headline text-4xl">ACTIVE BOUNTIES</h2>
          <div className="h-1 flex-grow mx-8 bg-surface-container-highest hidden md:block"></div>
          <Link href="/bounties" className="font-headline text-primary-container hover:underline decoration-4 underline-offset-8">VIEW ALL</Link>
        </div>
        
        {featuredBounties.length ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {featuredBounties.map((bounty) => (
              <Link
                key={bounty.id}
                href={`/bounties/${bounty.id}`}
                className="block bg-surface-container-high border-[4px] border-black p-1 rounded-xl neo-brutal-shadow hover:-translate-y-2 transition-transform duration-300"
              >
                <div className="bg-surface p-6 rounded-lg h-full border-[2px] border-outline-variant/20 flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-primary-container/10 rounded-lg">
                      <span className="material-symbols-outlined text-primary-container">code</span>
                    </div>
                    <span className="font-headline text-xs text-primary-container uppercase tracking-widest">
                      Open
                    </span>
                  </div>
                  <h3 className="font-headline text-2xl mb-3 uppercase">{bounty.title}</h3>
                  <p className="text-on-surface-variant mb-8 text-sm leading-relaxed line-clamp-4">
                    {bounty.description}
                  </p>
                  <div className="flex items-center justify-between mt-auto gap-4">
                    <div>
                      <p className="text-xs font-bold text-on-surface-variant uppercase">Reward</p>
                      <p className="font-headline text-xl text-primary-container">
                        {Number(bounty.reward).toLocaleString()} ALGO
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-on-surface-variant uppercase">Deadline</p>
                      <p className="font-bold text-on-surface">{formatDate(bounty.deadline)}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-surface-container border-[4px] border-black rounded-3xl p-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="font-headline text-3xl uppercase text-primary-container">No Live Bounties Yet</h3>
            <p className="mt-4 max-w-2xl text-on-surface-variant">
              The homepage now reads directly from the live marketplace. Fund the first bounty from the client
              dashboard and it will appear here automatically.
            </p>
            <Link
              href="/create"
              className="mt-6 inline-block bg-primary-container text-black border-[4px] border-black px-8 py-4 rounded-full font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              Launch the First Bounty
            </Link>
          </div>
        )}
      </section>

      {/* Final CTA */}
      <section className="bg-primary-container border-[4px] border-black rounded-3xl p-12 text-black flex flex-col md:flex-row items-center gap-12 neo-brutal-shadow-lime">
        <div className="flex-1">
          <h2 className="font-headline text-4xl md:text-5xl mb-4">READY TO USE BOUNTYBASE?</h2>
          <p className="font-body text-xl font-medium opacity-80">
            Clients can launch a funded bounty in minutes. Freelancers can sign in, connect Pera, and submit work to
            live escrows already listed in the marketplace.
          </p>
        </div>
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
          <Link
            href="/auth?mode=signup&role=client&next=/dashboard/client"
            className="bg-black text-white px-8 py-4 rounded-xl font-headline text-xl hover:translate-x-1 hover:translate-y-1 transition-all text-center"
          >
            START AS CLIENT
          </Link>
          <Link
            href="/auth?mode=signup&role=freelancer&next=/dashboard/freelancer"
            className="bg-white border-[4px] border-black px-8 py-4 rounded-xl font-headline text-xl hover:translate-x-1 hover:translate-y-1 transition-all text-center"
          >
            START AS FREELANCER
          </Link>
        </div>
      </section>
    </>
  );
}
