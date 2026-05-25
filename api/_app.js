// Gamify API — single Express app exported as a Vercel serverless function.
// Local dev: imported by server-local.js and bound to a port.

import express from 'express';
import cors from 'cors';
import { supabase, assertEnv } from './_lib/supabase.js';
import { normalizePhone, easternDateString, genShareCode, seededRng, shuffleWith, sendError, expectWrite, expectRead } from './_lib/util.js';
import {
  QUIZ_LENGTH, QUIZ_MAX_POINTS, TEST_LENGTH, TEST_MAX_POINTS,
  LEARN_RUN_POINTS, CARDS_PER_SESSION, MC_OPTION_COUNT,
} from './_lib/config.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// ---------------------------------------------------------------------------
// "Auth": the client sends the current user's id as a header. Per spec, MVP
// has no password / no SMS verification. We still verify the user exists.
// ---------------------------------------------------------------------------
async function requireUser(req) {
  const userId = req.header('x-user-id');
  if (!userId) {
    const e = new Error('Not authenticated'); e.status = 401; throw e;
  }
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!data) { const e = new Error('User not found'); e.status = 401; throw e; }
  return data;
}

// ===========================================================================
// AUTH
// ===========================================================================

// When the deployed DB is missing the `unique(phone)` constraint declared in
// schema.sql, duplicate rows for the same phone can accumulate (one from
// /auth/login that created a stub before CompleteProfile, another from
// /auth/invite-join falling through .maybeSingle(), etc). Returning a
// different row each login is what caused users to be re-prompted for their
// name and to re-join games as a "new" account. The helpers below find the
// canonical row (prefer a complete profile, then the oldest) and fold every
// duplicate's memberships/points/activity into it before deleting the dupe,
// so a single phone always resolves to a single user.

function pickCanonicalUser(matches) {
  const complete = matches.filter(m => m.first_name && m.last_name);
  const pool = complete.length ? complete : matches;
  return pool.slice().sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )[0];
}

// Move every child row from fromId to toId, then delete fromId. For tables
// whose unique key includes user_id we insert-then-delete and swallow 23505
// (unique violation) so canonical's existing row wins on conflict.
async function mergeUserInto(fromId, toId) {
  // memberships: pk (user_id, game_id)
  const { data: mems } = await supabase.from('memberships')
    .select('game_id, joined_at').eq('user_id', fromId);
  for (const m of mems || []) {
    const { error } = await supabase.from('memberships')
      .insert({ user_id: toId, game_id: m.game_id, joined_at: m.joined_at });
    if (error && error.code !== '23505') throw error;
  }
  await supabase.from('memberships').delete().eq('user_id', fromId);

  // activity_log: pk (user_id, game_id, date_et)
  const { data: acts } = await supabase.from('activity_log')
    .select('game_id, date_et').eq('user_id', fromId);
  for (const a of acts || []) {
    const { error } = await supabase.from('activity_log')
      .insert({ user_id: toId, game_id: a.game_id, date_et: a.date_et });
    if (error && error.code !== '23505') throw error;
  }
  await supabase.from('activity_log').delete().eq('user_id', fromId);

  // quiz_attempts: unique (user_id, game_id, date_et)
  const { data: quizzes } = await supabase.from('quiz_attempts')
    .select('*').eq('user_id', fromId);
  for (const q of quizzes || []) {
    const { error } = await supabase.from('quiz_attempts').insert({
      user_id: toId, game_id: q.game_id, date_et: q.date_et,
      total: q.total, correct: q.correct, answers: q.answers, taken_at: q.taken_at,
    });
    if (error && error.code !== '23505') throw error;
  }
  await supabase.from('quiz_attempts').delete().eq('user_id', fromId);

  // test_attempts: same shape as quiz_attempts
  const { data: tests } = await supabase.from('test_attempts')
    .select('*').eq('user_id', fromId);
  for (const t of tests || []) {
    const { error } = await supabase.from('test_attempts').insert({
      user_id: toId, game_id: t.game_id, date_et: t.date_et,
      total: t.total, correct: t.correct, answers: t.answers, taken_at: t.taken_at,
    });
    if (error && error.code !== '23505') throw error;
  }
  await supabase.from('test_attempts').delete().eq('user_id', fromId);

  // learn_runs: pk (user_id, game_id) — canonical's run wins if both exist.
  const { data: runs } = await supabase.from('learn_runs')
    .select('*').eq('user_id', fromId);
  for (const r of runs || []) {
    const { error } = await supabase.from('learn_runs').insert({
      user_id: toId, game_id: r.game_id, state: r.state, updated_at: r.updated_at,
    });
    if (error && error.code !== '23505') throw error;
  }
  await supabase.from('learn_runs').delete().eq('user_id', fromId);

  // daily_rank_snapshots: pk (game_id, user_id, date_et)
  const { data: snaps } = await supabase.from('daily_rank_snapshots')
    .select('*').eq('user_id', fromId);
  for (const s of snaps || []) {
    const { error } = await supabase.from('daily_rank_snapshots').insert({
      game_id: s.game_id, user_id: toId, date_et: s.date_et,
      rank: s.rank, total_points: s.total_points,
    });
    if (error && error.code !== '23505') throw error;
  }
  await supabase.from('daily_rank_snapshots').delete().eq('user_id', fromId);

  // points_ledger: id is pk, just reassign user_id (no conflict possible).
  await supabase.from('points_ledger')
    .update({ user_id: toId }).eq('user_id', fromId);

  // games: dup may have created some as admin.
  await supabase.from('games')
    .update({ admin_user_id: toId }).eq('admin_user_id', fromId);

  // Finally the row itself.
  await supabase.from('users').delete().eq('id', fromId);
}

