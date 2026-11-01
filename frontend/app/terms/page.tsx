const termsItems = [
  'Creators are responsible for describing work clearly and funding the bounty escrow before expecting submissions.',
  'Submitters must provide lawful and original work, along with a valid proof link or deliverable reference.',
  'BountyBase acts as a workflow platform for escrow, submission tracking, and creator-approved payout execution.',
  'Payouts can now move through a DAO juror review path when a creator disputes the review window, with jurors voting to release escrow or refund the creator.',
  'AI validation is advisory only. It helps surface likely strong or risky submissions, but final payout decisions remain with the creator or the DAO review council.',
  'Blockchain transactions are final once confirmed on Algorand, and network fees may apply during funding and payout.',
];

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <header className="rounded-[2rem] border-[4px] border-black bg-primary-fixed p-6 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-10">
        <p className="text-xs font-black uppercase tracking-[0.3em]">Terms</p>
        <h1 className="mt-4 font-headline text-4xl uppercase leading-none md:text-6xl">
          Terms
          <br />
          Of Use
        </h1>
        <p className="mt-5 text-base font-semibold leading-7 md:text-lg">
          These terms reflect how BountyBase is intended to be used in its current
          bounty escrow workflow.
        </p>
      </header>

      <section className="rounded-[2rem] border-[4px] border-black bg-surface-container p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-8">
        <ul className="space-y-4 text-sm font-semibold leading-7 text-on-surface-variant md:text-base">
          {termsItems.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-black bg-secondary text-xs font-black text-black">
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
