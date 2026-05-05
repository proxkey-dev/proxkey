import type { FastifyReply, FastifyRequest } from 'fastify'
import { parse, serialize } from 'cookie'
import type { AppEnv } from '../config/env'

function appendSetCookie(reply: FastifyReply, value: string): void {
  const existing = reply.getHeader('set-cookie')

  if (!existing) {
    reply.header('set-cookie', value)
    return
  }

  if (Array.isArray(existing)) {
    reply.header('set-cookie', [...existing.map(String), value])
    return
  }

  reply.header('set-cookie', [String(existing), value])
}

function baseCookieOptions(env: AppEnv) {
  return {
    path: '/',
    domain: env.COOKIE_DOMAIN,
    sameSite: env.COOKIE_SAME_SITE,
    secure: env.NODE_ENV === 'production',
  }
}

export function parseRequestCookies(request: FastifyRequest): Record<string, string> {
  return Object.fromEntries(
    Object.entries(parse(request.headers.cookie ?? '')).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

export function setSessionCookie(reply: FastifyReply, env: AppEnv, token: string): void {
  appendSetCookie(
    reply,
    serialize(env.SESSION_COOKIE_NAME, token, {
      ...baseCookieOptions(env),
      httpOnly: true,
      maxAge: env.SESSION_TTL_HOURS * 60 * 60,
    }),
  )
}

export function setCsrfCookie(reply: FastifyReply, env: AppEnv, token: string): void {
  appendSetCookie(
    reply,
    serialize(env.CSRF_COOKIE_NAME, token, {
      ...baseCookieOptions(env),
      httpOnly: false,
      maxAge: env.SESSION_TTL_HOURS * 60 * 60,
    }),
  )
}

export function clearAuthCookies(reply: FastifyReply, env: AppEnv): void {
  for (const name of [env.SESSION_COOKIE_NAME, env.CSRF_COOKIE_NAME]) {
    appendSetCookie(
      reply,
      serialize(name, '', {
        ...baseCookieOptions(env),
        httpOnly: name === env.SESSION_COOKIE_NAME,
        maxAge: 0,
        expires: new Date(0),
      }),
    )
  }
}
