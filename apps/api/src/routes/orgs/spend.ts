import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  authedOrg,
  daysAgo,
  percentageDelta,
  startOfMonth,
  startOfPrevMonth,
} from "./_helpers.js";

const breakdownQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d"]).default("30d"),
  groupBy: z.enum(["repo", "author", "workflow"]).default("repo"),
});

const PERIOD_DAYS: Record<"7d" | "30d" | "90d", number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

interface BreakdownAccumulator {
  costCents: number;
  buildCount: number;
  displayLabel: string;
}

function bucketStartOfWeek(d: Date): Date {
  const utc = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  // Monday-based ISO weeks.
  const offset = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - offset);
  return utc;
}

export async function registerSpendRoutes(
  app: FastifyInstance,
): Promise<void> {
  /** ----------- /spend/summary ----------- */
  app.get("/api/orgs/:orgId/spend/summary", async (request) => {
    const { orgId } = await authedOrg(app, request);

    const monthStart = startOfMonth();
    const prevMonthStart = startOfPrevMonth();

    const [thisMonth, lastMonth, twelveWeeks] = await Promise.all([
      app.prisma.build.aggregate({
        where: {
          repo: { orgId, deletedAt: null },
          startedAt: { gte: monthStart },
        },
        _sum: { costCents: true },
        _count: { id: true },
      }),
      app.prisma.build.aggregate({
        where: {
          repo: { orgId, deletedAt: null },
          startedAt: { gte: prevMonthStart, lt: monthStart },
        },
        _sum: { costCents: true },
      }),
      app.prisma.build.findMany({
        where: {
          repo: { orgId, deletedAt: null },
          startedAt: { gte: daysAgo(7 * 12) },
        },
        select: { costCents: true, startedAt: true },
      }),
    ]);

    const trendByWeek = new Map<string, number>();
    // Pre-seed last 12 weeks (incl. this one) with 0 so the response is
    // always exactly 12 entries even when there's no data.
    for (let i = 11; i >= 0; i--) {
      const weekStart = bucketStartOfWeek(daysAgo(i * 7));
      trendByWeek.set(weekStart.toISOString().slice(0, 10), 0);
    }
    for (const build of twelveWeeks) {
      const key = bucketStartOfWeek(build.startedAt)
        .toISOString()
        .slice(0, 10);
      if (trendByWeek.has(key)) {
        trendByWeek.set(key, (trendByWeek.get(key) ?? 0) + build.costCents);
      }
    }

    const weeklyTrend = [...trendByWeek.entries()]
      .map(([week, cents]) => ({ week, cents }))
      .sort((a, b) => (a.week < b.week ? -1 : 1));

    const n = weeklyTrend.length;
    const currentWeekCents = n > 0 ? weeklyTrend[n - 1]!.cents : 0;
    const previousWeekCents = n > 1 ? weeklyTrend[n - 2]!.cents : 0;

    return {
      thisMonthCents: thisMonth._sum.costCents ?? 0,
      lastMonthCents: lastMonth._sum.costCents ?? 0,
      weeklyTrend,
      buildCountThisMonth: thisMonth._count.id,
      wowWeekOverWeekPercent: percentageDelta(
        currentWeekCents,
        previousWeekCents,
      ),
      currentWeekCents,
      previousWeekCents,
    };
  });

  /** ----------- /spend/breakdown ----------- */
  app.get("/api/orgs/:orgId/spend/breakdown", async (request) => {
    const { orgId } = await authedOrg(app, request);
    const { period, groupBy } = breakdownQuerySchema.parse(request.query);
    const days = PERIOD_DAYS[period];
    const since = daysAgo(days);
    const previousSince = daysAgo(days * 2);

    const builds = await app.prisma.build.findMany({
      where: {
        repo: { orgId, deletedAt: null },
        startedAt: { gte: previousSince },
      },
      select: {
        id: true,
        costCents: true,
        triggeredBy: true,
        startedAt: true,
        repo: { select: { id: true, fullName: true } },
        jobs: {
          select: { name: true, costCents: true },
        },
      },
    });

    const current = new Map<string, BreakdownAccumulator>();
    const prior = new Map<string, BreakdownAccumulator>();

    const keysFromBuild = (
      build: (typeof builds)[number],
    ): Array<{ key: string; displayLabel: string; cents: number }> => {
      if (groupBy === "repo") {
        return [
          {
            key: `repo:${build.repo.id}`,
            displayLabel: build.repo.fullName,
            cents: build.costCents,
          },
        ];
      }
      if (groupBy === "author") {
        const label = build.triggeredBy ?? "(unknown)";
        return [{ key: `author:${label}`, displayLabel: label, cents: build.costCents }];
      }
      return build.jobs.map((j) => ({
        key: `workflow:${j.name}`,
        displayLabel: j.name,
        cents: j.costCents,
      }));
    };

    for (const build of builds) {
      const target = build.startedAt >= since ? current : prior;
      const seenKeys = new Set<string>();
      for (const entry of keysFromBuild(build)) {
        const acc = target.get(entry.key) ?? {
          costCents: 0,
          buildCount: 0,
          displayLabel: entry.displayLabel,
        };
        if (!acc.displayLabel) {
          acc.displayLabel = entry.displayLabel;
        }
        acc.costCents += entry.cents;
        if (!seenKeys.has(entry.key)) {
          acc.buildCount += 1;
          seenKeys.add(entry.key);
        }
        target.set(entry.key, acc);
      }
    }

    const rows = [...current.entries()]
      .map(([key, acc]) => {
        const previousCents = prior.get(key)?.costCents ?? 0;
        const repoId = groupBy === "repo" ? key.replace(/^repo:/, "") : undefined;
        return {
          key,
          repoId,
          repoName: groupBy === "repo" ? acc.displayLabel : undefined,
          label: acc.displayLabel,
          costCents: acc.costCents,
          buildCount: acc.buildCount,
          avgCostCents:
            acc.buildCount > 0
              ? Math.round(acc.costCents / acc.buildCount)
              : 0,
          deltaPercent: percentageDelta(acc.costCents, previousCents),
        };
      })
      .sort((a, b) => b.costCents - a.costCents);

    return { rows, groupBy };
  });
}
