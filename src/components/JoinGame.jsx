import React, { useState } from 'react';
import { api } from '../api.js';

export default function JoinGame({ onCancel, onJoined }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const { game } = await api.post('/api/games/join', { shareCode: code.trim().toUpperCase() });
      onJoined(game);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="hub">
      <header className="hub-header">
        <button className="btn btn-ghost" onClick={onCancel}>← Back</button>
        <div className="brand"><div className="brand-mono">G</div><div className="brand-title">Join</div></div>
        <div style={{width:80}} />
      </header>
      <main className="hub-main narrow">
        <h1 className="hub-greeting">Join a Gamify</h1>
        <p className="hub-sub">Enter the 6-character share code.</p>
        <form onSubmit={submit} className="auth-form">
          <input className="text-input code-input" autoFocus
            value={code} onChange={e=>setCode(e.target.value.toUpperCase())}
            placeholder="ABC123" maxLength={12} />
          {err ? <div className="form-error">{err}</div> : null}
          <button className="btn btn-primary" disabled={busy}>{busy?'Joining…':'Join'}</button>
        </form>
      </main>
    </div>
  );
}
