// Pluggable token storage.
//
// Two backends implement the same TokenStore interface:
//   - KeychainTokenStore: stores the token set in the OS keychain (macOS
//     Keychain, Windows Credential Manager, Linux Secret Service) via
//     @napi-rs/keyring. Preferred on interactive machines.
//   - FileTokenStore: stores token.json with 0600 permissions inside the config
//     dir. The portable fallback, and the better choice for headless agents
//     where no keychain is unlocked.
//
// Selection: config.storage forces a backend; otherwise keychain is used when
// available and file storage is the fallback.

import * as fs from 'fs';
import * as path from 'path';
import { Entry } from '@napi-rs/keyring';
import { Config, StorageBackend, TOKEN_FILE, TokenSet } from './config';

const KEYCHAIN_SERVICE = 'constant-contact-cli';

export interface TokenStore {
  readonly backend: StorageBackend;
  /** A short human description of where tokens live (for `ctct status`). */
  readonly location: string;
  load(): TokenSet | null;
  save(tokens: TokenSet): void;
  clear(): void;
}

class FileTokenStore implements TokenStore {
  readonly backend: StorageBackend = 'file';
  private readonly file: string;
  constructor(private readonly dir: string) {
    this.file = path.join(dir, TOKEN_FILE);
  }
  get location(): string {
    return this.file;
  }
  load(): TokenSet | null {
    if (!fs.existsSync(this.file)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8')) as TokenSet;
    } catch {
      return null;
    }
  }
  save(tokens: TokenSet): void {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(this.file, JSON.stringify(tokens, null, 2) + '\n', { mode: 0o600 });
  }
  clear(): void {
    if (fs.existsSync(this.file)) fs.rmSync(this.file);
  }
}

class KeychainTokenStore implements TokenStore {
  readonly backend: StorageBackend = 'keychain';
  private readonly entry: Entry;
  // The keychain account is keyed by config-dir path so local and global
  // installs keep separate credentials.
  constructor(private readonly account: string) {
    this.entry = new Entry(KEYCHAIN_SERVICE, account);
  }
  get location(): string {
    return `OS keychain (${KEYCHAIN_SERVICE} / ${this.account})`;
  }
  load(): TokenSet | null {
    const raw = this.entry.getPassword();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TokenSet;
    } catch {
      return null;
    }
  }
  save(tokens: TokenSet): void {
    this.entry.setPassword(JSON.stringify(tokens));
  }
  clear(): void {
    try {
      this.entry.deletePassword();
    } catch {
      /* nothing stored */
    }
  }
}

/** Probe whether an OS keychain backend is usable in this environment. */
export function keychainAvailable(): boolean {
  try {
    // Reading a (probably absent) entry exercises the platform backend without
    // writing anything; it returns null when the backend works but has no entry.
    new Entry(KEYCHAIN_SERVICE, '__probe__').getPassword();
    return true;
  } catch {
    return false;
  }
}

/**
 * Build the token store for a config dir. Honors config.storage; when it is
 * unset, prefers the keychain and falls back to a 0600 file.
 */
export function getTokenStore(dir: string, config: Config): TokenStore {
  const desired = config.storage;
  if (desired === 'file') return new FileTokenStore(dir);
  if (desired === 'keychain') return new KeychainTokenStore(dir);
  return keychainAvailable() ? new KeychainTokenStore(dir) : new FileTokenStore(dir);
}
