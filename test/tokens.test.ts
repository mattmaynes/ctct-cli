import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { TokenManager } from '../src/lib/tokens';
import { TokenSet } from '../src/lib/config';
import { TokenStore } from '../src/lib/storage';

class MemoryStore implements TokenStore {
  readonly backend = 'file' as const;
  readonly location = 'memory';
  constructor(private data: TokenSet | null = null) {}
  load() {
    return this.data;
  }
  save(t: TokenSet) {
    this.data = t;
  }
  clear() {
    this.data = null;
  }
}

// A fake token endpoint that returns rotated tokens.
function fakeRefreshFetch(capture: { body?: string }): typeof fetch {
  return (async (_url: string, init: any) => {
    capture.body = init.body;
    return {
      status: 200,
      text: async () =>
        JSON.stringify({
          access_token: 'new-access',
          refresh_token: 'rotated-refresh',
          expires_in: 28800,
          scope: 'contact_data offline_access',
          token_type: 'Bearer',
        }),
    };
  }) as unknown as typeof fetch;
}

const NOW = 1_000_000_000_000;

test('ensureValidAccessToken: throws when not authenticated', async () => {
  const tm = new TokenManager('client', new MemoryStore(null), { now: () => NOW });
  await assert.rejects(() => tm.ensureValidAccessToken(), /Not authenticated/);
});

test('ensureValidAccessToken: returns current token when not expired', async () => {
  const store = new MemoryStore({ access_token: 'good', refresh_token: 'r', expires_at: NOW + 3_600_000 });
  const tm = new TokenManager('client', store, { now: () => NOW });
  assert.equal(await tm.ensureValidAccessToken(), 'good');
});

test('ensureValidAccessToken: refreshes and persists rotated refresh token', async () => {
  const store = new MemoryStore({ access_token: 'old', refresh_token: 'old-refresh', expires_at: NOW - 1 });
  const capture: { body?: string } = {};
  const tm = new TokenManager('client', store, { now: () => NOW, fetchFn: fakeRefreshFetch(capture) });

  const token = await tm.ensureValidAccessToken();
  assert.equal(token, 'new-access');
  // The rotated refresh token must be persisted for next time.
  assert.equal(store.load()?.refresh_token, 'rotated-refresh');
  assert.equal(store.load()?.access_token, 'new-access');
  // Correct grant + client sent.
  assert.match(capture.body ?? '', /grant_type=refresh_token/);
  assert.match(capture.body ?? '', /client_id=client/);
});

test('ensureValidAccessToken: expired with no refresh token errors', async () => {
  const store = new MemoryStore({ access_token: 'old', expires_at: NOW - 1 });
  const tm = new TokenManager('client', store, { now: () => NOW });
  await assert.rejects(() => tm.ensureValidAccessToken(), /no refresh token/i);
});
