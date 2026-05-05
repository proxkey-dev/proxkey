import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authedOrg } from "./_helpers.js";

const patchBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  monthlyBudgetCents: z.number().int().min(0).nullable().optional(),
  slackWebhookUrl: z.string().url().nullable().optional(),
  digestEnabled: z.boolean().optional(),
  digestCronTimezone: z.string().min(1).max(64).optional(),
});

export async function registerOrgCoreRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/api/orgs/:orgId", async (request) => {
    const { orgId } = await authedOrg(app, request);
    return await app.prisma.org.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        plan: true,
        githubLogin: true,
        githubInstallationId: true,
        monthlyBudgetCents: true,
        slackWebhookUrl: true,
        digestEnabled: true,
        digestCronTimezone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  app.patch("/api/orgs/:orgId", async (request) => {
    const { orgId } = await authedOrg(app, request);
    const body = patchBodySchema.parse(request.body);
    return await app.prisma.org.update({
      where: { id: orgId },
      data: body,
      select: {
        id: true,
        name: true,
        plan: true,
        monthlyBudgetCents: true,
        slackWebhookUrl: true,
        digestEnabled: true,
        digestCronTimezone: true,
      },
    });
  });

  app.post("/api/orgs/:orgId/integrations/slack/test", async (request, reply) => {
    const { orgId } = await authedOrg(app, request);
    const body = z
      .object({
        webhookUrl: z.string().url(),
      })
      .parse(request.body);

    const res = await fetch(body.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "ProxKey: Slack webhook test from the dashboard.",
      }),
    });

    if (!res.ok) {
      return reply.status(502).send({
        error: "SLACK_WEBHOOK_FAILED",
        status: res.status,
      });
    }

    return reply.send({ ok: true });
  });

  app.get("/api/orgs/:orgId/members", async (request) => {
    const { orgId } = await authedOrg(app, request);
    const members = await app.prisma.orgMember.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        githubLogin: true,
        role: true,
        createdAt: true,
      },
    });
    return { rows: members };
  });
}
