// Tag commands -> ContactTagsApi.

import { Command } from 'commander';
import { ContactTagsApi } from 'ctct-api-client';
import { ctx } from '../lib/session';
import { loadDataOption, mergeBody, ok, printList, printObject } from '../lib/output';
import { call, defined, toInt, withDataOption } from './helpers';

export function registerTagCommands(program: Command): void {
  const tag = program.command('tag').description('Manage contact tags');

  tag
    .command('list')
    .description('List tags')
    .option('--limit <n>', 'page size', toInt)
    .action(async (opts) => {
      const res: any = await call(ctx().api(ContactTagsApi).getAllTags(opts.limit));
      printList(res.tags ?? [], [
        { header: 'TAG_ID', value: (t: any) => t.tag_id },
        { header: 'NAME', value: (t: any) => t.name },
        { header: 'CONTACTS', value: (t: any) => t.contacts_count },
      ]);
    });

  tag
    .command('get <tagId>')
    .description('Get a tag')
    .action(async (tagId) => {
      printObject(await call(ctx().api(ContactTagsApi).getTag(tagId)));
    });

  const add = tag
    .command('add')
    .description('Create a tag')
    .option('--name <name>')
    .option('--source <source>', 'tag_source, e.g. Contacts');
  withDataOption(add, 'tag').action(async (opts) => {
    const body = mergeBody(defined({ name: opts.name, tag_source: opts.source }), loadDataOption(opts.data));
    printObject(await call(ctx().api(ContactTagsApi).postTag(body as any)));
  });

  const update = tag
    .command('update <tagId>')
    .description('Rename a tag')
    .option('--name <name>');
  withDataOption(update, 'tag').action(async (tagId, opts) => {
    const body = mergeBody(defined({ name: opts.name }), loadDataOption(opts.data));
    printObject(await call(ctx().api(ContactTagsApi).putTag(tagId, body as any)));
  });

  tag
    .command('delete <tagId>')
    .description('Delete a tag')
    .action(async (tagId) => {
      await call(ctx().api(ContactTagsApi).deleteTag(tagId));
      ok(`Deleted tag ${tagId}`);
    });
}
