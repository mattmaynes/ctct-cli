// Reporting commands -> EmailReportingApi and ContactsReportingApi.

import { Command } from 'commander';
import { ContactsReportingApi, EmailReportingApi } from 'ctct-api-client';
import { ctx } from '../lib/session';
import { printObject } from '../lib/output';
import { call } from './helpers';

export function registerReportCommands(program: Command): void {
  const report = program.command('report').description('Email and contact reporting');

  report
    .command('campaigns')
    .description('Email campaign summary report')
    .option('--limit <n>', 'page size')
    .action(async (opts) => {
      printObject(await call(ctx().api(EmailReportingApi).getEmailCampaignReport(opts.limit)));
    });

  report
    .command('stats <campaignIds>')
    .description('Aggregate stats for one or more campaign ids (comma-separated)')
    .action(async (campaignIds) => {
      printObject(await call(ctx().api(EmailReportingApi).getEmailStatsReport(campaignIds)));
    });

  report
    .command('activity <activityIds>')
    .description('Per-activity report for campaign activity ids (comma-separated)')
    .action(async (activityIds) => {
      printObject(await call(ctx().api(EmailReportingApi).getEmailCampaignActivityReport(activityIds)));
    });

  const perActivity: [string, (api: EmailReportingApi, id: string, limit?: string) => Promise<any>][] = [
    ['opens', (api, id, limit) => api.getEmailOpensReport(id, limit)],
    ['sends', (api, id, limit) => api.getEmailSendsReport(id, limit)],
    ['clicks', (api, id, limit) => api.getClicksReport(id, undefined, limit)],
    ['bounces', (api, id, limit) => api.getBouncesReport(id, undefined, limit)],
    ['optouts', (api, id, limit) => api.getOptoutsReport(id, limit)],
    ['did-not-open', (api, id, limit) => api.getDidNotOpensReport(id, limit)],
  ];
  for (const [name, fn] of perActivity) {
    report
      .command(`${name} <activityId>`)
      .description(`Email ${name} report for a campaign activity`)
      .option('--limit <n>', 'page size')
      .action(async (activityId, opts) => {
        printObject(await call(fn(ctx().api(EmailReportingApi), activityId, opts.limit)));
      });
  }

  report
    .command('contact-rate <contactId>')
    .description('Open/click rate report for a contact')
    .requiredOption('--start <iso>', 'start date')
    .requiredOption('--end <iso>', 'end date')
    .action(async (contactId, opts) => {
      printObject(
        await call(ctx().api(ContactsReportingApi).getContactOpenClickRateReport(contactId, opts.start, opts.end)),
      );
    });
}
