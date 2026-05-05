import type { AuthContext, OrganizationContext } from './request'

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null
    organization: OrganizationContext | null
  }
}
