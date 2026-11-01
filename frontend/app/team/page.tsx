import Image from 'next/image';
import Link from 'next/link';

const teamMembers = [
  {
    name: 'Sejal Choudhary',
    image: '/team/sejal.jpeg',
    role: 'UI/UX and Frontend Developer',
    accent: 'bg-primary-container text-black',
  },
  {
    name: 'Ajitesh Vishwakarma',
    image: '/team/ajitesh.jpeg',
    role: 'Full-Stack Developer',
    accent: 'bg-secondary text-black',
  },
  {
    name: 'Anurag Jaiswal',
    image: '/team/anurag_jaiswal.jpeg',
    role: 'Backend Developer',
    accent: 'bg-tertiary-fixed text-black',
  },
  {
    name: 'Anand Kumar',
    image: '/team/anand_kumar.jpeg',
    role: 'Frontend Developer',
    accent: 'bg-primary-fixed text-black',
  },
];

const teamPillars = [
  'Secure escrow-backed bounty creation on Algorand',
  'Verified wallet-based submissions from builders',
  'Automated creator-approved winner payouts',
  'Responsive product experience across desktop and mobile',
];

export default function TeamPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <header className="rounded-[2rem] border-[4px] border-black bg-secondary p-6 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-10">
        <p className="text-xs font-black uppercase tracking-[0.3em]">BountyBase Team</p>
        <h1 className="mt-4 font-headline text-4xl uppercase leading-none md:text-6xl">
          Builders Behind
          <br />
          The Escrow.
        </h1>
        <p className="mt-5 max-w-3xl text-base font-semibold leading-7 md:text-lg">
          This is the core team shaping BountyBase around one focused problem statement:
          a decentralized Algorand bounty escrow with secure funds, verified submissions,
          and automated payouts.
        </p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {teamMembers.map((member) => (
          <article
            key={member.name}
            className="overflow-hidden rounded-[2rem] border-[4px] border-black bg-surface-container shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="relative aspect-[4/5] border-b-[4px] border-black bg-surface-container-high">
              <Image
                src={member.image}
                alt={member.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                priority
              />
            </div>
            <div className="p-5">
              <span
                className={`inline-flex rounded-full border-[3px] border-black px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${member.accent}`}
              >
                Core Team
              </span>
              <h2 className="mt-4 font-headline text-2xl uppercase text-primary-container">
                {member.name}
              </h2>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-on-surface">
                {member.role}
              </p>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                Contributing to product execution, on-chain workflow design, and the full-stack delivery
                of the BountyBase platform.
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[2rem] border-[4px] border-black bg-surface-container-high p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-8">
          <h2 className="font-headline text-3xl uppercase text-primary-container md:text-4xl">
            What The Team Is Building
          </h2>
          <ul className="mt-6 space-y-4 text-sm font-semibold leading-7 text-on-surface-variant md:text-base">
            {teamPillars.map((pillar) => (
              <li key={pillar} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-black bg-primary-container text-xs font-black text-black">
                  +
                </span>
                <span>{pillar}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-[2rem] border-[4px] border-black bg-primary-container p-6 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-8">
          <h2 className="font-headline text-3xl uppercase md:text-4xl">Project Mission</h2>
          <p className="mt-5 text-sm font-semibold leading-7 md:text-base">
            Build a trustworthy bounty system where creators commit funds before asking for work,
            builders can submit with wallet identity, and winner payouts happen through validated
            on-chain escrow logic.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/docs"
              className="rounded-full border-[3px] border-black bg-black px-6 py-3 text-sm font-black uppercase tracking-wide text-white"
            >
              Read Docs
            </Link>
            <Link
              href="/bounties"
              className="rounded-full border-[3px] border-black bg-white px-6 py-3 text-sm font-black uppercase tracking-wide"
            >
              Explore Bounties
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
