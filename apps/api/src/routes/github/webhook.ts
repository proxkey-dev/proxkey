import { verify } from "@octokit/webhooks-methods";
import { type Prisma, Provider } from "@proxkey/db";
import { calculateJobCostFromLabels } from "@proxkey/types";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const installationPayloadSchema = z.object({
  action: z.string(),
  installation: z.object({
    id: z.number(),
    account: z.object({
      login: z.string(),
      type: z.string(),
    }),
  }),
});

const repositoryShape = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  default_branch: z.string().optional(),
});

const workflowRunEnvelopeSchema = z.object({
  action: z.string(),
  installation: z.object({ id: z.number() }).optional(),
  repository: repositoryShape,
  workflow_run: z
    .object({
      id: z.number(),
      name: z.string().optional(),
      head_branch: z.string().optional(),
      head_sha: z.string().optional(),
      conclusion: z.string().nullable().optional(),
      status: z.string(),
      run_started_at: z.string().optional(),
      updated_at: z.string().optional(),
      triggering_actor: z.object({ login: z.string() }).optional(),
      actor: z.object({ login: z.string() }).optional(),
      pull_requests: z.array(z.object({ number: z.number() })).optional(),
    })
    .passthrough(),
});

const workflowJobEnvelopeSchema = z.object({
  action: z.string(),
  installation: z.object({ id: z.number() }).optional(),
  repository: repositoryShape,
  workflow_job: z
    .object({
      id: z.number(),
      run_id: z.number(),
      name: z.string(),
      status: z.string(),
      conclusion: z.string().nullable().optional(),
      started_at: z.string().nullable().optional(),
      completed_at: z.string().nullable().optional(),
      labels: z.array(z.string()).default([]),
    })
    .passthrough(),
});

function getRawBody(request: FastifyRequest): Buffer | undefined {
  return (request as { rawBody?: Buffer }).rawBody;
}

function getSignatureHeader(request: FastifyRequest): string | undefined {
  const h = request.headers["x-hub-signature-256"];
  return typeof h === "string" ? h : undefined;
}

function durationSeconds(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
): number | null {
  if (!startedAt || !completedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  return Math.ceil((end - start) / 1000);
}

function mapBuildConclusion(
  raw: string | null | undefined,
):
  | "SUCCESS"
  | "FAILURE"
  | "CANCELLED"
  | "TIMED_OUT"
  | "FLAKY"
  | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === "success") return "SUCCESS";
  if (v === "failure" || v === "startup_failure") return "FAILURE";
  if (v === "cancelled" || v === "skipped") return "CANCELLED";
  if (v === "timed_out") return "TIMED_OUT";
  return null;
}

async function findOrgByInstallation(
  app: FastifyInstance,
  installationId: number | undefined,
): Promise<{ id: string } | null> {
  if (installationId === undefined) return null;
  return await app.prisma.org.findFirst({
    where: {
      githubInstallationId: String(installationId),
      deletedAt: null,
    },
    select: { id: true },
  });
}

async function upsertRepoFromPayload(
  app: FastifyInstance,
  orgId: string,
  repository: z.infer<typeof repositoryShape>,
): Promise<{ id: string; defaultBranch: string }> {
  return await app.prisma.repo.upsert({
    where: {
      provider_externalId: {
        provider: Provider.GITHUB_ACTIONS,
        externalId: String(repository.id),
      },
    },
    create: {
      orgId,
      provider: Provider.GITHUB_ACTIONS,
      externalId: String(repository.id),
      name: repository.name,
      fullName: repository.full_name,
      defaultBranch: repository.default_branch ?? "main",
    },
    update: {
      orgId,
      name: repository.name,
      fullName: repository.full_name,
      ...(repository.default_branch !== undefined
        ? { defaultBranch: repository.default_branch }
        : {}),
      deletedAt: null,
    },
    select: { id: true, defaultBranch: true },
  });
}

/* -------------------------------------------------------------------- */
/*  Event handlers                                                       */
/* -------------------------------------------------------------------- */

