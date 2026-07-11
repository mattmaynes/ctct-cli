// Contact-list commands -> ContactListsApi.

import { Command } from 'commander';
import { ContactListsApi } from 'ctct-api-client';
import { ctx } from '../lib/session';
import { loadDataOption, mergeBody, ok, printList, printObject } from '../lib/output';
import { call, defined, toInt, withDataOption } from './helpers';

export function registerListCommands(program: Command): void {
  const list = program.command('list').description('Manage contact lists');

  list
    .command('list')
    .description('List all contact lists')
    .option('--name <name>', 'filter by name')
    .option('--status <status>', 'active | deleted | all')
    .option('--limit <n>', 'page size', toInt)
    .option('--counts', 'include membership counts', false)
    .action(async (opts) => {
      const res: any = await call(
        ctx()
          .api(ContactListsApi)
          .getAllLists(opts.limit, undefined, opts.counts ? ('all' as any) : undefined, opts.name, opts.status),
      );
      printList(res.lists ?? [], [
        { header: 'LIST_ID', value: (l: any) => l.list_id },
        { header: 'NAME', value: (l: any) => l.name },
        { header: 'MEMBERS', value: (l: any) => l.membership_count },
        { header: 'FAVORITE', value: (l: any) => l.favorite },
      ]);
    });

  const add = list
    .command('add')
    .description('Create a contact list')
    .option('--name <name>', 'list name')
    .option('--description <text>')
    .option('--favorite', 'mark as favorite', false);
  withDataOption(add, 'list').action(async (opts) => {
    const flags = defined({
      name: opts.name,
      description: opts.description,
      favorite: opts.favorite || undefined,
    });
    const body = mergeBody(flags, loadDataOption(opts.data));
    const res = await call(ctx().api(ContactListsApi).createList(body as any));
    printObject(res, ['list_id', 'name', 'description', 'favorite']);
  });

  list
    .command('get <listId>')
    .description('Get a contact list')
    .option('--counts', 'include membership count', false)
    .action(async (listId, opts) => {
      const res = await call(
        ctx().api(ContactListsApi).getList(listId, opts.counts ? ('all' as any) : undefined),
      );
      printObject(res);
    });

  const update = list
    .command('update <listId>')
    .description('Update a contact list')
    .option('--name <name>')
    .option('--description <text>')
    .option('--favorite <bool>');
  withDataOption(update, 'list').action(async (listId, opts) => {
    const flags = defined({
      name: opts.name,
      description: opts.description,
      favorite: opts.favorite === undefined ? undefined : opts.favorite === 'true',
    });
    const body = mergeBody(flags, loadDataOption(opts.data));
    const res = await call(ctx().api(ContactListsApi).updateList(listId, body as any));
    printObject(res);
  });

  list
    .command('delete <listId>')
    .description('Delete a contact list')
    .action(async (listId) => {
      await call(ctx().api(ContactListsApi).deleteList(listId));
      ok(`Deleted list ${listId}`);
    });
}
