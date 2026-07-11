// TokenManager: the single choke point through which every API command obtains
// a valid access token. It loads the stored token set, refreshes it when it is
// near expiry, and persists the rotated tokens so callers never deal with
// expiry themselves.

import { TokenSet } from './config';
import { TokenStore } from './storage';
import { refreshAccessToken, FlowDeps } from './deviceFlow';
import { AuthError } from './errors';

// Refresh when the access token has less than this much life left.
const EXPIRY_BUFFER_MS = 60_000;

export class TokenManager {
  constructor(
    private readonly clientId: string | undefined,
    private readonly store: TokenStore,
    private readonly deps: FlowDeps = {},
  ) {}

  get tokens(): TokenSet | null {
    return this.store.load();
  }

  isLoggedIn(): boolean {
    return this.store.load() != null;
  }

  isExpired(tokens: TokenSet, bufferMs = EXPIRY_BUFFER_MS): boolean {
    const now = this.deps.now ?? Date.now;
    return now() >= tokens.expires_at - bufferMs;
  }

  save(tokens: TokenSet): void {
    this.store.save(tokens);
  }

  logout(): void {
    this.store.clear();
  }

  /**
   * Return a currently-valid access token, refreshing and persisting new tokens
   * if the stored access token is expired or about to expire.
   */
  async ensureValidAccessToken(): Promise<string> {
    const tokens = this.store.load();
    if (!tokens) {
      throw new AuthError('Not authenticated. Run `ctct login` first.');
    }
    if (!this.isExpired(tokens)) {
      return tokens.access_token;
    }
    if (!tokens.refresh_token) {
      throw new AuthError('Access token expired and no refresh token is stored. Run `ctct login`.');
    }
    if (!this.clientId) {
      throw new AuthError('No client_id configured. Run `ctct init --client-id <id>`.');
    }
    const refreshed = await refreshAccessToken(this.clientId, tokens.refresh_token, this.deps);
    this.store.save(refreshed);
    return refreshed.access_token;
  }
}
