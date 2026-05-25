// Thin fetch wrapper. The current user's id is sent as X-User-Id.

import { getCurrentUser } from './auth.js';

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const user = getCurrentUser();
  if (user?.id) headers['X-User-Id'] = user.id;
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get:  (p)    => request('GET',  p),
  post: (p, b) => request('POST', p, b),
  put:  (p, b) => request('PUT',  p, b),
};
