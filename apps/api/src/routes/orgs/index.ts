import type { FastifyInstance } from "fastify";
import { registerOrgCoreRoutes } from "./core.js";
import { registerSpendRoutes } from "./spend.js";
import { registerBuildRoutes } from "./builds.js";
import { registerRepoRoutes } from "./repos.js";
import { registerWasteRoutes } from "./waste.js";
import { registerFlakyTestRoutes } from "./flaky-tests.js";

/**
 * GET /api/orgs (no orgId) — list orgs the caller belongs to.
 * All other routes are scoped to /api/orgs/:orgId and apply auth
 * + membership check via the helpers in `_helpers.ts`.
 */
export async function registerOrgRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/orgs",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request) => {
      const rows = await app.prisma.orgMember.findMany({
        where: {
          githubLogin: request.user!.githubLogin,
          org: { deletedAt: null },
        },
        include: {
          org: {
            select: {
              id: true,
              name: true,
              plan: true,
              githubLogin: true,
              digestEnabled: true,
              monthlyBudgetCents: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return {
        orgs: rows.map((r) => ({
          id: r.org.id,
          name: r.org.name,
          plan: r.org.plan,
          githubLogin: r.org.githubLogin,
          digestEnabled: r.org.digestEnabled,
          monthlyBudgetCents: r.org.monthlyBudgetCents,
          createdAt: r.org.createdAt.toISOString(),
          role: r.role,
        })),
      };
    },
  );

  await registerOrgCoreRoutes(app);
  await registerSpendRoutes(app);
  await registerBuildRoutes(app);
  await registerRepoRoutes(app);
  await registerWasteRoutes(app);
  await registerFlakyTestRoutes(app);
}
