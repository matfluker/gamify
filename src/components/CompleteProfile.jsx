import React, { useState } from 'react';
import { api } from '../api.js';

export default function CompleteProfile({ user, onDone }) {
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!firstName.trim() || !lastName.trim()) { setErr('Both names are required.'); return; }
    setBusy(true);
    try {
      const { user: u } = await api.post('/api/auth/complete-profile', { firstName, lastName });
      onDone(u);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand"><div className="brand-mono">G</div><div className="brand-title">Welcome</div></div>
        <p className="auth-sub">Tell us your name to finish setup.</p>
        <form onSubmit={submit} className="auth-form">
          <label className="field-label">First name</label>
          <input className="text-input" value={firstName} onChange={e=>setFirst(e.target.value)} autoFocus />
          <label className="field-label">Last name</label>
          <input className="text-input" value={lastName} onChange={e=>setLast(e.target.value)} />
          {err ? <div className="form-error">{err}</div> : null}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Continue'}</button>
        </form>
      </div>
    </div>
  );
}
