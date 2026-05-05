import type { FastifyInstance } from "fastify";

const startedAt = Date.now();

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get("/health", async () => ({
    status: "ok",
    uptime: Math.round((Date.now() - startedAt) / 1000),
    version: process.env["npm_package_version"] ?? "0.0.0",
  }));

  app.get("/ready", async (_request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      await app.queues.redis.ping();
      return { status: "ready" as const };
    } catch (err) {
      app.log.error({ err }, "readiness check failed");
      return reply.status(503).send({ status: "not_ready" as const });
    }
  });
}