// Resolve a phone to a single canonical user, merging duplicates if any.
// firstName/lastName are only written when the canonical row is brand-new or
// is missing those fields — we never overwrite a returning user's name.
async function findOrCreateUserByPhone({ phone, firstName, lastName }) {
  const { data: matches, error: selErr } = await supabase
    .from('users').select('*').eq('phone', phone);
  if (selErr) throw selErr;

  if (!matches || matches.length === 0) {
    const row = { phone };
    if (firstName) row.first_name = firstName;
    if (lastName)  row.last_name  = lastName;
    const [created] = await expectWrite(
      `create user for phone ${phone}`,
      1,
      supabase.from('users').insert(row).select('*'),
    );
    return { user: created, isNew: true };
  }

  const canonical = pickCanonicalUser(matches);
  const dups = matches.filter(m => m.id !== canonical.id);
  if (dups.length) {
    console.warn('[gamify api] merging duplicate users for phone', phone,
      'canonical:', canonical.id, 'merging:', dups.map(d => d.id),
      '— add `unique(phone)` to the users table to prevent recurrence.');
    for (const d of dups) await mergeUserInto(d.id, canonical.id);
  }

  let user = canonical;
  const wantFirst = !user.first_name && firstName;
  const wantLast  = !user.last_name  && lastName;
  if (wantFirst || wantLast) {
    const { data: updated } = await supabase.from('users').update({
      first_name: user.first_name || firstName || null,
      last_name:  user.last_name  || lastName  || null,
    }).eq('id', user.id).select('*').single();
    if (updated) user = updated;
  }
  return { user, isNew: false };
}

// POST /api/auth/login  body: { phone }
// If a user already exists for this phone, return it (with their name intact
// so the client skips CompleteProfile). Otherwise create a stub row.
app.post('/api/auth/login', async (req, res) => {
  try {
    assertEnv();
    const phone = normalizePhone(req.body?.phone);
    if (!phone || phone.length < 7) {
      return res.status(400).json({ error: 'Please enter a valid phone number.' });
    }
    const { user, isNew } = await findOrCreateUserByPhone({ phone });
    console.log('[gamify api] login: phone', phone,
      isNew ? '-> NEW user' : '-> existing user', user.id,
      user.first_name ? '(profile complete)' : '(no name yet)');
    res.json({ user, isNew });
  } catch (e) { sendError(res, e); }
});

// POST /api/auth/lookup  body: { phone }
// Lightweight "do you know me?" check used by the invite-join screen so a
// returning user only sees a Join button (no name fields). Does not create
// rows. Returns { exists, hasName, firstName, lastName }.
app.post('/api/auth/lookup', async (req, res) => {
  try {
    assertEnv();
    const phone = normalizePhone(req.body?.phone);
    if (!phone || phone.length < 7) {
      return res.status(400).json({ error: 'Please enter a valid phone number.' });
    }
    const { data: matches } = await supabase
      .from('users').select('*').eq('phone', phone);
    if (!matches || matches.length === 0) {
      return res.json({ exists: false, hasName: false });
    }
    const canonical = pickCanonicalUser(matches);
    res.json({
      exists: true,
      hasName: !!(canonical.first_name && canonical.last_name),
      firstName: canonical.first_name || '',
      lastName:  canonical.last_name  || '',
    });
  } catch (e) { sendError(res, e); }
});

// POST /api/auth/invite-join  body: { shareCode, firstName, lastName, phone }
// Magic-link entry path: the invite link skips the code-entry step. If the
// phone is already a returning user, their existing profile + memberships are
// reused (names in the body are ignored). Only new phones need to supply a
// first + last name. Returns { user, game } so the client can sign in and
// land on the game shell.
app.post('/api/auth/invite-join', async (req, res) => {
  try {
    assertEnv();
    const shareCode = String(req.body?.shareCode || '').trim().toUpperCase();
    const firstName = String(req.body?.firstName || '').trim();
    const lastName  = String(req.body?.lastName  || '').trim();
    const phone     = normalizePhone(req.body?.phone);
    if (!shareCode) return res.status(400).json({ error: 'Missing invite code.' });
    if (!phone || phone.length < 7) return res.status(400).json({ error: 'Please enter a valid phone number.' });

    const { data: game } = await supabase.from('games').select('*').eq('share_code', shareCode).maybeSingle();
    if (!game) return res.status(404).json({ error: 'Invite link is no longer valid.' });

    // Require name only when this phone is brand-new (or has no name yet).
    const { data: existing } = await supabase
      .from('users').select('first_name, last_name').eq('phone', phone);
    const hasCompleteProfile = (existing || []).some(u => u.first_name && u.last_name);
    if (!hasCompleteProfile && (!firstName || !lastName)) {
      return res.status(400).json({ error: 'First and last name are required.' });
    }

    const { user } = await findOrCreateUserByPhone({ phone, firstName, lastName });

    const { error: memErr } = await supabase.from('memberships')
      .insert({ user_id: user.id, game_id: game.id });
    if (memErr && memErr.code !== '23505') throw memErr;

    res.json({ user, game });
  } catch (e) { sendError(res, e); }
});

