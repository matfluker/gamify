import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { setCurrentUser } from '../auth.js';
import { QUIZ_MAX_POINTS, TEST_MAX_POINTS } from '../config.js';

// In-game first-run popup. Sits on top of GameShell with a translucent
// backdrop. Each slide spotlights a sidebar/board element so the user learns
// where it lives. Stamps users.onboarded_at on finish/close/skip so it never
// reappears. Slide 3's primary CTA also asks GameShell to switch to the
// Quizzes tab so the user can immediately take the Daily Quiz.
const SLIDES = [
  {
    spotlight: 'rank',
    title: 'See where you stand against everyone in your game.',
  },
  {
    spotlight: 'activities',
    title: 'Earn Points to Improve your Score',
    items: [
      `Daily Quiz — up to ${QUIZ_MAX_POINTS} pts`,
      `Daily Test — up to ${TEST_MAX_POINTS} pts`,
      'Learn — unlimited',
    ],
  },
  {
    spotlight: null,
    title: 'Earn your first points!',
    cta: 'Take the Daily Quiz!',
    closeable: true,
  },
];

export default function OnboardingTour({ onSpotlightChange, onDone }) {
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const slide = SLIDES[idx];
  const last = idx === SLIDES.length - 1;

  // Drive the parent's spotlight state as the user moves between slides, and
  // clear it when the tour unmounts so no stale highlight remains.
  useEffect(() => { onSpotlightChange?.(slide.spotlight); }, [slide.spotlight, onSpotlightChange]);
  useEffect(() => () => onSpotlightChange?.(null), [onSpotlightChange]);

  async function finish({ takeQuiz = false } = {}) {
    setBusy(true);
    setErr('');
    try {
      const { user } = await api.post('/api/auth/complete-onboarding', {});
      setCurrentUser(user);
      onDone?.(user, { takeQuiz });
    } catch (e) {
      setErr(e.message || 'Could not finish setup.');
      setBusy(false);
    }
  }

  function next() { if (!last) setIdx(idx + 1); }
  function back() { setIdx(Math.max(0, idx - 1)); }

  return (
    <>
      <div className="tour-backdrop" />
      <div className="tour-popup" role="dialog" aria-label="Welcome tour">
        {slide.closeable && (
          <button
            type="button"
            className="tour-popup-close"
            aria-label="Close"
            onClick={() => finish()}
            disabled={busy}>
            ×
          </button>
        )}
        <h3 className="tour-popup-title">{slide.title}</h3>
        {slide.items && (
          <ul className="tour-points-list">
            {slide.items.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        )}
        {err ? <div className="form-error" style={{ marginTop: 12 }}>{err}</div> : null}

        {last ? (
          <div className="tour-popup-controls solo-cta">
            <div className="tour-dots" aria-hidden="true">
              {SLIDES.map((_, i) => (
                <div key={i} className={`tour-dot ${i === idx ? 'on' : ''}`} />
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => finish({ takeQuiz: true })}
              disabled={busy}>
              {busy ? 'Starting…' : slide.cta}
            </button>
          </div>
        ) : (
          <div className="tour-popup-controls">
            {idx > 0
              ? <button className="btn btn-ghost small" onClick={back} disabled={busy}>← Back</button>
              : <button className="btn btn-ghost small" onClick={() => finish()} disabled={busy}>Skip</button>}
            <div className="tour-dots" aria-hidden="true">
              {SLIDES.map((_, i) => (
                <div key={i} className={`tour-dot ${i === idx ? 'on' : ''}`} />
              ))}
            </div>
            <button className="btn btn-primary small" onClick={next} disabled={busy}>
              Next →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
