import React, { useState } from 'react';
import { api } from '../api.js';
import { normalizePhone, isValidPhone, formatPhoneForDisplay } from '../utils/phone.js';

// Magic-link landing. The shareCode is read from the URL. We ask for phone
// first and check whether that phone is already known — returning users skip
// the name fields entirely. New phones get a second step that collects name
// before enrolling.
export default function InviteJoin({ shareCode, onJoined }) {
  const [phone, setPhone] = useState('');
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [knownUser, setKnownUser] = useState(null); // { firstName, lastName } when phone is recognized
  const [step, setStep] = useState('phone');        // 'phone' | 'name' | 'confirm'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function lookupPhone(e) {
    e.preventDefault();
    setErr('');
    if (!isValidPhone(phone)) { setErr('Please enter a valid phone number.'); return; }
    setBusy(true);
    try {
      const r = await api.post('/api/auth/lookup', { phone: normalizePhone(phone) });
      if (r.exists && r.hasName) {
        setKnownUser({ firstName: r.firstName, lastName: r.lastName });
        setStep('confirm');
      } else {
        setStep('name');
      }
    } catch (e2) { setErr(e2.message || 'Could not check phone.'); }
    finally { setBusy(false); }
  }

  async function join(extra = {}) {
    setErr('');
    setBusy(true);
    try {
      const { user, game } = await api.post('/api/auth/invite-join', {
        shareCode,
        phone: normalizePhone(phone),
        firstName: extra.firstName || firstName,
        lastName:  extra.lastName  || lastName,
      });
      onJoined(user, game);
    } catch (e2) { setErr(e2.message || 'Could not join.'); }
    finally { setBusy(false); }
  }

  function submitName(e) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { setErr('Enter your first and last name.'); return; }
    join();
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand"><div className="brand-mono">G</div><div className="brand-title">Gamify</div></div>
        <h2 style={{ marginTop: 8 }}>You're invited</h2>

        {step === 'phone' && (
          <>
            <p className="auth-sub">Enter your phone to join.</p>
            <form onSubmit={lookupPhone} className="auth-form">
              <label className="field-label">Phone</label>
              <input className="text-input" inputMode="tel" autoComplete="tel"
                placeholder="(404) 555-1234" autoFocus
                value={phone} onChange={e=>setPhone(e.target.value)} />
              {phone && isValidPhone(phone) ? (
                <div className="hint">Will sign in as {formatPhoneForDisplay(phone)}</div>
              ) : null}
              {err ? <div className="form-error">{err}</div> : null}
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
            </form>
          </>
        )}

        {step === 'confirm' && knownUser && (
          <>
            <p className="auth-sub">
              Welcome back, {knownUser.firstName}. Join this game?
            </p>
            {err ? <div className="form-error">{err}</div> : null}
            <button className="btn btn-primary" disabled={busy}
              onClick={() => join({ firstName: knownUser.firstName, lastName: knownUser.lastName })}>
              {busy ? 'Joining…' : 'Join the game'}
            </button>
            <button className="btn" type="button" disabled={busy}
              style={{ marginTop: 8 }}
              onClick={() => { setKnownUser(null); setStep('phone'); }}>
              Not you? Use a different phone
            </button>
          </>
        )}

        {step === 'name' && (
          <>
            <p className="auth-sub">First time here — tell us your name.</p>
            <form onSubmit={submitName} className="auth-form">
              <label className="field-label">First name</label>
              <input className="text-input" autoFocus
                value={firstName} onChange={e=>setFirst(e.target.value)} />
              <label className="field-label">Last name</label>
              <input className="text-input"
                value={lastName} onChange={e=>setLast(e.target.value)} />
              {err ? <div className="form-error">{err}</div> : null}
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Joining…' : 'Join the game'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
