import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@proxkey/db";
import { errors } from "../../lib/errors.js";
import { authedOrg, paginationQuery } from "./_helpers.js";

const buildQuerySchema = paginationQuery.extend({
  repoId: z.string().cuid().optional(),
  conclusion: z
    .enum(["SUCCESS", "FAILURE", "CANCELLED", "TIMED_OUT", "FLAKY"])
    .optional(),
  branch: z.string().min(1).max(255).optional(),
});

const buildIdParams = z.object({
  orgId: z.string().cuid(),
  buildId: z.string().cuid(),
});

export async function registerBuildRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/api/orgs/:orgId/builds", async (request) => {
    const { orgId } = await authedOrg(app, request);
    const q = buildQuerySchema.parse(request.query);

    const where: Prisma.BuildWhereInput = {
      repo: { orgId, deletedAt: null },
      ...(q.repoId ? { repoId: q.repoId } : {}),
      ...(q.conclusion ? { conclusion: q.conclusion } : {}),
      ...(q.branch ? { branch: q.branch } : {}),
    };

    const [rows, total] = await Promise.all([
      app.prisma.build.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        select: {
          id: true,
          externalId: true,
          branch: true,
          prNumber: true,
          prTitle: true,
          triggeredBy: true,
          status: true,
          conclusion: true,
          startedAt: true,
          finishedAt: true,
          durationSeconds: true,
          costCents: true,
          repo: { select: { id: true, fullName: true } },
          _count: {
            select: {
              jobs: true,
              wasteFlags: { where: { resolvedAt: null } },
            },
          },
        },
      }),
      app.prisma.build.count({ where }),
    ]);

    return {
      rows: rows.map((b) => ({
        id: b.id,
        externalId: b.externalId,
        branch: b.branch,
        prNumber: b.prNumber,
        prTitle: b.prTitle,
        triggeredBy: b.triggeredBy,
        status: b.status,
        conclusion: b.conclusion,
        startedAt: b.startedAt,
        finishedAt: b.finishedAt,
        durationSeconds: b.durationSeconds,
        costCents: b.costCents,
        jobCount: b._count.jobs,
        wasteFlagCount: b._count.wasteFlags,
        repo: { id: b.repo.id, name: b.repo.fullName },
      })),
      page: q.page,
      limit: q.limit,
      total,
    };
  });

  app.get("/api/orgs/:orgId/builds/:buildId", async (request) => {
    await app.requireAuth(request);
    const params = buildIdParams.parse(request.params);
    await app.requireOrgMembership(request, params.orgId);

    const build = await app.prisma.build.findFirst({
      where: {
        id: params.buildId,
        repo: { orgId: params.orgId, deletedAt: null },
      },
      include: {
        repo: {
          select: {
            id: true,
            name: true,
            fullName: true,
            defaultBranch: true,
            orgId: true,
          },
        },
        jobs: {
          orderBy: { startedAt: "asc" },
          select: {
            id: true,
            externalId: true,
            name: true,
            startedAt: true,
            finishedAt: true,
            durationSeconds: true,
            costCents: true,
            runnerType: true,
            runnerSize: true,
            conclusion: true,
          },
        },
        testResults: {
          orderBy: { suite: "asc" },
          select: {
            id: true,
            suite: true,
            name: true,
            status: true,
            durationMs: true,
            flakyCount30d: true,
          },
        },
        wasteFlags: {
          where: { resolvedAt: null },
          orderBy: { savingsEstimateCents: "desc" },
          select: {
            id: true,
            flagType: true,
            savingsEstimateCents: true,
            details: true,
            createdAt: true,
          },
        },
      },
    });
    if (!build || build.repo.orgId !== params.orgId) {
      throw errors.notFound();
    }

    const totalJobCost = build.jobs.reduce((sum, j) => sum + j.costCents, 0);

    // The spec calls out: never expose rawPayload in responses.
    return {
      id: build.id,
      externalId: build.externalId,
      branch: build.branch,
      prNumber: build.prNumber,
      prTitle: build.prTitle,
      triggeredBy: build.triggeredBy,
      status: build.status,
      conclusion: build.conclusion,
      startedAt: build.startedAt,
      finishedAt: build.finishedAt,
      durationSeconds: build.durationSeconds,
      costCents: build.costCents,
      runnerType: build.runnerType,
      runnerSize: build.runnerSize,
      commitSha: build.commitSha,
      repo: {
        id: build.repo.id,
        name: build.repo.fullName,
        defaultBranch: build.repo.defaultBranch,
      },
      jobs: build.jobs,
      testResults: build.testResults,
      wasteFlags: build.wasteFlags,
      costBreakdown: {
        totalCents: build.costCents,
        sumOfJobsCents: totalJobCost,
        unattributedCents: Math.max(0, build.costCents - totalJobCost),
      },
    };
  });
}
