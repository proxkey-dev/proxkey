import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma, createTestApp, loginUser, registerUser, resetDatabase } from './helpers'

describe('auth', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('registers users and hashes passwords with argon2id', async () => {
    const app = await createTestApp()

    try {
      const session = await registerUser(app, {
        email: 'owner@example.com',
      })

      expect(session.cookieHeader).toContain('proxkey_session=')
      expect(session.csrfToken.length).toBeGreaterThan(20)

      const storedUser = await prisma.user.findUnique({
        where: { email: 'owner@example.com' },
      })

      expect(storedUser).not.toBeNull()
      expect(storedUser?.passwordHash).not.toBe('ChangeMe123!')
      expect(storedUser?.passwordHash.startsWith('$argon2id$')).toBe(true)
    } finally {
      await app.close()
    }
  })

  it('logs in valid users and rejects invalid credentials', async () => {
    const app = await createTestApp()

    try {
      await registerUser(app, {
        email: 'login@example.com',
      })

      const validLogin = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'login@example.com',
          password: 'ChangeMe123!',
        },
      })

      expect(validLogin.statusCode).toBe(200)
      expect(validLogin.json().csrfToken).toBeTruthy()

      const invalidLogin = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'login@example.com',
          password: 'wrong-password-value',
        },
      })

      expect(invalidLogin.statusCode).toBe(401)
      expect(invalidLogin.json().error).toBe('UNAUTHORIZED')
    } finally {
      await app.close()
    }
  })

  it('returns the authenticated user via /auth/me', async () => {
    const app = await createTestApp()

    try {
      await registerUser(app, {
        email: 'me@example.com',
        organizationName: 'Me Org',
      })

      const session = await loginUser(app, {
        email: 'me@example.com',
      })

      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: {
          cookie: session.cookieHeader,
          'x-organization-id': session.organizationId,
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().user.email).toBe('me@example.com')
      expect(response.json().organization.id).toBe(session.organizationId)
    } finally {
      await app.close()
    }
  })
})
