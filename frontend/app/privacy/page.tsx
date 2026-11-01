const privacyItems = [
  'BountyBase stores bounty records, submissions, wallet addresses, and workflow status needed to run the platform.',
  'Wallet authentication uses signed challenges, and the backend issues JWT sessions after signature verification.',
  'Submission content is currently stored as text and proof links provided by users. Do not submit confidential information through public URLs.',
  'On-chain Algorand transactions are public by design, so funding and payout actions can be observed on the network.',
  'Operational secrets such as escrow encryption keys and backend service credentials stay on the server side and are not exposed in the frontend.',
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <header className="rounded-[2rem] border-[4px] border-black bg-tertiary-fixed p-6 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-10">
        <p className="text-xs font-black uppercase tracking-[0.3em]">Privacy</p>
        <h1 className="mt-4 font-headline text-4xl uppercase leading-none md:text-6xl">
          Privacy
          <br />
          Policy
        </h1>
        <p className="mt-5 text-base font-semibold leading-7 md:text-lg">
          This project uses wallet-based identity and backend-managed platform storage to
          operate bounty escrow, submission review, and winner payouts.
        </p>
      </header>

      <section className="rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-8">
        <ul className="space-y-4 text-sm font-semibold leading-7 text-on-surface-variant md:text-base">
          {privacyItems.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-black bg-primary-container text-xs font-black text-black">
                +
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
