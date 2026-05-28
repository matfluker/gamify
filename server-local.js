// Local-only entry: binds the Express app to a port. Vercel never runs this;
// it imports api/index.js directly as a serverless function.
//
// Env loading mirrors Vite / Vercel: .env is the committed baseline (Supabase
// URL + service role key) and .env.local is what `vercel env pull` writes
// (CRON_SECRET, APNS_*, etc). Both must load so cron endpoints can authorize
// in local dev. Use top-level await on a dynamic import for the app so the
// dotenv.config() calls actually run BEFORE api/_app.js (and supabase.js) are
// evaluated — plain ESM imports are hoisted above non-import statements,
// which would otherwise build the Supabase client with empty env vars.
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });
const { default: app } = await import('./api/_app.js');

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`[gamify] API listening on http://localhost:${port}`);
});
