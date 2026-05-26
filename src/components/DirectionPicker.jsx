import React from 'react';

// Shared selector for the per-game direction setting. Used in CreateGame
// (step 2) and EditPairs.
const OPTIONS = [
  { value: 'term',       label: 'Show term',       hint: 'Player sees the term and recalls the definition.' },
  { value: 'definition', label: 'Show definition', hint: 'Player sees the definition and recalls the term.' },
  { value: 'shuffle',    label: 'Shuffle',         hint: 'Each card randomly picks one direction or the other.' },
];

export default function DirectionPicker({ value, onChange }) {
  return (
    <div className="direction-picker">
      <div className="field-label">Prompt direction</div>
      <div className="direction-options">
        {OPTIONS.map(o => (
          <button
            key={o.value}
            type="button"
            className={`direction-option ${value === o.value ? 'sel' : ''}`}
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
          >
            <div className="direction-option-label">{o.label}</div>
            <div className="direction-option-hint">{o.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
