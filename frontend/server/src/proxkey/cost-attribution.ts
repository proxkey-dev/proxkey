import { Prisma, type PrismaClient, WasteFlagStatus, type WasteFlagType as PrismaWasteFlagType } from '@prisma/client'
import { detectWasteFlags, type WasteDetectionTest } from './ci-cost'
import type { CostAttributionJob } from './ci-queue'

function asStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function buildTestHistory(args: {
  tests: Array<{
    suite: string
    name: string
    status: string
    flakyCount30d: number
  }>
}): WasteDetectionTest[] {
  return args.tests.map((test) => {
    const inferredFailures = test.status === 'FLAKY' || test.status === 'FAIL' ? Math.max(1, test.flakyCount30d) : test.flakyCount30d
    const runs30d = Math.max(5, Math.ceil(inferredFailures / 0.45))

    return {
      suite: test.suite,
      name: test.name,
      runs30d,
      failedRuns30d: inferredFailures,
    }
  })
}

export async function runCostAttribution(prisma: PrismaClient, job: CostAttributionJob): Promise<void> {
  const build = await prisma.build.findUnique({
    where: { id: job.buildId },
    include: {
      workflowJobs: true,
      testResults: true,
    },
  })

  if (!build) {
    return
  }

  const totalJobCostCents = build.workflowJobs.reduce((sum, workflowJob) => sum + workflowJob.costCents, 0)
  const startedTimes = build.workflowJobs.map((workflowJob) => workflowJob.startedAt?.getTime()).filter((value): value is number => typeof value === 'number')
  const finishedTimes = build.workflowJobs.map((workflowJob) => workflowJob.finishedAt?.getTime()).filter((value): value is number => typeof value === 'number')
  const durationSeconds =
    startedTimes.length > 0 && finishedTimes.length > 0
      ? Math.ceil((Math.max(...finishedTimes) - Math.min(...startedTimes)) / 1000)
      : build.durationSeconds

  await prisma.build.update({
    where: { id: build.id },
    data: {
      costCents: totalJobCostCents || build.costCents,
      durationSeconds,
    },
  })

  const findings = detectWasteFlags({
    changedFiles: asStringArray(build.changedFiles),
    jobs: build.workflowJobs.map((workflowJob) => ({
      name: workflowJob.name,
      conclusion: workflowJob.conclusion,
      durationSeconds: workflowJob.durationSeconds,
      costCents: workflowJob.costCents,
      runnerSize: workflowJob.runnerSize,
      cacheRestored:
        typeof workflowJob.name === 'string' && workflowJob.name.toLowerCase().includes('cache miss')
          ? false
          : undefined,
    })),
    tests: buildTestHistory({
      tests: build.testResults.map((test) => ({
        suite: test.suite,
        name: test.name,
        status: test.status,
        flakyCount30d: test.flakyCount30d,
      })),
    }),
  })

  await Promise.all(
    findings.map((finding) =>
      prisma.wasteFlag.upsert({
        where: {
          repoId_buildId_type: {
            repoId: build.repoId,
            buildId: build.id,
            type: finding.type as PrismaWasteFlagType,
          },
        },
        update: {
          status: WasteFlagStatus.ACTIVE,
          savingsCents: finding.savingsCents,
          lastSeenAt: new Date(),
          recommendation: finding.recommendation,
          evidenceJson: finding.evidence as Prisma.InputJsonObject,
        },
        create: {
          orgId: build.orgId,
          repoId: build.repoId,
          buildId: build.id,
          type: finding.type as PrismaWasteFlagType,
          savingsCents: finding.savingsCents,
          recommendation: finding.recommendation,
          evidenceJson: finding.evidence as Prisma.InputJsonObject,
        },
      }),
    ),
  )
}
