import Image from 'next/image';
import Link from 'next/link';

type SiteLogoProps = {
  compact?: boolean;
  footer?: boolean;
};

export function SiteLogo({ compact = false, footer = false }: SiteLogoProps) {
  const textClassName = footer
    ? 'text-secondary'
    : 'text-black';

  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border-[3px] border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <Image
          src="/logo.svg"
          alt="BountyBase logo"
          width={44}
          height={44}
          className="h-full w-full object-cover"
          priority
        />
      </span>
      {!compact ? (
        <span className={`font-black text-xl tracking-tight header-anchor ${textClassName}`}>
          BOUNTYBASE
        </span>
      ) : null}
    </Link>
  );
}
