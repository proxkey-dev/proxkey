import { IssueType, Severity } from '@prisma/client'
import { z } from 'zod'
import {
  issueTypeSchema,
  safeArrayOfStringsSchema,
  severitySchema,
  trimmedStringSchema,
  uuidSchema,
} from './common'

export const duplicateCandidateSchema = z
  .object({
    reportId: trimmedStringSchema.max(100),
    similarity: z.number().min(0).max(1),
    summary: trimmedStringSchema.max(2_000),
  })
  .strict()

export const triageReportParamsSchema = z
  .object({
    id: uuidSchema,
  })
  .strict()

export const triageResultParamsSchema = z
  .object({
    id: uuidSchema,
  })
  .strict()

export const triageModelOutputSchema = z
  .object({
    summary: trimmedStringSchema.max(2_000),
    issueType: issueTypeSchema.default(IssueType.UNKNOWN),
    severity: severitySchema.default(Severity.UNKNOWN),
    confidenceScore: z.number().min(0).max(1),
    customerImpact: z.string().trim().max(2_000).optional().nullable(),
    affectedArea: z.string().trim().max(500).optional().nullable(),
    suspectedComponent: z.string().trim().max(500).optional().nullable(),
    reproSteps: safeArrayOfStringsSchema.optional().default([]),
    expectedBehavior: z.string().trim().max(2_000).optional().nullable(),
    actualBehavior: z.string().trim().max(2_000).optional().nullable(),
    missingInformation: safeArrayOfStringsSchema.optional().default([]),
    suggestedOwner: z.string().trim().max(200).optional().nullable(),
    suggestedLabels: safeArrayOfStringsSchema.optional().default([]),
    duplicateSignals: safeArrayOfStringsSchema.optional().default([]),
    duplicateCandidates: z.array(duplicateCandidateSchema).optional().default([]),
    severityReasoning: z.string().trim().max(2_000).optional().nullable(),
    nextAction: z.string().trim().max(2_000),
    followUpMessage: z.string().trim().max(2_000).optional().nullable(),
    ticketTitle: trimmedStringSchema.max(200),
    ticketDescription: trimmedStringSchema.max(6_000),
  })
  .strict()

export const updateTriageResultBodySchema = z
  .object({
    summary: trimmedStringSchema.max(2_000).optional(),
    issueType: issueTypeSchema.optional(),
    severity: severitySchema.optional(),
    confidenceScore: z.number().min(0).max(1).optional(),
    customerImpact: z.string().trim().max(2_000).nullable().optional(),
    affectedArea: z.string().trim().max(500).nullable().optional(),
    suspectedComponent: z.string().trim().max(500).nullable().optional(),
    reproSteps: safeArrayOfStringsSchema.optional(),
    expectedBehavior: z.string().trim().max(2_000).nullable().optional(),
    actualBehavior: z.string().trim().max(2_000).nullable().optional(),
    missingInformation: safeArrayOfStringsSchema.optional(),
    suggestedOwner: z.string().trim().max(200).nullable().optional(),
    suggestedLabels: safeArrayOfStringsSchema.optional(),
    duplicateSignals: safeArrayOfStringsSchema.optional(),
    duplicateCandidates: z.array(duplicateCandidateSchema).optional(),
    severityReasoning: z.string().trim().max(2_000).nullable().optional(),
    nextAction: z.string().trim().max(2_000).optional(),
    followUpMessage: z.string().trim().max(2_000).nullable().optional(),
    ticketTitle: trimmedStringSchema.max(200).optional(),
    ticketDescription: trimmedStringSchema.max(6_000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be updated',
  })

export const exportTriageBodySchema = z.object({}).strict()
