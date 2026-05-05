import { parseEnv, type Env } from "@proxkey/config/env";
import { PrismaClient } from "@proxkey/db";
import {
  buildIngestJobPayloadSchema,
  digestJobPayloadSchema,
  queueNames,
} from "@proxkey/types";
import { Worker } from "bullmq";
import { processBuildIngest } from "./build-ingest.js";
import { processDigest } from "./digest.js";
import { createRedisConnection } from "./redis.js";
import { startAttributeBuildWorker } from "./workers/attribute-build.js";
import { startRollUpCostWorker } from "./workers/roll-up-cost.js";
import { startSyncReposWorker } from "./workers/sync-repos.js";
import { startWeeklyDigestWorker } from "./workers/weekly-digest.js";

const env: Env = parseEnv();
const prisma = new PrismaClient();
const connection = createRedisConnection(env.REDIS_URL);

/* -------------------------------------------------------------------- */
/*  Legacy queues (build-ingest / digest)                                */
/* -------------------------------------------------------------------- */

const buildIngestWorker = new Worker(
  queueNames.buildIngest,
  async (job) => {
    const payload = buildIngestJobPayloadSchema.parse(job.data);
    await processBuildIngest(prisma, payload);
  },
  { connection },
);

const digestWorker = new Worker(
  queueNames.digest,
  async (job) => {
    const payload = digestJobPayloadSchema.parse(job.data);
    await processDigest(prisma, env, payload);
  },
  { connection },
);

/* -------------------------------------------------------------------- */
/*  Spec-aligned queues                                                  */
/* -------------------------------------------------------------------- */

const attributeBuildWorker = startAttributeBuildWorker(
  { prisma, env },
  connection,
);
const rollUpCostWorker = startRollUpCostWorker(prisma, connection);
const syncReposWorker = startSyncReposWorker(prisma, env, connection);

const weeklyDigestStartedPromise = startWeeklyDigestWorker(
  prisma,
  env,
  connection,
);

function logFailed(queue: string) {
  return (job: { id?: string } | undefined, err: Error): void => {
    console.error(`[${queue}] job failed`, job?.id, err);
  };
}

buildIngestWorker.on("failed", logFailed("build-ingest"));
digestWorker.on("failed", logFailed("digest"));
attributeBuildWorker.on("failed", logFailed("builds"));
rollUpCostWorker.on("failed", logFailed("cost-rollup"));
syncReposWorker.on("failed", logFailed("installations"));
void weeklyDigestStartedPromise.then(({ worker }) => {
  worker.on("failed", logFailed("digests"));
});

const shutdown = async (signal: string): Promise<void> => {
  console.info({ signal }, "worker shutting down");
  const { worker: weeklyDigestWorker, queue: weeklyDigestQueue } =
    await weeklyDigestStartedPromise;
  await Promise.all([
    buildIngestWorker.close(),
    digestWorker.close(),
    attributeBuildWorker.close(),
    rollUpCostWorker.close(),
    syncReposWorker.close(),
    weeklyDigestWorker.close(),
    weeklyDigestQueue.close(),
  ]);
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

console.info("worker listening", {
  queues: [
    queueNames.buildIngest,
    queueNames.digest,
    queueNames.builds,
    queueNames.costRollup,
    queueNames.installations,
    queueNames.digests,
  ],
});
