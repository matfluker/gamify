-- Gamify schema. Run in the Supabase SQL editor.
-- Safe to re-run: drops are commented; uncomment if you want a clean slate.

-- drop table if exists daily_rank_snapshots cascade;
-- drop table if exists test_attempts cascade;
-- drop table if exists quiz_attempts cascade;
-- drop table if exists learn_runs cascade;
-- drop table if exists points_ledger cascade;
-- drop table if exists activity_log cascade;
-- drop table if exists memberships cascade;
-- drop table if exists pairs cascade;
-- drop table if exists games cascade;
-- drop table if exists users cascade;

create extension if not exists "pgcrypto";

-- USERS: one row per phone (normalized). No password / no auth provider yet.
create table if not exists users (
  id              uuid primary key default gen_random_uuid(),
  phone           text not null unique,         -- normalized digits, US 10-digit form when possible
  first_name      text,
  last_name       text,
  created_at      timestamptz not null default now()
);
-- Backfill the unique(phone) constraint on databases that were created from an
-- earlier version of this schema (where it was missing). The API merges
-- duplicates on login, but the constraint stops new ones from being created
-- in race conditions. Run after the dedup query below.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'users'::regclass and contype = 'u'
      and conkey = (
        select array_agg(attnum) from pg_attribute
        where attrelid = 'users'::regclass and attname = 'phone'
      )
  ) then
    alter table users add constraint users_phone_key unique (phone);
  end if;
end $$;

-- GAMES: each Gamify game.
create table if not exists games (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  admin_user_id   uuid not null references users(id) on delete cascade,
  share_code      text not null unique,
  -- 'term' means the term (reference) is shown as the prompt and the user recalls the definition.
  -- 'definition' means the definition is shown and the user recalls the term.
  direction       text not null default 'term' check (direction in ('term','definition')),
  created_at      timestamptz not null default now()
);
create index if not exists idx_games_admin on games(admin_user_id);

-- PAIRS: term/definition pairs that belong to a game.
-- deleted_at: soft-delete marker. Pairs are NEVER hard-deleted because active
-- Learn runs and already-seeded daily quizzes/tests may still reference them.
-- Admin "Edit Pairs" UX hides soft-deleted pairs from new content.
create table if not exists pairs (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references games(id) on delete cascade,
  term            text not null,
  definition      text not null,
  sort_order      int not null default 0,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);
alter table pairs add column if not exists deleted_at timestamptz;
create index if not exists idx_pairs_game on pairs(game_id);

-- DAILY QUESTION SETS: snapshot of the quiz/test questions for a given day.
-- Lazily created when the first user opens that day's quiz or test. Once
-- created, the set is frozen for the day, so a later admin edit to pair
-- text won't change today's questions.
create table if not exists daily_question_sets (
  game_id     uuid not null references games(id) on delete cascade,
  kind        text not null check (kind in ('quiz', 'test')),
  date_et     date not null,
  questions   jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (game_id, kind, date_et)
);

-- MEMBERSHIPS: which users have joined which games.
create table if not exists memberships (
  user_id         uuid not null references users(id) on delete cascade,
  game_id         uuid not null references games(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (user_id, game_id)
);
create index if not exists idx_memberships_game on memberships(game_id);

-- POINTS LEDGER: append-only log of every points-earning event.
-- source: 'learn_master' (card mastered slice), 'quiz', 'test'.
create table if not exists points_ledger (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  game_id         uuid not null references games(id) on delete cascade,
  points          numeric(10,4) not null,
  source          text not null,
  ref_id          text,                          -- pair id for learn, attempt id for quiz/test
  earned_at       timestamptz not null default now(),
  earned_date_et  date not null                  -- the US/Eastern calendar date the event counts for
);
create index if not exists idx_ledger_user_game on points_ledger(user_id, game_id);
create index if not exists idx_ledger_game_date on points_ledger(game_id, earned_date_et);

-- LEARN RUNS: one row per (user, game). Stores the current run state (in-progress or last completed).
-- state is jsonb so we don't lock the shape in the DB. Includes:
--   cards: { [pair_id]: { phase, missedInPhase, consecutiveCorrect, mastered, paidOut } }
--   queue: ordered array of pair_ids still to be shown this run
--   sessionHistory: array of last N { correct, total }
--   currentSessionAnswers: number answered this 10-card session
--   currentSessionCorrect: number correct in this 10-card session
--   totalCards: snapshot of card count when run started (admin can add later; new cards join the next run)
--   newPairsSinceStart: array of pair_ids added mid-run, awaiting next run
create table if not exists learn_runs (
  user_id         uuid not null references users(id) on delete cascade,
  game_id         uuid not null references games(id) on delete cascade,
  state           jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- QUIZ ATTEMPTS: one per user/game/day. Locked once recorded.
create table if not exists quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  game_id         uuid not null references games(id) on delete cascade,
  date_et         date not null,
  total           int not null,
  correct         int not null,
  answers         jsonb not null,                -- [{pairId, chosen, correct, isCorrect}]
  taken_at        timestamptz not null default now(),
  unique (user_id, game_id, date_et)
);

-- TEST ATTEMPTS: one per user/game/day. Locked once recorded.
create table if not exists test_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  game_id         uuid not null references games(id) on delete cascade,
  date_et         date not null,
  total           int not null,
  correct         int not null,
  answers         jsonb not null,
  taken_at        timestamptz not null default now(),
  unique (user_id, game_id, date_et)
);

-- DAILY RANK SNAPSHOTS: rank captured at the start of each US/Eastern day.
-- Used to compute the daily rank movement indicator on the leaderboard.
create table if not exists daily_rank_snapshots (
  game_id         uuid not null references games(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  date_et         date not null,
  rank            int not null,
  total_points    numeric(10,4) not null,
  primary key (game_id, user_id, date_et)
);
create index if not exists idx_snapshots_game_date on daily_rank_snapshots(game_id, date_et);

-- ACTIVITY LOG: per user/game/day, did the user make ANY progress?
-- Used for the profile calendar and weekly streak.
create table if not exists activity_log (
  user_id         uuid not null references users(id) on delete cascade,
  game_id         uuid not null references games(id) on delete cascade,
  date_et         date not null,
  primary key (user_id, game_id, date_et)
);
create index if not exists idx_activity_user_date on activity_log(user_id, date_et);

-- Helpful view: total points per user per game.
create or replace view v_user_game_totals as
  select user_id, game_id, sum(points)::numeric(10,4) as total_points
  from points_ledger
  group by user_id, game_id;
