/**
 * Reputation System Configuration
 * ELO-style scoring system for user trustworthiness
 */

export const REPUTATION_CONFIG = {
  // Initial ELO score for new users
  INITIAL_ELO: 1000,

  // Minimum ELO (can't go below)
  MIN_ELO: 0,

  // Maximum ELO (soft cap)
  MAX_ELO: 2000,

  // ============================================
  // ELO GAINS
  // ============================================

  // Booking completed successfully (both parties get this)
  ELO_BOOKING_COMPLETED: 15,

  // Gave a review after booking
  ELO_REVIEW_GIVEN: 5,

  // Received a good review (4-5 stars)
  ELO_GOOD_REVIEW_RECEIVED: 10,

  // Received a neutral review (3 stars)
  ELO_NEUTRAL_REVIEW_RECEIVED: 0,

  // ============================================
  // ELO PENALTIES
  // ============================================

  // Received a bad review (1-2 stars)
  ELO_BAD_REVIEW_PENALTY: -20,

  // Late cancellation (< 24h before scheduled time)
  ELO_LATE_CANCELLATION_PENALTY: -30,

  // Provider cancels after accepting booking
  ELO_PROVIDER_CANCEL_AFTER_ACCEPT_PENALTY: -40,
} as const;

/**
 * Get ELO change based on review score (1-5)
 */
export function getEloChangeForReviewScore(score: number): number {
  if (score >= 4) {
    return REPUTATION_CONFIG.ELO_GOOD_REVIEW_RECEIVED;
  }
  if (score === 3) {
    return REPUTATION_CONFIG.ELO_NEUTRAL_REVIEW_RECEIVED;
  }
  // score 1-2
  return REPUTATION_CONFIG.ELO_BAD_REVIEW_PENALTY;
}

/**
 * Get trust level label based on ELO
 */
export function getTrustLevel(elo: number): {
  level: 'low' | 'medium' | 'high' | 'excellent';
  label: string;
  color: string;
} {
  if (elo >= 1500) {
    return { level: 'excellent', label: 'Excellent', color: 'text-emerald-500' };
  }
  if (elo >= 1200) {
    return { level: 'high', label: 'Très fiable', color: 'text-green-500' };
  }
  if (elo >= 800) {
    return { level: 'medium', label: 'Fiable', color: 'text-yellow-500' };
  }
  return { level: 'low', label: 'Nouveau', color: 'text-gray-500' };
}
