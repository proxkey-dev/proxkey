import { OrganizationRole, ReportStatus } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  prisma,
  authHeaders,
  createTestApp,
  inviteAndRegisterMember,
  registerUser,
  resetDatabase,
} from './helpers'

async function createReport(
  app: Awaited<ReturnType<typeof createTestApp>>,
  owner: { cookieHeader: string; csrfToken: string; organizationId: string },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/reports',
    headers: authHeaders(owner),
    payload: {
      title: 'Timeout during checkout',
      rawText:
        'Authorization: Bearer sk_live_supersecret Customer says the payment step times out after submission.',
      sourceType: 'INCIDENT',
    },
  })

  return response.json().id as string
}

describe('triage', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('prevents viewers from running triage', async () => {
    const app = await createTestApp()

    try {
      const owner = await registerUser(app, {
        email: 'owner-triage@example.com',
      })
      const reportId = await createReport(app, owner)
      const { memberSession: viewer } = await inviteAndRegisterMember({
        app,
        ownerSession: owner,
        email: 'viewer-triage@example.com',
        role: OrganizationRole.VIEWER,
      })

      const response = await app.inject({
        method: 'POST',
        url: `/reports/${reportId}/triage`,
        headers: authHeaders(viewer),
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('FORBIDDEN')
    } finally {
      await app.close()
    }
  })

  it('allows members to run triage and marks reports TRIAGED', async () => {
    const app = await createTestApp()

    try {
      const owner = await registerUser(app, {
        email: 'owner-member-triage@example.com',
      })
      const reportId = await createReport(app, owner)
      const { memberSession } = await inviteAndRegisterMember({
        app,
        ownerSession: owner,
        email: 'member-triage@example.com',
        role: OrganizationRole.MEMBER,
      })

      const response = await app.inject({
        method: 'POST',
        url: `/reports/${reportId}/triage`,
        headers: {
          ...authHeaders(memberSession),
          'idempotency-key': 'triage-member-1',
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().state).toBe('completed')

      const report = await prisma.report.findUnique({
        where: { id: reportId },
      })

      expect(report?.status).toBe(ReportStatus.TRIAGED)
    } finally {
      await app.close()
    }
  })

  it('handles one invalid JSON retry without crashing the server', async () => {
    const app = await createTestApp('invalid-json-once')

    try {
      const owner = await registerUser(app, {
        email: 'invalid-json@example.com',
      })
      const reportId = await createReport(app, owner)

      const response = await app.inject({
        method: 'POST',
        url: `/reports/${reportId}/triage`,
        headers: authHeaders(owner),
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().state).toBe('completed')
    } finally {
      await app.close()
    }
  })

  it('marks reports FAILED when the LLM call fails', async () => {
    const app = await createTestApp('throw')

    try {
      const owner = await registerUser(app, {
        email: 'llm-failure@example.com',
      })
      const reportId = await createReport(app, owner)

      const response = await app.inject({
        method: 'POST',
        url: `/reports/${reportId}/triage`,
        headers: authHeaders(owner),
      })

      expect(response.statusCode).toBe(502)

      const report = await prisma.report.findUnique({
        where: { id: reportId },
      })

      expect(report?.status).toBe(ReportStatus.FAILED)
      expect(report?.failureReason).toBeTruthy()
    } finally {
      await app.close()
    }
  })

  it('does not create duplicate triage results for duplicate requests', async () => {
    const app = await createTestApp()

    try {
      const owner = await registerUser(app, {
        email: 'duplicate-triage@example.com',
      })
      const reportId = await createReport(app, owner)

      const first = await app.inject({
        method: 'POST',
        url: `/reports/${reportId}/triage`,
        headers: {
          ...authHeaders(owner),
          'idempotency-key': 'same-key',
        },
      })

      const second = await app.inject({
        method: 'POST',
        url: `/reports/${reportId}/triage`,
        headers: {
          ...authHeaders(owner),
          'idempotency-key': 'same-key',
        },
      })

      expect(first.statusCode).toBe(200)
      expect(second.statusCode).toBe(200)
      expect(second.json().idempotent).toBe(true)

      const triageResults = await prisma.triageResult.findMany({
        where: { reportId },
      })

      expect(triageResults).toHaveLength(1)
    } finally {
      await app.close()
    }
  })

  it('creates audit logs for sensitive actions', async () => {
    const app = await createTestApp()

    try {
      const owner = await registerUser(app, {
        email: 'audit@example.com',
      })
      const reportId = await createReport(app, owner)

      await app.inject({
        method: 'POST',
        url: `/reports/${reportId}/triage`,
        headers: authHeaders(owner),
      })

      const logs = await prisma.auditLog.findMany({
        where: { organizationId: owner.organizationId },
      })

      const actions = logs.map((entry) => entry.action)
      expect(actions).toContain('LOGIN')
      expect(actions).toContain('REPORT_CREATED')
      expect(actions).toContain('TRIAGE_RUN')
    } finally {
      await app.close()
    }
  })
})
