// Bulk activity commands -> BulkActivitiesApi. These asynchronous jobs take a
// request body; use --data to supply it. Poll status with `bulk get <id>`.

import { Command } from 'commander';
import { BulkActivitiesApi } from 'ctct-api-client';
import { ctx } from '../lib/session';
import { loadDataOption, printList, printObject } from '../lib/output';
import { call, toInt, withDataOption } from './helpers';

export function registerBulkCommands(program: Command): void {
  const bulk = program.command('bulk').description('Bulk import/export/update activities');

  bulk
    .command('list')
    .description('List bulk activities')
    .option('--limit <n>', 'page size', toInt)
    .option('--state <state>', 'processing | completed | failed | ...')
    .action(async (opts) => {
      const res: any = await call(ctx().api(BulkActivitiesApi).getAllActivities(opts.limit, opts.state));
      printList(res.activities ?? [], [
        { header: 'ACTIVITY_ID', value: (a: any) => a.activity_id },
        { header: 'TYPE', value: (a: any) => a.state ?? a.type },
        { header: 'STATUS', value: (a: any) => a.status },
        { header: 'CREATED', value: (a: any) => a.created_at },
      ]);
    });

  bulk
    .command('get <activityId>')
    .description('Get a bulk activity status/result')
    .action(async (activityId) => {
      printObject(await call(ctx().api(BulkActivitiesApi).getActivityById(activityId)));
    });

  // JSON-body job creators: subcommand name -> SDK method.
  const jobs: [string, string, (api: BulkActivitiesApi, body: any) => Promise<any>][] = [
    ['import', 'import contacts (JSON)', (api, b) => api.createImportJSONActivity(b)],
    ['export', 'export contacts', (api, b) => api.createExportActivity(b)],
    ['delete-contacts', 'delete contacts in bulk', (api, b) => api.createDeleteActivity(b)],
    ['list-add', 'add contacts to lists', (api, b) => api.createListAddActivity(b)],
    ['list-remove', 'remove contacts from lists', (api, b) => api.createListRemoveActivity(b)],
    ['list-delete', 'delete list memberships', (api, b) => api.createListDeleteActivity(b)],
    ['tag-add', 'add a tag to contacts', (api, b) => api.createTagAddContactActivity(b)],
    ['tag-remove', 'remove a tag from contacts', (api, b) => api.createTagRemoveActivity(b)],
    ['tag-delete', 'delete tags in bulk', (api, b) => api.createTagDeleteActivity(b)],
  ];
  for (const [name, desc, fn] of jobs) {
    const cmd = bulk.command(name).description(desc + ' (body via --data)');
    withDataOption(cmd, 'activity').action(async (opts) => {
      printObject(await call(fn(ctx().api(BulkActivitiesApi), loadDataOption(opts.data) as any)));
    });
  }
}
