import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import DirectionPicker from './DirectionPicker.jsx';
import Loading from './Loading.jsx';

// Admin-only "Edit Pairs" editor. Loads ALL existing pairs, lets the admin
// edit term/definition, delete a pair via its trash icon, and add new pairs
// (including paste-from-spreadsheet). Save sends the whole list to the
// server, which diffs:
//   - rows without id  -> insert
//   - rows with id     -> update if changed
//   - missing rows     -> soft-delete
// All edits apply IMMEDIATELY to everyone: today's frozen daily quiz/test is
// dropped so the next load builds a fresh set against the new pairs, and
// active Learn runs are updated in-place (deleted cards removed from queue
// and state, updated text propagated into the run's card snapshot).
const BLANK = () => ({ id: null, term: '', definition: '', flagged: false });

export default function EditPairs({ gameId, onClose }) {
  const [rows, setRows] = useState([]);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  // Track both the loaded value and the editor's current selection so we only
  // PUT direction when the admin actually changed it.
  const [direction, setDirection] = useState('shuffle');
  const [initialDirection, setInitialDirection] = useState('shuffle');

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/games/${gameId}`).then(({ game, pairs }) => {
      if (cancelled) return;
      const fromDb = (pairs || []).map(p => ({
        id: p.id, term: p.term, definition: p.definition, flagged: false,
      }));
      setRows(fromDb.length ? fromDb : [BLANK(), BLANK(), BLANK()]);
      const dir = game?.direction || 'shuffle';
      setDirection(dir);
      setInitialDirection(dir);
      setLoading(false);
    }).catch(e => { setErr(e.message); setLoading(false); });
    return () => { cancelled = true; };
  }, [gameId]);

  function update(i, k, v) {
    setRows(rows.map((r, idx) => idx===i ? { ...r, [k]: v, flagged: false } : r));
  }
  function del(i)  { setRows(rows.filter((_, idx) => idx !== i)); }
  function more()  { setRows([...rows, BLANK(), BLANK(), BLANK(), BLANK(), BLANK()]); }

  function fillFromPaste() {
    const text = pasteText.replace(/\r\n?/g, '\n');
    if (!text.trim()) return;
    const incoming = text.split('\n').map(line => {
      if (!line.trim()) return null;
      const idx = line.indexOf('\t');
      if (idx === -1) return { id: null, term: line.trim(), definition: '', flagged: true };
      const term = line.slice(0, idx).trim();
      const definition = line.slice(idx + 1).trim();
      return { id: null, term, definition, flagged: !term || !definition };
    }).filter(Boolean);
    const trimmed = [...rows];
    while (trimmed.length && !trimmed[trimmed.length-1].id
      && !trimmed[trimmed.length-1].term && !trimmed[trimmed.length-1].definition) trimmed.pop();
    setRows([...trimmed, ...incoming]);
    setPasteText('');
  }

  async function submit() {
    setErr('');
    const cleanPairs = rows
      .map(r => ({ id: r.id, term: r.term.trim(), definition: r.definition.trim() }))
      .filter(r => r.term && r.definition);
    if (cleanPairs.length === 0) { setErr('Add at least one pair.'); return; }
    setBusy(true);
    try {
      if (direction !== initialDirection) {
        await api.put(`/api/games/${gameId}`, { direction });
      }
      await api.put(`/api/games/${gameId}/pairs`, { pairs: cleanPairs });
      onClose();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="modal-wrap">
      <div className="modal">
        <div className="modal-head">
          <h3>Edit Pairs</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          <p className="hub-sub">
            Edits apply immediately to everyone. If a removed or edited card was in today's quiz or test, the daily set regenerates on the next load. Active Learn runs update in-place too.
          </p>

          {loading ? null : (
            <DirectionPicker value={direction} onChange={setDirection} />
          )}

          <div className="paste-block">
            <label className="field-label">Paste from a spreadsheet</label>
            <p className="hint">
              One pair per line, term and definition separated by a Tab. Pasting two columns from a spreadsheet works directly.
            </p>
            <textarea className="text-input area paste-area" rows={3}
              value={pasteText} onChange={e=>setPasteText(e.target.value)}
              placeholder={"Photosynthesis\tProcess plants use to convert sunlight into energy\nMitochondria\tThe powerhouse of the cell"} />
            <button className="btn btn-secondary small paste-fill" onClick={fillFromPaste}
              disabled={!pasteText.trim()}>Fill cards from paste</button>
          </div>

          {loading ? <Loading /> : (
            <>
              <div className="pair-list">
                <div className="pair-row pair-header"><div>Term</div><div>Definition</div><div /></div>
                {rows.map((r,i)=>(
                  <div key={r.id || `new-${i}`} className={`pair-row ${r.flagged ? 'flagged' : ''}`}>
                    <textarea className="text-input area" value={r.term} onChange={e=>update(i,'term',e.target.value)} />
                    <textarea className="text-input area" value={r.definition} onChange={e=>update(i,'definition',e.target.value)} />
                    <button className="icon-btn" onClick={()=>del(i)} aria-label="Delete">×</button>
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary add-more" onClick={more}>+ Add 5 more</button>
            </>
          )}
          {err ? <div className="form-error">{err}</div> : null}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || loading}>{busy?'Saving…':'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}
