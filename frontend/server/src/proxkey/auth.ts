import crypto from 'crypto'
import argon2 from 'argon2'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { PlanTier, UserRole, UserStatus } from '@prisma/client'
import { parse as parseCookie, serialize as serializeCookie } from 'cookie'
import type { ProxKeyConfig } from './config'
import { prisma } from './db'
import { normalizeEmail } from './security'
import type { AuthenticatedUser } from './types'

const OWNER_EMAIL = 'omer@proxkey.dev'
const PROXKEY_DOMAIN = 'proxkey.dev'

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthenticatedUser | null
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function createOrgSlug(value: string): string {
  return toOrgSlug(value) || `workspace-${crypto.randomUUID().slice(0, 6)}`
}

async function ensureDefaultOrganization() {
  const existing = await prisma.organization.findFirst({
    where: { domain: PROXKEY_DOMAIN },
  })

  if (existing) {
    return existing
  }

  return prisma.organization.create({
    data: {
      name: 'ProxKey',
      domain: PROXKEY_DOMAIN,
      slug: 'proxkey',
      plan: PlanTier.FREE,
      subscriptionStatus: 'FREE',
    },
  })
}

function toOrgSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export async function createOrActivateUser(args: { email: string; password: string }) {
  const email = normalizeEmail(args.email)
  const existing = await prisma.user.findUnique({
    where: { email },
  })

  if (existing) {
    if (existing.status === UserStatus.DISABLED) {
      throw new Error('This user is disabled.')
    }

    if (existing.passwordHash) {
      const ok = await argon2.verify(existing.passwordHash, args.password)
      if (!ok) {
        throw new Error('Invalid email or password.')
      }
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash: await argon2.hash(args.password),
          status: UserStatus.ACTIVE,
          lastActive: new Date(),
        },
      })
    }

    return prisma.user.update({
      where: { id: existing.id },
      data: { lastActive: new Date() },
    })
  }

  const domain = email.split('@')[1] ?? ''
  if (domain !== PROXKEY_DOMAIN) {
    throw new Error('Only invited users or @proxkey.dev accounts can sign in.')
  }

  const organization = await ensureDefaultOrganization()

  return prisma.user.create({
    data: {
      orgId: organization.id,
      name: email.split('@')[0] ?? 'proxkey-user',
      email,
      passwordHash: await argon2.hash(args.password),
      role: email === OWNER_EMAIL ? UserRole.OWNER : UserRole.EMPLOYEE,
      status: UserStatus.ACTIVE,
      lastActive: new Date(),
    },
  })
}

export async function registerUser(args: {
  email: string
  password: string
  name: string
  organizationName: string
  plan?: PlanTier
}) {
  const email = normalizeEmail(args.email)
  const existing = await prisma.user.findUnique({
    where: { email },
  })

  if (existing) {
    throw new Error('An account with this email already exists.')
  }

  const domain = email.split('@')[1] ?? ''
  if (!domain) {
    throw new Error('A work email is required.')
  }

  const existingOrganization = await prisma.organization.findFirst({
    where: { domain },
  })

  if (existingOrganization) {
    throw new Error('This company workspace already exists. Ask an admin to invite you or sign in.')
  }

  const orgSlug = toOrgSlug(args.organizationName) || 'workspace'
  const fallbackDomain = `${orgSlug}-${crypto.randomUUID().slice(0, 6)}`

  const organization = await prisma.organization.create({
    data: {
      name: args.organizationName.trim(),
      domain: domain === PROXKEY_DOMAIN ? fallbackDomain : domain,
      slug: createOrgSlug(args.organizationName),
      plan: args.plan ?? PlanTier.FREE,
      subscriptionStatus: args.plan && args.plan !== PlanTier.FREE ? 'TRIAL' : 'FREE',
    },
  })

  const user = await prisma.user.create({
    data: {
      orgId: organization.id,
      name: args.name.trim(),
      email,
      passwordHash: await argon2.hash(args.password),
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
      lastActive: new Date(),
    },
  })

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      createdByUserId: user.id,
    },
  })

  return user
}

export async function createSession(args: { userId: string; config: ProxKeyConfig }) {
  const token = crypto.randomUUID()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + args.config.SESSION_TTL_HOURS * 60 * 60 * 1000)

  const session = await prisma.session.create({
    data: {
      userId: args.userId,
      tokenHash,
      expiresAt,
    },
  })

  return {
    session,
    token,
  }
}

export function setSessionCookie(reply: FastifyReply, config: ProxKeyConfig, token: string): void {
  reply.header(
    'set-cookie',
    serializeCookie(config.SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
      domain: config.COOKIE_DOMAIN,
      maxAge: config.SESSION_TTL_HOURS * 60 * 60,
    }),
  )
}

export function clearSessionCookie(reply: FastifyReply, config: ProxKeyConfig): void {
  reply.header(
    'set-cookie',
    serializeCookie(config.SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
      domain: config.COOKIE_DOMAIN,
      maxAge: 0,
    }),
  )
}

export async function authenticateRequest(
  request: FastifyRequest,
  config: ProxKeyConfig,
): Promise<AuthenticatedUser | null> {
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
  const headerApiKey =
    typeof request.headers['x-proxkey-key'] === 'string'
      ? request.headers['x-proxkey-key'].trim()
      : ''
  const cookies = parseCookie(request.headers.cookie ?? '')
  const cookieToken = cookies[config.SESSION_COOKIE_NAME]
  const token = headerApiKey || bearer || cookieToken

  if (!token) {
    return null
  }

  if (/^pk_(live|test)_/i.test(token)) {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        keyHash: hashToken(token),
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        createdByUser: true,
      },
    })

    if (!apiKey || apiKey.createdByUser.status === UserStatus.DISABLED) {
      return null
    }

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })

    return {
      id: apiKey.createdByUser.id,
      orgId: apiKey.orgId,
      email: apiKey.createdByUser.email,
      role: apiKey.createdByUser.role,
      status: apiKey.createdByUser.status,
      name: apiKey.createdByUser.name,
      authType: 'api-key',
      sessionId: null,
      token,
    }
  }

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: hashToken(token),
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  })

  if (!session || session.user.status === UserStatus.DISABLED) {
    return null
  }

  return {
    id: session.user.id,
    orgId: session.user.orgId,
    email: session.user.email,
    role: session.user.role,
    status: session.user.status,
    name: session.user.name,
    authType: 'session',
    sessionId: session.id,
    token,
  }
}

export async function requireAuth(
  request: FastifyRequest,
  config: ProxKeyConfig,
): Promise<AuthenticatedUser> {
  const auth = await authenticateRequest(request, config)

  if (!auth) {
    throw new Error('Authentication required.')
  }

  request.auth = auth
  return auth
}

export function requireRoles(auth: AuthenticatedUser, roles: UserRole[]): void {
  if (!roles.includes(auth.role)) {
    throw new Error('You do not have permission to perform this action.')
  }
}
