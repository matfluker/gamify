// Vercel Functions entry. vercel.json rewrites /api/* to /api so this single
// function handles every API path. The underscore-prefixed _app.js isn't
// auto-routed by Vercel; we re-export the Express app here so the original
// URL (e.g. /api/auth/login) is preserved on req.url and Express matches it.
import app from './_app.js';
export default app;
