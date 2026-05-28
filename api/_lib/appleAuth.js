// Verify "Sign in with Apple" identity tokens against Apple's published JWKS.
// The iOS app does the OAuth dance with Apple and posts the resulting JWT to
// /api/auth/apple; this module is what makes that JWT trustworthy.

import { createRemoteJWKSet, jwtVerify } from 'jose';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = new URL('https://appleid.apple.com/auth/keys');

// jose caches the JWKS internally (5-min refresh by default); a single instance
// per process is fine across many requests.
let _jwks;
function getJwks() {
  if (!_jwks) _jwks = createRemoteJWKSet(APPLE_JWKS_URL);
  return _jwks;
}

export async function verifyAppleIdentityToken(identityToken) {
  if (!identityToken || typeof identityToken !== 'string') {
    const e = new Error('Missing or invalid identityToken.');
    e.status = 400;
    throw e;
  }
  const audience = process.env.APPLE_BUNDLE_ID;
  if (!audience) {
    const e = new Error('APPLE_BUNDLE_ID is not set on the server.');
    e.status = 500;
    throw e;
  }
  try {
    const { payload } = await jwtVerify(identityToken, getJwks(), {
      issuer: APPLE_ISSUER,
      audience,
    });
    return payload;
  } catch (err) {
    const e = new Error(`Invalid Apple identity token: ${err.message}`);
    e.status = 400;
    throw e;
  }
}
