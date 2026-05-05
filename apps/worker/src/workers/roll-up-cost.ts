import type { PrismaClient } from "@proxkey/db";
import {
  jobNames,
  queueNames,
  type RollUpCostJob,
} from "@proxkey/types";
import { Worker, type Job, type ConnectionOptions } from "bullmq";

/**
 * Recompute Build.costCents = SUM(WorkflowJob.costCents) for the given
 * buildId. Idempotent — safe to rerun any time.
 */
export async function processRollUpCost(
  prisma: PrismaClient,
  payload: RollUpCostJob,
): Promise<void> {
  const agg = await prisma.workflowJob.aggregate({
    where: { buildId: payload.buildId },
    _sum: { costCents: true },
  });
  await prisma.build.updateMany({
    where: { id: payload.buildId },
    data: { costCents: agg._sum.costCents ?? 0 },
  });
}

export function startRollUpCostWorker(
  prisma: PrismaClient,
  connection: ConnectionOptions,
): Worker {
  return new Worker(
    queueNames.costRollup,
    async (job: Job) => {
      if (job.name !== jobNames.rollUpCost) return;
      const data = job.data as RollUpCostJob;
      await processRollUpCost(prisma, data);
    },
    { connection, concurrency: 8 },
  );
}
