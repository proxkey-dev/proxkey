import {
  AuditAction,
  MembershipStatus,
  OrganizationRole,
  PrismaClient,
  UsageEventType,
} from '@prisma/client'
import type { DatabaseClient } from '../lib/db'
import { createSlug } from '../lib/crypto'
import type { RequestAuditContext } from '../lib/request'
import { hashPassword, verifyPassword } from '../lib/password'
import { BadRequestError, ConflictError, UnauthorizedError } from '../errors/app-error'
import { AuditLogService } from './audit-log.service'
import { SessionService } from './session.service'
import { UsageService } from './usage.service'
import type { AuthContext, OrganizationContext } from '../types/request'

type AuthResponse = {
  user: {
    id: string
    email: string
    name: string | null
  }
  organization: {
    id: string
    name: string
  }
  role: OrganizationRole
  sessionToken: string
  csrfToken: string
}

export class AuthService {
  constructor(
    private readonly db: PrismaClient,
    private readonly sessionService: SessionService,
    private readonly auditLogService: AuditLogService,
    private readonly usageService: UsageService,
  ) {}

  private async activatePendingMemberships(
    email: string,
    userId: string,
    db: DatabaseClient,
  ): Promise<void> {
    await db.organizationMember.updateMany({
      where: {
        invitedEmail: email,
        userId: null,
        status: MembershipStatus.PENDING,
      },
      data: {
        userId,
        status: MembershipStatus.ACTIVE,
        acceptedAt: new Date(),
      },
    })
  }

  private async resolveActiveMembership(
    userId: string,
    requestedOrganizationId?: string,
  ): Promise<OrganizationContext> {
    if (requestedOrganizationId) {
      const requestedMembership = await this.db.organizationMember.findFirst({
        where: {
          userId,
          organizationId: requestedOrganizationId,
          status: MembershipStatus.ACTIVE,
        },
        include: {
          organization: true,
        },
      })

      if (!requestedMembership) {
        throw new UnauthorizedError('Organization access denied')
      }

      return {
        organizationId: requestedMembership.organizationId,
        memberId: requestedMembership.id,
        role: requestedMembership.role,
        organizationName: requestedMembership.organization.name,
      }
    }

    const membership = await this.db.organizationMember.findFirst({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: {
        organization: true,
      },
    })

    if (!membership) {
      throw new UnauthorizedError('No active organization membership found')
    }

    return {
      organizationId: membership.organizationId,
      memberId: membership.id,
      role: membership.role,
      organizationName: membership.organization.name,
    }
  }

  async register(
    input: {
      email: string
      password: string
      name: string
      organizationName: string
    },
    requestContext: RequestAuditContext,
  ): Promise<AuthResponse> {
    const existingUser = await this.db.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    })

    if (existingUser) {
      throw new ConflictError('A user with that email already exists')
    }

    const organizationSlug = createSlug(input.organizationName)

    const user = await this.db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: await hashPassword(input.password),
          name: input.name,
        },
      })

      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: `${organizationSlug}-${createdUser.id.slice(0, 8)}`,
          createdByUserId: createdUser.id,
        },
      })

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: createdUser.id,
          invitedEmail: input.email,
          role: OrganizationRole.OWNER,
          status: MembershipStatus.ACTIVE,
          invitedByUserId: createdUser.id,
          acceptedAt: new Date(),
        },
      })

      await this.activatePendingMemberships(input.email, createdUser.id, tx)

      await this.auditLogService.record(
        {
          ...requestContext,
          organizationId: organization.id,
          actorUserId: createdUser.id,
          action: AuditAction.ORGANIZATION_CREATED,
          targetType: 'ORGANIZATION',
          targetId: organization.id,
          metadata: { organizationName: input.organizationName },
        },
        tx,
      )

      return {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        organization,
      }
    })

    const { sessionToken, csrfToken } = await this.sessionService.createSession({
      userId: user.id,
      activeOrganizationId: user.organization.id,
      requestContext,
    })

    await this.auditLogService.record({
      ...requestContext,
      organizationId: user.organization.id,
      actorUserId: user.id,
      action: AuditAction.LOGIN,
      targetType: 'USER',
      targetId: user.id,
    })

    await this.usageService.record({
      organizationId: user.organization.id,
      userId: user.id,
      eventType: UsageEventType.LOGIN,
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organization: {
        id: user.organization.id,
        name: user.organization.name,
      },
      role: OrganizationRole.OWNER,
      sessionToken,
      csrfToken,
    }
  }

  async login(
    input: {
      email: string
      password: string
      organizationId?: string
    },
    requestContext: RequestAuditContext,
  ): Promise<AuthResponse> {
    const user = await this.db.user.findUnique({
      where: { email: input.email },
    })

    if (!user) {
      throw new UnauthorizedError('Invalid email or password')
    }

    const passwordMatches = await verifyPassword(user.passwordHash, input.password)

    if (!passwordMatches) {
      throw new UnauthorizedError('Invalid email or password')
    }

    await this.activatePendingMemberships(user.email, user.id, this.db)

    const membership = await this.resolveActiveMembership(user.id, input.organizationId)
    const { sessionToken, csrfToken } = await this.sessionService.createSession({
      userId: user.id,
      activeOrganizationId: membership.organizationId,
      requestContext,
    })

    await this.auditLogService.record({
      ...requestContext,
      organizationId: membership.organizationId,
      actorUserId: user.id,
      action: AuditAction.LOGIN,
      targetType: 'USER',
      targetId: user.id,
    })

    await this.usageService.record({
      organizationId: membership.organizationId,
      userId: user.id,
      eventType: UsageEventType.LOGIN,
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organization: {
        id: membership.organizationId,
        name: membership.organizationName,
      },
      role: membership.role,
      sessionToken,
      csrfToken,
    }
  }

  async logout(
    sessionToken: string | undefined,
    auth: AuthContext | null,
    requestContext: RequestAuditContext,
  ): Promise<void> {
    if (auth) {
      await this.auditLogService.record({
        ...requestContext,
        organizationId: auth.activeOrganizationId,
        actorUserId: auth.userId,
        action: AuditAction.LOGOUT,
        targetType: 'USER',
        targetId: auth.userId,
      })
    }

    await this.sessionService.invalidateSession(sessionToken)
  }

  async getMe(
    auth: AuthContext,
    organization: OrganizationContext,
  ): Promise<{
    user: { id: string; email: string; name: string | null }
    organization: { id: string; name: string }
    role: OrganizationRole
  }> {
    return {
      user: {
        id: auth.userId,
        email: auth.email,
        name: auth.name,
      },
      organization: {
        id: organization.organizationId,
        name: organization.organizationName,
      },
      role: organization.role,
    }
  }
}