async function handleInstallation(
  app: FastifyInstance,
  body: z.infer<typeof installationPayloadSchema>,
): Promise<void> {
  const login = body.installation.account.login;
  const installationId = String(body.installation.id);

  if (body.action === "deleted") {
    await app.prisma.org.updateMany({
      where: { githubLogin: login, githubInstallationId: installationId },
      data: { deletedAt: new Date() },
    });
    return;
  }

  if (body.action !== "created" && body.action !== "unsuspend") return;

  const org = await app.prisma.org.upsert({
    where: { githubLogin: login },
    create: {
      githubLogin: login,
      name: login,
      githubInstallationId: installationId,
    },
    update: {
      githubInstallationId: installationId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (body.action === "created") {
    await app.queues.enqueueSyncRepos({
      orgId: org.id,
      installationId,
    });
  }
}

async function handleWorkflowRun(
  app: FastifyInstance,
  body: z.infer<typeof workflowRunEnvelopeSchema>,
): Promise<void> {
  if (body.action !== "completed") return;

  const org = await findOrgByInstallation(app, body.installation?.id);
  if (!org) return;

  const repo = await upsertRepoFromPayload(app, org.id, body.repository);
  const wr = body.workflow_run;
  const startedAt = wr.run_started_at
    ? new Date(wr.run_started_at)
    : new Date();
  const finishedAt = wr.updated_at ? new Date(wr.updated_at) : null;

  const build = await app.prisma.build.upsert({
    where: {
      provider_externalId: {
        provider: Provider.GITHUB_ACTIONS,
        externalId: String(wr.id),
      },
    },
    create: {
      repoId: repo.id,
      provider: Provider.GITHUB_ACTIONS,
      externalId: String(wr.id),
      branch: wr.head_branch ?? repo.defaultBranch,
      prNumber: wr.pull_requests?.[0]?.number ?? null,
      triggeredBy:
        wr.triggering_actor?.login ?? wr.actor?.login ?? null,
      status: wr.status,
      conclusion: mapBuildConclusion(wr.conclusion),
      startedAt,
      finishedAt,
      durationSeconds: durationSeconds(wr.run_started_at, wr.updated_at),
      commitSha: wr.head_sha ?? null,
      // Spec: never expose rawPayload in responses; OK to persist here.
      rawPayload: body as unknown as Prisma.InputJsonValue,
    },
    update: {
      branch: wr.head_branch ?? repo.defaultBranch,
      prNumber: wr.pull_requests?.[0]?.number ?? null,
      triggeredBy:
        wr.triggering_actor?.login ?? wr.actor?.login ?? null,
      status: wr.status,
      conclusion: mapBuildConclusion(wr.conclusion),
      finishedAt,
      durationSeconds: durationSeconds(wr.run_started_at, wr.updated_at),
      commitSha: wr.head_sha ?? null,
      rawPayload: body as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  await app.queues.enqueueAttributeBuild({ buildId: build.id });
}

async function handleWorkflowJob(
  app: FastifyInstance,
  body: z.infer<typeof workflowJobEnvelopeSchema>,
): Promise<void> {
  if (body.action !== "completed") return;

  const org = await findOrgByInstallation(app, body.installation?.id);
  if (!org) return;

  const repo = await upsertRepoFromPayload(app, org.id, body.repository);
  const job = body.workflow_job;

  // Find/create the parent build by workflow_run id. Whichever event
  // arrives first creates the build; the other backfills.
  const parent = await app.prisma.build.upsert({
    where: {
      provider_externalId: {
        provider: Provider.GITHUB_ACTIONS,
        externalId: String(job.run_id),
      },
    },
    create: {
      repoId: repo.id,
      provider: Provider.GITHUB_ACTIONS,
      externalId: String(job.run_id),
      branch: repo.defaultBranch,
      status: "in_progress",
      startedAt: job.started_at ? new Date(job.started_at) : new Date(),
    },
    update: { repoId: repo.id },
    select: { id: true },
  });

  const dur = durationSeconds(job.started_at, job.completed_at);
  const costCents =
    dur === null ? 0 : calculateJobCostFromLabels(job.labels, dur);

  await app.prisma.workflowJob.upsert({
    where: {
      buildId_externalId: {
        buildId: parent.id,
        externalId: String(job.id),
      },
    },
    create: {
      buildId: parent.id,
      externalId: String(job.id),
      name: job.name,
      startedAt: job.started_at ? new Date(job.started_at) : new Date(),
      finishedAt: job.completed_at ? new Date(job.completed_at) : null,
      durationSeconds: dur,
      costCents,
      runnerType: job.labels.join(",") || null,
      conclusion: job.conclusion ?? null,
    },
    update: {
      name: job.name,
      finishedAt: job.completed_at ? new Date(job.completed_at) : null,
      durationSeconds: dur,
      costCents,
      runnerType: job.labels.join(",") || null,
      conclusion: job.conclusion ?? null,
    },
  });

  await app.queues.enqueueRollUpCost({ buildId: parent.id });
}

/* -------------------------------------------------------------------- */
/*  Route                                                                */
/* -------------------------------------------------------------------- */

export async function registerWebhookRoute(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    "/api/github/webhook",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const raw = getRawBody(request);
      if (!raw) {
        return reply
          .status(400)
          .send({ error: "missing_raw_body", code: "BAD_REQUEST" });
      }

      const signature = getSignatureHeader(request);
      let ok = false;
      try {
        ok = await verify(
          app.proxkeyEnv.GITHUB_WEBHOOK_SECRET,
          raw.toString("utf8"),
          signature ?? "",
        );
      } catch {
        ok = false;
      }
      if (!ok) {
        return reply
          .status(401)
          .send({ error: "invalid_signature", code: "UNAUTHORIZED" });
      }

      const event = request.headers["x-github-event"];
      const json: unknown = JSON.parse(raw.toString("utf8"));

      if (event === "installation") {
        const parsed = installationPayloadSchema.safeParse(json);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: "invalid_payload", code: "BAD_REQUEST" });
        }
        await handleInstallation(app, parsed.data);
        return reply.status(202).send({ accepted: true });
      }

      if (event === "workflow_run") {
        const parsed = workflowRunEnvelopeSchema.safeParse(json);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: "invalid_payload", code: "BAD_REQUEST" });
        }
        await handleWorkflowRun(app, parsed.data);
        return reply.status(202).send({ accepted: true });
      }

      if (event === "workflow_job") {
        const parsed = workflowJobEnvelopeSchema.safeParse(json);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: "invalid_payload", code: "BAD_REQUEST" });
        }
        await handleWorkflowJob(app, parsed.data);
        return reply.status(202).send({ accepted: true });
      }

      return reply.status(202).send({ accepted: true, ignored: true });
    },
  );
}
