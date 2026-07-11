// Segment commands -> SegmentsApi. Note: segment ids are numbers in the SDK.

import { Command } from 'commander';
import { SegmentsApi } from 'ctct-api-client';
import { ctx } from '../lib/session';
import { loadDataOption, mergeBody, ok, printList, printObject } from '../lib/output';
import { call, defined, toInt, withDataOption } from './helpers';

export function registerSegmentCommands(program: Command): void {
  const segment = program.command('segment').description('Manage contact segments');

  segment
    .command('list')
    .description('List segments')
    .option('--limit <n>', 'page size')
    .option('--sort-by <field>', 'e.g. name, date')
    .action(async (opts) => {
      const res: any = await call(ctx().api(SegmentsApi).getAllSegments(opts.limit, opts.sortBy));
      printList(res.segments ?? [], [
        { header: 'SEGMENT_ID', value: (s: any) => s.segment_id },
        { header: 'NAME', value: (s: any) => s.name },
        { header: 'EDITED', value: (s: any) => s.edited_date },
      ]);
    });

  segment
    .command('get <segmentId>')
    .description('Get a segment')
    .action(async (segmentId) => {
      printObject(await call(ctx().api(SegmentsApi).getSegmentById(toInt(segmentId))));
    });

  const add = segment
    .command('add')
    .description('Create a segment')
    .option('--name <name>')
    .option('--criteria <json>', 'segment_criteria as a JSON string');
  withDataOption(add, 'segment').action(async (opts) => {
    const body = mergeBody(
      defined({ name: opts.name, segment_criteria: opts.criteria }),
      loadDataOption(opts.data),
    );
    printObject(await call(ctx().api(SegmentsApi).createSegment(body as any)));
  });

  const update = segment
    .command('update <segmentId>')
    .description('Update a segment (name + criteria)')
    .option('--name <name>')
    .option('--criteria <json>');
  withDataOption(update, 'segment').action(async (segmentId, opts) => {
    const body = mergeBody(
      defined({ name: opts.name, segment_criteria: opts.criteria }),
      loadDataOption(opts.data),
    );
    printObject(await call(ctx().api(SegmentsApi).updateSegment(toInt(segmentId), body as any)));
  });

  segment
    .command('rename <segmentId> <name>')
    .description('Rename a segment')
    .action(async (segmentId, name) => {
      printObject(
        await call(ctx().api(SegmentsApi).updateSegmentName(toInt(segmentId), { name } as any)),
      );
    });

  segment
    .command('delete <segmentId>')
    .description('Delete a segment')
    .action(async (segmentId) => {
      await call(ctx().api(SegmentsApi).deleteSegment(toInt(segmentId)));
      ok(`Deleted segment ${segmentId}`);
    });
}
