import { Queue } from "bullmq";
import { Redis } from "ioredis";
import {
  attributeBuildJobSchema,
  buildIngestJobPayloadSchema,
  digestJobPayloadSchema,
  jobNames,
  queueNames,
  rollUpCostJobSchema,
  syncReposJobSchema,
  type AttributeBuildJob,
  type BuildIngestJobPayload,
  type DigestJobPayload,
  type RollUpCostJob,
  type SyncReposJob,
} from "@proxkey/types";

export interface ProducerHandles {
  redis: Redis;

  // Spec-aligned queues
  builds: Queue;
  costRollup: Queue;
  installations: Queue;
  digests: Queue;

  // Legacy
  buildIngest: Queue;
  digest: Queue;

  enqueueAttributeBuild: (job: AttributeBuildJob) => Promise<void>;
  enqueueRollUpCost: (job: RollUpCostJob) => Promise<void>;
  enqueueSyncRepos: (job: SyncReposJob) => Promise<void>;
  enqueueBuildIngest: (job: BuildIngestJobPayload) => Promise<void>;
  enqueueDigest: (job: DigestJobPayload) => Promise<void>;
  close: () => Promise<void>;
}

export function createProducers(redisUrl: string): ProducerHandles {
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  /** Spec: attempts: 3, backoff exponential 1000ms. */
  const builds = new Queue(queueNames.builds, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86_400 * 7 },
    },
  });

  const costRollup = new Queue(queueNames.costRollup, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 500 },
      removeOnComplete: { age: 3600, count: 1000 },
    },
  });

  /** Spec: attempts: 3 for sync-repos. */
  const installations = new Queue(queueNames.installations, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 3600, count: 100 },
    },
  });

  const digests = new Queue(queueNames.digests, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: { age: 86_400 * 30, count: 500 },
    },
  });

  /* Legacy queues — kept for the existing build-ingest/digest workers. */
  const buildIngest = new Queue(queueNames.buildIngest, {
    connection: redis,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86_400 * 7, count: 5000 },
    },
  });
  const digest = new Queue(queueNames.digest, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 3600, count: 500 },
      removeOnFail: { age: 86_400 * 7, count: 1000 },
    },
  });

  return {
    redis,
    builds,
    costRollup,
    installations,
    digests,
    buildIngest,
    digest,
    enqueueAttributeBuild: async (job) => {
      const payload = attributeBuildJobSchema.parse(job);
      // jobId = buildId so we deduplicate when GitHub re-delivers
      // the same workflow_run.completed event.
      await builds.add(jobNames.attributeBuild, payload, {
        jobId: payload.buildId,
      });
    },
    enqueueRollUpCost: async (job) => {
      const payload = rollUpCostJobSchema.parse(job);
      await costRollup.add(jobNames.rollUpCost, payload);
    },
    enqueueSyncRepos: async (job) => {
      const payload = syncReposJobSchema.parse(job);
      await installations.add(jobNames.syncRepos, payload, {
        jobId: `sync-repos:${payload.installationId}`,
      });
    },
    enqueueBuildIngest: async (job) => {
      const payload = buildIngestJobPayloadSchema.parse(job);
      await buildIngest.add("ingest", payload, {
        jobId: `${payload.provider}:${payload.buildExternalId}`,
      });
    },
    enqueueDigest: async (job) => {
      const payload = digestJobPayloadSchema.parse(job);
      await digest.add("send", payload, {
        jobId: `${payload.orgId}:${payload.channel}:${String(Date.now())}`,
      });
    },
    close: async () => {
      await Promise.allSettled([
        builds.close(),
        costRollup.close(),
        installations.close(),
        digests.close(),
        buildIngest.close(),
        digest.close(),
      ]);
      redis.disconnect();
    },
  };
}
