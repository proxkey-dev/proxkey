import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { SESSION_COOKIE } from "../lib/jwt.js";

/**
 * 200 req/min per IP for unauthenticated callers.
 * 1000 req/min per session cookie for authenticated callers.
 *
 * We do NOT rate-limit the GitHub webhook endpoint — GitHub will
 * fan out bursts and we want to ingest them all.
 */
export async function rateLimitPlugin(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    global: true,
    max: (request: FastifyRequest): number => {
      return request.cookies[SESSION_COOKIE] ? 1000 : 200;
    },
    timeWindow: "1 minute",
    keyGenerator: (request: FastifyRequest): string => {
      const cookie = request.cookies[SESSION_COOKIE];
      return cookie ? `session:${cookie.slice(0, 32)}` : `ip:${request.ip}`;
    },
    allowList: (request: FastifyRequest) =>
      request.url.startsWith("/api/github/webhook"),
    errorResponseBuilder: () => ({
      error: "Too many requests, slow down.",
      code: "RATE_LIMITED",
    }),
  });
}
