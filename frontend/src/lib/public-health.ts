import { apiUrl } from './api'

/** Normalized from GET /api/health (shape may vary slightly by deployment). */
export type PublicHealthStatus = {
  ok: boolean
  database: string
  version?: string
  uptimeSeconds?: number
  status?: string
  timestampIso: string
}

const STORAGE_KEY = 'proxkey.publicHealth.v2'
/** Short TTL so repeat visits in-session don’t burst the API; periodic refresh while /status is open uses a separate path. */
export const PUBLIC_HEALTH_CACHE_TTL_MS = 3 * 60 * 1000
/** How often we re-check API + database in the background while the status page stays open (no manual refresh). */
export const PUBLIC_HEALTH_BACKGROUND_INTERVAL_MS = 10 * 60 * 1000

type Stored = {
  payload: Record<string, unknown>
  fetchedAt: number
}

let inflight: Promise<PublicHealthStatus> | null = null

function parsePayload(json: Record<string, unknown>): PublicHealthStatus {
  const ts =
    typeof json.timestamp === 'string'
      ? json.timestamp
      : typeof json.checkedAt === 'string'
        ? json.checkedAt
        : new Date().toISOString()

  return {
    ok: Boolean(json.ok),
    database: String(json.database ?? 'unknown'),
    version: typeof json.version === 'string' ? json.version : undefined,
    uptimeSeconds: typeof json.uptime === 'number' ? json.uptime : undefined,
    status: typeof json.status === 'string' ? json.status : undefined,
    timestampIso: ts,
  }
}

/**
 * Fetches public API health with sessionStorage TTL + in-flight deduplication.
 * Does not attach auth headers or cookies — safe for a public status page.
 */
export async function getPublicHealthStatus(options?: {
  /** Skip cache and hit the network (used for background refresh and cold loads). Not exposed in the UI. */
  force?: boolean
  ttlMs?: number
}): Promise<{ status: PublicHealthStatus; fromCache: boolean }> {
  const ttlMs = options?.ttlMs ?? PUBLIC_HEALTH_CACHE_TTL_MS
  const force = Boolean(options?.force)
  const now = Date.now()

  if (!force && typeof sessionStorage !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Stored
        if (now - parsed.fetchedAt < ttlMs && parsed.payload && typeof parsed.payload === 'object') {
          return {
            status: parsePayload(parsed.payload),
            fromCache: true,
          }
        }
      }
    } catch {
      /* ignore corrupt cache */
    }
  }

  if (inflight && !force) {
    const status = await inflight
    return { status, fromCache: false }
  }

  const run = async (): Promise<PublicHealthStatus> => {
    const res = await fetch(apiUrl('/api/health'), {
      method: 'GET',
      credentials: 'omit',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const msg =
        typeof json.message === 'string'
          ? json.message
          : typeof json.error === 'string'
            ? json.error
            : `HTTP ${res.status}`
      throw new Error(msg)
    }

    const status = parsePayload(json)

    if (typeof sessionStorage !== 'undefined') {
      try {
        const next: Stored = { payload: json, fetchedAt: Date.now() }
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* quota / private mode */
      }
    }

    return status
  }

  if (force) {
    inflight = null
  }

  const p = run().finally(() => {
    inflight = null
  })
  inflight = p
  const status = await p
  return { status, fromCache: false }
}
