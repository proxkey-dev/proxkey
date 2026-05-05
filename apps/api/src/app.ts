import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { prisma, type Db } from "@proxkey/db";
import Fastify, { type FastifyInstance } from "fastify";
import type { ApiEnv } from "./env.js";
import { corsOrigins } from "./env.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { authPlugin } from "./plugins/auth.js";
import { orgMembershipPlugin } from "./plugins/org-membership.js";
import { rateLimitPlugin } from "./plugins/rate-limit.js";
import { requestIdPlugin } from "./plugins/request-id.js";
import { createProducers, type ProducerHandles } from "./queues/index.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth/index.js";
import { registerGithubRoutes } from "./routes/github/index.js";
import { registerOrgRoutes } from "./routes/orgs/index.js";

declare module "fastify" {
  interface FastifyInstance {
    proxkeyEnv: ApiEnv;
    prisma: Db;
    queues: ProducerHandles;
  }
}

export interface BuildAppOptions {
  env: ApiEnv;
  prisma?: Db;
  queues?: ProducerHandles;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: opts.env.LOG_LEVEL,
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      formatters: {
        level: (label) => ({ level: label }),
      },
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          requestId: req.id,
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    },
    bodyLimit: 1_000_000,
    disableRequestLogging: false,
  });

  app.decorate("proxkeyEnv", opts.env);
  app.decorate("prisma", opts.prisma ?? prisma);
  app.decorate(
    "queues",
    opts.queues ?? createProducers(opts.env.REDIS_URL),
  );

  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (request, body, done) => {
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
      (request as { rawBody?: Buffer }).rawBody = buf;
      try {
        done(null, buf.length === 0 ? {} : JSON.parse(buf.toString("utf8")));
      } catch (err) {
        const e = err instanceof Error ? err : new Error("Invalid JSON body");
        done(e, undefined);
      }
    },
  );

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie, { secret: opts.env.JWT_SECRET });
  await app.register(cors, {
    origin: (origin, cb) => {
      if (origin === undefined) {
        cb(null, true);
        return;
      }
      const allowed = corsOrigins(opts.env);
      cb(null, allowed.includes(origin));
    },
    credentials: true,
  });

  await app.register(requestIdPlugin);
  await app.register(rateLimitPlugin);
  await app.register(authPlugin);
  await app.register(orgMembershipPlugin);

  registerErrorHandler(app);

  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        ms: reply.elapsedTime,
      },
      "request.completed",
    );
  });

  registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerGithubRoutes(app);
  await registerOrgRoutes(app);

  app.addHook("onClose", async () => {
    await app.queues.close();
    await app.prisma.$disconnect();
  });

  return app;
}
