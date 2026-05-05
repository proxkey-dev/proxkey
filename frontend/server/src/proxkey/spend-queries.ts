import type { PrismaClient } from '@prisma/client'

export function startOfMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export function percentageDelta(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100
  }

  return Number((((current - previous) / previous) * 100).toFixed(1))
}

export async function getSpendSummary(prisma: PrismaClient, orgId: string) {
  const monthStart = startOfMonth()
  const currentWeekStart = daysAgo(7)
  const previousWeekStart = daysAgo(14)
  const [month, currentWeek, previousWeek] = await Promise.all([
    prisma.build.aggregate({
      where: { orgId, deletedAt: null, startedAt: { gte: monthStart } },
      _sum: { costCents: true },
      _count: true,
    }),
    prisma.build.aggregate({
      where: { orgId, deletedAt: null, startedAt: { gte: currentWeekStart } },
      _sum: { costCents: true },
    }),
    prisma.build.aggregate({
      where: { orgId, deletedAt: null, startedAt: { gte: previousWeekStart, lt: currentWeekStart } },
      _sum: { costCents: true },
    }),
  ])

  const currentWeekSpend = currentWeek._sum.costCents ?? 0
  const previousWeekSpend = previousWeek._sum.costCents ?? 0

  return {
    totalSpendCents: month._sum.costCents ?? 0,
    buildCount: month._count,
    wowDeltaPercent: percentageDelta(currentWeekSpend, previousWeekSpend),
    currentWeekSpendCents: currentWeekSpend,
    previousWeekSpendCents: previousWeekSpend,
  }
}

export async function getSpendBreakdown(prisma: PrismaClient, orgId: string) {
  const monthStart = startOfMonth()
  const builds = await prisma.build.findMany({
    where: { orgId, deletedAt: null, startedAt: { gte: monthStart } },
    include: {
      repo: true,
      workflowJobs: true,
    },
    orderBy: { costCents: 'desc' },
  })

  const byRepo = new Map<string, { repoId: string; repoName: string; spendCents: number; builds: number }>()
  const byTeam = new Map<string, { team: string; spendCents: number; builds: number }>()
  const byAuthor = new Map<string, { author: string; spendCents: number; builds: number }>()
  const byWorkflow = new Map<string, { workflow: string; spendCents: number; jobs: number }>()

  for (const build of builds) {
    const repoEntry = byRepo.get(build.repoId) ?? {
      repoId: build.repoId,
      repoName: build.repo.name,
      spendCents: 0,
      builds: 0,
    }
    repoEntry.spendCents += build.costCents
    repoEntry.builds += 1
    byRepo.set(build.repoId, repoEntry)

    const team = build.team ?? 'Unassigned'
    const teamEntry = byTeam.get(team) ?? { team, spendCents: 0, builds: 0 }
    teamEntry.spendCents += build.costCents
    teamEntry.builds += 1
    byTeam.set(team, teamEntry)

    const author = build.triggeredBy ?? 'unknown'
    const authorEntry = byAuthor.get(author) ?? { author, spendCents: 0, builds: 0 }
    authorEntry.spendCents += build.costCents
    authorEntry.builds += 1
    byAuthor.set(author, authorEntry)

    for (const workflowJob of build.workflowJobs) {
      const workflowEntry = byWorkflow.get(workflowJob.name) ?? { workflow: workflowJob.name, spendCents: 0, jobs: 0 }
      workflowEntry.spendCents += workflowJob.costCents
      workflowEntry.jobs += 1
      byWorkflow.set(workflowJob.name, workflowEntry)
    }
  }

  return {
    byRepo: [...byRepo.values()],
    byTeam: [...byTeam.values()],
    byAuthor: [...byAuthor.values()],
    byWorkflow: [...byWorkflow.values()].sort((a, b) => b.spendCents - a.spendCents),
  }
}

const MS_DAY = 24 * 60 * 60 * 1000
const MS_WEEK = 7 * MS_DAY

function weekLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** Oldest → newest, each bucket is a 7-day window ending at `anchor`. */
export async function getWeeklySpendSeries(prisma: PrismaClient, orgId: string, weekCount: number) {
  const anchor = Date.now()
  const since = new Date(anchor - weekCount * MS_WEEK)
  const builds = await prisma.build.findMany({
    where: { orgId, deletedAt: null, startedAt: { gte: since } },
    select: { startedAt: true, costCents: true },
  })

  const series: Array<{ weekStart: string; weekLabel: string; spendCents: number }> = []

  for (let w = weekCount - 1; w >= 0; w -= 1) {
    const windowEnd = anchor - w * MS_WEEK
    const windowStart = windowEnd - MS_WEEK
    let spendCents = 0
    for (const b of builds) {
      const t = b.startedAt.getTime()
      if (t >= windowStart && t < windowEnd) {
        spendCents += b.costCents
      }
    }
    series.push({
      weekStart: new Date(windowStart).toISOString(),
      weekLabel: weekLabel(new Date(windowStart)),
      spendCents,
    })
  }

  return series
}

export async function getRepoWowMap(prisma: PrismaClient, orgId: string): Promise<Map<string, number>> {
  const since = daysAgo(14)
  const builds = await prisma.build.findMany({
    where: { orgId, deletedAt: null, startedAt: { gte: since } },
    select: { repoId: true, startedAt: true, costCents: true },
  })

  const now = Date.now()
  const curStart = now - MS_WEEK
  const prevStart = now - 2 * MS_WEEK

  const current = new Map<string, number>()
  const previous = new Map<string, number>()

  for (const b of builds) {
    const t = b.startedAt.getTime()
    if (t >= curStart) {
      current.set(b.repoId, (current.get(b.repoId) ?? 0) + b.costCents)
    } else if (t >= prevStart && t < curStart) {
      previous.set(b.repoId, (previous.get(b.repoId) ?? 0) + b.costCents)
    }
  }

  const out = new Map<string, number>()
  const repoIds = new Set([...current.keys(), ...previous.keys()])
  for (const id of repoIds) {
    out.set(id, percentageDelta(current.get(id) ?? 0, previous.get(id) ?? 0))
  }
  return out
}

export async function getRepoDailySpend30d(prisma: PrismaClient, orgId: string, repoId: string) {
  const since = daysAgo(30)
  const builds = await prisma.build.findMany({
    where: { orgId, repoId, deletedAt: null, startedAt: { gte: since } },
    select: { startedAt: true, costCents: true },
  })

  const byDay = new Map<string, number>()
  for (const b of builds) {
    const key = b.startedAt.toISOString().slice(0, 10)
    byDay.set(key, (byDay.get(key) ?? 0) + b.costCents)
  }

  const series: Array<{ day: string; spendCents: number }> = []
  for (let i = 29; i >= 0; i -= 1) {
    const d = daysAgo(i)
    const key = d.toISOString().slice(0, 10)
    series.push({ day: key, spendCents: byDay.get(key) ?? 0 })
  }
  return series
}