// POST /api/auth/complete-profile  body: { firstName, lastName }
app.post('/api/auth/complete-profile', async (req, res) => {
  try {
    const user = await requireUser(req);
    const firstName = String(req.body?.firstName || '').trim();
    const lastName  = String(req.body?.lastName  || '').trim();
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First and last name are required.' });
    }
    const [updated] = await expectWrite(
      `complete-profile update for user ${user.id}`,
      1,
      supabase.from('users')
        .update({ first_name: firstName, last_name: lastName })
        .eq('id', user.id)
        .select('*'),
    );
    res.json({ user: updated });
  } catch (e) { sendError(res, e); }
});

// ===========================================================================
// GAMES
// ===========================================================================

// GET /api/me/games — all games the user is a member of
app.get('/api/me/games', async (req, res) => {
  try {
    const user = await requireUser(req);
    const { data: mems, error: mErr } = await supabase
      .from('memberships').select('game_id, joined_at').eq('user_id', user.id);
    if (mErr) throw mErr;
    if (!mems.length) return res.json({ games: [] });
    const ids = mems.map(m => m.game_id);
    const { data: games, error: gErr } = await supabase
      .from('games').select('*').in('id', ids);
    if (gErr) throw gErr;
    res.json({ games });
  } catch (e) { sendError(res, e); }
});

// POST /api/games — create a game. body: { title, pairs: [{term, definition}] }
// Prompt direction is now randomized per-card in Learn/Quiz/Test (no per-game
// direction). For DB compatibility we still write 'term' to the column.
app.post('/api/games', async (req, res) => {
  try {
    const user = await requireUser(req);
    const title = String(req.body?.title || '').trim();
    const pairs = Array.isArray(req.body?.pairs) ? req.body.pairs : [];
    if (!title) return res.status(400).json({ error: 'Title is required.' });
    const cleanPairs = pairs
      .map(p => ({ term: String(p.term || '').trim(), definition: String(p.definition || '').trim() }))
      .filter(p => p.term && p.definition);
    if (cleanPairs.length === 0) {
      return res.status(400).json({ error: 'Add at least one term/definition pair.' });
    }

    // Make a unique share code (collide-retry a few times).
    let shareCode = '';
    for (let i = 0; i < 8; i++) {
      const candidate = genShareCode();
      const { data: hit } = await supabase
        .from('games').select('id').eq('share_code', candidate).maybeSingle();
      if (!hit) { shareCode = candidate; break; }
    }
    if (!shareCode) return res.status(500).json({ error: 'Could not generate share code.' });

    const { data: game, error: gErr } = await supabase.from('games').insert({
      title, admin_user_id: user.id, share_code: shareCode, direction: 'term',
    }).select('*').single();
    if (gErr) throw gErr;

    const pairRows = cleanPairs.map((p, i) => ({
      game_id: game.id, term: p.term, definition: p.definition, sort_order: i + 1,
    }));
    await expectWrite(
      `insert pairs for game ${game.id}`,
      pairRows.length,
      supabase.from('pairs').insert(pairRows).select('id'),
    );

    const { error: memErr } = await supabase.from('memberships')
      .insert({ user_id: user.id, game_id: game.id });
    if (memErr && memErr.code !== '23505') throw memErr;

    res.json({ game });
  } catch (e) { sendError(res, e); }
});

// POST /api/games/join — body: { shareCode }
app.post('/api/games/join', async (req, res) => {
  try {
    const user = await requireUser(req);
    const code = String(req.body?.shareCode || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Enter a share code.' });
    const { data: game, error: gErr } = await supabase
      .from('games').select('*').eq('share_code', code).maybeSingle();
    if (gErr) throw gErr;
    if (!game) return res.status(404).json({ error: 'No game with that code.' });

    const { error: insErr } = await supabase.from('memberships')
      .insert({ user_id: user.id, game_id: game.id });
    if (insErr && insErr.code !== '23505') throw insErr;
    res.json({ game });
  } catch (e) { sendError(res, e); }
});

// GET /api/games/:id — full game (pairs + your role)
app.get('/api/games/:id', async (req, res) => {
  try {
    const user = await requireUser(req);
    const { id } = req.params;
    const { data: game, error: gErr } = await supabase
      .from('games').select('*').eq('id', id).maybeSingle();
    if (gErr) throw gErr;
    if (!game) return res.status(404).json({ error: 'Game not found.' });

    const { data: mem } = await supabase.from('memberships')
      .select('*').eq('user_id', user.id).eq('game_id', id).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'You are not in this game.' });

    const pairs = await expectRead(
      `load pairs for game ${id}`,
      supabase
        .from('pairs').select('*').eq('game_id', id).is('deleted_at', null)
        .order('sort_order', { ascending: true }),
    );

    res.json({ game, pairs, isAdmin: game.admin_user_id === user.id });
  } catch (e) { sendError(res, e); }
});

// POST /api/games/:id/pairs — admin adds new pairs after launch.
app.post('/api/games/:id/pairs', async (req, res) => {
  try {
    const user = await requireUser(req);
    const { id } = req.params;
    const newPairs = Array.isArray(req.body?.pairs) ? req.body.pairs : [];
    const { data: game } = await supabase.from('games').select('*').eq('id', id).maybeSingle();
    if (!game) return res.status(404).json({ error: 'Game not found.' });
    if (game.admin_user_id !== user.id) return res.status(403).json({ error: 'Only the admin can add pairs.' });

    const clean = newPairs.map(p => ({
      term: String(p.term || '').trim(), definition: String(p.definition || '').trim(),
    })).filter(p => p.term && p.definition);
    if (!clean.length) return res.status(400).json({ error: 'No valid pairs.' });

    const { data: last } = await supabase.from('pairs').select('sort_order')
      .eq('game_id', id).order('sort_order', { ascending: false }).limit(1).maybeSingle();
    const base = last?.sort_order || 0;

    const rows = clean.map((p, i) => ({
      game_id: id, term: p.term, definition: p.definition, sort_order: base + i + 1,
    }));
    await expectWrite(
      `insert pairs (admin add) for game ${id}`,
      rows.length,
      supabase.from('pairs').insert(rows).select('id'),
    );
    res.json({ ok: true, added: rows.length });
  } catch (e) { sendError(res, e); }
});

