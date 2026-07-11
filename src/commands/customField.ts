// Custom field commands -> ContactsCustomFieldsApi.

import { Command } from 'commander';
import { ContactsCustomFieldsApi } from 'ctct-api-client';
import { ctx } from '../lib/session';
import { loadDataOption, mergeBody, ok, printList, printObject } from '../lib/output';
import { call, defined, toInt, withDataOption } from './helpers';

export function registerCustomFieldCommands(program: Command): void {
  const cf = program.command('custom-field').description('Manage contact custom fields');

  cf
    .command('list')
    .description('List custom fields')
    .option('--limit <n>', 'page size', toInt)
    .action(async (opts) => {
      const res: any = await call(ctx().api(ContactsCustomFieldsApi).getAllCustomFields(opts.limit));
      printList(res.custom_fields ?? [], [
        { header: 'ID', value: (f: any) => f.custom_field_id },
        { header: 'LABEL', value: (f: any) => f.label },
        { header: 'NAME', value: (f: any) => f.name },
        { header: 'TYPE', value: (f: any) => f.type },
      ]);
    });

  cf
    .command('get <fieldId>')
    .description('Get a custom field')
    .action(async (fieldId) => {
      printObject(await call(ctx().api(ContactsCustomFieldsApi).getCustomField(fieldId)));
    });

  const add = cf
    .command('add')
    .description('Create a custom field')
    .option('--label <label>')
    .option('--type <type>', 'string | date');
  withDataOption(add, 'custom field').action(async (opts) => {
    const body = mergeBody(defined({ label: opts.label, type: opts.type }), loadDataOption(opts.data));
    printObject(await call(ctx().api(ContactsCustomFieldsApi).createCustomFields(body as any)));
  });

  const update = cf
    .command('update <fieldId>')
    .description('Update a custom field')
    .option('--label <label>')
    .option('--type <type>');
  withDataOption(update, 'custom field').action(async (fieldId, opts) => {
    const body = mergeBody(defined({ label: opts.label, type: opts.type }), loadDataOption(opts.data));
    printObject(await call(ctx().api(ContactsCustomFieldsApi).updateCustomField(fieldId, body as any)));
  });

  cf
    .command('delete <fieldId>')
    .description('Delete a custom field')
    .action(async (fieldId) => {
      await call(ctx().api(ContactsCustomFieldsApi).deleteCustomField(fieldId));
      ok(`Deleted custom field ${fieldId}`);
    });
}
