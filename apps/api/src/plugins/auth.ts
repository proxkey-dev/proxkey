import type { FastifyInstance, FastifyRequest } from "fastify";
import { errors } from "../lib/errors.js";
import { SESSION_COOKIE, verifySessionToken } from "../lib/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: { githubLogin: string; email: string };
  }
}

/**
 * Mounts `request.user` after verifying the session cookie.
 * Use `preHandler: app.requireAuth` on routes that require a dashboard session.
 */
export async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorate(
    "requireAuth",
    async (request: FastifyRequest): Promise<void> => {
      const cookie = request.cookies[SESSION_COOKIE];
      if (!cookie) {
        throw errors.unauthorized();
      }
      try {
        const session = await verifySessionToken(
          cookie,
          app.proxkeyEnv.JWT_SECRET,
        );
        request.user = {
          githubLogin: session.githubLogin,
          email: session.email,
        };
      } catch {
        throw errors.unauthorized("INVALID_SESSION", "Invalid session token");
      }
    },
  );
}

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest) => Promise<void>;
  }
}