// PUT /api/games/:id/pairs — admin "Edit Pairs": diff-save the full editable
// list. Edits and deletes only affect FUTURE Learn runs and FUTURE days:
//   - Learn runs in progress still use the snapshot stored in run state.
//   - Daily quiz/test already-seeded for today are frozen in daily_question_sets.
// Body: { pairs: [{ id?, term, definition }] }
// Rules:
//   - Rows without id and with content -> insert.
//   - Rows with id -> update term/definition (if changed).
//   - Pairs in DB (non-deleted) NOT present in body -> soft-delete.
app.put('/api/games/:id/pairs', async (req, res) => {
  try {
    const user = await requireUser(req);
    const { id } = req.params;
    const incoming = Array.isArray(req.body?.pairs) ? req.body.pairs : [];

    const { data: game } = await supabase.from('games').select('*').eq('id', id).maybeSingle();
    if (!game) return res.status(404).json({ error: 'Game not found.' });
    if (game.admin_user_id !== user.id) return res.status(403).json({ error: 'Only the admin can edit pairs.' });

    const clean = incoming.map(p => ({
      id: p.id ? String(p.id) : null,
      term: String(p.term || '').trim(),
      definition: String(p.definition || '').trim(),
    })).filter(p => p.term && p.definition);
    if (!clean.length) return res.status(400).json({ error: 'At least one pair is required.' });

    const { data: existing } = await supabase.from('pairs')
      .select('id, term, definition, sort_order')
      .eq('game_id', id).is('deleted_at', null);
    const existingMap = new Map((existing || []).map(p => [p.id, p]));
    const incomingIds = new Set(clean.filter(p => p.id).map(p => p.id));

    // Soft-delete any pair not present in incoming.
    const toDelete = (existing || []).filter(p => !incomingIds.has(p.id)).map(p => p.id);
    if (toDelete.length) {
      await expectWrite(
        `soft-delete pairs for game ${id}`,
        toDelete.length,
        supabase.from('pairs')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', toDelete)
          .select('id'),
      );
    }

    // Update changed rows.
    let updatedCount = 0;
    for (const row of clean) {
      if (!row.id) continue;
      const prev = existingMap.get(row.id);
      if (!prev) continue;
      if (prev.term === row.term && prev.definition === row.definition) continue;
      await expectWrite(
        `update pair ${row.id}`,
        1,
        supabase.from('pairs')
          .update({ term: row.term, definition: row.definition })
          .eq('id', row.id)
          .select('id'),
      );
      updatedCount += 1;
    }

    // Insert new rows.
    const { data: last } = await supabase.from('pairs').select('sort_order')
      .eq('game_id', id).order('sort_order', { ascending: false }).limit(1).maybeSingle();
    let base = last?.sort_order || 0;
    const inserts = clean.filter(p => !p.id).map((p) => {
      base += 1;
      return { game_id: id, term: p.term, definition: p.definition, sort_order: base };
    });
    if (inserts.length) {
      await expectWrite(
        `insert new pairs for game ${id}`,
        inserts.length,
        supabase.from('pairs').insert(inserts).select('id'),
      );
    }

    res.json({ ok: true, deleted: toDelete.length, updated: updatedCount, inserted: inserts.length });
  } catch (e) { sendError(res, e); }
});

// ===========================================================================
// LEADERBOARD
// ===========================================================================

// GET /api/games/:id/leaderboard — ranked members with daily delta
app.get('/api/games/:id/leaderboard', async (req, res) => {
  try {
    const user = await requireUser(req);
    const { id } = req.params;

    // membership check
    const { data: mem } = await supabase.from('memberships')
      .select('user_id').eq('user_id', user.id).eq('game_id', id).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'Not in this game.' });

    const { data: members } = await supabase.from('memberships')
      .select('user_id').eq('game_id', id);
    const memberIds = (members || []).map(m => m.user_id);

    const { data: users } = await supabase.from('users')
      .select('id, first_name, last_name').in('id', memberIds.length ? memberIds : ['00000000-0000-0000-0000-000000000000']);

    const { data: ledger } = await supabase.from('points_ledger')
      .select('user_id, points').eq('game_id', id);

    const totals = new Map();
    (ledger || []).forEach(r => {
      totals.set(r.user_id, (totals.get(r.user_id) || 0) + Number(r.points));
    });

    let rows = (users || []).map(u => ({
      userId: u.id,
      firstName: u.first_name || '',
      lastName:  u.last_name  || '',
      totalPoints: Number(totals.get(u.id) || 0),
    }));
    rows.sort((a, b) => b.totalPoints - a.totalPoints
      || (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName));
    rows = rows.map((r, i) => ({ ...r, rank: i + 1 }));

    // Daily delta vs the most recent snapshot. Snapshot updates lazily here:
    // if the latest snapshot's date is older than ET-today, refresh it
    // (the snapshot represents "ranks as of midnight today" — i.e. the
    // pre-today state we compare against).
    const today = easternDateString();
    const { data: snapDates } = await supabase.from('daily_rank_snapshots')
      .select('date_et').eq('game_id', id).order('date_et', { ascending: false }).limit(1);
    const latestSnapDate = snapDates?.[0]?.date_et;
    if (latestSnapDate !== today) {
      // upsert today's snapshot using yesterday's totals (which equal the
      // pre-existing ledger totals for everyone whose first activity today
      // hasn't shifted ranks yet). The simplest interpretation: snapshot the
      // CURRENT ranks at first access of the new ET day. Subsequent accesses
      // today compare to that snapshot.
      const snapRows = rows.map(r => ({
        game_id: id, user_id: r.userId, date_et: today,
        rank: r.rank, total_points: r.totalPoints,
      }));
      if (snapRows.length) {
        await supabase.from('daily_rank_snapshots').upsert(snapRows,
          { onConflict: 'game_id,user_id,date_et' });
      }
    }

    const { data: snap } = await supabase.from('daily_rank_snapshots')
      .select('user_id, rank').eq('game_id', id).eq('date_et', today);
    const snapMap = new Map((snap || []).map(s => [s.user_id, s.rank]));
    rows = rows.map(r => {
      const prev = snapMap.get(r.userId);
      const delta = prev == null ? 0 : (prev - r.rank); // positive = moved up
      return { ...r, delta };
    });

    res.json({ leaderboard: rows });
  } catch (e) { sendError(res, e); }
});

