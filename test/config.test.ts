import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveConfigDir, globalConfigDir, DIR_NAME } from '../src/lib/config';

function mkTemp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ctct-cfg-'));
}

function withEnv(fn: () => void): void {
  const saved = process.env.CTCT_CONFIG_DIR;
  const cwd = process.cwd();
  delete process.env.CTCT_CONFIG_DIR;
  try {
    fn();
  } finally {
    if (saved === undefined) delete process.env.CTCT_CONFIG_DIR;
    else process.env.CTCT_CONFIG_DIR = saved;
    process.chdir(cwd);
  }
}

test('resolveConfigDir: explicit override wins', () => {
  withEnv(() => {
    process.env.CTCT_CONFIG_DIR = '/should/be/ignored';
    assert.equal(resolveConfigDir('/explicit/dir'), path.resolve('/explicit/dir'));
  });
});

test('resolveConfigDir: env var used when no override', () => {
  withEnv(() => {
    process.env.CTCT_CONFIG_DIR = '/env/dir';
    assert.equal(resolveConfigDir(), path.resolve('/env/dir'));
  });
});

test('resolveConfigDir: finds nearest .ctct walking up', () => {
  withEnv(() => {
    const root = mkTemp();
    const localDir = path.join(root, DIR_NAME);
    fs.mkdirSync(localDir);
    const nested = path.join(root, 'a', 'b');
    fs.mkdirSync(nested, { recursive: true });
    process.chdir(nested);
    // Compare real paths: on macOS the tmp dir is under a /private symlink and
    // process.cwd() (used while walking up) resolves it.
    assert.equal(fs.realpathSync(resolveConfigDir()), fs.realpathSync(localDir));
  });
});

test('resolveConfigDir: falls back to global ~/.ctct', () => {
  withEnv(() => {
    const root = mkTemp(); // no .ctct ancestor
    process.chdir(root);
    assert.equal(resolveConfigDir(), globalConfigDir());
  });
});
