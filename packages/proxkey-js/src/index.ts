export type GenerateInput = {
  rawInput: string
  source?: 'manual' | 'support' | 'qa' | 'incident' | 'log' | 'other'
}

export type TriagePacket = {
  id?: string
  title: string
  summary: string
  severity: 'SEV-1' | 'SEV-2' | 'SEV-3' | 'SEV-4'
  confidence: number
  affected_component: string
  user_impact: string
  environment: string
  reproduction_steps: string[]
  expected_behavior: string
  actual_behavior: string
  evidence: string[]
  suspected_root_causes: string[]
  missing_information: string[]
  recommended_next_actions: string[]
  suggested_owner: string
  engineering_handoff: string
  support_response: string
  tags: string[]
}

export type UpdateInput = {
  summary?: string
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  component?: string
  reproSteps?: string[]
  missingInfo?: string[]
  nextAction?: string
  suggestedOwnerId?: string | null
  status?: 'TRIAGED' | 'NEEDS_REVIEW' | 'ASSIGNED' | 'RESOLVED'
}

export function createClient(args: { apiKey?: string; baseUrl?: string }) {
  const baseUrl = (args.baseUrl ?? 'http://localhost:4000').replace(/\/$/, '')
  const apiKey = args.apiKey

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('accept', 'application/json')
    if (apiKey) {
      headers.set('authorization', `Bearer ${apiKey}`)
    }
    if (init.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error((data as { error?: string } | null)?.error ?? 'Request failed')
    }

    return data as T
  }

  return {
    triage: {
      generate(input: GenerateInput) {
        return request<TriagePacket>('/api/triage/generate', {
          method: 'POST',
          body: JSON.stringify({
            raw_input: input.rawInput,
            source: input.source ?? 'manual',
          }),
        })
      },
      async get(id: string) {
        return request(`/api/reports/${id}`)
      },
      async list() {
        return request('/api/reports')
      },
      async update(id: string, patch: UpdateInput) {
        return request(`/api/triage/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        })
      },
      async export(id: string, format: 'markdown' | 'github' | 'jira' | 'linear' | 'customer' = 'markdown') {
        const result = await request<{
          report: {
            id: string
            title: string
            triageResult: null | {
              summary: string
              severity: string
              component: string
              confidence: number
              nextAction: string
              reproSteps: string[]
              missingInfo: string[]
            }
          }
        }>(`/api/reports/${id}`)

        if (!result.report.triageResult) {
          throw new Error('Triage result not found.')
        }

        const triage = result.report.triageResult
        const repro = triage.reproSteps.map((step) => `- ${step}`).join('\n') || '- None'
        const missing = triage.missingInfo.map((item) => `- ${item}`).join('\n') || '- None'

        if (format === 'github') {
          return [`# ${result.report.title}`, '', triage.summary, '', '## Reproduction steps', repro].join('\n')
        }
        if (format === 'jira') {
          return [`Summary: ${result.report.title}`, `Severity: ${triage.severity}`, '', triage.summary].join('\n')
        }
        if (format === 'linear') {
          return [`${result.report.title}`, '', triage.summary, '', `Next action: ${triage.nextAction}`].join('\n')
        }
        if (format === 'customer') {
          return `Thanks for the report. The current next step is: ${triage.nextAction}`
        }

        return [
          `# ${result.report.title}`,
          '',
          `Severity: ${triage.severity}`,
          `Component: ${triage.component}`,
          `Confidence: ${Math.round(triage.confidence * 100)}%`,
          '',
          '## Summary',
          triage.summary,
          '',
          '## Reproduction steps',
          repro,
          '',
          '## Missing information',
          missing,
          '',
          '## Next action',
          triage.nextAction,
        ].join('\n')
      },
    },
  }
}
