export type CostInput = {
  runnerType: string | null | undefined
  startedAt: Date | string | null | undefined
  finishedAt: Date | string | null | undefined
}

export type WasteFlagType =
  | 'DOCS_ONLY_TRIGGER'
  | 'ALWAYS_FLAKY_TEST'
  | 'OVERSIZED_RUNNER'
  | 'REDUNDANT_MATRIX'
  | 'CACHE_MISS_CHURN'

export type WasteDetectionJob = {
  name: string
  conclusion: string | null
  durationSeconds: number | null
  costCents: number
  runnerSize?: string | null
  cacheRestored?: boolean | null
}

export type WasteDetectionTest = {
  suite: string
  name: string
  runs30d: number
  failedRuns30d: number
}

export type WasteDetectionInput = {
  changedFiles: string[]
  jobs: WasteDetectionJob[]
  tests: WasteDetectionTest[]
}

export type WasteFinding = {
  type: WasteFlagType
  savingsCents: number
  recommendation: string
  evidence: Record<string, unknown>
}

const githubRunnerMilliCentsPerMinute: Record<string, number> = {
  'ubuntu-latest': 800,
  'windows-latest': 1600,
  'macos-latest': 8000,
}

export function parseGitHubRunnerType(labels: Array<string | null | undefined> = []): string {
  const joined = labels.filter(Boolean).join(' ').toLowerCase()

  if (joined.includes('macos')) {
    return 'macos-latest'
  }

  if (joined.includes('windows')) {
    return 'windows-latest'
  }

  return 'ubuntu-latest'
}

export function parseRunnerSize(labels: Array<string | null | undefined> = []): string {
  const joined = labels.filter(Boolean).join(' ').toLowerCase()

  if (joined.includes('xlarge') || joined.includes('16-core') || joined.includes('macos-13-xl')) {
    return 'xlarge'
  }

  if (joined.includes('large') || joined.includes('8-core') || joined.includes('4-core')) {
    return 'large'
  }

  return 'standard'
}

export function calculateDurationSeconds(startedAt: Date | string | null | undefined, finishedAt: Date | string | null | undefined): number | null {
  if (!startedAt || !finishedAt) {
    return null
  }

  const start = new Date(startedAt).getTime()
  const finish = new Date(finishedAt).getTime()

  if (!Number.isFinite(start) || !Number.isFinite(finish) || finish <= start) {
    return null
  }

  return Math.ceil((finish - start) / 1000)
}

export function calculateGitHubActionsCostCents(input: CostInput): number {
  const durationSeconds = calculateDurationSeconds(input.startedAt, input.finishedAt)

  if (!durationSeconds) {
    return 0
  }

  const runnerType = input.runnerType ?? 'ubuntu-latest'
  const rateMilliCents = githubRunnerMilliCentsPerMinute[runnerType] ?? githubRunnerMilliCentsPerMinute['ubuntu-latest']
  const billedMinutes = Math.max(1, Math.ceil(durationSeconds / 60))

  return Math.ceil((billedMinutes * rateMilliCents) / 1000)
}

export function normalizeBuildConclusion(value: string | null | undefined): 'SUCCESS' | 'FAILURE' | 'CANCELLED' | 'FLAKY' | null {
  const normalized = value?.toLowerCase()

  if (normalized === 'success') {
    return 'SUCCESS'
  }

  if (normalized === 'cancelled' || normalized === 'skipped') {
    return 'CANCELLED'
  }

  if (normalized === 'failure' || normalized === 'timed_out' || normalized === 'startup_failure') {
    return 'FAILURE'
  }

  if (normalized === 'flaky') {
    return 'FLAKY'
  }

  return null
}

function isDocsOnlyFile(path: string): boolean {
  const normalized = path.trim().toLowerCase()
  return normalized.endsWith('.md') || normalized.endsWith('.txt') || normalized.startsWith('docs/')
}

function totalJobCost(jobs: WasteDetectionJob[]): number {
  return jobs.reduce((sum, job) => sum + Math.max(0, job.costCents), 0)
}

export function detectWasteFlags(input: WasteDetectionInput): WasteFinding[] {
  const findings: WasteFinding[] = []
  const spendCents = totalJobCost(input.jobs)

  if (input.changedFiles.length > 0 && input.changedFiles.every(isDocsOnlyFile) && input.jobs.length > 1) {
    findings.push({
      type: 'DOCS_ONLY_TRIGGER',
      savingsCents: spendCents,
      recommendation: 'Add path filters so docs and text-only changes run a narrow CI workflow.',
      evidence: { changedFiles: input.changedFiles, jobCount: input.jobs.length },
    })
  }

  const flakyTests = input.tests.filter((test) => {
    if (test.runs30d < 5) {
      return false
    }

    return test.failedRuns30d / test.runs30d > 0.4
  })

  if (flakyTests.length > 0) {
    findings.push({
      type: 'ALWAYS_FLAKY_TEST',
      savingsCents: Math.max(1, Math.round(spendCents * 0.2)),
      recommendation: 'Quarantine or fix tests with a failure rate above 40% over the last 30 days.',
      evidence: { tests: flakyTests },
    })
  }

  const oversizedJobs = input.jobs.filter((job) => {
    const duration = job.durationSeconds ?? Number.POSITIVE_INFINITY
    const runnerSize = job.runnerSize?.toLowerCase() ?? ''
    return duration < 120 && ['large', 'xlarge'].includes(runnerSize)
  })

  if (oversizedJobs.length > 0) {
    findings.push({
      type: 'OVERSIZED_RUNNER',
      savingsCents: oversizedJobs.reduce((sum, job) => sum + Math.max(1, Math.round(job.costCents * 0.5)), 0),
      recommendation: 'Move short jobs off large runners unless they are CPU-bound.',
      evidence: { jobs: oversizedJobs.map((job) => job.name) },
    })
  }

  const jobOutcomeCounts = new Map<string, number>()
  for (const job of input.jobs) {
    const key = `${job.name}:${job.conclusion ?? 'unknown'}`
    jobOutcomeCounts.set(key, (jobOutcomeCounts.get(key) ?? 0) + 1)
  }

  const redundantEntries = [...jobOutcomeCounts.entries()].filter(([, count]) => count > 3)
  if (redundantEntries.length > 0) {
    findings.push({
      type: 'REDUNDANT_MATRIX',
      savingsCents: Math.max(1, Math.round(spendCents * 0.35)),
      recommendation: 'Collapse matrix axes that produce identical jobs with the same outcome in one PR.',
      evidence: { redundantEntries },
    })
  }

  const cacheSignals = input.jobs.filter((job) => typeof job.cacheRestored === 'boolean')
  const cacheMisses = cacheSignals.filter((job) => job.cacheRestored === false)
  if (cacheSignals.length >= 5 && cacheMisses.length / cacheSignals.length > 0.6) {
    findings.push({
      type: 'CACHE_MISS_CHURN',
      savingsCents: Math.max(1, Math.round(spendCents * 0.15)),
      recommendation: 'Key caches by lockfile and restore the nearest branch cache before falling back to cold installs.',
      evidence: { cacheMisses: cacheMisses.length, cacheSignals: cacheSignals.length },
    })
  }

  return findings
}
