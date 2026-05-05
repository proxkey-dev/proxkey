import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { errors } from "../../lib/errors.js";
import { authedOrg } from "./_helpers.js";

const flagParams = z.object({
  orgId: z.string().cuid(),
  flagId: z.string().cuid(),
});

export async function registerWasteRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/api/orgs/:orgId/waste", async (request) => {
    const { orgId } = await authedOrg(app, request);
    const flags = await app.prisma.wasteFlag.findMany({
      where: { orgId, resolvedAt: null },
      orderBy: { savingsEstimateCents: "desc" },
      include: {
        build: {
          select: {
            id: true,
            branch: true,
            prNumber: true,
            costCents: true,
            repo: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    return {
      rows: flags.map((f) => ({
        id: f.id,
        type: f.flagType,
        savingsEstimateCents: f.savingsEstimateCents,
        details: f.details,
        createdAt: f.createdAt,
        resolvedAt: f.resolvedAt,
        build: f.build
          ? {
              id: f.build.id,
              branch: f.build.branch,
              prNumber: f.build.prNumber,
              costCents: f.build.costCents,
              repo: { id: f.build.repo.id, name: f.build.repo.fullName },
            }
          : null,
      })),
    };
  });

  app.patch(
    "/api/orgs/:orgId/waste/:flagId/resolve",
    async (request, reply) => {
      await app.requireAuth(request);
      const params = flagParams.parse(request.params);
      await app.requireOrgMembership(request, params.orgId);

      const existing = await app.prisma.wasteFlag.findFirst({
        where: { id: params.flagId, orgId: params.orgId },
        select: { id: true },
      });
      if (!existing) throw errors.notFound();

      const updated = await app.prisma.wasteFlag.update({
        where: { id: params.flagId },
        data: { resolvedAt: new Date() },
        select: { id: true, resolvedAt: true },
      });

      return reply.send({
        id: updated.id,
        resolvedAt: updated.resolvedAt,
      });
    },
  );
}