// ===========================================================================
// QUIZ / TEST  (deterministic per-day question set)
// ===========================================================================

function buildDailyQuestions(pairs, length, seedStr) {
  if (pairs.length < length) return null;
  const rng = seededRng(seedStr);
  const chosen = shuffleWith(rng, pairs).slice(0, length);
  return chosen.map((p, i) => {
    // Per-card random direction (seeded, so every player sees the SAME question
    // set + same directions for a given game/day).
    const showDefinition = rng() < 0.5;
    const promptKey = showDefinition ? 'definition' : 'term';
    const answerKey = showDefinition ? 'term' : 'definition';
    const distractors = shuffleWith(rng, pairs.filter(x => x.id !== p.id))
      .slice(0, MC_OPTION_COUNT - 1)
      .map(x => x[answerKey]);
    const opts = shuffleWith(rng, [p[answerKey], ...distractors]);
    return {
      pairId: p.id,
      prompt: p[promptKey],
      options: opts,
      correctAnswer: p[answerKey],
      index: i,
    };
  });
}

async function getDailyAttempt(table, userId, gameId, dateEt) {
  const { data } = await supabase.from(table).select('*')
    .eq('user_id', userId).eq('game_id', gameId).eq('date_et', dateEt).maybeSingle();
  return data;
}

// Get-or-create today's frozen question set. Once written, today's set
// never changes — admin edits to pairs only affect FUTURE days.
async function getOrCreateDailyQuestions(gameId, kind, dateEt, length) {
  const { data: snap } = await supabase.from('daily_question_sets')
    .select('questions').eq('game_id', gameId).eq('kind', kind).eq('date_et', dateEt).maybeSingle();
  if (snap?.questions && Array.isArray(snap.questions) && snap.questions.length === length) {
    return snap.questions;
  }
  const pairs = await expectRead(
    `load pairs for daily ${kind} on game ${gameId}`,
    supabase.from('pairs').select('*')
      .eq('game_id', gameId).is('deleted_at', null),
  );
  if (!pairs || pairs.length < length) return null;
  const seed = `${kind}|${gameId}|${dateEt}`;
  const questions = buildDailyQuestions(pairs, length, seed);
  if (!questions) return null;
  await supabase.from('daily_question_sets').upsert(
    { game_id: gameId, kind, date_et: dateEt, questions },
    { onConflict: 'game_id,kind,date_et' });
  return questions;
}

async function quizOrTestGet(req, res, kind) {
  const user = await requireUser(req);
  const { id } = req.params;
  const length = kind === 'quiz' ? QUIZ_LENGTH : TEST_LENGTH;
  const table  = kind === 'quiz' ? 'quiz_attempts' : 'test_attempts';

  const { data: game } = await supabase.from('games').select('*').eq('id', id).maybeSingle();
  if (!game) return res.status(404).json({ error: 'Game not found.' });
  const { data: mem } = await supabase.from('memberships')
    .select('user_id').eq('user_id', user.id).eq('game_id', id).maybeSingle();
  if (!mem) return res.status(403).json({ error: 'Not in this game.' });

  const dateEt = easternDateString();
  const questions = await getOrCreateDailyQuestions(id, kind, dateEt, length);
  if (!questions) {
    const pairs = await expectRead(
      `count pairs for ${kind} availability on game ${id}`,
      supabase.from('pairs').select('id')
        .eq('game_id', id).is('deleted_at', null),
    );
    return res.json({ available: false, needed: length, have: pairs?.length || 0 });
  }

  const attempt = await getDailyAttempt(table, user.id, id, dateEt);
  if (attempt) {
    return res.json({
      available: true,
      locked: true,
      attempt,
      questions: questions.map(q => ({ ...q, correctAnswer: undefined })),
    });
  }
  res.json({
    available: true,
    locked: false,
    questions: questions.map(q => ({ ...q, correctAnswer: undefined })),
  });
}

