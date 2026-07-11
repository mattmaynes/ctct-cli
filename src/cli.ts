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

const VERSION = '1.0.0';

function buildProgram(): Command {
  const program = new Command();
  program
    .name('ctct')
    .description('Command-line interface for the Constant Contact v3 API (for humans and AI agents).')
    .version(VERSION, '-v, --version')
    .option('--json', 'output JSON (also automatic when piped)')
    .option('--config <dir>', 'use a specific config directory')
    .enablePositionalOptions();

  // Apply global options before any subcommand runs.
  program.hook('preAction', () => {
    const opts = program.opts();
    configureOutput({ json: !!opts.json });
    setSessionOptions({ configDir: opts.config });
  });

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

async function main(): Promise<void> {
  const program = buildProgram();
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    // configureOutput may not have run if parsing failed early; default is fine.
    process.exitCode = renderError(normalizeError(err));
  }
}

void main();
