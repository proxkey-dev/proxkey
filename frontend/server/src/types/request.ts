import type { OrganizationRole } from '@prisma/client'

export type AuthContext = {
  userId: string
  email: string
  name: string | null
  sessionId: string
  csrfTokenHash: string
  activeOrganizationId: string | null
}

export type OrganizationContext = {
  organizationId: string
  memberId: string
  role: OrganizationRole
  organizationName: string
}
