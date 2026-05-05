import type { Env } from "@proxkey/config/env";
import type { Prisma, PrismaClient, WasteFlagType as WasteFlagTypeT } from "@proxkey/db";
import {
  jobNames,
  queueNames,
  type AttributeBuildJob,
} from "@proxkey/types";
import { Worker, type Job, type ConnectionOptions } from "bullmq";
import { makeInstallationOctokit } from "../lib/github-app.js";
import {
  detectWasteFlags,
  type WasteFinding,
  type WasteHistoryEntry,
  type WasteJobInput,
} from "./waste-detection.js";

interface AttributeContext {
  prisma: PrismaClient;
  env: Env;
}

async function fetchChangedFilesViaGithub(
  ctx: AttributeContext,
  build: { id: string; commitSha: string | null; repoId: string },
): Promise<string[]> {
  if (!build.commitSha) return [];

  const repo = await ctx.prisma.repo.findUnique({
    where: { id: build.repoId },
    select: {
      fullName: true,
      org: { select: { githubInstallationId: true } },
    },
  });
  if (!repo?.org.githubInstallationId) return [];
  const [owner, repoName] = repo.fullName.split("/");
  if (!owner || !repoName) return [];

  const octokit = makeInstallationOctokit(
    ctx.env,
    repo.org.githubInstallationId,
  );

  try {
    const commit = await octokit.repos.getCommit({
      owner,
      repo: repoName,
      ref: build.commitSha,
    });
    return (commit.data.files ?? [])
      .map((f) => f.filename)
      .filter((f): f is string => typeof f === "string");
  } catch {
    // GitHub may return 404 for force-pushed/deleted commits — that's
    // a normal failure mode, just skip detection that depends on diff.
    return [];
  }
}

async function loadCacheJobHistory(
  prisma: PrismaClient,
  repoId: string,
  jobNamesToCheck: readonly string[],
): Promise<Map<string, WasteHistoryEntry[]>> {
  const result = new Map<string, WasteHistoryEntry[]>();
  for (const name of jobNamesToCheck) {
    const recent = await prisma.workflowJob.findMany({
      where: { name, build: { repoId } },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { conclusion: true },
    });
    result.set(
      name,
      recent.map((r) => ({ jobName: name, conclusion: r.conclusion })),
    );
  }
  return result;
}

async function persistFindings(
  prisma: PrismaClient,
  build: { id: string; orgId: string },
  findings: readonly WasteFinding[],
): Promise<void> {
  const seenTypes = new Set<WasteFlagTypeT>();

  // Upsert/create flags. WasteFlag has no unique key for (build, flagType)
  // in this schema, so we look up by hand and update or create.
  for (const finding of findings) {
    seenTypes.add(finding.flagType);
    const existing = await prisma.wasteFlag.findFirst({
      where: {
        orgId: build.orgId,
        buildId: build.id,
        flagType: finding.flagType,
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.wasteFlag.update({
        where: { id: existing.id },
        data: {
          savingsEstimateCents: finding.savingsEstimateCents,
          details: finding.details as Prisma.InputJsonValue,
          resolvedAt: null,
        },
      });
    } else {
      await prisma.wasteFlag.create({
        data: {
          orgId: build.orgId,
          buildId: build.id,
          flagType: finding.flagType,
          savingsEstimateCents: finding.savingsEstimateCents,
          details: finding.details as Prisma.InputJsonValue,
        },
      });
    }
  }

  // Auto-resolve previously-active flags on this build whose detector
  // no longer fires (idempotency for re-runs).
  await prisma.wasteFlag.updateMany({
    where: {
      buildId: build.id,
      resolvedAt: null,
      ...(seenTypes.size > 0
        ? { flagType: { notIn: [...seenTypes] } }
        : {}),
    },
    data: { resolvedAt: new Date() },
  });
}

export async function processAttributeBuild(
  ctx: AttributeContext,
  payload: AttributeBuildJob,
): Promise<void> {
  const build = await ctx.prisma.build.findUnique({
    where: { id: payload.buildId },
    include: {
      repo: { select: { id: true, orgId: true, fullName: true } },
      jobs: {
        select: {
          id: true,
          name: true,
          conclusion: true,
          durationSeconds: true,
          costCents: true,
          runnerType: true,
        },
      },
    },
  });
  if (!build) return;

  // 1. Sum job costCents → update Build.costCents.
  const totalJobCost = build.jobs.reduce((sum, j) => sum + j.costCents, 0);
  if (totalJobCost !== build.costCents) {
    await ctx.prisma.build.update({
      where: { id: build.id },
      data: { costCents: totalJobCost },
    });
  }

  // 2. Fetch changed files via the GitHub commit endpoint.
  const changedFiles = await fetchChangedFilesViaGithub(ctx, {
    id: build.id,
    commitSha: build.commitSha,
    repoId: build.repoId,
  });

  // 3. Run detection.
  const cacheJobNames = build.jobs
    .filter((j) => j.name.toLowerCase().includes("cache"))
    .map((j) => j.name);
  const recentJobHistoryByName = await loadCacheJobHistory(
    ctx.prisma,
    build.repoId,
    cacheJobNames,
  );

  const jobsForDetector: WasteJobInput[] = build.jobs.map((j) => ({
    id: j.id,
    name: j.name,
    conclusion: j.conclusion,
    durationSeconds: j.durationSeconds,
    costCents: j.costCents,
    runnerLabels: (j.runnerType ?? "").toLowerCase(),
  }));

  const findings = detectWasteFlags({
    buildCostCents: totalJobCost,
    changedFiles,
    jobs: jobsForDetector,
    recentJobHistoryByName,
  });

  // 4. Persist findings (idempotent across retries).
  await persistFindings(
    ctx.prisma,
    { id: build.id, orgId: build.repo.orgId },
    findings,
  );
}

export function startAttributeBuildWorker(
  ctx: AttributeContext,
  connection: ConnectionOptions,
): Worker {
  return new Worker(
    queueNames.builds,
    async (job: Job) => {
      if (job.name !== jobNames.attributeBuild) return;
      const data = job.data as AttributeBuildJob;
      await processAttributeBuild(ctx, data);
    },
    { connection, concurrency: 4 },
  );
}
