import { TIER_THRESHOLDS, TIER_COLORS, TIERS } from '../config.js';

// Map total points -> tier name. Bands per spec:
//   Rookie:       0–99
//   Professional: 100–199
//   Elite:        200–349
//   Veteran:      350–599
//   Master:       600+
export function tierForPoints(points) {
  const p = Number(points || 0);
  if (p < TIER_THRESHOLDS[0]) return 'Rookie';
  if (p < TIER_THRESHOLDS[1]) return 'Professional';
  if (p < TIER_THRESHOLDS[2]) return 'Elite';
  if (p < TIER_THRESHOLDS[3]) return 'Veteran';
  return 'Master';
}

export function colorForTier(tier) {
  return TIER_COLORS[tier] || TIER_COLORS.Rookie;
}

export function tierInfo(name) {
  return TIERS.find(t => t.name === name) || TIERS.find(t => t.name === 'Rookie');
}

export function rangeForTier(tier) {
  const t = tierInfo(tier);
  return t.max == null ? `${t.min}+ pts` : `${t.min}–${t.max} pts`;
}
