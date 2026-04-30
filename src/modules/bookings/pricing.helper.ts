// Pure helper for loyalty pricing surcharge.
// Mirror of the frontend logic — keep in sync if the rule changes.

export interface PricingTier {
  thresholdWeeks: number;
  surchargeCents: number;
}

export interface LoyaltyResult {
  surchargeCents: number;
  appliedTierWeeks: number | null;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Picks the highest matching tier whose threshold is <= the elapsed weeks
 * since the last completed booking. First-time bookings (lastCompletedAt is
 * null) and clients still within the smallest threshold pay the base price.
 */
export function computeLoyaltySurcharge(
  tiers: PricingTier[],
  lastCompletedAt: Date | null,
  scheduledAt: Date,
): LoyaltyResult {
  if (!lastCompletedAt || tiers.length === 0) {
    return { surchargeCents: 0, appliedTierWeeks: null };
  }

  const elapsedMs = scheduledAt.getTime() - lastCompletedAt.getTime();
  if (elapsedMs <= 0) {
    return { surchargeCents: 0, appliedTierWeeks: null };
  }
  const weeksSinceLast = elapsedMs / MS_PER_WEEK;

  let matched: PricingTier | null = null;
  for (const tier of tiers) {
    if (weeksSinceLast >= tier.thresholdWeeks) {
      if (!matched || tier.thresholdWeeks > matched.thresholdWeeks) {
        matched = tier;
      }
    }
  }

  return matched
    ? { surchargeCents: matched.surchargeCents, appliedTierWeeks: matched.thresholdWeeks }
    : { surchargeCents: 0, appliedTierWeeks: null };
}
