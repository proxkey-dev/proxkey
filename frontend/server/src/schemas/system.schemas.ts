import { z } from 'zod'
import { auditActionSchema, paginationQuerySchema } from './common'

export const auditLogsQuerySchema = paginationQuerySchema.extend({
  action: auditActionSchema.optional(),
})
