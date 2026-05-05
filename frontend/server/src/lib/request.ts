import type { FastifyRequest } from 'fastify'

export type RequestAuditContext = {
  requestId: string
  ipAddress?: string
  userAgent?: string
}

export function getRequestAuditContext(request: FastifyRequest): RequestAuditContext {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  }
}
