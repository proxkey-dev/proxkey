import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getPublicHealthStatus,
  PUBLIC_HEALTH_BACKGROUND_INTERVAL_MS,
  type PublicHealthStatus,
} from '../lib/public-health'

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}h ${m}m ${s}s`
  }
  if (m > 0) {
    return `${m}m ${s}s`
  }
  return `${s}s`
}

function DbStatusCell({ snapshot, loading }: { snapshot: PublicHealthStatus | null; loading: boolean }) {
  if (loading && !snapshot) {
    return <span className="text-xl font-semibold text-[#e8e8e8]">…</span>
  }
  const raw = snapshot?.database ?? ''
  const isOk = raw.toLowerCase() === 'ok'
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {isOk ? (
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4ade80] text-[#0a0a0a]"
          title="Database reachable"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : null}
      <span className="text-xl font-semibold capitalize text-[#e8e8e8]">{raw || '—'}</span>
    </div>
  )
}

export default function StatusPage() {
  const [snapshot, setSnapshot] = useState<PublicHealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applyResult = useCallback((next: PublicHealthStatus) => {
    setSnapshot(next)
    setError(null)
  }, [])

  const silentRefresh = useCallback(async () => {
    try {
      const { status } = await getPublicHealthStatus({ force: true })
      applyResult(status)
    } catch {
      /* keep last-known good; avoids flicker during brief outages */
    }
  }, [applyResult])

  const initialLoad = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await getPublicHealthStatus({ force: false })
      applyResult(next.status)
    } catch (loadError) {
      setSnapshot(null)
      setError(loadError instanceof Error ? loadError.message : 'Unable to reach the API.')
    } finally {
      setLoading(false)
    }
  }, [applyResult])

  useEffect(() => {
    void initialLoad()
  }, [initialLoad])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return
      }
      void silentRefresh()
    }, PUBLIC_HEALTH_BACKGROUND_INTERVAL_MS)

    return () => {
      window.clearInterval(id)
    }
  }, [silentRefresh])

  const checkedLabel = snapshot ? new Date(snapshot.timestampIso).toLocaleString() : loading ? '…' : '—'

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8e8e8] antialiased">
      <header className="sticky top-0 z-40 border-b border-[#1e1e1e] bg-[#0a0a0a]">
        <nav
          className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 md:px-6"
          aria-label="Primary"
        >
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-[#e8e8e8] hover:text-[#4ade80] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
            style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
          >
            ProxKey
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#6b6b6b]">
            <Link to="/docs" className="hover:text-[#e8e8e8]">
              Docs
            </Link>
            <Link to="/login" className="hover:text-[#e8e8e8]">
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
        <p
          className="text-xs font-semibold uppercase tracking-widest text-[#4ade80]"
          style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
        >
          System status
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">API &amp; database</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#6b6b6b] md:text-base">
          API and database health are checked automatically about every{' '}
          {PUBLIC_HEALTH_BACKGROUND_INTERVAL_MS / 60_000} minutes while you keep this tab open (&amp; visible). Cached
          results may show first so we don&apos;t overload the backend on every navigation—there is{' '}
          <span className="text-[#e8e8e8]">no manual ping or refresh.</span>
        </p>

        {error ? (
          <div className="mt-8 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
          <div className="rounded border border-[#1e1e1e] bg-[#111111] p-5">
            <div className="text-xs uppercase tracking-wide text-[#6b6b6b]">API</div>
            <div className="mt-2 text-xl font-semibold text-[#e8e8e8]">
              {loading && !snapshot ? '…' : snapshot?.ok ? 'Operational' : 'Degraded'}
            </div>
          </div>
          <div className="rounded border border-[#1e1e1e] bg-[#111111] p-5">
            <div className="text-xs uppercase tracking-wide text-[#6b6b6b]">Database</div>
            <DbStatusCell snapshot={snapshot} loading={loading} />
          </div>
          <div className="rounded border border-[#1e1e1e] bg-[#111111] p-5">
            <div className="text-xs uppercase tracking-wide text-[#6b6b6b]">Deploy</div>
            <div
              className="mt-2 font-mono text-sm text-[#e8e8e8]"
              style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}
            >
              {snapshot?.version ?? '—'}
            </div>
          </div>
          <div className="rounded border border-[#1e1e1e] bg-[#111111] p-5">
            <div className="text-xs uppercase tracking-wide text-[#6b6b6b]">Last checked</div>
            <div className="mt-2 text-sm font-medium text-[#e8e8e8]">{checkedLabel}</div>
          </div>
        </section>

        {snapshot?.uptimeSeconds != null ? (
          <p className="mt-6 text-sm text-[#6b6b6b]">
            Process uptime:{' '}
            <span className="font-mono text-[#e8e8e8]">{formatUptime(snapshot.uptimeSeconds)}</span>
          </p>
        ) : null}

        <div className="mt-10 rounded border border-[#1e1e1e] bg-[#0d0d0d] p-4">
          <div className="text-xs uppercase tracking-wide text-[#6b6b6b]">Latest response snapshot</div>
          <pre className="mt-3 overflow-x-auto text-xs leading-relaxed text-[#a3a3a3] md:text-sm">
            {loading && !snapshot
              ? '…'
              : JSON.stringify(
                  snapshot
                    ? {
                        ok: snapshot.ok,
                        status: snapshot.status,
                        version: snapshot.version,
                        database: snapshot.database,
                        uptime: snapshot.uptimeSeconds,
                        timestamp: snapshot.timestampIso,
                      }
                    : null,
                  null,
                  2,
                )}
          </pre>
        </div>
      </main>

      <footer className="border-t border-[#1e1e1e] bg-[#0a0a0a] px-4 py-8 md:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 text-sm text-[#6b6b6b] md:flex-row md:items-center md:justify-between">
          <p className="font-mono text-[#e8e8e8]">ProxKey © {new Date().getFullYear()}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href="mailto:hello@proxkey.dev" className="transition-colors hover:text-[#e8e8e8]">
              hello@proxkey.dev
            </a>
            <span aria-hidden="true" className="hidden text-[#2a2a2a] sm:inline">
              |
            </span>
            <span className="text-[#e8e8e8]" aria-current="page">
              Status
            </span>
            <span aria-hidden="true" className="hidden text-[#2a2a2a] sm:inline">
              |
            </span>
            <Link to="/about" className="transition-colors hover:text-[#e8e8e8]">
              About
            </Link>
            <span aria-hidden="true" className="hidden text-[#2a2a2a] sm:inline">
              |
            </span>
            <Link to="/docs" className="transition-colors hover:text-[#e8e8e8]">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
