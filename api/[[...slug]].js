// Vercel catch-all serverless function. Matches /api and /api/anything/else.
// The underscore-prefixed _app.js is not auto-routed by Vercel; we re-export
// the Express app here so subpaths land on it with the original URL preserved.
import app from './_app.js';
export default app;
