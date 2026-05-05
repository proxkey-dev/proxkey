import type { FastifyInstance } from 'fastify'
import { PrismaClient, type OrganizationRole } from '@prisma/client'
import { buildApp } from '../app'
import { loadEnv } from '../config/env'
import { MockProvider } from '../services/providers/mock.provider'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://proxkey:proxkey@localhost:5433/proxkey_test?schema=public'
process.env.CONTENT_ENCRYPTION_KEY =
  process.env.CONTENT_ENCRYPTION_KEY ?? 'Qk+hyRQmWW8Xtm3t0BvX2mMOjXrVxZwh6dm2J+G0VvA='
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:3000'
process.env.LLM_PROVIDER = 'mock'

export const testEnv = loadEnv({
  ...process.env,
  NODE_ENV: 'test',
  BODY_LIMIT_BYTES: '2048',
})

export const prisma = new PrismaClient()

export async function resetDatabase(): Promise<void> {
  await prisma.idempotencyKey.deleteMany()
  await prisma.usageEvent.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.integrationConnection.deleteMany()
  await prisma.triageResult.deleteMany()
  await prisma.report.deleteMany()
  await prisma.session.deleteMany()
  await prisma.organizationMember.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.user.deleteMany()
}

export async function createTestApp(
  mode: 'success' | 'invalid-json-once' | 'always-invalid-json' | 'throw' = 'success',
): Promise<FastifyInstance> {
  return buildApp({
    env: testEnv,
    prisma,
    llmProvider: new MockProvider(mode),
    logger: false,
  })
}

function setCookieHeaderToMap(
  setCookieHeader: string[] | string | undefined,
): Record<string, string> {
  if (!setCookieHeader) {
    return {}
  }

  const items = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]

  return Object.fromEntries(
    items.map((value) => {
      const [pair] = value.split(';')
      const [name, ...rest] = pair.split('=')
      return [name, rest.join('=')]
    }),
  )
}

function cookieMapToHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

export async function registerUser(
  app: FastifyInstance,
  input: {
    email: string
    password?: string
    name?: string
    organizationName?: string
  },
): Promise<{
  cookieHeader: string
  csrfToken: string
  organizationId: string
  userId: string
}> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: input.email,
      password: input.password ?? 'ChangeMe123!',
      name: input.name ?? 'Test User',
      organizationName: input.organizationName ?? 'Test Org',
    },
  })

  const body = response.json()
  const cookies = setCookieHeaderToMap(response.headers['set-cookie'])

  return {
    cookieHeader: cookieMapToHeader(cookies),
    csrfToken: body.csrfToken,
    organizationId: body.organization.id,
    userId: body.user.id,
  }
}

export async function loginUser(
  app: FastifyInstance,
  input: {
    email: string
    password?: string
    organizationId?: string
  },
): Promise<{
  cookieHeader: string
  csrfToken: string
  organizationId: string
}> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: input.email,
      password: input.password ?? 'ChangeMe123!',
      organizationId: input.organizationId,
    },
  })

  const body = response.json()
  const cookies = setCookieHeaderToMap(response.headers['set-cookie'])

  return {
    cookieHeader: cookieMapToHeader(cookies),
    csrfToken: body.csrfToken,
    organizationId: body.organization.id,
  }
}

export function authHeaders(session: {
  cookieHeader: string
  csrfToken: string
  organizationId?: string
}): Record<string, string> {
  return {
    cookie: session.cookieHeader,
    'x-csrf-token': session.csrfToken,
    ...(session.organizationId ? { 'x-organization-id': session.organizationId } : {}),
  }
}

export async function inviteAndRegisterMember(args: {
  app: FastifyInstance
  ownerSession: { cookieHeader: string; csrfToken: string; organizationId: string }
  email: string
  role: OrganizationRole
  password?: string
}): Promise<{
  memberSession: { cookieHeader: string; csrfToken: string; organizationId: string }
  invitedOrganizationId: string
}> {
  const inviteResponse = await args.app.inject({
    method: 'POST',
    url: `/organizations/${args.ownerSession.organizationId}/invite`,
    headers: authHeaders(args.ownerSession),
    payload: {
      email: args.email,
      role: args.role,
    },
  })

  if (inviteResponse.statusCode !== 201) {
    throw new Error(`Invite failed: ${inviteResponse.statusCode}`)
  }

  await registerUser(args.app, {
    email: args.email,
    password: args.password,
    name: args.role.toLowerCase(),
    organizationName: `${args.role.toLowerCase()} org`,
  })

  const memberSession = await loginUser(args.app, {
    email: args.email,
    password: args.password,
    organizationId: args.ownerSession.organizationId,
  })

  return {
    memberSession,
    invitedOrganizationId: args.ownerSession.organizationId,
  }
}
