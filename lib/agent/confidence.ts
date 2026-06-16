// Confidence scoring as specified in AGENTS.md Phase 4

export function computeNewConfidence(
  timesObserved: number,
  currentConfidence: number,
  isContradiction: boolean
): number {
  if (isContradiction) {
    return Math.max(0.1, currentConfidence - 0.3);
  }

  switch (timesObserved) {
    case 1:  return 0.3;
    case 2:  return 0.5;
    case 3:  return 0.7;
    default: return Math.min(0.95, currentConfidence + 0.1);
  }
}

export const AUTO_APPLY_THRESHOLD = 0.8;

export function shouldAutoApply(confidence: number): boolean {
  return confidence >= AUTO_APPLY_THRESHOLD;
}
