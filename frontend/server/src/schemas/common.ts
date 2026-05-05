import {
  AuditAction,
  IssueType,
  OrganizationRole,
  ReportStatus,
  Severity,
  SourceType,
} from '@prisma/client'
import { z } from 'zod'

export const uuidSchema = z.string().uuid()

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()

export const metadataSchema = z.record(z.string(), z.unknown())
export const organizationRoleSchema = z.nativeEnum(OrganizationRole)
export const sourceTypeSchema = z.nativeEnum(SourceType)
export const reportStatusSchema = z.nativeEnum(ReportStatus)
export const severitySchema = z.nativeEnum(Severity)
export const issueTypeSchema = z.nativeEnum(IssueType)
export const auditActionSchema = z.nativeEnum(AuditAction)

export const trimmedStringSchema = z.string().trim().min(1)
export const safeArrayOfStringsSchema = z.array(z.string().trim().min(1)).max(50)
