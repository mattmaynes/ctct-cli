import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadDataOption, mergeBody } from '../src/lib/output';

test('loadDataOption: parses inline JSON object', () => {
  assert.deepEqual(loadDataOption('{"a":1,"b":"x"}'), { a: 1, b: 'x' });
});

test('loadDataOption: empty input yields empty object', () => {
  assert.deepEqual(loadDataOption(undefined), {});
});

test('loadDataOption: reads @file references', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ctct-data-')), 'body.json');
  fs.writeFileSync(file, '{"name":"from-file"}');
  assert.deepEqual(loadDataOption('@' + file), { name: 'from-file' });
});

test('loadDataOption: rejects non-object and invalid JSON', () => {
  assert.throws(() => loadDataOption('[1,2,3]'), /Invalid --data/);
  assert.throws(() => loadDataOption('not json'), /Invalid --data/);
});

test('mergeBody: override (--data) wins over convenience flags', () => {
  const flags = { name: 'flag', favorite: true };
  const data = { name: 'data' };
  assert.deepEqual(mergeBody(flags, data), { name: 'data', favorite: true });
});

test('mergeBody: undefined override values do not clobber base', () => {
  assert.deepEqual(mergeBody({ a: 1 }, { a: undefined as any, b: 2 }), { a: 1, b: 2 });
});
