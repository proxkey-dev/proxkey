import type { Env } from "@proxkey/config/env";
import { type PrismaClient, Provider } from "@proxkey/db";
import {
  jobNames,
  queueNames,
  type SyncReposJob,
} from "@proxkey/types";
import { Worker, type Job, type ConnectionOptions } from "bullmq";
import { makeInstallationOctokit } from "../lib/github-app.js";

interface InstallationRepo {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
}

/**
 * Authenticate as the GitHub App installation, paginate through every
 * repository visible to it, and upsert into our DB. Repos that have
 * disappeared from the installation get soft-deleted so existing
 * Build rows still resolve cleanly via the relation.
 *
 * Idempotent: rerunning produces the same end state.
 */
export async function processSyncRepos(
  prisma: PrismaClient,
  env: Env,
  payload: SyncReposJob,
): Promise<void> {
  const octokit = makeInstallationOctokit(env, payload.installationId);
  const seenIds = new Set<string>();

  for await (const response of octokit.paginate.iterator(
    octokit.apps.listReposAccessibleToInstallation,
    { per_page: 100 },
  )) {
    for (const repo of response.data as unknown as InstallationRepo[]) {
      const externalId = String(repo.id);
      seenIds.add(externalId);
      await prisma.repo.upsert({
        where: {
          provider_externalId: {
            provider: Provider.GITHUB_ACTIONS,
            externalId,
          },
        },
        create: {
          orgId: payload.orgId,
          provider: Provider.GITHUB_ACTIONS,
          externalId,
          name: repo.name,
          fullName: repo.full_name,
          defaultBranch: repo.default_branch,
        },
        update: {
          orgId: payload.orgId,
          name: repo.name,
          fullName: repo.full_name,
          defaultBranch: repo.default_branch,
          deletedAt: null,
        },
      });
    }
  }

  // Soft-delete repos that disappeared. Don't touch already-deleted rows.
  if (seenIds.size > 0) {
    await prisma.repo.updateMany({
      where: {
        orgId: payload.orgId,
        provider: Provider.GITHUB_ACTIONS,
        externalId: { notIn: [...seenIds] },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
  }
}

export function startSyncReposWorker(
  prisma: PrismaClient,
  env: Env,
  connection: ConnectionOptions,
): Worker {
  return new Worker(
    queueNames.installations,
    async (job: Job) => {
      if (job.name !== jobNames.syncRepos) return;
      const data = job.data as SyncReposJob;
      await processSyncRepos(prisma, env, data);
    },
    { connection, concurrency: 2 },
  );
}
