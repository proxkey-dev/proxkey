import { z } from 'zod'

const trimmedStringSchema = z.string().trim().min(1)
const serviceNameSchema = trimmedStringSchema.max(200)
const signalKindSchema = z.enum(['error_rate', 'latency', 'alert', 'saturation'])

const deployEventSchema = z
  .object({
    deployId: trimmedStringSchema.max(200),
    commitHash: trimmedStringSchema.max(100),
    pr: trimmedStringSchema.max(100),
    service: serviceNameSchema,
    deployedAt: z.coerce.date(),
    metadata: z.record(z.unknown()).optional().default({}),
  })
  .strict()

const observabilitySignalSchema = z
  .object({
    signalId: trimmedStringSchema.max(200),
    service: serviceNameSchema,
    timestamp: z.coerce.date(),
    kind: signalKindSchema,
    severity: z.number().min(0).max(1),
    description: trimmedStringSchema.max(2_000),
  })
  .strict()

const kindWeightsSchema = z
  .object({
    error_rate: z.number().min(0).max(5).optional(),
    latency: z.number().min(0).max(5).optional(),
    alert: z.number().min(0).max(5).optional(),
    saturation: z.number().min(0).max(5).optional(),
  })
  .strict()

const scoringConfigSchema = z
  .object({
    maxDelayHours: z.number().positive().max(24).optional(),
    clockSkewMinutes: z.number().min(0).max(30).optional(),
    unknownPrior: z.number().min(0.01).max(0.9).optional(),
    unknownSignalLikelihoodRatio: z.number().min(1).max(10).optional(),
    backgroundSignalProbability: z.number().min(0.001).max(0.5).optional(),
    immediateDecayHours: z.number().positive().max(24).optional(),
    delayedDecayHours: z.number().positive().max(48).optional(),
    dependencyDecay: z.number().min(0).max(1).optional(),
    callerDecay: z.number().min(0).max(1).optional(),
    undirectedDecay: z.number().min(0).max(1).optional(),
    maxGraphDepth: z.number().int().min(1).max(8).optional(),
    kindWeights: kindWeightsSchema.optional(),
  })
  .strict()

export const incidentAttributionRankBodySchema = z
  .object({
    incidentId: trimmedStringSchema.max(200),
    primaryService: serviceNameSchema,
    startedAt: z.coerce.date(),
    detectedAt: z.coerce.date(),
    deploys: z.array(deployEventSchema).min(1).max(500),
    signals: z.array(observabilitySignalSchema).min(1).max(1_000),
    serviceDependencies: z
      .record(serviceNameSchema, z.array(serviceNameSchema).max(100))
      .default({}),
    config: scoringConfigSchema.optional(),
  })
  .strict()
  .refine((value) => value.detectedAt >= value.startedAt, {
    path: ['detectedAt'],
    message: 'detectedAt must be at or after startedAt',
  })

export type IncidentAttributionRankBody = z.infer<typeof incidentAttributionRankBodySchema>
