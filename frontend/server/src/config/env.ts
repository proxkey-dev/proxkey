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

const booleanishSchema = z.union([z.boolean(), z.string()]).transform((value) => {
  if (typeof value === 'boolean') {
    return value
  }

  return value.toLowerCase() === 'true'
})

const integerishSchema = z
  .union([z.number(), z.string()])
  .transform((value) => Number(value))
  .pipe(z.number().int())

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: integerishSchema.default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  BODY_LIMIT_BYTES: integerishSchema.default(262_144),
  SESSION_TTL_HOURS: integerishSchema.default(168),
  SESSION_COOKIE_NAME: z.string().min(1).default('proxkey_session'),
  CSRF_COOKIE_NAME: z.string().min(1).default('proxkey_csrf'),
  COOKIE_DOMAIN: z.union([z.string(), z.undefined()]).transform((value) => {
    const trimmed = typeof value === 'string' ? value.trim() : ''
    return trimmed.length > 0 ? trimmed : undefined
  }),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: booleanishSchema.default(false),
  RATE_LIMIT_WINDOW_MS: integerishSchema.default(60_000),
  RATE_LIMIT_MAX: integerishSchema.default(100),
  TRIAGE_RATE_LIMIT_MAX: integerishSchema.default(5),
  LLM_PROVIDER: z.enum(['mock', 'openai', 'anthropic', 'groq']).default('mock'),
  LLM_TIMEOUT_MS: integerishSchema.default(15_000),
  AI_PROVIDER: z.enum(['mock', 'openai', 'anthropic', 'groq']).optional(),
  AI_BASE_URL: z.string().url().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  CONTENT_ENCRYPTION_KEY: z.string().min(1),
  REDACT_EMAILS: booleanishSchema.default(false),
  REDACT_PHONES: booleanishSchema.default(false),
})

export type AppEnv = z.infer<typeof rawEnvSchema> & {
  corsOrigins: string[]
  contentEncryptionKeyBytes: Buffer
  effectiveLlmProvider: 'mock' | 'openai' | 'anthropic' | 'groq'
  effectiveOpenAiApiKey?: string
  effectiveOpenAiModel?: string
  effectiveOpenAiBaseUrl?: string
}

function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = rawEnvSchema.parse(source)
  const corsOrigins = parseCorsOrigins(parsed.CORS_ORIGINS)
  const contentEncryptionKeyBytes = Buffer.from(parsed.CONTENT_ENCRYPTION_KEY, 'base64')
  const effectiveLlmProvider = parsed.AI_PROVIDER ?? parsed.LLM_PROVIDER
  const effectiveOpenAiApiKey = parsed.AI_API_KEY ?? parsed.OPENAI_API_KEY
  const effectiveOpenAiModel = parsed.AI_MODEL ?? parsed.OPENAI_MODEL
  const effectiveOpenAiBaseUrl =
    parsed.AI_BASE_URL ??
    parsed.OPENAI_BASE_URL ??
    (effectiveLlmProvider === 'groq'
      ? 'https://api.groq.com/openai/v1'
      : 'https://api.openai.com/v1')

  if (contentEncryptionKeyBytes.length !== 32) {
    throw new Error('CONTENT_ENCRYPTION_KEY must decode to exactly 32 bytes')
  }

  if (
    (effectiveLlmProvider === 'openai' || effectiveLlmProvider === 'groq') &&
    !effectiveOpenAiApiKey
  ) {
    throw new Error('AI_API_KEY or OPENAI_API_KEY is required when LLM_PROVIDER is openai or groq')
  }

  if (
    (effectiveLlmProvider === 'openai' || effectiveLlmProvider === 'groq') &&
    !effectiveOpenAiModel
  ) {
    throw new Error('AI_MODEL or OPENAI_MODEL is required when LLM_PROVIDER is openai or groq')
  }

  if (parsed.COOKIE_SAME_SITE === 'none' && parsed.NODE_ENV !== 'production') {
    throw new Error('COOKIE_SAME_SITE=none requires NODE_ENV=production so cookies stay Secure')
  }

  if (parsed.NODE_ENV !== 'test' && corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one allowed origin')
  }

  return {
    ...parsed,
    corsOrigins,
    contentEncryptionKeyBytes,
    effectiveLlmProvider,
    effectiveOpenAiApiKey,
    effectiveOpenAiModel,
    effectiveOpenAiBaseUrl,
  }
}
