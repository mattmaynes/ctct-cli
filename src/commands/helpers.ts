// Small helpers shared by resource commands.

import { Command } from 'commander';

/** Unwrap an SDK method's AxiosResponse to its data payload. */
export async function call<T>(p: Promise<{ data: T }>): Promise<T> {
  return (await p).data;
}

/** commander's `--limit` parser (string -> number). */
export function toInt(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`"${value}" is not a number`);
  return n;
}

/**
 * Add a standard `--data <json|@file>` option describing the escape hatch that
 * maps directly onto the SDK request body.
 */
export function withDataOption(cmd: Command, noun = 'request body'): Command {
  return cmd.option(
    '--data <json>',
    `full ${noun} as inline JSON, @file.json, or @- for stdin (merged over flags)`,
  );
}

/** Drop undefined-valued keys so they don't overwrite --data fields. */
export function defined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}
