import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { HttpError } from "../lib/errors.js";

/**
 * Single error handler. Every error response is the canonical
 * { error, code } shape. ZodErrors map to 400 with code VALIDATION_ERROR.
 * Unknown errors map to 500 INTERNAL — we never leak stack traces.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      void reply.status(error.statusCode).send(error.toResponse());
      return;
    }

    if (error instanceof ZodError) {
      const message = error.errors
        .map((e) => {
          const path = e.path.length > 0 ? e.path.join(".") : "(root)";
          return `${path}: ${e.message}`;
        })
        .join("; ");
      void reply
        .status(400)
        .send({ error: message || "Validation failed", code: "VALIDATION_ERROR" });
      return;
    }

    // Fastify built-in errors (e.g. payload too large) usually have statusCode.
    const fastifyStatus = (error as { statusCode?: number }).statusCode;
    if (typeof fastifyStatus === "number" && fastifyStatus < 500) {
      void reply
        .status(fastifyStatus)
        .send({
          error: error.message || "Bad request",
          code: (error as { code?: string }).code ?? "BAD_REQUEST",
        });
      return;
    }

    request.log.error(
      { err: error, requestId: request.id },
      "Unhandled error",
    );
    void reply
      .status(500)
      .send({ error: "Internal server error", code: "INTERNAL" });
  });

  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });
  });
}
