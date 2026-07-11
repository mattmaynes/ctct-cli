// Contact commands -> ContactsApi.

import { Command } from 'commander';
import { ContactsApi } from 'ctct-api-client';
import { ctx } from '../lib/session';
import { loadDataOption, mergeBody, ok, printList, printObject } from '../lib/output';
import { call, defined, toInt, withDataOption } from './helpers';

// Repeatable option collector for commander (e.g. --list a --list b).
const collect = (value: string, prev: string[] = []) => prev.concat(value);

const emailOf = (c: any): string => c?.email_address?.address ?? '';

export function registerContactCommands(program: Command): void {
  const contact = program.command('contact').description('Manage contacts');

  const add = contact
    .command('add')
    .description('Create a contact')
    .option('--email <address>', 'email address')
    .option('--permission <p>', 'permission_to_send (e.g. implicit, explicit)', 'implicit')
    .option('--first-name <name>')
    .option('--last-name <name>')
    .option('--company <name>')
    .option('--job-title <title>')
    .option('--phone <number>')
    .option('--list <id>', 'list membership id (repeatable)', collect)
    .option('--tag <id>', 'tag id (repeatable)', collect)
    .option('--source <source>', 'create_source: Account | Contact', 'Account');
  withDataOption(add, 'contact').action(async (opts) => {
    const flags = defined({
      email_address: opts.email
        ? { address: opts.email, permission_to_send: opts.permission }
        : undefined,
      first_name: opts.firstName,
      last_name: opts.lastName,
      company_name: opts.company,
      job_title: opts.jobTitle,
      phone_numbers: opts.phone ? [{ phone_number: opts.phone, kind: 'home' }] : undefined,
      list_memberships: opts.list,
      taggings: opts.tag,
      create_source: opts.source,
    });
    const body = mergeBody(flags, loadDataOption(opts.data));
    const res = await call(ctx().api(ContactsApi).createContact(body as any));
    printObject(res, ['contact_id', 'email_address', 'first_name', 'last_name', 'create_source']);
  });

  const upsert = contact
    .command('upsert')
    .description('Create or update a contact (matched by email)')
    .option('--email <address>')
    .option('--first-name <name>')
    .option('--last-name <name>')
    .option('--list <id>', 'list membership id (repeatable)', collect);
  withDataOption(upsert, 'contact').action(async (opts) => {
    const flags = defined({
      email_address: opts.email ? { address: opts.email } : undefined,
      first_name: opts.firstName,
      last_name: opts.lastName,
      list_memberships: opts.list,
    });
    const body = mergeBody(flags, loadDataOption(opts.data));
    const res = await call(ctx().api(ContactsApi).createOrUpdateContact(body as any));
    printObject(res);
  });

  contact
    .command('list')
    .description('List contacts')
    .option('--email <address>', 'filter by email')
    .option('--lists <ids>', 'comma-separated list ids')
    .option('--status <status>', 'all | active | unsubscribed | removed ...')
    .option('--tags <ids>', 'comma-separated tag ids')
    .option('--updated-after <iso>')
    .option('--limit <n>', 'page size (max 500)', toInt)
    .action(async (opts) => {
      const res: any = await call(
        ctx()
          .api(ContactsApi)
          .getAllContacts(
            opts.status,
            opts.email,
            opts.lists,
            undefined,
            opts.tags,
            opts.updatedAfter,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            opts.limit,
          ),
      );
      printList(res.contacts ?? [], [
        { header: 'CONTACT_ID', value: (c: any) => c.contact_id },
        { header: 'EMAIL', value: emailOf },
        { header: 'NAME', value: (c: any) => [c.first_name, c.last_name].filter(Boolean).join(' ') },
        { header: 'UPDATED', value: (c: any) => c.updated_at },
      ]);
    });

  contact
    .command('get <contactId>')
    .description('Get a contact by id')
    .option('--include <fields>', 'comma-separated: list_memberships,taggings,custom_fields,...')
    .action(async (contactId, opts) => {
      const res = await call(ctx().api(ContactsApi).getContactById(contactId, opts.include));
      printObject(res);
    });

  const update = contact
    .command('update <contactId>')
    .description('Update a contact (send the full updated resource)')
    .option('--first-name <name>')
    .option('--last-name <name>')
    .option('--email <address>');
  withDataOption(update, 'contact').action(async (contactId, opts) => {
    const flags = defined({
      first_name: opts.firstName,
      last_name: opts.lastName,
      email_address: opts.email ? { address: opts.email } : undefined,
    });
    const body = mergeBody(flags, loadDataOption(opts.data));
    const res = await call(ctx().api(ContactsApi).updateContact(contactId, body as any));
    printObject(res);
  });

  contact
    .command('delete <contactId>')
    .description('Delete a contact')
    .action(async (contactId) => {
      await call(ctx().api(ContactsApi).deleteContact(contactId));
      ok(`Deleted contact ${contactId}`);
    });

  contact
    .command('counts')
    .description('Get contact counts')
    .option('--include <opts>', 'e.g. active_count,all_count')
    .action(async (opts) => {
      const res = await call(ctx().api(ContactsApi).getContactCounts(opts.include));
      printObject(res);
    });
}
