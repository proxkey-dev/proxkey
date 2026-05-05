import type { FastifyInstance } from 'fastify'
import {
  parseRequestCookies,
  setCsrfCookie,
  setSessionCookie,
  clearAuthCookies,
} from '../lib/cookies'
import { getRequestAuditContext } from '../lib/request'
import { validateRequest } from '../lib/validation'
import { loginBodySchema, registerBodySchema } from '../schemas/auth.schemas'
import type { AppEnv } from '../config/env'
import type { AppServices, RouteGuards } from './types'

export function registerAuthRoutes(
  app: FastifyInstance,
  services: AppServices,
  guards: RouteGuards,
  env: AppEnv,
): void {
  app.post('/auth/register', async (request, reply) => {
    const { body } = validateRequest({
      bodySchema: registerBodySchema,
      body: request.body,
    })

    const result = await services.authService.register(body!, getRequestAuditContext(request))

    setSessionCookie(reply, env, result.sessionToken)
    setCsrfCookie(reply, env, result.csrfToken)

    reply.code(201).send({
      user: result.user,
      organization: result.organization,
      role: result.role,
      csrfToken: result.csrfToken,
    })
  })

  app.post('/auth/login', async (request, reply) => {
    const { body } = validateRequest({
      bodySchema: loginBodySchema,
      body: request.body,
    })

    const result = await services.authService.login(body!, getRequestAuditContext(request))

    setSessionCookie(reply, env, result.sessionToken)
    setCsrfCookie(reply, env, result.csrfToken)

    reply.send({
      user: result.user,
      organization: result.organization,
      role: result.role,
      csrfToken: result.csrfToken,
    })
  })

  app.post(
    '/auth/logout',
    {
      preHandler: [guards.authenticate, guards.requireCsrf],
    },
    async (request, reply) => {
      const cookies = parseRequestCookies(request)

      await services.authService.logout(
        cookies[env.SESSION_COOKIE_NAME],
        request.auth,
        getRequestAuditContext(request),
      )

      clearAuthCookies(reply, env)
      reply.send({ success: true })
    },
  )

  app.get(
    '/auth/me',
    {
      preHandler: [guards.authenticate, guards.useCurrentOrganization],
    },
    async (request, reply) => {
      const payload = await services.authService.getMe(request.auth!, request.organization!)
      const cookies = parseRequestCookies(request)

      reply.send({
        ...payload,
        csrfToken: cookies[env.CSRF_COOKIE_NAME],
      })
    },
  )
}
