// Authentication & configuration commands: init, login, logout, status, scopes.

import { Command } from 'commander';
import {
  readConfig,
  StorageBackend,
  targetConfigDir,
  writeConfig,
} from '../lib/config';
import { resolveScopes, SCOPES } from '../lib/oauth';
import { startDeviceAuthorization, pollForToken } from '../lib/deviceFlow';
import { AuthError, CliError, EXIT } from '../lib/errors';
import { bold, dim, info, ok, printList, printObject } from '../lib/output';
import { openBrowser } from '../lib/browser';
import { canPrompt, prompt } from '../lib/prompt';
import { ctx, sessionConfigDir } from '../lib/session';

export function registerAuthCommands(program: Command): void {
  program
    .command('init')
    .description('Save the OAuth client_id (and storage preferences) to the config file')
    .option('--client-id <id>', 'Constant Contact app client_id (public identifier)')
    .option('--local', 'write config to ./.ctct instead of ~/.ctct', false)
    .option('--storage <backend>', 'token storage backend: keychain | file')
    .option('--scopes <list>', 'default scopes for `ctct login` (comma-separated, or "all")')
    .option('--from-name <name>', 'default sender name for `email create`')
    .option('--from-email <email>', 'default sender email (must be a verified sender)')
    .option('--reply-to <email>', 'default reply-to email (defaults to from-email)')
    .action(async (opts) => {
      const dir = targetConfigDir(!!opts.local, sessionConfigDir());
      const existing = readConfig(dir);

      let clientId: string | undefined = opts.clientId || process.env.CTCT_CLIENT_ID || existing.client_id;
      if (!clientId && canPrompt()) {
        clientId = (await prompt('Constant Contact client_id: ')).trim() || undefined;
      }
      if (!clientId) {
        throw new CliError(
          'A client_id is required. Pass --client-id <id> or set CTCT_CLIENT_ID.',
          EXIT.USAGE,
        );
      }

      let storage: StorageBackend | undefined = existing.storage;
      if (opts.storage) {
        if (opts.storage !== 'keychain' && opts.storage !== 'file') {
          throw new CliError('--storage must be "keychain" or "file".', EXIT.USAGE);
        }
        storage = opts.storage;
      }

      const default_scopes = opts.scopes ? resolveScopes(opts.scopes) : existing.default_scopes;

      writeConfig(dir, {
        ...existing,
        client_id: clientId,
        storage,
        default_scopes,
        from_name: opts.fromName ?? existing.from_name,
        from_email: opts.fromEmail ?? existing.from_email,
        reply_to: opts.replyTo ?? existing.reply_to,
      });
      ok(`Saved configuration to ${dir}`, {
        ok: true,
        config_dir: dir,
        client_id: clientId,
        storage: storage ?? 'auto',
        from_email: opts.fromEmail ?? existing.from_email ?? null,
      });
    });

  program
    .command('login')
    .description('Authenticate via OAuth2 device flow and store a long-lived token')
    .option('--scopes <list>', 'scopes to request (comma-separated, or "all"). Default: all')
    .option('--no-open', 'do not automatically open the browser')
    .action(async (opts) => {
      const c = ctx();
      if (!c.clientId) {
        throw new AuthError('No client_id configured. Run `ctct init --client-id <id>` first.');
      }
      const scope = resolveScopes(opts.scopes || c.config.default_scopes);

      const auth = await startDeviceAuthorization(c.clientId, scope);
      const verifyUrl = auth.verification_uri_complete || auth.verification_uri;

      info(bold('\nTo authorize this CLI:'));
      info(`  1. Open: ${bold(auth.verification_uri)}`);
      info(`  2. Enter code: ${bold(auth.user_code)}`);
      info(dim(`  (requesting scopes: ${scope})\n`));

      if (opts.open !== false && process.stdout.isTTY) {
        openBrowser(verifyUrl);
        info(dim('Opening your browser…'));
      }
      info(dim('Waiting for authorization…'));

      const tokens = await pollForToken(c.clientId, auth);
      c.tokens.save(tokens);

      ok('Logged in.', {
        ok: true,
        scopes: tokens.scope,
        expires_at: new Date(tokens.expires_at).toISOString(),
        storage: c.store.backend,
      });
    });

  program
    .command('logout')
    .description('Delete the stored token')
    .action(async () => {
      ctx().tokens.logout();
      ok('Logged out.');
    });

  program
    .command('status')
    .description('Show configuration and authentication status')
    .action(async () => {
      const c = ctx();
      const t = c.tokens.tokens;
      const status = {
        config_dir: c.configDir,
        client_id: c.clientId ?? null,
        storage_backend: c.store.backend,
        storage_location: c.store.location,
        authenticated: !!t,
        expires_at: t ? new Date(t.expires_at).toISOString() : null,
        expired: t ? c.tokens.isExpired(t, 0) : null,
        scopes: t?.scope ?? null,
      };
      printObject(status);
    });

  program
    .command('scopes')
    .description('List available OAuth scopes')
    .action(async () => {
      printList(SCOPES, [
        { header: 'SCOPE', value: (s) => s.name },
        { header: 'DESCRIPTION', value: (s) => s.description },
      ]);
    });
}
