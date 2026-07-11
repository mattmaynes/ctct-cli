// Holds the resolved global CLI options for the current invocation and lazily
// builds a single command Context from them.

import { buildContext, Ctx } from './api';

interface SessionOptions {
  configDir?: string;
}

let options: SessionOptions = {};
let cached: Ctx | undefined;

export function setSessionOptions(opts: SessionOptions): void {
  options = opts;
  cached = undefined;
}

export function ctx(): Ctx {
  if (!cached) cached = buildContext({ configDir: options.configDir });
  return cached;
}

export function sessionConfigDir(): string | undefined {
  return options.configDir;
}
