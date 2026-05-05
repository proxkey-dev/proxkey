import { AuditAction, MembershipStatus, OrganizationRole, PrismaClient } from '@prisma/client'
import type { DatabaseClient } from '../lib/db'
import { createSlug } from '../lib/crypto'
import type { RequestAuditContext } from '../lib/request'
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/app-error'
import { AuditLogService } from './audit-log.service'
import { SessionService } from './session.service'
import type { AuthContext, OrganizationContext } from '../types/request'

export class OrganizationService {
  constructor(
    private readonly db: PrismaClient,
    private readonly auditLogService: AuditLogService,
    private readonly sessionService: SessionService,
  ) {}

  async resolveOrganizationContext(args: {
    auth: AuthContext
    requestedOrganizationId?: string
  }): Promise<OrganizationContext> {
    const preferredOrganizationId =
      args.requestedOrganizationId ?? args.auth.activeOrganizationId ?? undefined

    if (preferredOrganizationId) {
      const preferredMembership = await this.db.organizationMember.findFirst({
        where: {
          organizationId: preferredOrganizationId,
          userId: args.auth.userId,
          status: MembershipStatus.ACTIVE,
        },
        include: {
          organization: true,
        },
      })

      if (preferredMembership) {
        return {
          organizationId: preferredMembership.organizationId,
          memberId: preferredMembership.id,
          role: preferredMembership.role,
          organizationName: preferredMembership.organization.name,
        }
      }
    }

    const membership = await this.db.organizationMember.findFirst({
      where: {
        userId: args.auth.userId,
        status: MembershipStatus.ACTIVE,
      },
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    if (!membership) {
      throw new ForbiddenError('You do not belong to any active organization')
    }

    await this.sessionService.updateActiveOrganization(
      args.auth.sessionId,
      membership.organizationId,
    )

    return {
      organizationId: membership.organizationId,
      memberId: membership.id,
      role: membership.role,
      organizationName: membership.organization.name,
    }
  }

  async createOrganization(args: {
    auth: AuthContext
    name: string
    requestContext: RequestAuditContext
  }): Promise<{ id: string; name: string; role: OrganizationRole }> {
    const slugBase = createSlug(args.name)

    const organization = await this.db.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: args.name,
          slug: `${slugBase}-${args.auth.userId.slice(0, 8)}-${Date.now()}`,
          createdByUserId: args.auth.userId,
        },
      })

      await tx.organizationMember.create({
        data: {
          organizationId: created.id,
          userId: args.auth.userId,
          invitedEmail: args.auth.email,
          role: OrganizationRole.OWNER,
          status: MembershipStatus.ACTIVE,
          invitedByUserId: args.auth.userId,
          acceptedAt: new Date(),
        },
      })

      await this.auditLogService.record(
        {
          ...args.requestContext,
          organizationId: created.id,
          actorUserId: args.auth.userId,
          action: AuditAction.ORGANIZATION_CREATED,
          targetType: 'ORGANIZATION',
          targetId: created.id,
          metadata: { organizationName: args.name },
        },
        tx,
      )

      return created
    })

    await this.sessionService.updateActiveOrganization(args.auth.sessionId, organization.id)

    return {
      id: organization.id,
      name: organization.name,
      role: OrganizationRole.OWNER,
    }
  }

  async getCurrentOrganization(
    organization: OrganizationContext,
  ): Promise<{ id: string; name: string; role: OrganizationRole }> {
    return {
      id: organization.organizationId,
      name: organization.organizationName,
      role: organization.role,
    }
  }

  async listMembers(args: {
    organizationId: string
    page: number
    pageSize: number
    status?: MembershipStatus
  }): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    const where = {
      organizationId: args.organizationId,
      status: args.status,
    }

    const [items, total] = await this.db.$transaction([
      this.db.organizationMember.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        skip: (args.page - 1) * args.pageSize,
        take: args.pageSize,
      }),
      this.db.organizationMember.count({ where }),
    ])

    return {
      items,
      total,
      page: args.page,
      pageSize: args.pageSize,
    }
  }

  async inviteMember(args: {
    actor: AuthContext
    organization: OrganizationContext
    email: string
    role: OrganizationRole
    requestContext: RequestAuditContext
  }): Promise<{
    memberId: string
    invitedEmail: string
    role: OrganizationRole
    status: MembershipStatus
  }> {
    if (args.email === args.actor.email) {
      throw new ConflictError('Users cannot invite themselves')
    }

    const existingUser = await this.db.user.findUnique({
      where: { email: args.email },
      select: { id: true },
    })

    const membership = await this.db.organizationMember.upsert({
      where: {
        organizationId_invitedEmail: {
          organizationId: args.organization.organizationId,
          invitedEmail: args.email,
        },
      },
      update: {
        userId: existingUser?.id ?? null,
        role: args.role,
        status: existingUser ? MembershipStatus.ACTIVE : MembershipStatus.PENDING,
        invitedByUserId: args.actor.userId,
        acceptedAt: existingUser ? new Date() : null,
      },
      create: {
        organizationId: args.organization.organizationId,
        userId: existingUser?.id ?? null,
        invitedEmail: args.email,
        role: args.role,
        status: existingUser ? MembershipStatus.ACTIVE : MembershipStatus.PENDING,
        invitedByUserId: args.actor.userId,
        acceptedAt: existingUser ? new Date() : null,
      },
    })

    if (membership.userId === args.actor.userId) {
      throw new ConflictError('User is already a member of this organization')
    }

    await this.auditLogService.record({
      ...args.requestContext,
      organizationId: args.organization.organizationId,
      actorUserId: args.actor.userId,
      action: AuditAction.INVITE_SENT,
      targetType: 'ORGANIZATION_MEMBER',
      targetId: membership.id,
      metadata: {
        invitedEmail: args.email,
        role: args.role,
        status: membership.status,
      },
    })

    return {
      memberId: membership.id,
      invitedEmail: membership.invitedEmail,
      role: membership.role,
      status: membership.status,
    }
  }

  async changeMemberRole(args: {
    actor: AuthContext
    organization: OrganizationContext
    memberId: string
    role: OrganizationRole
    requestContext: RequestAuditContext
  }): Promise<{ memberId: string; role: OrganizationRole }> {
    const targetMembership = await this.db.organizationMember.findFirst({
      where: {
        id: args.memberId,
        organizationId: args.organization.organizationId,
        status: MembershipStatus.ACTIVE,
      },
    })

    if (!targetMembership) {
      throw new NotFoundError('Organization member not found')
    }

    if (targetMembership.role === OrganizationRole.OWNER && args.role !== OrganizationRole.OWNER) {
      const ownerCount = await this.db.organizationMember.count({
        where: {
          organizationId: args.organization.organizationId,
          status: MembershipStatus.ACTIVE,
          role: OrganizationRole.OWNER,
        },
      })

      if (ownerCount <= 1) {
        throw new ConflictError('Cannot demote the last organization owner')
      }
    }

    const updated = await this.db.organizationMember.update({
      where: { id: targetMembership.id },
      data: { role: args.role },
    })

    await this.auditLogService.record({
      ...args.requestContext,
      organizationId: args.organization.organizationId,
      actorUserId: args.actor.userId,
      action: AuditAction.ROLE_CHANGED,
      targetType: 'ORGANIZATION_MEMBER',
      targetId: updated.id,
      metadata: {
        previousRole: targetMembership.role,
        nextRole: updated.role,
      },
    })

    return {
      memberId: updated.id,
      role: updated.role,
    }
  }
}
