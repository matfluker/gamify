// All day boundaries in the app are US Eastern Time.
// We compute "what is today's date in ET" by formatting a Date in en-CA locale
// with timeZone: America/New_York — that gives us "YYYY-MM-DD" directly.

import { APP_TIMEZONE } from '../config.js';

export function easternDateString(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(date); // 'YYYY-MM-DD'
}

// Returns { year, month, day } in ET for a given Date.
export function easternDateParts(date = new Date()) {
  const s = easternDateString(date);
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m, day: d };
}

// Day-of-week (0 = Sunday) for an ET date string 'YYYY-MM-DD'.
export function dowFromDateString(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  // Construct as UTC; weekday is the same for any tz-shifted version of the
  // same calendar date.
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// All ET dates (YYYY-MM-DD) for the current ET calendar month, in order.
export function easternMonthDates(date = new Date()) {
  const { year, month } = easternDateParts(date);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out = [];
  for (let d = 1; d <= last; d++) {
    out.push(`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  }
  return out;
}

// Sunday-of-week date string (YYYY-MM-DD) for a given ET date string.
export function sundayOfWeek(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = utc.getUTCDay();
  utc.setUTCDate(utc.getUTCDate() - dow);
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Counts CALENDAR WEEKS (Sun–Sat in ET) with at least one active date.
// `activeDateStrings`: set/array of 'YYYY-MM-DD' the user was active.
// Streak: number of consecutive weeks ending with the CURRENT week that
// contain at least one active date. If the current week has no activity yet,
// the streak is the count ending with the most recent active week (the user
// hasn't broken it until the week ends).
export function weeklyStreakCount(activeDateStrings, today = easternDateString()) {
  const set = new Set(activeDateStrings);
  const weekHasActivity = (sundayYmd) => {
    const [y, m, d] = sundayYmd.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    for (let i = 0; i < 7; i++) {
      const dt = new Date(start);
      dt.setUTCDate(dt.getUTCDate() + i);
      const ys = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
      if (set.has(ys)) return true;
    }
    return false;
  };
  let cursor = sundayOfWeek(today);
  // If the current week has no activity yet, start counting from the prior
  // week so the user doesn't see their streak drop to 0 just because today
  // is Sunday morning.
  if (!weekHasActivity(cursor)) {
    cursor = prevSunday(cursor);
  }
  let count = 0;
  while (weekHasActivity(cursor)) {
    count += 1;
    cursor = prevSunday(cursor);
  }
  return count;
}

function prevSunday(sundayYmd) {
  const [y, m, d] = sundayYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 7);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
}
