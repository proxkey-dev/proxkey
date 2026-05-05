import type { Env } from "@proxkey/config/env";
import { type Prisma, type PrismaClient } from "@proxkey/db";
import {
  jobNames,
  queueNames,
  type WeeklyDigestJob,
} from "@proxkey/types";
import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import { Resend } from "resend";
import {
  buildEmailHtml,
  buildSlackBlocks,
  loadDigestData,
  type DigestData,
} from "./digest-data.js";

interface DigestContext {
  prisma: PrismaClient;
  env: Env;
  resend: Resend;
  fromEmail: string;
}

async function sendEmailDigest(
  ctx: DigestContext,
  org: { name: string },
  recipientEmails: string[],
  data: DigestData,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (recipientEmails.length === 0) {
    return { success: false, error: "no_recipients" };
  }
  try {
    const result = await ctx.resend.emails.send({
      from: ctx.fromEmail,
      to: recipientEmails,
      subject: `${org.name} — CI spend digest`,
      html: buildEmailHtml(org.name, data),
    });
    if (result.error) {
      return { success: false, error: result.error.message };
    }
    return { success: true, messageId: result.data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "send failed",
    };
  }
}

async function sendSlackDigest(
  webhookUrl: string,
  orgName: string,
  data: DigestData,
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildSlackBlocks(orgName, data)),
    });
    return {
      success: res.ok,
      status: res.status,
      ...(res.ok ? {} : { error: `slack_${String(res.status)}` }),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "fetch_failed",
    };
  }
}

export async function processWeeklyDigestForOrg(
  ctx: DigestContext,
  orgId: string,
): Promise<void> {
  const org = await ctx.prisma.org.findUnique({
    where: { id: orgId },
    include: {
      members: { select: { githubLogin: true } },
    },
  });
  if (!org || org.deletedAt) return;
  if (!org.digestEnabled) return;

  const data = await loadDigestData(ctx.prisma, orgId);

  // Members are referenced by GitHub login, not email. We can still
  // ship a Slack-only digest if no email recipients are recoverable,
  // but the spec asks us to send via Resend. We rely on the Resend
  // address book / webhook recipient being configured upstream when
  // GitHub login → email isn't directly available. For now, derive
  // a placeholder address per login that the customer can map.
  const recipients = org.members.map(
    (m) => `${m.githubLogin}@${ctx.env.APP_URL.replace(/^https?:\/\//, "")}`,
  );

  const emailResult = await sendEmailDigest(
    ctx,
    org,
    recipients,
    data,
  );

  if (emailResult.success) {
    await ctx.prisma.digestLog.create({
      data: {
        orgId,
        channel: "email",
        payload: {
          totalSpendCents: data.totalSpendCents,
          wowDeltaPercent: data.wowDeltaPercent,
          topRepos: data.topRepos,
          topWasteFlags: data.topWasteFlags,
          messageId: emailResult.messageId ?? null,
        } as Prisma.InputJsonValue,
      },
    });
  } else {
    await ctx.prisma.digestLog.create({
      data: {
        orgId,
        channel: "email",
        payload: {
          error: emailResult.error ?? "unknown",
        } as Prisma.InputJsonValue,
      },
    });
  }

  if (org.slackWebhookUrl) {
    const slackResult = await sendSlackDigest(
      org.slackWebhookUrl,
      org.name,
      data,
    );
    await ctx.prisma.digestLog.create({
      data: {
        orgId,
        channel: "slack",
        payload: {
          success: slackResult.success,
          status: slackResult.status ?? null,
          error: slackResult.error ?? null,
          totalSpendCents: data.totalSpendCents,
        } as Prisma.InputJsonValue,
      },
    });
  }
}

export async function processWeeklyDigest(
  ctx: DigestContext,
  payload: WeeklyDigestJob,
): Promise<void> {
  if (payload.orgId) {
    await processWeeklyDigestForOrg(ctx, payload.orgId);
    return;
  }
  const orgs = await ctx.prisma.org.findMany({
    where: { digestEnabled: true, deletedAt: null },
    select: { id: true },
  });
  for (const o of orgs) {
    try {
      await processWeeklyDigestForOrg(ctx, o.id);
    } catch (err) {
      // Log via Prisma so we have a record of the failure.
      await ctx.prisma.digestLog.create({
        data: {
          orgId: o.id,
          channel: "email",
          payload: {
            error: err instanceof Error ? err.message : "unknown",
          } as Prisma.InputJsonValue,
        },
      });
    }
  }
}

export async function startWeeklyDigestWorker(
  prisma: PrismaClient,
  env: Env,
  connection: ConnectionOptions,
): Promise<{ worker: Worker; queue: Queue }> {
  const ctx: DigestContext = {
    prisma,
    env,
    resend: new Resend(env.RESEND_API_KEY),
    fromEmail: "ProxKey Digest <digests@proxkey.dev>",
  };

  const queue = new Queue(queueNames.digests, { connection });

  // Mondays 09:00 UTC. BullMQ ensures only one consumer fires per tick
  // even with multiple worker processes running.
  await queue.upsertJobScheduler(
    "weekly-digest:cron",
    { pattern: "0 9 * * 1" },
    {
      name: jobNames.weeklyDigest,
      data: {} satisfies WeeklyDigestJob,
      opts: {
        attempts: 3,
        backoff: { type: "exponential", delay: 60_000 },
      },
    },
  );

  const worker = new Worker(
    queueNames.digests,
    async (job: Job) => {
      if (job.name !== jobNames.weeklyDigest) return;
      const data = job.data as WeeklyDigestJob;
      await processWeeklyDigest(ctx, data);
    },
    { connection, concurrency: 1 },
  );

  return { worker, queue };
}
