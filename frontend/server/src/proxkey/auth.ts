import crypto from 'crypto'
import argon2 from 'argon2'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { OrganizationMembershipRole, PlanTier, UserRole, UserStatus } from '@prisma/client'
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

const auth0Jwks = new Map<string, unknown>()
let joseModulePromise: Promise<any> | null = null

async function loadJoseModule(): Promise<any> {
  if (!joseModulePromise) {
    joseModulePromise = import('jose') as Promise<any>
  }

  return joseModulePromise
}

function getAuth0Issuer(config: ProxKeyConfig): string {
  const rawIssuer =
    config.AUTH0_ISSUER_BASE_URL?.trim() ||
    (config.AUTH0_DOMAIN ? `https://${config.AUTH0_DOMAIN}/` : '')
  return rawIssuer.endsWith('/') ? rawIssuer : `${rawIssuer}/`
}

async function getAuth0KeySet(config: ProxKeyConfig) {
  const issuer = getAuth0Issuer(config)
  if (!issuer) {
    throw new Error('Auth0 is not configured.')
  }

  const cached = auth0Jwks.get(issuer)
  if (cached) {
    return cached
  }

  const { createRemoteJWKSet } = await loadJoseModule()
  const jwks = createRemoteJWKSet(new URL('.well-known/jwks.json', issuer))
  auth0Jwks.set(issuer, jwks)
  return jwks
}

async function fetchAuth0UserInfo(accessToken: string, config: ProxKeyConfig) {
  const issuer = getAuth0Issuer(config)
  const response = await fetch(new URL('userinfo', issuer), {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Unable to load Auth0 user profile.')
  }

  const payload = (await response.json()) as {
    sub?: string
    email?: string
    name?: string
    nickname?: string
  }

  return payload
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

function mapUserRoleToMembershipRole(role: UserRole): OrganizationMembershipRole {
  if (role === UserRole.OWNER) return OrganizationMembershipRole.OWNER
  if (role === UserRole.ADMIN || role === UserRole.TRIAGE_LEAD)
    return OrganizationMembershipRole.ADMIN
  return OrganizationMembershipRole.MEMBER
}

async function ensureOrganizationMembership(args: {
  organizationId: string
  userId: string
  role: UserRole
}) {
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: args.organizationId,
        userId: args.userId,
      },
    },
  })

  if (membership) {
    return membership
  }

  return prisma.organizationMembership.create({
    data: {
      organizationId: args.organizationId,
      userId: args.userId,
      role: mapUserRoleToMembershipRole(args.role),
    },
  })
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

export async function verifyAuth0IdToken(args: { idToken: string; config: ProxKeyConfig }) {
  if (!args.config.AUTH0_CLIENT_ID) {
    throw new Error('Auth0 client configuration is missing.')
  }

  const issuer = getAuth0Issuer(args.config)
  if (!issuer) {
    throw new Error('Auth0 issuer configuration is missing.')
  }

  const { jwtVerify } = await loadJoseModule()
  const keySet = await getAuth0KeySet(args.config)
  const { payload } = await jwtVerify(args.idToken, keySet as Parameters<typeof jwtVerify>[1], {
    issuer,
    audience: args.config.AUTH0_CLIENT_ID,
  })

  const emailClaim = typeof payload.email === 'string' ? payload.email : ''
  const email = normalizeEmail(emailClaim)
  if (!email) {
    throw new Error('Auth0 did not return a usable email address.')
  }

  if (payload.email_verified === false) {
    throw new Error('Verify your Auth0 email address before continuing.')
  }

  return {
    email,
    name:
      typeof payload.name === 'string'
        ? payload.name
        : typeof payload.nickname === 'string'
          ? payload.nickname
          : (email.split('@')[0] ?? 'ProxKey User'),
    subject: typeof payload.sub === 'string' ? payload.sub : null,
  }
}

export async function verifyAuth0AccessToken(args: { accessToken: string; config: ProxKeyConfig }) {
  if (!args.config.AUTH0_AUDIENCE) {
    throw new Error('Auth0 audience configuration is missing.')
  }

  const issuer = getAuth0Issuer(args.config)
  if (!issuer) {
    throw new Error('Auth0 issuer configuration is missing.')
  }

  const { jwtVerify } = await loadJoseModule()
  const keySet = await getAuth0KeySet(args.config)
  const { payload, protectedHeader } = await jwtVerify(
    args.accessToken,
    keySet as Parameters<typeof jwtVerify>[1],
    {
      issuer,
      audience: args.config.AUTH0_AUDIENCE,
    },
  )

  if (protectedHeader.alg !== 'RS256') {
    throw new Error('Unsupported Auth0 token signing algorithm.')
  }

  const userInfo =
    typeof payload.email === 'string' && payload.email.trim()
      ? null
      : await fetchAuth0UserInfo(args.accessToken, args.config).catch(() => null)

  const emailClaim = typeof payload.email === 'string' ? payload.email : (userInfo?.email ?? '')
  const email = normalizeEmail(emailClaim)
  if (!email) {
    throw new Error('Auth0 did not return a usable email address.')
  }

  return {
    email,
    name:
      typeof payload.name === 'string'
        ? payload.name
        : typeof payload.nickname === 'string'
          ? payload.nickname
          : typeof userInfo?.name === 'string'
            ? userInfo.name
            : typeof userInfo?.nickname === 'string'
              ? userInfo.nickname
              : (email.split('@')[0] ?? 'ProxKey User'),
    subject: typeof payload.sub === 'string' ? payload.sub : (userInfo?.sub ?? null),
    auth0OrgId: typeof payload.org_id === 'string' ? payload.org_id : null,
  }
}

