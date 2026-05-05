import { describe, expect, it } from 'vitest'
import Fastify from 'fastify'
import { registerIncidentAttributionRoutes } from '../routes/incident-attribution.routes'
import type { AppServices, RouteGuards } from '../routes/types'
import { IncidentAttributionService } from '../services/incident-attribution.service'

function at(hour: number, minute: number): Date {
  return new Date(Date.UTC(2026, 4, 1, hour, minute))
}

describe('IncidentAttributionService', () => {
  it('ranks the delayed dependency deploy above concurrent same-service and unrelated deploys', () => {
    const service = new IncidentAttributionService()

    const result = service.rank({
      incidentId: 'inc-2026-05-01-checkout-5xx',
      primaryService: 'checkout',
      startedAt: at(13, 18),
      detectedAt: at(13, 24),
      serviceDependencies: {
        'api-gateway': ['checkout', 'identity', 'search'],
        checkout: ['payments', 'inventory', 'identity'],
        payments: ['ledger'],
        notifications: ['email'],
        search: ['catalog'],
      },
      deploys: [
        {
          deployId: 'dep-001',
          commitHash: 'a11ce01',
          pr: 'PR-231',
          service: 'identity',
          deployedAt: at(10, 0),
        },
        {
          deployId: 'dep-002',
          commitHash: 'b00c042',
          pr: 'PR-232',
          service: 'checkout',
          deployedAt: at(10, 4),
        },
        {
          deployId: 'dep-003',
          commitHash: 'cafe777',
          pr: 'PR-233',
          service: 'payments',
          deployedAt: at(10, 20),
        },
        {
          deployId: 'dep-004',
          commitHash: 'deed404',
          pr: 'PR-234',
          service: 'search',
          deployedAt: at(12, 45),
        },
        {
          deployId: 'dep-005',
          commitHash: 'ee11e55',
          pr: 'PR-235',
          service: 'notifications',
          deployedAt: at(13, 0),
        },
      ],
      signals: [
        {
          signalId: 'sig-001',
          service: 'checkout',
          timestamp: at(13, 18),
          kind: 'error_rate',
          severity: 0.96,
          description: 'checkout 5xx rate jumped from 0.2% to 14%',
        },
        {
          signalId: 'sig-002',
          service: 'payments',
          timestamp: at(13, 20),
          kind: 'error_rate',
          severity: 0.92,
          description: 'payments authorization errors increased after cache rollover',
        },
        {
          signalId: 'sig-003',
          service: 'api-gateway',
          timestamp: at(13, 24),
          kind: 'latency',
          severity: 0.72,
          description: 'p95 latency for checkout route exceeded alert threshold',
        },
        {
          signalId: 'sig-004',
          service: 'checkout',
          timestamp: at(13, 25),
          kind: 'alert',
          severity: 1,
          description: 'PagerDuty alert for checkout availability',
        },
      ],
    })

    expect(result.rankedCommits[0]).toMatchObject({
      commitHash: 'cafe777',
      service: 'payments',
      rank: 1,
    })
    expect(result.rankedCommits[0].confidence).toBeGreaterThan(result.rankedCommits[1].confidence)
    expect(result.unknownConfidence).toBeGreaterThan(0)
    expect(result.rankedCommits.at(-1)).toMatchObject({
      commitHash: 'ee11e55',
      service: 'notifications',
    })
  })

  it('returns unknown when no deploy falls inside the candidate window', () => {
    const service = new IncidentAttributionService()

    const result = service.rank({
      incidentId: 'inc-no-recent-deploy',
      primaryService: 'checkout',
      startedAt: at(13, 18),
      detectedAt: at(13, 24),
      serviceDependencies: {
        checkout: ['payments'],
      },
      deploys: [
        {
          deployId: 'dep-old',
          commitHash: 'old111',
          pr: 'PR-100',
          service: 'payments',
          deployedAt: at(1, 0),
        },
      ],
      signals: [
        {
          signalId: 'sig-001',
          service: 'checkout',
          timestamp: at(13, 18),
          kind: 'error_rate',
          severity: 1,
          description: 'checkout errors',
        },
      ],
    })

    expect(result.unknownConfidence).toBe(1)
    expect(result.rankedCommits).toEqual([])
  })
})

describe('incident attribution route', () => {
  it('validates and scores a rank request through Fastify', async () => {
    const app = Fastify({ logger: false })
    const noOpGuard = async () => {}
    const guards: RouteGuards = {
      authenticate: noOpGuard,
      requireCsrf: noOpGuard,
      useCurrentOrganization: noOpGuard,
      useOrganizationParam: noOpGuard,
      triageRateLimit: noOpGuard,
      authorize: () => noOpGuard,
    }

    registerIncidentAttributionRoutes(
      app,
      {
        incidentAttributionService: new IncidentAttributionService(),
      } as AppServices,
      guards,
    )

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/incident-attribution/rank',
        payload: {
          incidentId: 'inc-route-test',
          primaryService: 'checkout',
          startedAt: at(13, 18).toISOString(),
          detectedAt: at(13, 24).toISOString(),
          serviceDependencies: {
            checkout: ['payments'],
          },
          deploys: [
            {
              deployId: 'dep-001',
              commitHash: 'cafe777',
              pr: 'PR-233',
              service: 'payments',
              deployedAt: at(10, 20).toISOString(),
            },
          ],
          signals: [
            {
              signalId: 'sig-001',
              service: 'checkout',
              timestamp: at(13, 18).toISOString(),
              kind: 'error_rate',
              severity: 0.95,
              description: 'checkout 5xx spike',
            },
          ],
        },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().rankedCommits[0]).toMatchObject({
        commitHash: 'cafe777',
        rank: 1,
      })
    } finally {
      await app.close()
    }
  })
})
