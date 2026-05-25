import React, { useState } from 'react';
import { api } from '../api.js';
import Monogram from './Monogram.jsx';
import InviteFriends from './InviteFriends.jsx';

const BLANK_ROWS = 5;
function makeRows(n) { return Array.from({ length: n }, () => ({ term: '', definition: '', flagged: false })); }

export default function CreateGame({ onCancel, onCreated }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState(makeRows(BLANK_ROWS));
  const [pasteText, setPasteText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [createdGame, setCreatedGame] = useState(null);

  function updateRow(i, key, val) {
    setRows(rows.map((r, idx) => idx === i ? { ...r, [key]: val, flagged: false } : r));
  }
  function addRows() { setRows([...rows, ...makeRows(BLANK_ROWS)]); }
  function deleteRow(i) { setRows(rows.filter((_, idx) => idx !== i)); }

  // Parse tab-separated text. Each line: "term<TAB>definition".
  // Malformed lines (no tab, or missing either field) are still added but
  // FLAGGED yellow so the user can find and fix them before saving.
  function fillFromPaste() {
    const text = pasteText.replace(/\r\n?/g, '\n');
    if (!text.trim()) return;
    const incoming = text.split('\n').map(line => {
      if (!line.trim()) return null;
      const idx = line.indexOf('\t');
      if (idx === -1) {
        return { term: line.trim(), definition: '', flagged: true };
      }
      const term = line.slice(0, idx).trim();
      const definition = line.slice(idx + 1).trim();
      const flagged = !term || !definition;
      return { term, definition, flagged };
    }).filter(Boolean);

    // Drop trailing blank rows in the current editor before appending so paste
    // fills empty slots first instead of stacking on top of empties.
    const trimmedExisting = [...rows];
    while (trimmedExisting.length && !trimmedExisting[trimmedExisting.length - 1].term && !trimmedExisting[trimmedExisting.length - 1].definition) {
      trimmedExisting.pop();
    }
    setRows([...trimmedExisting, ...incoming]);
    setPasteText('');
  }

  async function submit() {
    setErr('');
    const cleanPairs = rows.map(r => ({ term: r.term.trim(), definition: r.definition.trim() }))
      .filter(r => r.term && r.definition);
    if (cleanPairs.length === 0) { setErr('Add at least one term and definition.'); return; }
    setBusy(true);
    try {
      const { game } = await api.post('/api/games', { title: title.trim(), pairs: cleanPairs });
      // Show the Share popup instead of immediately handing off to the shell.
      setCreatedGame(game);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  if (createdGame) {
    return (
      <div className="hub">
        <header className="hub-header">
          <div className="brand"><div className="brand-mono">G</div><div className="brand-title">Game ready</div></div>
          <div style={{width:80}} />
        </header>
        <main className="hub-main narrow">
          <h1 className="hub-greeting">Your Gamify is live</h1>
          <p className="hub-sub">Send the link to friends and family!</p>
          <InviteFriends game={createdGame} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="btn btn-primary" onClick={() => onCreated(createdGame)}>Open game →</button>
          </div>
        </main>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="hub">
        <header className="hub-header">
          <button className="btn btn-ghost" onClick={onCancel}>← Back</button>
          <div className="brand"><div className="brand-mono">G</div><div className="brand-title">Create</div></div>
          <div style={{width:80}} />
        </header>
        <main className="hub-main narrow">
          <h1 className="hub-greeting">Create a Gamify</h1>
          <p className="hub-sub">Name your game.</p>

          <label className="field-label">Game title</label>
          <input className="text-input" value={title} onChange={e=>setTitle(e.target.value)}
            placeholder="e.g. Biology Study Group" autoFocus />

          <div className="logo-preview">
            <Monogram name={title || 'G'} size={72} />
            <div className="hint">Your game logo is the first letter of the title.</div>
          </div>

          {err ? <div className="form-error">{err}</div> : null}
          <button className="btn btn-primary" style={{marginTop:24}}
            disabled={!title.trim()}
            onClick={() => setStep(2)}>Continue</button>
        </main>
      </div>
    );
  }

  return (
    <div className="hub">
      <header className="hub-header">
        <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
        <div className="brand"><div className="brand-mono">G</div><div className="brand-title">Content</div></div>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? 'Creating…' : 'Create game'}
        </button>
      </header>
      <main className="hub-main">
        <h2 className="section-title">Add your terms & definitions</h2>

        <div className="paste-block">
          <label className="field-label">Paste from a spreadsheet</label>
          <p className="hint">
            One pair per line, term and definition separated by a Tab. Pasting two columns from a spreadsheet works directly.
          </p>
          <textarea className="text-input area paste-area" rows={4}
            value={pasteText} onChange={e=>setPasteText(e.target.value)}
            placeholder={"Photosynthesis\tProcess plants use to convert sunlight into energy\nMitochondria\tThe powerhouse of the cell"} />
          <button className="btn btn-secondary small paste-fill" onClick={fillFromPaste}
            disabled={!pasteText.trim()}>Fill cards from paste</button>
        </div>

        <div className="pair-list">
          <div className="pair-row pair-header">
            <div>Term</div><div>Definition</div><div />
          </div>
          {rows.map((r, i) => (
            <div key={i} className={`pair-row ${r.flagged ? 'flagged' : ''}`}>
              <textarea className="text-input area" value={r.term}
                onChange={e=>updateRow(i,'term',e.target.value)} placeholder="e.g. Photosynthesis" />
              <textarea className="text-input area" value={r.definition}
                onChange={e=>updateRow(i,'definition',e.target.value)} placeholder="Process plants use to convert sunlight into energy" />
              <button className="icon-btn" aria-label="Delete row" onClick={() => deleteRow(i)} title="Delete row">×</button>
            </div>
          ))}
        </div>

        <button className="btn btn-secondary add-more" onClick={addRows}>+ Add 5 more</button>
        {err ? <div className="form-error">{err}</div> : null}
      </main>
    </div>
  );
}
