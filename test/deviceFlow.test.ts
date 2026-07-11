import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { pollForToken, refreshAccessToken, DeviceAuthorization } from '../src/lib/deviceFlow';

// Build a fake fetch that returns queued JSON bodies in order.
function queuedFetch(responses: Array<{ status?: number; body: unknown }>): typeof fetch {
  let i = 0;
  return (async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return {
      status: r.status ?? 200,
      text: async () => JSON.stringify(r.body),
    };
  }) as unknown as typeof fetch;
}

const AUTH: DeviceAuthorization = {
  device_code: 'dev-123',
  user_code: 'ABCD',
  verification_uri: 'https://example/activate',
  expires_in: 600,
  interval: 1,
};

const noSleep = async () => {};
const now = () => 1_000_000_000_000;

test('pollForToken: retries on authorization_pending then succeeds', async () => {
  const fetchFn = queuedFetch([
    { body: { error: 'authorization_pending' } },
    { body: { error: 'authorization_pending' } },
    { body: { access_token: 'AT', refresh_token: 'RT', expires_in: 28800, token_type: 'Bearer' } },
  ]);
  const token = await pollForToken('client', AUTH, { fetchFn, sleep: noSleep, now });
  assert.equal(token.access_token, 'AT');
  assert.equal(token.refresh_token, 'RT');
  assert.equal(token.expires_at, now() + 28800 * 1000);
});

test('pollForToken: throws on expired_token', async () => {
  const fetchFn = queuedFetch([{ body: { error: 'expired_token' } }]);
  await assert.rejects(() => pollForToken('client', AUTH, { fetchFn, sleep: noSleep, now }), /expired/i);
});

test('pollForToken: throws on access_denied', async () => {
  const fetchFn = queuedFetch([{ body: { error: 'access_denied' } }]);
  await assert.rejects(() => pollForToken('client', AUTH, { fetchFn, sleep: noSleep, now }), /denied/i);
});

test('refreshAccessToken: keeps previous refresh token if none returned', async () => {
  const fetchFn = queuedFetch([{ body: { access_token: 'AT2', expires_in: 28800 } }]);
  const token = await refreshAccessToken('client', 'prev-refresh', { fetchFn, now });
  assert.equal(token.access_token, 'AT2');
  assert.equal(token.refresh_token, 'prev-refresh');
});

test('refreshAccessToken: surfaces OAuth errors', async () => {
  const fetchFn = queuedFetch([{ status: 400, body: { error: 'invalid_grant' } }]);
  await assert.rejects(() => refreshAccessToken('client', 'bad', { fetchFn, now }), /refresh failed/i);
});
