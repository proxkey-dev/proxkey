import { MembershipStatus, OrganizationRole } from '@prisma/client'
import { z } from 'zod'
import { paginationQuerySchema, trimmedStringSchema, uuidSchema } from './common'

export const createOrganizationBodySchema = z
  .object({
    name: trimmedStringSchema.max(120),
  })
  .strict()

export const organizationIdParamsSchema = z
  .object({
    id: uuidSchema,
  })
  .strict()

export const memberIdParamsSchema = z
  .object({
    id: uuidSchema,
    memberId: uuidSchema,
  })
  .strict()

export const inviteMemberBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
    role: z.enum([
      OrganizationRole.ADMIN,
      OrganizationRole.MEMBER,
      OrganizationRole.VIEWER,
    ] as const),
  })
  .strict()

export const updateMemberRoleBodySchema = z
  .object({
    role: z.nativeEnum(OrganizationRole),
  })
  .strict()

export const listMembersQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(MembershipStatus).optional(),
})