async function quizOrTestSubmit(req, res, kind) {
  const user = await requireUser(req);
  const { id } = req.params;
  const length = kind === 'quiz' ? QUIZ_LENGTH : TEST_LENGTH;
  const maxPts = kind === 'quiz' ? QUIZ_MAX_POINTS : TEST_MAX_POINTS;
  const table  = kind === 'quiz' ? 'quiz_attempts' : 'test_attempts';

  const { data: game } = await supabase.from('games').select('*').eq('id', id).maybeSingle();
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  const dateEt = easternDateString();
  const existing = await getDailyAttempt(table, user.id, id, dateEt);
  if (existing) return res.status(409).json({ error: `Already taken today.`, attempt: existing });

  const questions = await getOrCreateDailyQuestions(id, kind, dateEt, length);
  if (!questions) return res.status(400).json({ error: 'Not enough content.' });
  const submitted = Array.isArray(req.body?.answers) ? req.body.answers : [];

  let correct = 0;
  const graded = questions.map((q, i) => {
    const chosen = submitted[i] ?? null;
    const isCorrect = chosen != null && chosen === q.correctAnswer;
    if (isCorrect) correct += 1;
    return { pairId: q.pairId, chosen, correct: q.correctAnswer, isCorrect };
  });

  const points = Math.min(correct, maxPts);

  const { data: attempt, error: aErr } = await supabase.from(table).insert({
    user_id: user.id, game_id: id, date_et: dateEt,
    total: length, correct, answers: graded,
  }).select('*').single();
  if (aErr) throw aErr;

  await supabase.from('points_ledger').insert({
    user_id: user.id, game_id: id, points,
    source: kind, ref_id: attempt.id, earned_date_et: dateEt,
  });
  await supabase.from('activity_log').upsert(
    { user_id: user.id, game_id: id, date_et: dateEt },
    { onConflict: 'user_id,game_id,date_et' }
  );

  res.json({ attempt, points, correct, total: length });
}

app.get('/api/games/:id/quiz',  (req, res) => quizOrTestGet(req, res, 'quiz').catch(e => sendError(res, e)));
app.post('/api/games/:id/quiz', (req, res) => quizOrTestSubmit(req, res, 'quiz').catch(e => sendError(res, e)));
app.get('/api/games/:id/test',  (req, res) => quizOrTestGet(req, res, 'test').catch(e => sendError(res, e)));
app.post('/api/games/:id/test', (req, res) => quizOrTestSubmit(req, res, 'test').catch(e => sendError(res, e)));

// ===========================================================================
// LEARN
// ===========================================================================

