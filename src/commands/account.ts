// Account commands -> AccountServicesApi.

import { Command } from 'commander';
import { AccountServicesApi } from 'ctct-api-client';
import { ctx } from '../lib/session';
import { loadDataOption, printList, printObject } from '../lib/output';
import { call, withDataOption } from './helpers';

export function registerAccountCommands(program: Command): void {
  const account = program.command('account').description('Account information and settings');

  account
    .command('show')
    .description('Show account details')
    .option('--extra <fields>', 'extra fields, e.g. physical_address,company_logo')
    .action(async (opts) => {
      const res = await call(ctx().api(AccountServicesApi).getAccountDetails(opts.extra));
      printObject(res);
    });

  const update = account.command('update').description('Update account details');
  withDataOption(update, 'account').action(async (opts) => {
    const res = await call(ctx().api(AccountServicesApi).updateAccount(loadDataOption(opts.data) as any));
    printObject(res);
  });

  account
    .command('privileges')
    .description('Show the authenticated user\'s privileges')
    .action(async () => {
      printObject(await call(ctx().api(AccountServicesApi).getUserPrivileges()));
    });

  account
    .command('emails')
    .description('List account email addresses')
    .option('--status <status>', 'CONFIRMED | UNCONFIRMED')
    .action(async (opts) => {
      const res: any = await call(
        ctx().api(AccountServicesApi).getAllAccountEmailAddresses(opts.status),
      );
      const rows = Array.isArray(res) ? res : res.account_emails ?? [];
      printList(rows, [
        { header: 'EMAIL', value: (e: any) => e.email_address },
        { header: 'STATUS', value: (e: any) => e.confirm_status },
        { header: 'ROLES', value: (e: any) => (e.roles ?? []).join(',') },
      ]);
    });

  account
    .command('address')
    .description('Show the account physical address')
    .action(async () => {
      printObject(await call(ctx().api(AccountServicesApi).getAccountPhysicalAddress()));
    });
}
