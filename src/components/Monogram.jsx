import React from 'react';

// First-letter monogram in a black circle. The "logo" for every game.
export default function Monogram({ name, size = 48 }) {
  const letter = (String(name || '?').trim()[0] || '?').toUpperCase();
  return (
    <div
      className="monogram"
      style={{
        width: size, height: size,
        fontSize: Math.round(size * 0.5),
        lineHeight: `${size}px`,
      }}
      aria-hidden="true"
    >{letter}</div>
  );
}
