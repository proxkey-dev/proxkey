import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { errors } from "../../lib/errors.js";

export const orgParams = z.object({ orgId: z.string().cuid() });
export type OrgParams = z.infer<typeof orgParams>;

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Convenience: parses + validates orgId, runs auth + membership.
 * Returns the parsed orgId so callers can stay tidy.
 */
export async function authedOrg(
  app: FastifyInstance,
  request: FastifyRequest,
): Promise<{ orgId: string }> {
  const { orgId } = orgParams.parse(request.params);
  await app.requireAuth(request);
  await app.requireOrgMembership(request, orgId);
  return { orgId };
}

export function startOfMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function startOfPrevMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function percentageDelta(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

/**
 * Use any time we look up a child resource by id — returns 404 when
 * the row doesn't exist OR belongs to a different org. The spec
 * explicitly forbids leaking "exists but forbidden".
 */
export function ensureBelongsToOrg<T extends { orgId: string } | null>(
  row: T,
  orgId: string,
): NonNullable<T> {
  if (!row || row.orgId !== orgId) {
    throw errors.notFound();
  }
  return row;
}
