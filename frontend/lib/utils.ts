/**
 * Truncate an Algorand address for display
 */
export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Convert microALGO to ALGO
 */
export function microAlgoToAlgo(microAlgo: number): number {
  return microAlgo / 1_000_000;
}

/**
 * Convert ALGO to microALGO
 */
export function algoToMicroAlgo(algo: number): number {
  return Math.floor(algo * 1_000_000);
}

/**
 * Format a date string for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Check if a bounty deadline has passed
 */
export function isExpired(deadline: string): boolean {
  return new Date(deadline) < new Date();
}

export function formatBountyStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

/**
 * cn utility for conditionally joining classnames
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
