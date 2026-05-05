import type { PrismaClient } from '@prisma/client'
import { generateOpaqueToken, hashToken } from '../lib/crypto'
import type { RequestAuditContext } from '../lib/request'
import type { AuthContext } from '../types/request'

export class SessionService {
  constructor(
    private readonly db: PrismaClient,
    private readonly sessionTtlHours: number,
  ) {}

  async createSession(input: {
    userId: string
    activeOrganizationId: string | null
    requestContext: RequestAuditContext
  }): Promise<{ sessionToken: string; csrfToken: string }> {
    const sessionToken = generateOpaqueToken()
    const csrfToken = generateOpaqueToken()
    const expiresAt = new Date(Date.now() + this.sessionTtlHours * 60 * 60 * 1000)

    await this.db.session.create({
      data: {
        userId: input.userId,
        tokenHash: hashToken(sessionToken),
        csrfTokenHash: hashToken(csrfToken),
        activeOrganizationId: input.activeOrganizationId,
        expiresAt,
        lastSeenAt: new Date(),
        ipAddress: input.requestContext.ipAddress ?? null,
        userAgent: input.requestContext.userAgent ?? null,
      },
    })

    return { sessionToken, csrfToken }
  }

  async authenticate(sessionToken?: string): Promise<AuthContext | null> {
    if (!sessionToken) {
      return null
    }

    const session = await this.db.session.findUnique({
      where: { tokenHash: hashToken(sessionToken) },
      include: { user: true },
    })

    if (!session || session.expiresAt <= new Date()) {
      return null
    }

    await this.db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    })

    return {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      sessionId: session.id,
      csrfTokenHash: session.csrfTokenHash,
      activeOrganizationId: session.activeOrganizationId ?? null,
    }
  }

  async updateActiveOrganization(sessionId: string, organizationId: string): Promise<void> {
    await this.db.session.update({
      where: { id: sessionId },
      data: { activeOrganizationId: organizationId },
    })
  }

  async invalidateSession(sessionToken?: string): Promise<void> {
    if (!sessionToken) {
      return
    }

    await this.db.session.deleteMany({
      where: { tokenHash: hashToken(sessionToken) },
    })
  }

  isCsrfTokenValid(auth: AuthContext, csrfToken?: string): boolean {
    if (!csrfToken) {
      return false
    }

    return hashToken(csrfToken) === auth.csrfTokenHash
  }
}
