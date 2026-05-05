import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()
dotenv.config({ path: path.resolve(process.cwd(), '../.env') })

function preferNonLocalDatabaseUrl(): void {
  if (process.env.NODE_ENV === 'production') {
    return
  }

  const envPaths = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../.env')]

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) {
      continue
    }

    const matches = [...fs.readFileSync(envPath, 'utf8').matchAll(/^DATABASE_URL=(.*)$/gm)]
      .map((match) => match[1]?.trim().replace(/^"|"$/g, ''))
      .filter(Boolean)
    const firstRemoteUrl = matches.find(
      (value) => !value.includes('localhost') && !value.includes('127.0.0.1'),
    )

    if (firstRemoteUrl) {
      process.env.DATABASE_URL = firstRemoteUrl
      return
    }
  }
}

preferNonLocalDatabaseUrl()

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === 'boolean' ? value : value.toLowerCase() === 'true'))

const integerish = z
  .union([z.number(), z.string()])
  .transform((value) => Number(value))
  .pipe(z.number().int())

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: integerish.default(4000),
  DATABASE_URL: z.string().min(1),
  // CORS_ALLOWED_ORIGINS is the canonical production name; FRONTEND_ORIGIN is kept for backwards compat.
  // Comma-separated list of allowed origins, e.g. "https://proxkey.dev,https://www.proxkey.dev"
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  APP_BASE_URL: z.string().url().optional(),
  API_BASE_URL: z.string().url().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().default('proxkey_session'),
  SESSION_TTL_HOURS: integerish.default(168),
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_AUDIENCE: z.string().optional(),
  AUTH0_CLIENT_ID: z.string().optional(),
  AUTH0_CLI_CLIENT_ID: z.string().optional(),
  AUTH0_CLI_SCOPE: z.string().default('openid profile email offline_access'),
  AUTH0_ISSUER_BASE_URL: z.string().url().optional(),
  AI_BASE_URL: z.string().url().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_PROVIDER: z.string().default('heuristic'),
  REDIS_URL: z.string().optional(),
  REDIS_ENABLED: booleanish.default(false),
  USE_INLINE_QUEUE: booleanish.default(true),
  ENABLE_OVERAGES: booleanish.default(false),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  DASHBOARD_SESSION_SECRET: z.string().optional(),
  // APP_URL kept for backwards compat; prefer APP_BASE_URL
  APP_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
})

export type ProxKeyConfig = z.infer<typeof envSchema> & {
  frontendOrigins: string[]
  useRedisQueue: boolean
  dashboardSessionSecret: string
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): ProxKeyConfig {
  const parsed = envSchema.parse(source)

  // CORS_ALLOWED_ORIGINS takes priority; fall back to FRONTEND_ORIGIN for backwards compat
  const originsRaw = parsed.CORS_ALLOWED_ORIGINS ?? parsed.FRONTEND_ORIGIN
  const frontendOrigins = originsRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  const dashboardSessionSecret =
    parsed.DASHBOARD_SESSION_SECRET ?? parsed.JWT_SECRET ?? 'proxkey-dev-dashboard-session-secret'

  if (parsed.NODE_ENV === 'production' && dashboardSessionSecret === 'proxkey-dev-dashboard-session-secret') {
    throw new Error('DASHBOARD_SESSION_SECRET or JWT_SECRET must be set in production.')
  }

  return {
    ...parsed,
    frontendOrigins,
    useRedisQueue: Boolean(parsed.REDIS_URL) && parsed.REDIS_ENABLED,
    dashboardSessionSecret,
  }
}
