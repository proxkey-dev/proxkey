import type { FastifyInstance, FastifyRequest } from "fastify";
import { errors } from "../lib/errors.js";

declare module "fastify" {
  interface FastifyInstance {
    requireOrgMembership: (
      request: FastifyRequest,
      orgId: string,
    ) => Promise<{ role: string }>;
  }
}

/**
 * Ensures the authenticated GitHub user is a member of the org.
 * Returns 404 when the membership row is missing to avoid leaking org ids.
 */
export async function orgMembershipPlugin(
  app: FastifyInstance,
): Promise<void> {
  app.decorate(
    "requireOrgMembership",
    async (
      request: FastifyRequest,
      orgId: string,
    ): Promise<{ role: string }> => {
      if (!request.user) {
        throw errors.unauthorized();
      }
      const membership = await app.prisma.orgMember.findUnique({
        where: {
          orgId_githubLogin: {
            orgId,
            githubLogin: request.user.githubLogin,
          },
        },
        select: { role: true },
      });
      if (!membership) {
        throw errors.notFound();
      }
      return { role: membership.role };
    },
  );
}
