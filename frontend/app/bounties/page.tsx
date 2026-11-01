import Link from 'next/link';
import { getActiveBounties } from '@/services/bounty.service';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ExploreBountiesPage() {
  const bounties = await getActiveBounties();
  const totalPool = bounties.reduce((sum, bounty) => sum + Number(bounty.reward || 0), 0);

  return (
    <>
      <header className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-5xl md:text-7xl mb-4 text-primary-container tracking-tighter uppercase leading-none font-headline">
              ACTIVE<br/>BOUNTIES
            </h1>
            <p className="text-on-surface text-xl max-w-xl font-light">
              Live bounties are loaded from your FastAPI backend and only appear here after escrow funding is confirmed.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-surface-container-high p-4 border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-[0.65rem] font-bold uppercase text-secondary mb-1">Total Pool</p>
              <p className="text-2xl font-headline text-primary-container">{totalPool.toLocaleString()} ALGO</p>
            </div>
            <div className="bg-surface-container-high p-4 border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-[0.65rem] font-bold uppercase text-secondary mb-1">Live Bounties</p>
              <p className="text-2xl font-headline text-primary-container">{bounties.length}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="mb-12 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
          <input
            className="w-full bg-surface-container-highest border-4 border-black rounded-2xl py-4 pl-12 pr-4 text-on-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none"
            placeholder="Search UI coming next. Current list is fully live."
            type="text"
            disabled
          />
        </div>
        <div className="flex gap-4">
          <Link
            href="/create"
            className="bg-primary-container text-black border-4 border-black px-6 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
          >
            Create New
            <span className="material-symbols-outlined">add</span>
          </Link>
        </div>
      </section>

      {bounties.length ? (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {bounties.map((bounty) => (
            <Link
              key={bounty.id}
              href={`/bounties/${bounty.id}`}
              className="block bg-surface-container-high border-4 border-black rounded-3xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4 group hover:-translate-y-2 transition-transform"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="w-10 h-10 bg-surface-container-highest rounded-lg border-2 border-black flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary-container">code</span>
                </div>
                <span className="bg-primary-container text-black px-3 py-1 rounded-full text-[10px] font-black uppercase border border-black">
                  {bounty.status}
                </span>
              </div>

              <h3 className="text-xl font-headline text-primary-container leading-snug uppercase">
                {bounty.title}
              </h3>

              <p className="text-on-surface-variant text-sm leading-relaxed line-clamp-3">
                {bounty.description}
              </p>

              <div className="mt-auto pt-4 border-t border-white/10 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase font-bold text-on-surface-variant">Reward</p>
                  <p className="font-headline text-2xl text-primary-container">{bounty.reward} ALGO</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase font-bold text-on-surface-variant">Deadline</p>
                  <p className="font-bold text-on-surface">{formatDate(bounty.deadline)}</p>
                </div>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="bg-surface-container border-4 border-black rounded-3xl p-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="font-headline text-3xl text-primary-container mb-4 uppercase">No Open Bounties Yet</h2>
          <p className="text-on-surface-variant mb-6">
            Create and fund the first escrow-backed bounty to populate the marketplace.
          </p>
          <Link
            href="/create"
            className="inline-flex bg-primary-container text-black border-4 border-black px-8 py-4 rounded-full font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            Launch a Bounty
          </Link>
        </section>
      )}
    </>
  );
}
