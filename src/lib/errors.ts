// Error types and exit-code conventions.
//
// Exit codes are part of the CLI's contract with automation (AI agents,
// scripts), so they are stable and meaningful:
//   1  generic / unexpected error
//   2  usage error (bad flags, missing arguments)
//   3  not authenticated / token refresh failed  -> run `ctct login`
//   4  API error returned by Constant Contact

export const EXIT = {
  GENERIC: 1,
  USAGE: 2,
  AUTH: 3,
  API: 4,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/** An error carrying an explicit process exit code and optional structured detail. */
export class CliError extends Error {
  readonly exitCode: ExitCode;
  readonly detail?: unknown;
  constructor(message: string, exitCode: ExitCode = EXIT.GENERIC, detail?: unknown) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
    this.detail = detail;
  }
}

export class AuthError extends CliError {
  constructor(message: string, detail?: unknown) {
    super(message, EXIT.AUTH, detail);
    this.name = 'AuthError';
  }
}

interface AxiosLikeError {
  isAxiosError?: boolean;
  response?: { status?: number; data?: unknown };
  request?: unknown;
  message?: string;
}

/**
 * Convert any thrown value (axios error from the SDK, OAuth error, plain Error)
 * into a CliError with a helpful message and the right exit code.
 */
export function normalizeError(err: unknown): CliError {
  if (err instanceof CliError) return err;

  const ax = err as AxiosLikeError;
  if (ax && ax.isAxiosError) {
    if (ax.response) {
      const status = ax.response.status;
      const data = ax.response.data;
      if (status === 401) {
        return new AuthError('Access token was rejected (401). Run `ctct login` to re-authenticate.', data);
      }
      const summary = summarizeApiError(data) ?? ax.message ?? 'API request failed';
      return new CliError(`API error${status ? ` (${status})` : ''}: ${summary}`, EXIT.API, data);
    }
    if (ax.request) {
      return new CliError(`Network error: could not reach Constant Contact. ${ax.message ?? ''}`.trim(), EXIT.GENERIC);
    }
  }

  if (err instanceof Error) return new CliError(err.message, EXIT.GENERIC);
  return new CliError(String(err), EXIT.GENERIC);
}

/** Pull a human-readable message out of Constant Contact's error response body. */
function summarizeApiError(data: unknown): string | undefined {
  if (!data) return undefined;
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) {
    // v3 returns [{ error_key, error_message }, ...]
    const msgs = data
      .map((e) => (e && typeof e === 'object' ? (e as any).error_message ?? (e as any).error_key : undefined))
      .filter(Boolean);
    if (msgs.length) return msgs.join('; ');
  }
  if (typeof data === 'object') {
    const o = data as any;
    return o.error_message ?? o.error_description ?? o.error ?? o.message ?? undefined;
  }
  return undefined;
}
