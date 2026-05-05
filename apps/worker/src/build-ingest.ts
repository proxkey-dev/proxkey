import { type Prisma, type PrismaClient, Provider } from "@proxkey/db";
import type { BuildIngestJobPayload } from "@proxkey/types";
import { z } from "zod";
import { mapGitHubWorkflowConclusion } from "./map-github-conclusion.js";

const githubWorkflowPayloadSchema = z.object({
  installation: z.object({ id: z.number() }).optional(),
  repository: z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    default_branch: z.string().optional(),
  }),
  workflow_run: z.object({
    id: z.number(),
    head_branch: z.string().optional(),
    head_sha: z.string().optional(),
    conclusion: z.string().nullable().optional(),
    status: z.string(),
    run_started_at: z.string().optional(),
    updated_at: z.string().optional(),
    triggering_actor: z.object({ login: z.string() }).optional(),
    actor: z.object({ login: z.string() }).optional(),
    pull_requests: z.array(z.object({ number: z.number() })).optional(),
  }),
});

export async function processBuildIngest(
  prisma: PrismaClient,
  job: BuildIngestJobPayload,
): Promise<void> {
  if (job.provider !== Provider.GITHUB_ACTIONS) {
    return;
  }

  const parsed = githubWorkflowPayloadSchema.safeParse(job.payload);
  if (!parsed.success) {
    throw new Error("invalid_github_workflow_payload");
  }

  const installationId = parsed.data.installation?.id;
  if (installationId === undefined) {
    return;
  }

  const org = await prisma.org.findFirst({
    where: {
      githubInstallationId: String(installationId),
      deletedAt: null,
    },
  });
  if (!org) {
    return;
  }

  const repoExternalId = String(parsed.data.repository.id);
  const wr = parsed.data.workflow_run;

  const startedAt = wr.run_started_at
    ? new Date(wr.run_started_at)
    : new Date();
  const finishedAt = wr.updated_at ? new Date(wr.updated_at) : null;
  let durationSeconds: number | null = null;
  if (finishedAt && startedAt.getTime() > 0) {
    durationSeconds = Math.max(
      0,
      Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000),
    );
  }

  const repo = await prisma.repo.upsert({
    where: {
      provider_externalId: {
        provider: Provider.GITHUB_ACTIONS,
        externalId: repoExternalId,
      },
    },
    create: {
      orgId: org.id,
      provider: Provider.GITHUB_ACTIONS,
      externalId: repoExternalId,
      name: parsed.data.repository.name,
      fullName: parsed.data.repository.full_name,
      defaultBranch: parsed.data.repository.default_branch ?? "main",
    },
    update: {
      name: parsed.data.repository.name,
      fullName: parsed.data.repository.full_name,
      ...(parsed.data.repository.default_branch !== undefined
        ? { defaultBranch: parsed.data.repository.default_branch }
        : {}),
      deletedAt: null,
    },
  });

  const buildExternalId = String(wr.id);
  const prNumber = wr.pull_requests?.[0]?.number ?? null;
  const triggeredBy =
    wr.triggering_actor?.login ?? wr.actor?.login ?? null;

  await prisma.build.upsert({
    where: {
      provider_externalId: {
        provider: Provider.GITHUB_ACTIONS,
        externalId: buildExternalId,
      },
    },
    create: {
      repoId: repo.id,
      provider: Provider.GITHUB_ACTIONS,
      externalId: buildExternalId,
      branch: wr.head_branch ?? "unknown",
      prNumber,
      prTitle: null,
      triggeredBy,
      status: wr.status,
      conclusion: mapGitHubWorkflowConclusion(wr.conclusion),
      startedAt,
      finishedAt,
      durationSeconds,
      costCents: 0,
      runnerType: null,
      runnerSize: null,
      commitSha: wr.head_sha ?? null,
      rawPayload: job.payload as Prisma.InputJsonValue,
    },
    update: {
      branch: wr.head_branch ?? "unknown",
      prNumber,
      triggeredBy,
      status: wr.status,
      conclusion: mapGitHubWorkflowConclusion(wr.conclusion),
      finishedAt,
      durationSeconds,
      commitSha: wr.head_sha ?? null,
      rawPayload: job.payload as Prisma.InputJsonValue,
    },
  });
}
