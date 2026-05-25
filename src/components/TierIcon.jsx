import React from 'react';
import { colorForTier } from '../utils/tiers.js';

// Inline SVG icon per tier. Each tier gets a distinct silhouette so the user
// can recognize it without reading the label. Color comes from TIER_COLORS.
// When `outlined` is true, the icon also gets a thick white stroke so it
// stays visible on a same-color tier pill background.
export default function TierIcon({ tier, size = 18, outlined = false }) {
  const color = colorForTier(tier);
  const stroke = outlined ? '#ffffff' : 'none';
  const strokeWidth = outlined ? 1.5 : 0;
  const props = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true };
  const pathProps = { fill: color, stroke, strokeWidth, strokeLinejoin: 'round' };
  switch (tier) {
    case 'Professional': // shield
      return (
        <svg {...props}>
          <path d="M12 2L4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z" {...pathProps} />
        </svg>
      );
    case 'Elite': // star
      return (
        <svg {...props}>
          <path d="M12 2l2.9 6.1 6.6.6-5 4.6 1.5 6.5L12 16.9 5.9 19.8 7.4 13.3l-5-4.6 6.7-.6L12 2z" {...pathProps} />
        </svg>
      );
    case 'Veteran': // diamond
      return (
        <svg {...props}>
          <path d="M12 2l8 8-8 12-8-12 8-8z" {...pathProps} />
        </svg>
      );
    case 'Master': // crown
      return (
        <svg {...props}>
          <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z" {...pathProps} />
        </svg>
      );
    case 'Rookie':
    default: // circle
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" fill={color} stroke={stroke} strokeWidth={strokeWidth} />
        </svg>
      );
  }
}
