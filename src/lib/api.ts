// Per-invocation command context: resolves the config dir, config, client_id,
// token store and token manager, and builds SDK API clients that transparently
// obtain a valid access token at request time.

import { Configuration } from 'ctct-api-client';
import {
  Config,
  readConfig,
  resolveClientId,
  resolveConfigDir,
} from './config';
import { getTokenStore, TokenStore } from './storage';
import { TokenManager } from './tokens';

export interface Ctx {
  configDir: string;
  config: Config;
  clientId?: string;
  store: TokenStore;
  tokens: TokenManager;
  /** Instantiate an SDK API class wired to auto-refreshing auth. */
  api<T>(Ctor: new (config: Configuration) => T): T;
}

export function buildContext(opts: { configDir?: string } = {}): Ctx {
  const configDir = resolveConfigDir(opts.configDir);
  const config = readConfig(configDir);
  const clientId = resolveClientId(config);
  const store = getTokenStore(configDir, config);
  const tokens = new TokenManager(clientId, store);

  // The SDK accepts an async accessToken provider and calls it while building
  // each request, so token refresh happens lazily and transparently.
  const configuration = new Configuration({
    accessToken: () => tokens.ensureValidAccessToken(),
  });

  return {
    configDir,
    config,
    clientId,
    store,
    tokens,
    api: (Ctor) => new Ctor(configuration),
  };
}
