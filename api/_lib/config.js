// Server-side mirror of src/config.js. Kept in sync manually.
// (Vite-bundled client code uses src/config.js; serverless can't import from /src.)

export const QUIZ_LENGTH = 5;
export const QUIZ_MAX_POINTS = 5;
export const TEST_LENGTH = 20;
export const TEST_MAX_POINTS = 20;
export const LEARN_RUN_POINTS = 50;
export const TIER_THRESHOLDS = [100, 200, 350, 600];
export const CARDS_PER_SESSION = 10;
export const MC_OPTION_COUNT = 4;
export const SIMILARITY_THRESHOLD = 0.9;
export const SHARE_CODE_LENGTH = 6;
export const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const APP_TIMEZONE = 'America/New_York';
