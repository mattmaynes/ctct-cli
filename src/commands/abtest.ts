// A/B test commands -> EmailCampaignsABTestsApi. Operates on a campaign
// activity id (the primary_email activity of a campaign).

import { Command } from 'commander';
import { EmailCampaignsABTestsApi } from 'ctct-api-client';
import { ctx } from '../lib/session';
import { loadDataOption, ok, printObject } from '../lib/output';
import { call, withDataOption } from './helpers';

export function registerAbtestCommands(program: Command): void {
  const abtest = program.command('abtest').description('Manage email A/B tests');

  abtest
    .command('get <activityId>')
    .description('Get the A/B test for a campaign activity')
    .action(async (activityId) => {
      printObject(await call(ctx().api(EmailCampaignsABTestsApi).getABTestEmailCampaign(activityId)));
    });

  const create = abtest
    .command('create <activityId>')
    .description('Create an A/B test for a campaign activity (provide the test body via --data)');
  withDataOption(create, 'A/B test').action(async (activityId, opts) => {
    printObject(
      await call(
        ctx()
          .api(EmailCampaignsABTestsApi)
          .createABTestEmailCampaign(activityId, loadDataOption(opts.data) as any),
      ),
    );
  });

  abtest
    .command('delete <activityId>')
    .description('Delete the A/B test for a campaign activity')
    .action(async (activityId) => {
      await call(ctx().api(EmailCampaignsABTestsApi).deleteABTestEmailCampaign(activityId));
      ok(`Deleted A/B test for activity ${activityId}`);
    });
}
