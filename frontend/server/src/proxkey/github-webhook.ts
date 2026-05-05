import crypto from 'node:crypto'

export type GitHubRepositoryPayload = {
  id: number
  name: string
  full_name?: string
  default_branch?: string
  owner?: {
    login?: string
  }
}

export type GitHubWebhookPayload = {
  action?: string
  installation?: {
    id?: number
    account?: {
      login?: string
    }
  }
  organization?: {
    login?: string
  }
  repository?: GitHubRepositoryPayload
  workflow_run?: {
    id: number
    run_started_at?: string
    updated_at?: string
    created_at?: string
    head_branch?: string
    status?: string
    conclusion?: string | null
    actor?: {
      login?: string
    }
    pull_requests?: Array<{
      number?: number
    }>
  }
  workflow_job?: {
    id: number
    run_id: number
    name: string
    status?: string
    conclusion?: string | null
    started_at?: string | null
    completed_at?: string | null
    labels?: string[]
    runner_name?: string | null
    runner_group_name?: string | null
  }
  pull_request?: {
    number?: number
    head?: {
      ref?: string
    }
    user?: {
      login?: string
    }
  }
}

export function verifyGitHubSignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false
  }

  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`
  const expectedBytes = Buffer.from(expected)
  const actualBytes = Buffer.from(signatureHeader)

  if (expectedBytes.length !== actualBytes.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBytes, actualBytes)
}

export function getRepoDisplayName(repository: GitHubRepositoryPayload): string {
  return repository.full_name ?? repository.name
}
