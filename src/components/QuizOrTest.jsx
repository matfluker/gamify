import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Shared component for both the daily Quiz and the daily Test.
// Behavior matches the spec:
//  - Identical question set for everyone in the game on a given day.
//  - One attempt per user per day; locked after taking.
//  - "Not enough content yet" state when the game has too few pairs.
export default function QuizOrTest({ game, kind, length, onGoToLeaderboard }) {
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [justEarnedPoints, setJustEarnedPoints] = useState(null);

  async function load() {
    setErr('');
    try {
      const d = await api.get(`/api/games/${game.id}/${kind}`);
      setData(d);
      if (d?.locked && d?.attempt) setResult(d.attempt);
      else setResult(null);
      setIdx(0);
      setAnswers(new Array(d?.questions?.length || 0).fill(null));
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, [game.id, kind]);

  if (err) return <div className="form-error">{err}</div>;
  if (!data) return <div className="empty">Loading…</div>;
  if (!data.available) {
    return (
      <div className="tab-pad">
        <h1 className="tab-title">{kind === 'quiz' ? 'Daily Quiz' : 'Daily Test'}</h1>
        <div className="empty-card">
          <h3>Not enough content yet</h3>
          <p>This game needs at least {length} pairs before {kind === 'quiz' ? 'a quiz' : 'a test'} is available.</p>
          <p className="muted small">Have {data.have} of {data.needed}.</p>
        </div>
      </div>
    );
  }

  // Already taken today / just finished. Quiz/Test grading is 1pt per correct,
  // so points earned == result.correct — even when revisiting a prior attempt.
  if (result) {
    const pointsEarned = justEarnedPoints != null ? justEarnedPoints : Number(result.correct || 0);
    return (
      <div className="tab-pad">
        <h1 className="tab-title">{kind === 'quiz' ? 'Daily Quiz' : 'Daily Test'}</h1>
        <div className="result-card">
          <div className="muted small">Today's result · locked until tomorrow</div>
          <div className="big-score ok-text">{result.correct}/{result.total}</div>
          <div className="points-earned-line ok-text">
            You earned +{pointsEarned} {pointsEarned === 1 ? 'point' : 'points'} for this {kind === 'quiz' ? 'quiz' : 'test'}.
          </div>
          {onGoToLeaderboard ? (
            <button className="btn btn-primary result-cta" onClick={onGoToLeaderboard}>
              See your standing →
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const questions = data.questions || [];
  const q = questions[idx];

  function pick(opt) {
    const next = answers.slice();
    next[idx] = opt;
    setAnswers(next);
  }

  async function submit() {
    if (answers.some(a => a == null)) {
      setErr('Answer every question before submitting.');
      return;
    }
    setBusy(true);
    try {
      const out = await api.post(`/api/games/${game.id}/${kind}`, { answers });
      setResult(out.attempt);
      setJustEarnedPoints(Number(out.points || 0));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div className="tab-pad">
      <h1 className="tab-title">{kind === 'quiz' ? 'Daily Quiz' : 'Daily Test'}</h1>
      <p className="hub-sub">
        {kind === 'quiz' ? `${length} questions · once per day` : `${length} questions · once per day`}
      </p>

      <div className="qt-progress">Question {idx + 1} of {questions.length}</div>
      <div className="qt-bar">
        <div className="qt-bar-fill" style={{ width: `${((idx+1)/questions.length)*100}%` }} />
      </div>

      <div className="qt-card">
        <div className="qt-prompt">{q.prompt}</div>
        <div className="qt-options">
          {q.options.map((opt, i) => (
            <button
              key={i}
              className={`qt-option ${answers[idx]===opt ? 'sel' : ''}`}
              onClick={() => pick(opt)}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="qt-controls">
        <button className="btn btn-ghost" disabled={idx===0} onClick={()=>setIdx(idx-1)}>← Back</button>
        {idx < questions.length - 1
          ? <button className="btn btn-primary" disabled={answers[idx]==null} onClick={()=>setIdx(idx+1)}>Next →</button>
          : <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy?'Submitting…':'Submit'}</button>}
      </div>
      {err ? <div className="form-error">{err}</div> : null}
    </div>
  );
}
