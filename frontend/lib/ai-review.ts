export function formatAiReviewMode(mode?: string | null): string {
  if (!mode) {
    return 'Advisory Review';
  }

  return mode
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatAiProvider(provider?: string | null): string {
  if (!provider) {
    return 'AI Review';
  }

  return provider
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getAiRecommendationLabel(recommendation?: string | null): string {
  switch (recommendation) {
    case 'recommended':
      return 'Looks Strong';
    case 'needs_review':
      return 'Needs Review';
    case 'high_risk':
      return 'High Risk';
    default:
      return 'Advisory Review';
  }
}

export function getAiRecommendationSummary(recommendation?: string | null): string {
  switch (recommendation) {
    case 'recommended':
      return 'The submitted proof appears aligned with the bounty brief.';
    case 'needs_review':
      return 'The submission has partial signals, but it still needs manual review.';
    case 'high_risk':
      return 'The evidence shows major mismatch or credibility risk.';
    default:
      return 'AI provided an advisory review for this submission.';
  }
}

export function getCompactEvidencePreview(evidencePreview?: string | null): string | null {
  if (!evidencePreview) {
    return null;
  }

  const normalized = evidencePreview.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized;
}

export function getAiCodeSignalBadges(codeSignals?: Record<string, unknown> | null): string[] {
  if (!codeSignals) {
    return [];
  }

  const badges: string[] = [];
  if (codeSignals.testsPresent) {
    badges.push('Tests detected');
  }
  if (codeSignals.ciPresent) {
    badges.push('CI/build files detected');
  }
  if (codeSignals.contractsPresent) {
    badges.push('Smart-contract files detected');
  }
  if (codeSignals.frontendPresent) {
    badges.push('Frontend structure detected');
  }
  if (codeSignals.backendPresent) {
    badges.push('Backend structure detected');
  }
  if (codeSignals.docsPresent) {
    badges.push('Docs/readme detected');
  }

  const sampledFiles = Array.isArray(codeSignals.sampledFiles) ? codeSignals.sampledFiles.length : 0;
  if (sampledFiles > 0) {
    badges.push(`${sampledFiles} code sample${sampledFiles === 1 ? '' : 's'} reviewed`);
  }

  const totalFilesScanned = typeof codeSignals.totalFilesScanned === 'number' ? codeSignals.totalFilesScanned : null;
  if (totalFilesScanned && totalFilesScanned > 0) {
    badges.push(`${totalFilesScanned} repo files scanned`);
  }

  const repoLanguage =
    typeof codeSignals.repoLanguage === 'string' && codeSignals.repoLanguage.trim()
      ? codeSignals.repoLanguage.trim()
      : null;
  if (repoLanguage) {
    badges.push(`${repoLanguage} repo`);
  }

  return badges;
}