// Build a fresh run state for the given pairs. Term/definition are snapshotted
// into each card so future admin edits to a pair don't disturb an active run.
function newRunState(pairs) {
  const cards = {};
  for (const p of pairs) {
    cards[p.id] = {
      phase: 'mc',
      missedInPhase: false,
      consecutiveCorrect: 0,
      mastered: false,
      paidOut: false,
      // Direction is assigned ONCE per card and kept for the card's entire life
      // in this run (across MC -> TIO and any repeats). Per-card random.
      direction: Math.random() < 0.5 ? 'definition' : 'term',
      term: p.term,
      definition: p.definition,
    };
  }
  // initial queue: every pair, in shuffled order — first pass is all MC.
  const ids = pairs.map(p => p.id);
  // simple Math.random shuffle (each user gets their own order; OK because
  // Learn is personal, not synchronized).
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return {
    cards,
    queue: ids,
    totalCards: ids.length,
    sessionHistory: [],          // [{correct, total}]
    currentSessionCorrect: 0,
    currentSessionAnswered: 0,
    mastersThisRun: 0,
    // mastersBankedAtLastExit: snapshot of mastersThisRun the last time the
    // user exited mid-run. Used to display the "points earned since last exit"
    // figure on the exit popup (which must show 0 if no new masters since).
    mastersBankedAtLastExit: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

async function loadOrInitRun(userId, gameId) {
  const { data: row } = await supabase.from('learn_runs').select('*')
    .eq('user_id', userId).eq('game_id', gameId).maybeSingle();
  if (row?.state?.cards && row?.state?.queue) return { state: row.state, isNew: false };

  const pairs = await expectRead(
    `load pairs to init Learn run for game ${gameId}`,
    supabase.from('pairs').select('id, term, definition')
      .eq('game_id', gameId).is('deleted_at', null),
  );
  if (!pairs || pairs.length === 0) {
    const e = new Error('No content in this game yet.'); e.status = 400; throw e;
  }
  const state = newRunState(pairs);
  await supabase.from('learn_runs').upsert({
    user_id: userId, game_id: gameId, state, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,game_id' });
  return { state, isNew: true };
}

async function saveRun(userId, gameId, state) {
  await supabase.from('learn_runs').upsert({
    user_id: userId, game_id: gameId, state, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,game_id' });
}

// Sync new pairs added by the admin into the current run as "to be learned".
// Cards added mid-run join the queue and are eligible for the slice of points
// in the NEXT run (per spec: "new pairs simply appear in everyone's 'To Be
// Learned' set"). Here we add them to the queue so the run continues to cover
// them; the run's totalCards expands too, so each card slice is recomputed
// proportionally for the cards still unpaid. Active runs are immune to edits
// or deletes of already-known pairs — those only show up in the next run.
async function syncNewPairs(state, gameId) {
  const pairs = await expectRead(
    `sync new pairs into active Learn run for game ${gameId}`,
    supabase.from('pairs').select('id, term, definition')
      .eq('game_id', gameId).is('deleted_at', null),
  );
  const known = new Set(Object.keys(state.cards));
  const fresh = (pairs || []).filter(p => !known.has(p.id));
  // Backfill direction + text snapshot on legacy cards (for runs created before
  // those landed).
  for (const id of Object.keys(state.cards)) {
    if (!state.cards[id].direction) {
      state.cards[id].direction = Math.random() < 0.5 ? 'definition' : 'term';
    }
    if (state.cards[id].term == null || state.cards[id].definition == null) {
      const cur = (pairs || []).find(p => p.id === id);
      if (cur) {
        state.cards[id].term = cur.term;
        state.cards[id].definition = cur.definition;
      }
    }
  }
  if (fresh.length === 0) return state;
  for (const p of fresh) {
    state.cards[p.id] = {
      phase: 'mc', missedInPhase: false, consecutiveCorrect: 0,
      mastered: false, paidOut: false,
      direction: Math.random() < 0.5 ? 'definition' : 'term',
      term: p.term, definition: p.definition,
    };
    state.queue.push(p.id);
  }
  state.totalCards = Object.keys(state.cards).length;
  return state;
}

// Build the payload the client needs to render the next card. Card text is
// read from the run's frozen snapshot (state.cards) — not the live pairs row —
// so admin edits/deletes don't disturb an in-progress run.
async function buildNextCardPayload(state, gameId) {
  if (state.queue.length === 0) return null;
  const nextId = state.queue[0];
  const cardState = state.cards[nextId];
  if (!cardState) return null;
  // Per-card direction, fixed for the card's life in this run.
  const dir = cardState.direction || 'term';
  const promptKey = dir === 'definition' ? 'definition' : 'term';
  const answerKey = dir === 'definition' ? 'term' : 'definition';

  if (cardState.phase === 'mc') {
    // Distractors come from the OTHER known cards in this run's snapshot so
    // they stay coherent with the snapshot's content.
    const pool = Object.entries(state.cards)
      .filter(([id, c]) => id !== nextId && c && c[answerKey])
      .map(([, c]) => c[answerKey]);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const distractors = pool.slice(0, MC_OPTION_COUNT - 1);
    const options = [...distractors, cardState[answerKey]];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return {
      pairId: nextId,
      kind: 'mc',
      prompt: cardState[promptKey],
      options,
      correctAnswer: cardState[answerKey],
    };
  } else {
    return {
      pairId: nextId,
      kind: 'tio',
      prompt: cardState[promptKey],
      correctAnswer: cardState[answerKey],
    };
  }
}

// Build the bucket counts used by the post-session screen.
function bucketCounts(state) {
  let mastered = 0, learning = 0, toBeLearned = 0;
  for (const id of Object.keys(state.cards)) {
    const c = state.cards[id];
    if (c.mastered) mastered++;
    else if (c.phase === 'tio') learning++;
    else toBeLearned++;
  }
  return { mastered, learning, toBeLearned };
}

function estimatedSecondsRemaining(state) {
  let mc = 0, tio = 0;
  for (const id of Object.keys(state.cards)) {
    const c = state.cards[id];
    if (c.mastered) continue;
    if (c.phase === 'mc') {
      // best-case: 1 if not missed; 2 - consecutive if missed
      mc += c.missedInPhase ? Math.max(2 - c.consecutiveCorrect, 1) : 1;
      tio += 1; // will need one tio after graduating
    } else {
      tio += c.missedInPhase ? Math.max(2 - c.consecutiveCorrect, 1) : 1;
    }
  }
  // EST_SECONDS values mirror src/config.js. Hardcoded here to keep this file
  // self-contained.
  return mc * 10 + tio * 30;
}

// GET /api/games/:id/learn — current state + next card (resumes if mid-run)
app.get('/api/games/:id/learn', async (req, res) => {
  try {
    const user = await requireUser(req);
    const { id } = req.params;
    const { data: game } = await supabase.from('games').select('*').eq('id', id).maybeSingle();
    if (!game) return res.status(404).json({ error: 'Game not found.' });
    const { data: mem } = await supabase.from('memberships')
      .select('user_id').eq('user_id', user.id).eq('game_id', id).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'Not in this game.' });

    let { state } = await loadOrInitRun(user.id, id);
    state = await syncNewPairs(state, id);
    await saveRun(user.id, id, state);

    const nextCard = await buildNextCardPayload(state, id);
    res.json({
      state, nextCard,
      buckets: bucketCounts(state),
      secondsRemaining: estimatedSecondsRemaining(state),
      cardsRemaining: state.queue.length,
    });
  } catch (e) { sendError(res, e); }
});

// POST /api/games/:id/learn/answer  body: { pairId, isCorrect }
// Returns updated state + next card + (if 10 answered) session summary.
app.post('/api/games/:id/learn/answer', async (req, res) => {
  try {
    const user = await requireUser(req);
    const { id } = req.params;
    const pairId = String(req.body?.pairId || '');
    const isCorrect = !!req.body?.isCorrect;

    const { data: game } = await supabase.from('games').select('*').eq('id', id).maybeSingle();
    if (!game) return res.status(404).json({ error: 'Game not found.' });

    let { state } = await loadOrInitRun(user.id, id);
    state = await syncNewPairs(state, id);

    if (state.queue[0] !== pairId) {
      return res.status(409).json({ error: 'Card mismatch — refresh and continue.' });
    }
    state.queue.shift();
    const card = state.cards[pairId];
    if (!card) return res.status(400).json({ error: 'Unknown card.' });

    let pointsEarned = 0;
    let graduated = false;
    let mastered = false;

    if (isCorrect) {
      if (card.missedInPhase) {
        card.consecutiveCorrect += 1;
        if (card.consecutiveCorrect >= 2) {
          if (card.phase === 'mc') {
            card.phase = 'tio';
            card.missedInPhase = false;
            card.consecutiveCorrect = 0;
            graduated = true;
          } else {
            card.mastered = true;
            mastered = true;
          }
        }
      } else {
        // first-try correct
        if (card.phase === 'mc') {
          card.phase = 'tio';
          card.missedInPhase = false;
          card.consecutiveCorrect = 0;
          graduated = true;
        } else {
          card.mastered = true;
          mastered = true;
        }
      }
    } else {
      card.missedInPhase = true;
      card.consecutiveCorrect = 0;
    }

    // Pay the slice if newly mastered (and not already paid this run).
    if (mastered && !card.paidOut) {
      card.paidOut = true;
      state.mastersThisRun = (state.mastersThisRun || 0) + 1;
      const slice = LEARN_RUN_POINTS / state.totalCards;
      pointsEarned = slice;
      const dateEt = easternDateString();
      await supabase.from('points_ledger').insert({
        user_id: user.id, game_id: id, points: slice,
        source: 'learn_master', ref_id: pairId, earned_date_et: dateEt,
      });
      await supabase.from('activity_log').upsert(
        { user_id: user.id, game_id: id, date_et: dateEt },
        { onConflict: 'user_id,game_id,date_et' });
    } else {
      // Even an in-progress answer counts as activity for the streak/calendar.
      const dateEt = easternDateString();
      await supabase.from('activity_log').upsert(
        { user_id: user.id, game_id: id, date_et: dateEt },
        { onConflict: 'user_id,game_id,date_et' });
    }

    // Re-append the card if not mastered.
    if (!card.mastered) state.queue.push(pairId);

    // Session bookkeeping
    state.currentSessionAnswered = (state.currentSessionAnswered || 0) + 1;
    if (isCorrect) state.currentSessionCorrect = (state.currentSessionCorrect || 0) + 1;

    let sessionSummary = null;
    if (state.currentSessionAnswered >= CARDS_PER_SESSION) {
      sessionSummary = {
        correct: state.currentSessionCorrect,
        total: state.currentSessionAnswered,
      };
      state.sessionHistory = [...(state.sessionHistory || []), sessionSummary];
      state.currentSessionAnswered = 0;
      state.currentSessionCorrect = 0;
    }

    // Check for run completion
    const allMastered = Object.values(state.cards).every(c => c.mastered);
    if (allMastered) {
      state.completedAt = new Date().toISOString();
    }

    await saveRun(user.id, id, state);

    const nextCard = state.completedAt
      ? null
      : await buildNextCardPayload(state, id);

    res.json({
      state,
      nextCard,
      pointsEarned,
      graduated,
      mastered,
      sessionSummary,
      runComplete: !!state.completedAt,
      buckets: bucketCounts(state),
      secondsRemaining: estimatedSecondsRemaining(state),
      cardsRemaining: state.queue.length,
    });
  } catch (e) { sendError(res, e); }
});

// POST /api/games/:id/learn/exit — confirm exit. Points for mastered cards are
// already paid (per-card on mastery). The popup shows "points earned since the
// last bank" — i.e. points from cards mastered AFTER the previous exit. If the
// user re-enters and exits without mastering anything new, this is 0.
app.post('/api/games/:id/learn/exit', async (req, res) => {
  try {
    const user = await requireUser(req);
    const { id } = req.params;
    const { state } = await loadOrInitRun(user.id, id);
    const masters = Object.values(state.cards).filter(c => c.mastered).length;
    const slice = LEARN_RUN_POINTS / Math.max(state.totalCards, 1);
    const bankedSinceLastExit = Math.max(0, masters - (state.mastersBankedAtLastExit || 0)) * slice;
    state.mastersBankedAtLastExit = masters;
    await saveRun(user.id, id, state);
    res.json({
      ok: true,
      bankedSinceLastExit,
      bankedTotalRun: masters * slice,
    });
  } catch (e) { sendError(res, e); }
});

// POST /api/games/:id/learn/reset — start a brand-new run (used after a run
// completes; the client confirms then calls this).
app.post('/api/games/:id/learn/reset', async (req, res) => {
  try {
    const user = await requireUser(req);
    const { id } = req.params;
    const pairs = await expectRead(
      `load pairs for Learn reset on game ${id}`,
      supabase.from('pairs').select('id, term, definition')
        .eq('game_id', id).is('deleted_at', null),
    );
    if (!pairs?.length) return res.status(400).json({ error: 'No content in game.' });
    const state = newRunState(pairs);
    await saveRun(user.id, id, state);
    res.json({ ok: true, state });
  } catch (e) { sendError(res, e); }
});

// ===========================================================================
// PROFILE (calendar, streak, totals)
// ===========================================================================

app.get('/api/games/:id/profile', async (req, res) => {
  try {
    const user = await requireUser(req);
    const { id } = req.params;
    const { data: mem } = await supabase.from('memberships')
      .select('user_id').eq('user_id', user.id).eq('game_id', id).maybeSingle();
    if (!mem) return res.status(403).json({ error: 'Not in this game.' });

    const { data: ledger } = await supabase.from('points_ledger')
      .select('points').eq('user_id', user.id).eq('game_id', id);
    const totalPoints = (ledger || []).reduce((s, r) => s + Number(r.points), 0);

    const { data: activity } = await supabase.from('activity_log')
      .select('date_et').eq('user_id', user.id).eq('game_id', id);
    const activeDates = (activity || []).map(r => r.date_et);

    res.json({
      user: { id: user.id, firstName: user.first_name, lastName: user.last_name },
      totalPoints,
      activeDates,
    });
  } catch (e) { sendError(res, e); }
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// 404 for /api/* misses
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

export default app;
