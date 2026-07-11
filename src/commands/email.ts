// Email campaign + scheduling commands -> EmailCampaignsApi, EmailSchedulingApi.
//
// Constant Contact models an email as a *campaign* that contains one or more
// *activities*; the editable/sendable email is the activity with role
// "primary_email". Scheduling/sending operate on the activity, so these
// commands accept a campaign id and resolve its primary activity automatically
// (or take an explicit --activity id).

import * as fs from 'fs';
import { Command } from 'commander';
import { EmailCampaignsApi, EmailSchedulingApi } from 'ctct-api-client';
import { ctx } from '../lib/session';
import { loadDataOption, mergeBody, ok, printList, printObject } from '../lib/output';
import { CliError, EXIT } from '../lib/errors';
import { call, defined, toInt, withDataOption } from './helpers';

async function primaryActivityId(campaignOrActivity: string, activityFlag?: string): Promise<string> {
  if (activityFlag) return activityFlag;
  const camp: any = await call(ctx().api(EmailCampaignsApi).getEmailCampaignById(campaignOrActivity));
  const primary = (camp.campaign_activities ?? []).find((a: any) => a.role === 'primary_email');
  if (!primary?.campaign_activity_id) {
    throw new CliError(
      `Could not find a primary_email activity for campaign ${campaignOrActivity}. Pass --activity <id>.`,
      EXIT.GENERIC,
    );
  }
  return primary.campaign_activity_id;
}

