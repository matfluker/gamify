// Shared server-side helpers. Mirrors src/utils where useful so the API
// doesn't need to import from the client bundle.

import { APP_TIMEZONE, SHARE_CODE_ALPHABET, SHARE_CODE_LENGTH } from './config.js';

export function normalizePhone(input) {
  if (!input) return '';
  const digits = String(input).replace(/\D+/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

export function easternDateString(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(date);
}

export function genShareCode() {
  let out = '';
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    out += SHARE_CODE_ALPHABET[Math.floor(Math.random() * SHARE_CODE_ALPHABET.length)];
  }
  return out;
}

// xfnv1a -> mulberry32 (matches src/utils/seededRandom.js).
function xfnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return () => {
    h += 0x6D2B79F5;
    h = Math.imul(h ^ (h >>> 15), 1 | h);
    h ^= h + Math.imul(h ^ (h >>> 7), 61 | h);
    return (h ^ (h >>> 14)) >>> 0;
  };
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededRng(seedString) {
  const seedFn = xfnv1a(String(seedString));
  return mulberry32(seedFn());
}
export function shuffleWith(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sendError(res, err) {
  const status = err?.status || 500;
  const message = err?.message || 'Server error';
  console.error('[gamify api]', message, err?.stack || '');
  res.status(status).json({ error: message });
}

// Wrap a Supabase read so that schema mismatches and other read errors
// surface as a thrown error instead of being silently destructured away.
// Returns the data array (or single row). Use for reads where an error
// truly means something is broken (vs. genuinely-empty results).
export async function expectRead(label, queryPromise) {
  const { data, error } = await queryPromise;
  if (error) {
    console.error('[gamify api] read failed', label, error);
    const e = new Error(`${label}: ${error.message || 'supabase error'}`);
    e.status = error.status || 500;
    throw e;
  }
  return data;
}

// Wrap a Supabase write that we expect to return rows. If the supabase
// client reports an error, OR returns fewer rows than expected, throw with
// the full context so the failure shows up in the response and server log
// instead of silently producing an empty table. This catches the common
// case where the API key is the anon key and RLS swallows writes.
export async function expectWrite(label, expected, queryPromise) {
  const { data, error } = await queryPromise;
  if (error) {
    console.error('[gamify api] write failed', label, error);
    const e = new Error(`${label}: ${error.message || 'supabase error'}`);
    e.status = error.status || 500;
    throw e;
  }
  const rows = Array.isArray(data) ? data : (data ? [data] : []);
  if (rows.length !== expected) {
    console.error('[gamify api] write row-count mismatch',
      label, `expected=${expected}`, `got=${rows.length}`,
      'check: SUPABASE_SERVICE_ROLE_KEY is the SERVICE ROLE key (not anon) and that RLS on this table allows writes from service role.');
    const e = new Error(
      `${label}: wrote ${rows.length} of ${expected} rows. ` +
      `Likely cause: SUPABASE_SERVICE_ROLE_KEY env var is the anon key instead of the service-role key, ` +
      `or RLS is blocking the write.`
    );
    e.status = 500;
    throw e;
  }
  return rows;
}
