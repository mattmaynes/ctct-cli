// Config-directory resolution and reading/writing config.json.
//
// Resolution order (first match wins):
//   1. explicit --config <dir> flag (passed in as `override`)
//   2. CTCT_CONFIG_DIR environment variable
//   3. nearest `.ctct/` directory walking up from the current working dir
//      (a "local" install, e.g. per-project credentials)
//   4. ~/.ctct/ (the global default)

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const DIR_NAME = '.ctct';
export const CONFIG_FILE = 'config.json';
export const TOKEN_FILE = 'token.json';

export type StorageBackend = 'keychain' | 'file';

export interface Config {
  client_id?: string;
  /** Default scope selection used by `ctct login` when --scope is omitted. */
  default_scopes?: string;
  /** Where the refresh/access tokens are kept. Defaults to keychain when available. */
  storage?: StorageBackend;
}

export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  /** Absolute expiry time of the access token, epoch milliseconds. */
  expires_at: number;
  scope?: string;
  token_type?: string;
}

/** Find the nearest ancestor directory (including cwd) that contains a `.ctct/` dir. */
function findLocalDir(startDir: string): string | undefined {
  let dir = startDir;
  // Stop at the filesystem root.
  while (true) {
    const candidate = path.join(dir, DIR_NAME);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

export const globalConfigDir = (): string => path.join(os.homedir(), DIR_NAME);

/**
 * Resolve which config directory to use. The returned path is not guaranteed to
 * exist yet (call {@link ensureConfigDir} before writing).
 */
export function resolveConfigDir(override?: string): string {
  if (override) return path.resolve(override);
  if (process.env.CTCT_CONFIG_DIR) return path.resolve(process.env.CTCT_CONFIG_DIR);
  const local = findLocalDir(process.cwd());
  if (local) return local;
  return globalConfigDir();
}

/** The config dir used by `ctct init`: local `./.ctct` when --local, else global. */
export function targetConfigDir(local: boolean, override?: string): string {
  if (override) return path.resolve(override);
  if (process.env.CTCT_CONFIG_DIR) return path.resolve(process.env.CTCT_CONFIG_DIR);
  return local ? path.join(process.cwd(), DIR_NAME) : globalConfigDir();
}

export function ensureConfigDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

export function readConfig(dir: string): Config {
  const file = path.join(dir, CONFIG_FILE);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Config;
  } catch {
    throw new Error(`Config file at ${file} is not valid JSON.`);
  }
}

export function writeConfig(dir: string, config: Config): void {
  ensureConfigDir(dir);
  const file = path.join(dir, CONFIG_FILE);
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

/** Resolve the client_id from config, falling back to the CTCT_CLIENT_ID env var. */
export function resolveClientId(config: Config): string | undefined {
  return process.env.CTCT_CLIENT_ID || config.client_id;
}