export function registerEmailCommands(program: Command): void {
  const email = program.command('email').description('Manage and send email campaigns');

  const create = email
    .command('create')
    .description('Create an email campaign (use --data for full activity content)')
    .option('--name <name>', 'campaign name (unique)')
    .option('--subject <subject>')
    .option('--from-name <name>')
    .option('--from-email <email>', 'must be a verified account email')
    .option('--reply-to <email>')
    .option('--preheader <text>')
    .option('--html <html>', 'HTML content')
    .option('--html-file <path>', 'read HTML content from a file')
    .option('--format-type <n>', 'format_type (default 5 = custom code)', toInt);
  withDataOption(create, 'campaign').action(async (opts) => {
    const data = loadDataOption(opts.data);
    let body: Record<string, unknown>;
    if (data.email_campaign_activities) {
      body = mergeBody(defined({ name: opts.name }), data);
    } else {
      const html = opts.htmlFile ? fs.readFileSync(opts.htmlFile, 'utf8') : opts.html;
      const activity = defined({
        format_type: opts.formatType ?? 5,
        from_name: opts.fromName,
        from_email: opts.fromEmail,
        reply_to_email: opts.replyTo,
        subject: opts.subject,
        preheader: opts.preheader,
        html_content: html,
      });
      body = mergeBody(defined({ name: opts.name, email_campaign_activities: [activity] }), data);
    }
    const res = await call(ctx().api(EmailCampaignsApi).createEmailCampaign(body as any));
    printObject(res, ['campaign_id', 'name', 'current_status', 'type']);
  });

  email
    .command('list')
    .description('List email campaigns')
    .option('--limit <n>', 'page size', toInt)
    .option('--before <iso>', 'before_date filter')
    .option('--after <iso>', 'after_date filter')
    .action(async (opts) => {
      const res: any = await call(
        ctx().api(EmailCampaignsApi).getAllEmailCampaigns(opts.limit, opts.before, opts.after),
      );
      printList(res.campaigns ?? [], [
        { header: 'CAMPAIGN_ID', value: (c: any) => c.campaign_id },
        { header: 'NAME', value: (c: any) => c.name },
        { header: 'STATUS', value: (c: any) => c.current_status },
        { header: 'UPDATED', value: (c: any) => c.updated_at },
      ]);
    });

  email
    .command('get <campaignId>')
    .description('Get an email campaign (includes its activities)')
    .action(async (campaignId) => {
      const res = await call(ctx().api(EmailCampaignsApi).getEmailCampaignById(campaignId));
      printObject(res);
    });

  email
    .command('rename <campaignId> <name>')
    .description('Rename an email campaign')
    .action(async (campaignId, name) => {
      const res = await call(
        ctx().api(EmailCampaignsApi).patchEmailCampaignName(campaignId, { name } as any),
      );
      printObject(res);
    });

  const updateActivity = email
    .command('update-activity <activityId>')
    .description('Update an email campaign activity (send the full activity resource via --data)');
  withDataOption(updateActivity, 'activity').action(async (activityId, opts) => {
    const body = loadDataOption(opts.data);
    const res = await call(
      ctx().api(EmailCampaignsApi).updateEmailCampaignActivity(activityId, body as any),
    );
    printObject(res);
  });

  email
    .command('delete <campaignId>')
    .description('Delete an email campaign')
    .action(async (campaignId) => {
      await call(ctx().api(EmailCampaignsApi).deleteEmailCampaign(campaignId));
      ok(`Deleted campaign ${campaignId}`);
    });

  email
    .command('schedule <campaignId>')
    .description('Schedule a campaign to send at a specific time')
    .requiredOption('--at <iso>', 'ISO 8601 datetime to send (e.g. 2026-08-01T15:00:00Z)')
    .option('--activity <id>', 'target a specific activity id instead of resolving primary')
    .action(async (campaignId, opts) => {
      const activityId = await primaryActivityId(campaignId, opts.activity);
      const res = await call(
        ctx()
          .api(EmailSchedulingApi)
          .scheduleEmailCampaignActivity(activityId, { scheduled_date: opts.at } as any),
      );
      ok(`Scheduled campaign ${campaignId} for ${opts.at}`, res);
    });

  email
    .command('send <campaignId>')
    .description('Send a campaign immediately')
    .option('--activity <id>', 'target a specific activity id instead of resolving primary')
    .action(async (campaignId, opts) => {
      const activityId = await primaryActivityId(campaignId, opts.activity);
      // scheduled_date "0" means "send now" in the v3 API.
      const res = await call(
        ctx()
          .api(EmailSchedulingApi)
          .scheduleEmailCampaignActivity(activityId, { scheduled_date: '0' } as any),
      );
      ok(`Sending campaign ${campaignId} now`, res);
    });

  email
    .command('unschedule <campaignId>')
    .description('Cancel a scheduled send')
    .option('--activity <id>')
    .action(async (campaignId, opts) => {
      const activityId = await primaryActivityId(campaignId, opts.activity);
      await call(ctx().api(EmailSchedulingApi).unscheduleEmailCampaignActivity(activityId));
      ok(`Unscheduled campaign ${campaignId}`);
    });

  email
    .command('test-send <campaignId>')
    .description('Send a test email to specific addresses')
    .requiredOption('--to <emails>', 'comma-separated email addresses')
    .option('--message <text>', 'personal message to include')
    .option('--activity <id>')
    .action(async (campaignId, opts) => {
      const activityId = await primaryActivityId(campaignId, opts.activity);
      const emails = String(opts.to)
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      await call(
        ctx()
          .api(EmailSchedulingApi)
          .testSendEmailCampaignActivity(activityId, {
            email_addresses: emails,
            personal_message: opts.message,
          } as any),
      );
      ok(`Test email sent to ${emails.join(', ')}`);
    });

  email
    .command('preview <campaignId>')
    .description('Get the HTML/subject preview of a campaign activity')
    .option('--activity <id>')
    .action(async (campaignId, opts) => {
      const activityId = await primaryActivityId(campaignId, opts.activity);
      const res = await call(ctx().api(EmailSchedulingApi).getEmailCampaignActivityPreview(activityId));
      printObject(res);
    });

  email
    .command('schedule-info <campaignId>')
    .description('Show the current schedule for a campaign activity')
    .option('--activity <id>')
    .action(async (campaignId, opts) => {
      const activityId = await primaryActivityId(campaignId, opts.activity);
      const res = await call(ctx().api(EmailSchedulingApi).getEmailCampaignActivitySchedule(activityId));
      printObject(res);
    });
}
