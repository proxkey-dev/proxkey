import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma, authHeaders, createTestApp, registerUser, resetDatabase } from './helpers'

describe('reports', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates reports and allows the owner to read them', async () => {
    const app = await createTestApp()

    try {
      const owner = await registerUser(app, {
        email: 'owner-reports@example.com',
      })

      const createResponse = await app.inject({
        method: 'POST',
        url: '/reports',
        headers: authHeaders(owner),
        payload: {
          title: 'Escalated outage',
          rawText: 'Authorization: Bearer sk_live_secret and password=hunter2',
          sourceType: 'INCIDENT',
          metadata: { source: 'support' },
        },
      })

      expect(createResponse.statusCode).toBe(201)
      expect(createResponse.json().redactedText).toContain('[REDACTED_AUTH_HEADER]')

      const reportId = createResponse.json().id
      const readResponse = await app.inject({
        method: 'GET',
        url: `/reports/${reportId}`,
        headers: {
          cookie: owner.cookieHeader,
          'x-organization-id': owner.organizationId,
        },
      })

      expect(readResponse.statusCode).toBe(200)
      expect(readResponse.json().id).toBe(reportId)
    } finally {
      await app.close()
    }
  })

  it('denies report access across organizations', async () => {
    const app = await createTestApp()

    try {
      const owner = await registerUser(app, {
        email: 'tenant-a@example.com',
        organizationName: 'Tenant A',
      })
      const outsider = await registerUser(app, {
        email: 'tenant-b@example.com',
        organizationName: 'Tenant B',
      })

      const createResponse = await app.inject({
        method: 'POST',
        url: '/reports',
        headers: authHeaders(owner),
        payload: {
          title: 'Tenant A report',
          rawText: 'Customer says checkout fails with api_key=abc123',
          sourceType: 'SUPPORT_TICKET',
        },
      })

      const reportId = createResponse.json().id

      const readResponse = await app.inject({
        method: 'GET',
        url: `/reports/${reportId}`,
        headers: {
          cookie: outsider.cookieHeader,
          'x-organization-id': outsider.organizationId,
        },
      })

      expect(readResponse.statusCode).toBe(404)
    } finally {
      await app.close()
    }
  })

  it('rejects invalid and oversized report payloads', async () => {
    const app = await createTestApp()

    try {
      const owner = await registerUser(app, {
        email: 'payloads@example.com',
      })

      const invalidResponse = await app.inject({
        method: 'POST',
        url: '/reports',
        headers: authHeaders(owner),
        payload: {
          title: '',
          rawText: '',
          sourceType: 'INCIDENT',
        },
      })

      expect(invalidResponse.statusCode).toBe(400)
      expect(invalidResponse.json().error).toBe('VALIDATION_ERROR')

      const oversizedResponse = await app.inject({
        method: 'POST',
        url: '/reports',
        headers: authHeaders(owner),
        payload: {
          title: 'Large payload',
          rawText: 'x'.repeat(10_000),
          sourceType: 'INCIDENT',
        },
      })

      expect(oversizedResponse.statusCode).toBe(413)
      expect(oversizedResponse.json().error).toBe('PAYLOAD_TOO_LARGE')
    } finally {
      await app.close()
    }
  })
})
