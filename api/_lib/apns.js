// Tiny wrapper around @parse/node-apn's Provider so the rest of the API can
// just call `sendPush(deviceToken, { title, body, data })`. APNs HTTP/2 token
// auth uses the .p8 key downloaded from developer.apple.com — see Phase 0 in
// docs/IOS_MIGRATION_PLAN.md.

import apn from '@parse/node-apn';

// Vercel env vars store the .p8 PEM as a single line with literal `\n`
// sequences. Restore real newlines before handing it to the apn provider.
function decodeKey(raw) {
  if (!raw) return '';
  return raw.replace(/\\n/g, '\n');
}

let _provider;
function getProvider() {
  if (_provider) return _provider;
  const key = decodeKey(process.env.APNS_KEY_P8);
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!key || !keyId || !teamId) {
    const e = new Error('APNS_KEY_P8, APNS_KEY_ID, or APNS_TEAM_ID is not set on the server.');
    e.status = 500;
    throw e;
  }
  _provider = new apn.Provider({
    token: { key, keyId, teamId },
    production: String(process.env.APNS_PRODUCTION).toLowerCase() === 'true',
  });
  return _provider;
}

// Send one push. Resolves to { sent: true } on success.
// On a permanent token failure (BadDeviceToken / Unregistered / 410), throws
// an error with `e.unregistered === true` so the caller can clear the token
// from the DB and stop sending to it.
export async function sendPush(deviceToken, { title, body, data } = {}) {
  if (!deviceToken) {
    const e = new Error('Missing APNs device token.');
    e.status = 400;
    throw e;
  }
  const topic = process.env.APNS_BUNDLE_ID;
  if (!topic) {
    const e = new Error('APNS_BUNDLE_ID is not set on the server.');
    e.status = 500;
    throw e;
  }

  const provider = getProvider();
  const notification = new apn.Notification();
  notification.topic = topic;
  notification.alert = { title, body };
  notification.sound = 'default';
  if (data && typeof data === 'object') notification.payload = data;

  const result = await provider.send(notification, deviceToken);
  const failure = result.failed?.[0];
  if (failure) {
    const status = failure.status ? String(failure.status) : '';
    const reason = failure.response?.reason || failure.error?.message || '';
    const e = new Error(`APNs failure: ${reason || status || 'unknown'}`);
    e.unregistered = status === '410' || reason === 'BadDeviceToken' || reason === 'Unregistered';
    e.apnsStatus = status;
    e.apnsReason = reason;
    throw e;
  }
  return { sent: true };
}
