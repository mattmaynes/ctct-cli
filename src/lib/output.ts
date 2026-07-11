// Output layer. Renders human-readable tables/text on a TTY and structured JSON
// otherwise. JSON mode is on when --json is passed OR stdout is not a TTY (an
// agent piping the command), so machine consumers always get parseable output.

import * as fs from 'fs';
import { CliError } from './errors';

let jsonForced = false;

export function configureOutput(opts: { json?: boolean }): void {
  jsonForced = !!opts.json;
}

export function isJsonMode(): boolean {
  return jsonForced || !process.stdout.isTTY;
}

const useColor = (): boolean => !!process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, s: string): string => (useColor() ? `[${code}m${s}[0m` : s);
export const dim = (s: string) => paint('2', s);
export const bold = (s: string) => paint('1', s);
export const green = (s: string) => paint('32', s);
export const red = (s: string) => paint('31', s);
export const yellow = (s: string) => paint('33', s);

function writeJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

export interface Column<T> {
  header: string;
  value: (row: T) => unknown;
}

/** Print an array either as JSON or a formatted table. */
export function printList<T>(rows: T[], columns: Column<T>[]): void {
  if (isJsonMode()) {
    writeJson(rows);
    return;
  }
  if (!rows.length) {
    process.stdout.write(dim('(no results)\n'));
    return;
  }
  const cells = rows.map((r) => columns.map((c) => formatCell(c.value(r))));
  const widths = columns.map((c, i) =>
    Math.max(c.header.length, ...cells.map((row) => row[i].length)),
  );
  const line = (parts: string[]) => parts.map((p, i) => p.padEnd(widths[i])).join('  ').trimEnd();
  process.stdout.write(bold(line(columns.map((c) => c.header))) + '\n');
  for (const row of cells) process.stdout.write(line(row) + '\n');
}

/** Print a single object: JSON in json mode, else a key/value block. */
export function printObject(obj: unknown, fields?: string[]): void {
  if (isJsonMode() || obj == null || typeof obj !== 'object') {
    writeJson(obj);
    return;
  }
  const record = obj as Record<string, unknown>;
  const keys = fields ?? Object.keys(record);
  const width = Math.max(...keys.map((k) => k.length));
  for (const k of keys) {
    if (!(k in record)) continue;
    process.stdout.write(`${dim(k.padEnd(width))}  ${formatCell(record[k])}\n`);
  }
}

/** Confirm a successful action that returns little/no body. */
export function ok(message: string, payload?: unknown): void {
  if (isJsonMode()) {
    writeJson(payload ?? { ok: true, message });
    return;
  }
  process.stdout.write(green('✓ ') + message + '\n');
}

/** Informational line to stderr (never pollutes JSON stdout). */
export function info(message: string): void {
  process.stderr.write(message + '\n');
}

/** Render a normalized error and return its exit code. */
export function renderError(err: CliError): number {
  if (isJsonMode()) {
    writeJson({ error: err.message, detail: err.detail ?? undefined, exit_code: err.exitCode });
  } else {
    process.stderr.write(red('Error: ') + err.message + '\n');
    if (err.detail && process.env.CTCT_DEBUG) {
      process.stderr.write(dim(JSON.stringify(err.detail, null, 2)) + '\n');
    }
  }
  return err.exitCode;
}

function formatCell(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/**
 * Load a request body supplied via --data. Accepts inline JSON (`'{"k":1}'`),
 * a file reference (`@path/to/body.json`), or `@-` to read stdin. Returns an
 * object that command handlers merge with their convenience flags.
 */
export function loadDataOption(data?: string): Record<string, unknown> {
  if (!data) return {};
  let text = data.trim();
  if (text.startsWith('@')) {
    const ref = text.slice(1);
    text = ref === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(ref, 'utf8');
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    throw new CliError(`Invalid --data value: ${(e as Error).message}`, 2);
  }
}

/** Shallow-merge convenience-flag fields under an explicit --data body. */
export function mergeBody(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
