import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { errors } from "../../lib/errors.js";
import { authedOrg, daysAgo, startOfMonth } from "./_helpers.js";

const repoSpendParams = z.object({
  orgId: z.string().cuid(),
  repoId: z.string().cuid(),
});

export async function registerRepoRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/api/orgs/:orgId/repos", async (request) => {
    const { orgId } = await authedOrg(app, request);
    const monthStart = startOfMonth();

    const repos = await app.prisma.repo.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        name: true,
        fullName: true,
        defaultBranch: true,
        provider: true,
        createdAt: true,
      },
    });
    if (repos.length === 0) {
      return { rows: [] };
    }
    const repoIds = repos.map((r) => r.id);

    const [buildAgg, wasteAgg] = await Promise.all([
      app.prisma.build.groupBy({
        by: ["repoId"],
        where: {
          repoId: { in: repoIds },
          startedAt: { gte: monthStart },
        },
        _sum: { costCents: true },
        _count: { _all: true },
      }),
      // WasteFlag has no direct repoId column — go through build.
      app.prisma.wasteFlag.findMany({
        where: {
          orgId,
          resolvedAt: null,
          build: { repoId: { in: repoIds } },
        },
        select: { build: { select: { repoId: true } } },
      }),
    ]);

    const aggByRepo = new Map(buildAgg.map((row) => [row.repoId, row]));
    const wasteCountByRepo = new Map<string, number>();
    for (const w of wasteAgg) {
      const repoId = w.build?.repoId;
      if (!repoId) continue;
      wasteCountByRepo.set(repoId, (wasteCountByRepo.get(repoId) ?? 0) + 1);
    }

    return {
      rows: repos.map((r) => {
        const agg = aggByRepo.get(r.id);
        return {
          id: r.id,
          name: r.fullName,
          defaultBranch: r.defaultBranch,
          provider: r.provider,
          createdAt: r.createdAt,
          monthlySpendCents: agg?._sum.costCents ?? 0,
          buildCount: agg?._count._all ?? 0,
          wasteFlagCount: wasteCountByRepo.get(r.id) ?? 0,
        };
      }),
    };
  });

  app.get("/api/orgs/:orgId/repos/:repoId/spend", async (request) => {
    await app.requireAuth(request);
    const params = repoSpendParams.parse(request.params);
    await app.requireOrgMembership(request, params.orgId);

    const repo = await app.prisma.repo.findFirst({
      where: { id: params.repoId, orgId: params.orgId, deletedAt: null },
      select: { id: true, fullName: true },
    });
    if (!repo) throw errors.notFound();

    const since = daysAgo(30);
    const builds = await app.prisma.build.findMany({
      where: {
        repoId: params.repoId,
        startedAt: { gte: since },
      },
      select: { startedAt: true, costCents: true },
    });

    const buckets = new Map<
      string,
      { costCents: number; buildCount: number }
    >();
    for (let i = 29; i >= 0; i--) {
      buckets.set(daysAgo(i).toISOString().slice(0, 10), {
        costCents: 0,
        buildCount: 0,
      });
    }
    for (const b of builds) {
      const key = b.startedAt.toISOString().slice(0, 10);
      const slot = buckets.get(key) ?? { costCents: 0, buildCount: 0 };
      slot.costCents += b.costCents;
      slot.buildCount += 1;
      buckets.set(key, slot);
    }

    return {
      repo: { id: repo.id, name: repo.fullName },
      buckets: [...buckets.entries()]
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    };
  });
}
