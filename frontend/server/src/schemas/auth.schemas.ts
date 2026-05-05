import { z } from 'zod'
import { trimmedStringSchema, uuidSchema } from './common'

export const registerBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    password: z.string().min(12).max(128),
    name: trimmedStringSchema.max(100),
    organizationName: trimmedStringSchema.max(120),
  })
  .strict()

export const loginBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    password: z.string().min(12).max(128),
    organizationId: uuidSchema.optional(),
  })
  .strict()
