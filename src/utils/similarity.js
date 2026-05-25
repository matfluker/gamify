// Forgiving "close enough" check for type-it-out answers.
// - Lowercase, strip punctuation, collapse whitespace.
// - Compare with normalized Levenshtein similarity.

export function normalizeForCompare(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[‘’“”]/g, "'") // smart quotes -> ascii
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')  // drop punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function similarity(a, b) {
  const A = normalizeForCompare(a);
  const B = normalizeForCompare(b);
  if (A === '' && B === '') return 1;
  const maxLen = Math.max(A.length, B.length);
  if (maxLen === 0) return 1;
  const d = levenshtein(A, B);
  return 1 - d / maxLen;
}

// True if `userAnswer` is letter-for-letter identical to `correct` after
// trim (used to decide whether to show an override button).
export function isExactMatch(userAnswer, correct) {
  return String(userAnswer ?? '').trim() === String(correct ?? '').trim();
}
