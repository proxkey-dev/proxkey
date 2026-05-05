import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { errors } from "../../lib/errors.js";

const bodySchema = z.object({
  installation_id: z.string().min(1),
});

/**
 * Called from the SPA after GitHub App installation redirect (?installation_id=).
 */
export async function registerInstallationsRoute(app: FastifyInstance): Promise<void> {
  app.post("/api/github/installations", async (request, reply) => {
    await app.requireAuth(request);
    const body = bodySchema.parse(request.body);

    const membership = await app.prisma.orgMember.findFirst({
      where: { githubLogin: request.user!.githubLogin },
      orderBy: { createdAt: "asc" },
      select: { orgId: true },
    });

    if (!membership) {
      throw errors.badRequest("NO_ORG", "No organization membership found.");
    }

    await app.prisma.org.update({
      where: { id: membership.orgId },
      data: { githubInstallationId: body.installation_id },
    });

    return reply.send({ ok: true, next: "/dashboard" });
  });
}
