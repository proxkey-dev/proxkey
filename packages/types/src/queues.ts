import { Provider } from "@proxkey/db";
import { z } from "zod";

/**
 * Queue names. The spec mandates four queues: `builds`, `cost-rollup`,
 * `installations`, `digests`. We also keep two legacy queue names from
 * the original scaffold (`build-ingest`, `digest`) so that older
 * producers/consumers built against them continue to work during the
 * transition.
 */
export const queueNames = {
  builds: "builds",
  costRollup: "cost-rollup",
  installations: "installations",
  digests: "digests",
  // Legacy.
  buildIngest: "build-ingest",
  digest: "digest",
} as const;

export type QueueName = (typeof queueNames)[keyof typeof queueNames];

export const jobNames = {
  attributeBuild: "attribute-build",
  rollUpCost: "roll-up-cost",
  syncRepos: "sync-repos",
  weeklyDigest: "weekly-digest",
} as const;

export type JobName = (typeof jobNames)[keyof typeof jobNames];

/* -------------------------------------------------------------------- */
/*  Spec-aligned job payloads                                            */
/* -------------------------------------------------------------------- */

export const attributeBuildJobSchema = z.object({
  buildId: z.string().cuid(),
});
export type AttributeBuildJob = z.infer<typeof attributeBuildJobSchema>;

export const rollUpCostJobSchema = z.object({
  buildId: z.string().cuid(),
});
export type RollUpCostJob = z.infer<typeof rollUpCostJobSchema>;

export const syncReposJobSchema = z.object({
  orgId: z.string().cuid(),
  installationId: z.string().min(1),
});
export type SyncReposJob = z.infer<typeof syncReposJobSchema>;

export const weeklyDigestJobSchema = z.object({
  /** When set, only this org runs. The cron entry leaves it undefined
   *  to fan out to every org with digestEnabled = true. */
  orgId: z.string().cuid().optional(),
});
export type WeeklyDigestJob = z.infer<typeof weeklyDigestJobSchema>;

/* -------------------------------------------------------------------- */
/*  Legacy job payloads (kept for backward compatibility)                */
/* -------------------------------------------------------------------- */

export const digestJobPayloadSchema = z.discriminatedUnion("channel", [
  z.object({
    orgId: z.string().cuid(),
    channel: z.literal("email"),
    to: z.string().email(),
  }),
  z.object({
    orgId: z.string().cuid(),
    channel: z.literal("slack"),
  }),
]);
export type DigestJobPayload = z.infer<typeof digestJobPayloadSchema>;

export const buildIngestJobPayloadSchema = z.object({
  provider: z.nativeEnum(Provider),
  repoFullName: z.string().min(1),
  buildExternalId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});
export type BuildIngestJobPayload = z.infer<typeof buildIngestJobPayloadSchema>;
