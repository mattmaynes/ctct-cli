import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { resolveRefreshToken, resolveScopes, ALL_SCOPES } from '../src/lib/oauth';

test('resolveScopes: default requests all scopes including offline_access', () => {
  const scope = resolveScopes().split(' ');
  for (const s of ALL_SCOPES) assert.ok(scope.includes(s), `missing ${s}`);
});

test('resolveScopes: subset always appends offline_access', () => {
  const scope = resolveScopes('contact_data,campaign_data');
  assert.equal(scope, 'contact_data campaign_data offline_access');
});

test('resolveScopes: accepts array and space-separated input', () => {
  assert.equal(resolveScopes(['contact_data']), 'contact_data offline_access');
  assert.equal(resolveScopes('account_read account_update'), 'account_read account_update offline_access');
});

test('resolveScopes: does not duplicate offline_access', () => {
  const scope = resolveScopes('contact_data,offline_access');
  assert.equal(scope.split(' ').filter((s) => s === 'offline_access').length, 1);
});

test('resolveScopes: rejects unknown scopes', () => {
  assert.throws(() => resolveScopes('contact_data,bogus'), /Unknown scope/);
});

test('resolveRefreshToken: flag beats env and session, and is stateless', () => {
  const r = resolveRefreshToken({ flag: 'flagtok', env: 'envtok', session: 'sesstok' });
  assert.equal(r.refreshToken, 'flagtok');
  assert.equal(r.fromSession, false);
});

test('resolveRefreshToken: env beats session, and is stateless', () => {
  const r = resolveRefreshToken({ env: 'envtok', session: 'sesstok' });
  assert.equal(r.refreshToken, 'envtok');
  assert.equal(r.fromSession, false);
});

test('resolveRefreshToken: session used only when no flag/env, and flags fromSession', () => {
  const r = resolveRefreshToken({ session: 'sesstok' });
  assert.equal(r.refreshToken, 'sesstok');
  assert.equal(r.fromSession, true);
});

test('resolveRefreshToken: nothing provided yields no token', () => {
  const r = resolveRefreshToken({});
  assert.equal(r.refreshToken, undefined);
  assert.equal(r.fromSession, false);
});
