// Single Supabase client for the API (service-role key, server-only).
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  // Don't throw at import time on Vercel cold start (would 500 every route);
  // throw on first use so the message reaches the response.
  console.warn('[gamify] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.');
}

export const supabase = createClient(url || 'http://localhost', key || 'placeholder', {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function assertEnv() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error('Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    err.status = 500;
    throw err;
  }
}
