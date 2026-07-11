// OAuth2 Device Flow implementation against the Constant Contact authorization
// server. Uses the global `fetch` (Node >= 18). Network and sleep are injectable
// so the polling loop can be unit-tested without real HTTP or real delays.

import {
  DEVICE_AUTHORIZE_URL,
  DEVICE_CODE_GRANT,
  REFRESH_GRANT,
  TOKEN_URL,
} from './oauth';
import { AuthError } from './errors';
import { TokenSet } from './config';

export interface DeviceAuthorization {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export interface FlowDeps {
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Wall clock, injectable for deterministic expires_at in tests. */
  now?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function postForm(
  url: string,
  params: Record<string, string>,
  fetchFn: typeof fetch,
): Promise<{ status: number; body: any }> {
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(params).toString(),
  });
  let body: any = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

function toTokenSet(t: TokenResponse, now: () => number): TokenSet {
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: now() + t.expires_in * 1000,
    scope: t.scope,
    token_type: t.token_type ?? 'Bearer',
  };
}

/** Step 1: request a device + user code from the authorization server. */
export async function startDeviceAuthorization(
  clientId: string,
  scope: string,
  deps: FlowDeps = {},
): Promise<DeviceAuthorization> {
  const fetchFn = deps.fetchFn ?? fetch;
  const { status, body } = await postForm(
    DEVICE_AUTHORIZE_URL,
    { client_id: clientId, scope, response_type: 'code' },
    fetchFn,
  );
  if (status >= 400 || !body?.device_code) {
    const msg = body?.error_description || body?.error || `HTTP ${status}`;
    throw new AuthError(`Failed to start device authorization: ${msg}`, body);
  }
  return body as DeviceAuthorization;
}

/**
 * Step 2/3: poll the token endpoint until the user approves (or the code
 * expires). Honors `authorization_pending` and `slow_down` per RFC 8628.
 */
export async function pollForToken(
  clientId: string,
  auth: DeviceAuthorization,
  deps: FlowDeps = {},
): Promise<TokenSet> {
  const fetchFn = deps.fetchFn ?? fetch;
  const sleep = deps.sleep ?? realSleep;
  const now = deps.now ?? Date.now;

  let intervalMs = (auth.interval ?? 5) * 1000;
  const deadline = now() + (auth.expires_in ?? 600) * 1000;

  while (true) {
    if (now() >= deadline) {
      throw new AuthError('Device code expired before authorization completed. Run `ctct login` again.');
    }
    await sleep(intervalMs);
    const { body } = await postForm(
      TOKEN_URL,
      { client_id: clientId, device_code: auth.device_code, grant_type: DEVICE_CODE_GRANT },
      fetchFn,
    );
    if (body?.access_token) {
      return toTokenSet(body as TokenResponse, now);
    }
    switch (body?.error) {
      case 'authorization_pending':
        continue;
      case 'slow_down':
        intervalMs += 5000;
        continue;
      case 'expired_token':
        throw new AuthError('Device code expired before authorization completed. Run `ctct login` again.');
      case 'access_denied':
        throw new AuthError('Authorization was denied.');
      default:
        throw new AuthError(
          `Authorization failed: ${body?.error_description || body?.error || 'unknown error'}`,
          body,
        );
    }
  }
}

/** Exchange a refresh token for a fresh access token (refresh tokens rotate). */
export async function refreshAccessToken(
  clientId: string,
  refreshToken: string,
  deps: FlowDeps = {},
): Promise<TokenSet> {
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? Date.now;
  const { status, body } = await postForm(
    TOKEN_URL,
    { client_id: clientId, refresh_token: refreshToken, grant_type: REFRESH_GRANT },
    fetchFn,
  );
  if (status >= 400 || !body?.access_token) {
    const msg = body?.error_description || body?.error || `HTTP ${status}`;
    throw new AuthError(`Token refresh failed: ${msg}. Run \`ctct login\` to re-authenticate.`, body);
  }
  const next = toTokenSet(body as TokenResponse, now);
  // Constant Contact rotates refresh tokens, but be defensive: if the response
  // omits one, keep the previous refresh token so the session survives.
  if (!next.refresh_token) next.refresh_token = refreshToken;
  return next;
}
