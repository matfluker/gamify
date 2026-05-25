import React, { useState } from 'react';
import { api } from '../api.js';
import { normalizePhone, isValidPhone, formatPhoneForDisplay } from '../utils/phone.js';

export default function LoginScreen({ onSignedIn }) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!isValidPhone(phone)) { setErr('Please enter a valid phone number.'); return; }
    setBusy(true);
    try {
      const { user } = await api.post('/api/auth/login', { phone: normalizePhone(phone) });
      onSignedIn(user);
    } catch (e2) {
      setErr(e2.message || 'Could not sign in.');
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <div className="brand-mono">G</div>
          <div className="brand-title">Gamify</div>
        </div>
        <p className="auth-sub">Sign in with your phone number.</p>
        <form onSubmit={submit} className="auth-form">
          <label className="field-label">Phone</label>
          <input
            inputMode="tel"
            autoComplete="tel"
            placeholder="(404) 555-1234"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="text-input"
            autoFocus
          />
          {err ? <div className="form-error">{err}</div> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Continue'}
          </button>
          {phone && isValidPhone(phone)
            ? <div className="hint">Will sign in as {formatPhoneForDisplay(phone)}</div>
            : null}
        </form>
      </div>
    </div>
  );
}