export async function upsertAuth0User(args: {
  subject?: string | null
  email: string
  name: string
  organizationName?: string
  plan?: PlanTier
  auth0OrgId?: string | null
}) {
  const email = normalizeEmail(args.email)
  const existing = args.subject
    ? await prisma.user.findFirst({
        where: {
          OR: [{ auth0UserId: args.subject }, { email }],
        },
        include: {
          organization: true,
        },
      })
    : await prisma.user.findFirst({
        where: { email },
        include: {
          organization: true,
        },
      })

  if (existing) {
    if (existing.status === UserStatus.DISABLED) {
      throw new Error('This user is disabled.')
    }

    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        auth0UserId: args.subject ?? existing.auth0UserId,
        name: args.name.trim() || existing.name,
        email,
        status: UserStatus.ACTIVE,
        lastActive: new Date(),
      },
    })

    if (args.auth0OrgId && !existing.organization.auth0OrgId) {
      await prisma.organization.update({
        where: { id: existing.organization.id },
        data: {
          auth0OrgId: args.auth0OrgId,
        },
      })
    }

    await ensureOrganizationMembership({
      organizationId: user.orgId,
      userId: user.id,
      role: user.role,
    })

    return user
  }

  const domain = email.split('@')[1] ?? ''
  if (!domain) {
    throw new Error('A work email is required.')
  }

  if (args.auth0OrgId) {
    const organization = await prisma.organization.findUnique({
      where: {
        auth0OrgId: args.auth0OrgId,
      },
    })

    if (organization) {
      const user = await prisma.user.create({
        data: {
          orgId: organization.id,
          auth0UserId: args.subject,
          name: args.name.trim() || email.split('@')[0] || 'ProxKey User',
          email,
          passwordHash: null,
          role: UserRole.EMPLOYEE,
          status: UserStatus.ACTIVE,
          lastActive: new Date(),
        },
      })

      await ensureOrganizationMembership({
        organizationId: organization.id,
        userId: user.id,
        role: user.role,
      })

      return user
    }
  }

  if (!args.organizationName?.trim()) {
    throw new Error('No ProxKey workspace exists for this Auth0 identity yet. Start with sign up.')
  }

  const existingOrganization = await prisma.organization.findFirst({
    where: { domain },
  })

  if (existingOrganization) {
    throw new Error(
      'This company workspace already exists. Ask an admin to invite you or sign in with the existing account.',
    )
  }

  const organization = await prisma.organization.create({
    data: {
      name: args.organizationName.trim(),
      domain,
      slug: createOrgSlug(args.organizationName),
      auth0OrgId: args.auth0OrgId ?? undefined,
      plan: args.plan ?? PlanTier.FREE,
      subscriptionStatus: args.plan && args.plan !== PlanTier.FREE ? 'TRIAL' : 'FREE',
    },
  })

  const user = await prisma.user.create({
    data: {
      orgId: organization.id,
      auth0UserId: args.subject,
      name: args.name.trim() || email.split('@')[0] || 'ProxKey User',
      email,
      passwordHash: null,
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
      lastActive: new Date(),
    },
  })

  await prisma.organization.update({
    where: { id: organization.id },
    data: { createdByUserId: user.id },
  })

  await ensureOrganizationMembership({
    organizationId: organization.id,
    userId: user.id,
    role: user.role,
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

  if (bearer && !headerApiKey) {
    try {
      const identity = await verifyAuth0AccessToken({
        accessToken: bearer,
        config,
      })

      if (!identity.subject) {
        return null
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [{ auth0UserId: identity.subject }, { email: identity.email }],
        },
      })

      if (user && user.status !== UserStatus.DISABLED) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            auth0UserId: identity.subject,
            lastActive: new Date(),
          },
        })

        return {
          id: user.id,
          orgId: user.orgId,
          email: user.email,
          role: user.role,
          status: user.status,
          name: user.name,
          authType: 'auth0',
          sessionId: null,
          token: bearer,
        }
      }
    } catch {
      // Fall through so legacy session tokens can still authenticate if Auth0 is not in play.
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
