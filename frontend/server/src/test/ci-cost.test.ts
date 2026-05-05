import { describe, expect, it } from 'vitest'
import { calculateGitHubActionsCostCents, detectWasteFlags, parseGitHubRunnerType } from '../proxkey/ci-cost'

describe('CI cost calculation', () => {
  it('uses GitHub Actions per-minute pricing and stores integer cents', () => {
    const startedAt = '2026-05-03T10:00:00.000Z'
    const finishedAt = '2026-05-03T10:10:00.000Z'

    expect(calculateGitHubActionsCostCents({ runnerType: 'ubuntu-latest', startedAt, finishedAt })).toBe(8)
    expect(calculateGitHubActionsCostCents({ runnerType: 'windows-latest', startedAt, finishedAt })).toBe(16)
    expect(calculateGitHubActionsCostCents({ runnerType: 'macos-latest', startedAt, finishedAt })).toBe(80)
  })

  it('rounds fractional cent bills up so spend is never understated', () => {
    expect(
      calculateGitHubActionsCostCents({
        runnerType: 'ubuntu-latest',
        startedAt: '2026-05-03T10:00:00.000Z',
        finishedAt: '2026-05-03T10:00:10.000Z',
      }),
    ).toBe(1)
  })

  it('parses hosted runner families from workflow labels', () => {
    expect(parseGitHubRunnerType(['self-hosted', 'macos-13-xlarge'])).toBe('macos-latest')
    expect(parseGitHubRunnerType(['windows-latest'])).toBe('windows-latest')
    expect(parseGitHubRunnerType(['ubuntu-latest'])).toBe('ubuntu-latest')
  })
})

describe('waste flag detection', () => {
  it('detects docs-only full CI runs, flaky tests, oversized runners, redundant matrices, and cache churn', () => {
    const findings = detectWasteFlags({
      changedFiles: ['docs/readme.md', 'CHANGELOG.md'],
      jobs: [
        { name: 'test node 20', conclusion: 'SUCCESS', durationSeconds: 60, costCents: 12, runnerSize: 'large', cacheRestored: false },
        { name: 'test node 20', conclusion: 'SUCCESS', durationSeconds: 58, costCents: 12, runnerSize: 'large', cacheRestored: false },
        { name: 'test node 20', conclusion: 'SUCCESS', durationSeconds: 62, costCents: 12, runnerSize: 'large', cacheRestored: false },
        { name: 'test node 20', conclusion: 'SUCCESS', durationSeconds: 59, costCents: 12, runnerSize: 'large', cacheRestored: false },
        { name: 'lint', conclusion: 'SUCCESS', durationSeconds: 42, costCents: 6, runnerSize: 'standard', cacheRestored: true },
      ],
      tests: [
        {
          suite: 'auth',
          name: 'refresh token retries expired sessions',
          runs30d: 10,
          failedRuns30d: 5,
        },
      ],
    })

    expect(findings.map((finding) => finding.type)).toEqual(
      expect.arrayContaining([
        'DOCS_ONLY_TRIGGER',
        'ALWAYS_FLAKY_TEST',
        'OVERSIZED_RUNNER',
        'REDUNDANT_MATRIX',
        'CACHE_MISS_CHURN',
      ]),
    )
  })

  it('does not flag mixed source changes as docs-only', () => {
    const findings = detectWasteFlags({
      changedFiles: ['docs/readme.md', 'src/index.ts'],
      jobs: [
        { name: 'test', conclusion: 'SUCCESS', durationSeconds: 300, costCents: 8, runnerSize: 'standard' },
      ],
      tests: [],
    })

    expect(findings.some((finding) => finding.type === 'DOCS_ONLY_TRIGGER')).toBe(false)
  })
})
