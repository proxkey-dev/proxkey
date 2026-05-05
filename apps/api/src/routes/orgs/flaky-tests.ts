import type { FastifyInstance } from "fastify";
import { authedOrg, daysAgo } from "./_helpers.js";

interface FlakyAccumulator {
  testName: string;
  suite: string;
  repoName: string;
  flakyCount30d: number;
  estimatedWasteCents: number;
  lastSeen: Date;
}

export async function registerFlakyTestRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/api/orgs/:orgId/flaky-tests", async (request) => {
    const { orgId } = await authedOrg(app, request);

    const tests = await app.prisma.testResult.findMany({
      where: {
        flakyCount30d: { gt: 3 },
        build: {
          startedAt: { gte: daysAgo(30) },
          repo: { orgId, deletedAt: null },
        },
      },
      include: {
        build: {
          select: {
            costCents: true,
            startedAt: true,
            repo: { select: { fullName: true } },
          },
        },
      },
    });

    // Group by (suite, name, repo). Estimate per-occurrence waste at
    // 10% of the build's cost — same heuristic the worker uses for
    // ALWAYS_FLAKY_TEST detection.
    const grouped = new Map<string, FlakyAccumulator>();
    for (const t of tests) {
      const key = `${t.suite}::${t.name}::${t.build.repo.fullName}`;
      const wasteIncrement = Math.max(
        1,
        Math.round(t.build.costCents * 0.1),
      );
      const existing = grouped.get(key);
      if (existing) {
        existing.flakyCount30d = Math.max(
          existing.flakyCount30d,
          t.flakyCount30d,
        );
        existing.estimatedWasteCents += wasteIncrement;
        if (t.build.startedAt > existing.lastSeen) {
          existing.lastSeen = t.build.startedAt;
        }
      } else {
        grouped.set(key, {
          testName: t.name,
          suite: t.suite,
          repoName: t.build.repo.fullName,
          flakyCount30d: t.flakyCount30d,
          estimatedWasteCents: wasteIncrement,
          lastSeen: t.build.startedAt,
        });
      }
    }

    const rows = [...grouped.values()]
      .sort((a, b) => b.estimatedWasteCents - a.estimatedWasteCents)
      .map((r) => ({ ...r, lastSeen: r.lastSeen.toISOString() }));

    return { rows };
  });
}
