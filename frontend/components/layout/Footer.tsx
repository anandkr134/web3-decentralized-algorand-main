import { SiteLogo } from '@/components/layout/SiteLogo';
import Link from 'next/link';

export const Footer = () => {
  return (
    <footer className="mt-20 flex w-full flex-col items-center justify-between gap-6 border-t-4 border-black bg-[#001710] px-8 py-12 md:flex-row">
      <div className="flex flex-col gap-2 items-center md:items-start">
        <SiteLogo footer />
        <p className="text-on-surface text-xs font-bold uppercase tracking-widest opacity-80">
          © 2025 BOUNTYBASE. ALL RIGHTS RESERVED.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
        <Link className="text-on-surface text-xs font-bold uppercase tracking-widest transition-colors hover:text-secondary" href="/team">
          Team
        </Link>
        <Link className="text-on-surface text-xs font-bold uppercase tracking-widest transition-colors hover:text-secondary" href="/terms">
          Terms
        </Link>
        <Link className="text-on-surface text-xs font-bold uppercase tracking-widest transition-colors hover:text-secondary" href="/privacy">
          Privacy
        </Link>
        <Link className="text-on-surface text-xs font-bold uppercase tracking-widest transition-colors hover:text-secondary" href="/docs">
          Docs
        </Link>
      </div>

      <div className="flex gap-4">
        <button className="w-10 h-10 rounded-full bg-surface-container-high border-2 border-primary-container flex items-center justify-center text-primary-container hover:bg-secondary hover:text-black transition-colors">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>public</span>
        </button>
        <button className="w-10 h-10 rounded-full bg-surface-container-high border-2 border-primary-container flex items-center justify-center text-primary-container hover:bg-secondary hover:text-black transition-colors">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
        </button>
      </div>
    </footer>
  );
};
