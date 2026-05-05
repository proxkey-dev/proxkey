import { z } from 'zod'
import {
  metadataSchema,
  paginationQuerySchema,
  reportStatusSchema,
  sourceTypeSchema,
  trimmedStringSchema,
  uuidSchema,
} from './common'

export const reportIdParamsSchema = z
  .object({
    id: uuidSchema,
  })
  .strict()

export const createReportBodySchema = z
  .object({
    title: trimmedStringSchema.max(200),
    rawText: z.string().trim().min(1).max(50_000),
    sourceType: sourceTypeSchema,
    metadata: metadataSchema.optional(),
  })
  .strict()

export const listReportsQuerySchema = paginationQuerySchema.extend({
  status: reportStatusSchema.optional(),
  sourceType: sourceTypeSchema.optional(),
})

export const updateReportBodySchema = z
  .object({
    title: trimmedStringSchema.max(200).optional(),
    rawText: z.string().trim().min(1).max(50_000).optional(),
    sourceType: sourceTypeSchema.optional(),
    metadata: metadataSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be updated',
  })
