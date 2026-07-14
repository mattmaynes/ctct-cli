// OAuth2 constants for the Constant Contact v3 authorization server.
//
// The CLI authenticates using the OAuth2 Device Flow, which is a *public
// client* flow: only a client_id is required (no client secret), and there is
// no redirect URI / localhost callback server. See:
// https://developer.constantcontact.com/api_guide/device_flow.html

export const AUTHZ_BASE = 'https://authz.constantcontact.com/oauth2/default/v1';
export const DEVICE_AUTHORIZE_URL = `${AUTHZ_BASE}/device/authorize`;
export const TOKEN_URL = `${AUTHZ_BASE}/token`;

export const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
export const REFRESH_GRANT = 'refresh_token';

// The full set of scopes the v3 API exposes. `offline_access` is what makes the
// authorization server return a refresh token, so it is always requested.
export interface ScopeInfo {
  name: string;
  description: string;
}

export const SCOPES: ScopeInfo[] = [
  { name: 'account_read', description: 'Read account data.' },
  { name: 'account_update', description: 'Update account data.' },
  { name: 'contact_data', description: 'Read and write contact data and read contact reports.' },
  { name: 'campaign_data', description: 'Read and write campaign data and read campaign reports.' },
  { name: 'offline_access', description: 'Receive a refresh token for long-lived access (always included).' },
];

// Scopes a user can meaningfully choose between (offline_access is implied).
export const SELECTABLE_SCOPES = SCOPES.filter((s) => s.name !== 'offline_access').map((s) => s.name);
export const ALL_SCOPES = SCOPES.map((s) => s.name);

/**
 * Resolve which refresh token `ctct refresh-token` should exchange, from the
 * precedence: explicit `--refresh-token` flag > `CTCT_REFRESH_TOKEN` env var >
 * the stored login session. `fromSession` is true only when the token came from
 * the session (neither flag nor env was given), which tells the caller to
 * persist the rotated tokens back to the session store; an explicit flag/env
 * token is treated as stateless (e.g. a cron keepalive over a `.env` file) and
 * is never written to the session.
 */
export function resolveRefreshToken(sources: {
  flag?: string;
  env?: string;
  session?: string;
}): { refreshToken?: string; fromSession: boolean } {
  const explicit = sources.flag || sources.env;
  return {
    refreshToken: explicit || sources.session || undefined,
    fromSession: !explicit && !!sources.session,
  };
}

/**
 * Normalize a user-supplied scope selection into the space-delimited string the
 * authorization server expects. `offline_access` is always appended so we get a
 * refresh token. Passing nothing (or "all") requests every scope.
 */
export function resolveScopes(selection?: string | string[]): string {
  let chosen: string[];
  if (!selection || selection === 'all') {
    chosen = [...SELECTABLE_SCOPES];
  } else {
    const raw = Array.isArray(selection) ? selection : selection.split(/[,\s]+/);
    chosen = raw.map((s) => s.trim()).filter(Boolean);
    const unknown = chosen.filter((s) => !SELECTABLE_SCOPES.includes(s) && s !== 'offline_access');
    if (unknown.length) {
      throw new Error(
        `Unknown scope(s): ${unknown.join(', ')}. Valid scopes: ${SELECTABLE_SCOPES.join(', ')}`,
      );
    }
  }
  const withOffline = Array.from(new Set([...chosen, 'offline_access']));
  return withOffline.join(' ');
}
