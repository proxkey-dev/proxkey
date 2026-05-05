import type { Env } from "@proxkey/config/env";
import type { PrismaClient } from "@proxkey/db";
import type { DigestJobPayload } from "@proxkey/types";
import { Resend } from "resend";

export async function processDigest(
  prisma: PrismaClient,
  env: Env,
  job: DigestJobPayload,
): Promise<void> {
  const org = await prisma.org.findFirst({
    where: { id: job.orgId, deletedAt: null },
  });
  if (!org || !org.digestEnabled) {
    return;
  }

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 86_400_000);

  const agg = await prisma.build.aggregate({
    where: {
      startedAt: { gte: start, lte: end },
      repo: { orgId: org.id, deletedAt: null },
    },
    _sum: { costCents: true },
    _count: true,
  });

  const totalCents = agg._sum.costCents ?? 0;
  const buildCount = agg._count;

  if (job.channel === "slack") {
    if (!org.slackWebhookUrl) {
      return;
    }
    const res = await fetch(org.slackWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `ProxKey digest — *${org.name}* (UTC, last 7d): ${String(buildCount)} builds, ${String(totalCents)} cents attributed.`,
      }),
    });
    if (!res.ok) {
      throw new Error(`slack_webhook_failed:${String(res.status)}`);
    }
    await prisma.digestLog.create({
      data: {
        orgId: org.id,
        channel: "slack",
        payload: { buildCount, totalCents, periodDays: 7 },
      },
    });
    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const from = "ProxKey <onboarding@resend.dev>";
  const { error } = await resend.emails.send({
    from,
    to: job.to,
    subject: `ProxKey digest — ${org.name}`,
    text: `Last 7 days (UTC): ${String(buildCount)} builds, ${String(totalCents)} cents in attributed metered estimates.`,
  });
  if (error) {
    throw new Error(error.message);
  }

  await prisma.digestLog.create({
    data: {
      orgId: org.id,
      channel: "email",
      payload: { to: job.to, buildCount, totalCents },
    },
  });
}
