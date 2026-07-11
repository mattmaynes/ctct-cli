#!/usr/bin/env node
// Entry point: builds the commander program, wires global options and a single
// error boundary, and registers every command group.

import { Command } from 'commander';
import { configureOutput, renderError } from './lib/output';
import { normalizeError } from './lib/errors';
import { setSessionOptions } from './lib/session';

import { registerAuthCommands } from './commands/auth';
import { registerAccountCommands } from './commands/account';
import { registerContactCommands } from './commands/contact';
import { registerListCommands } from './commands/list';
import { registerTagCommands } from './commands/tag';
import { registerCustomFieldCommands } from './commands/customField';
import { registerSegmentCommands } from './commands/segment';
import { registerEmailCommands } from './commands/email';
import { registerAbtestCommands } from './commands/abtest';
import { registerReportCommands } from './commands/report';
import { registerBulkCommands } from './commands/bulk';

const VERSION = '1.0.1';

function buildProgram(): Command {
  const program = new Command();
  program
    .name('ctct')
    .description('Command-line interface for the Constant Contact v3 API (for humans and AI agents).')
    .version(VERSION, '-v, --version')
    .option('--json', 'output JSON (also automatic when piped)')
    .option('--config <dir>', 'use a specific config directory');

  registerAuthCommands(program);
  registerAccountCommands(program);
  registerContactCommands(program);
  registerListCommands(program);
  registerTagCommands(program);
  registerCustomFieldCommands(program);
  registerSegmentCommands(program);
  registerEmailCommands(program);
  registerAbtestCommands(program);
  registerReportCommands(program);
  registerBulkCommands(program);

  program.showHelpAfterError('(add --help for usage)');
  return program;
}

/**
 * Pull the global `--json` / `--config <dir>` flags out of argv from ANY
 * position (before or after the subcommand) and return the remaining args.
 * This lets agents write `ctct account show --json` naturally instead of being
 * forced to put global flags before the subcommand.
 */
function extractGlobalFlags(args: string[]): { rest: string[]; json: boolean; configDir?: string } {
  const rest: string[] = [];
  let json = false;
  let configDir: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') json = true;
    else if (a === '--config') configDir = args[++i];
    else if (a.startsWith('--config=')) configDir = a.slice('--config='.length);
    else rest.push(a);
  }
  return { rest, json, configDir };
}

async function main(): Promise<void> {
  const [node, script, ...argv] = process.argv;
  const { rest, json, configDir } = extractGlobalFlags(argv);
  configureOutput({ json });
  setSessionOptions({ configDir });

  const program = buildProgram();
  try {
    await program.parseAsync([node, script, ...rest]);
  } catch (err) {
    process.exitCode = renderError(normalizeError(err));
  }
}

void main();
