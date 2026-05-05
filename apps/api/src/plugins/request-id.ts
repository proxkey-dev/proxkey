import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";

/**
 * Ensures every request carries an `x-request-id`. If the caller didn't
 * provide one we generate a UUIDv4 and echo it back in the response so
 * clients can correlate logs.
 */
export async function requestIdPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", async (request, reply) => {
    const incoming = request.headers["x-request-id"];
    const requestId =
      typeof incoming === "string" && incoming.length > 0
        ? incoming
        : randomUUID();
    request.id = requestId;
    void reply.header("x-request-id", requestId);
  });
}
