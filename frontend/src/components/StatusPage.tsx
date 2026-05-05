import { useEffect, useState } from 'react'
import { proxkeyApi, type HealthSnapshot } from '../lib/proxkey-api'

const liveNotes = [
  'Exports stay operator-controlled even when a draft handoff is ready.',
  'Founder-only company metrics stay out of non-owner employee views.',
  'Authenticated workspace metrics are read from the live database.',
]

export function StatusPage() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    proxkeyApi
      .health()
      .then((next) => {
        setSnapshot(next)
        setError(null)
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load status.')
      })
  }, [])

  const checkedAt = snapshot?.checkedAt
    ? new Date(snapshot.checkedAt).toLocaleString()
    : 'Checking…'

  return (
    <div className="bg-[#f6f4ef] px-4 py-10 text-[#111] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="pk-frame pk-grid-surface bg-white px-6 py-8 shadow-[0_20px_54px_rgba(33,28,19,0.06)] sm:px-8">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">Status</div>
          <h1 className="mt-4 font-['Georgia'] text-4xl tracking-tight text-[#111] sm:text-6xl">
            Live health for the ProxKey triage surface.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[#57544d]">
            This page reports the live API, database, and AI mode for the current deployment.
          </p>
        </section>

        {error ? (
          <div className="border border-[#f1cac6] bg-[#fff4f4] px-4 py-3 text-sm text-[#e5484d]">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="pk-frame bg-white px-5 py-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">API</div>
            <div className="mt-2 text-2xl font-semibold text-[#111]">
              {snapshot?.ok ? 'Operational' : 'Checking'}
            </div>
          </div>
          <div className="pk-frame bg-white px-5 py-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">Database</div>
            <div className="mt-2 text-2xl font-semibold text-[#111]">
              {snapshot?.database ?? 'Checking'}
            </div>
          </div>
          <div className="pk-frame bg-white px-5 py-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">AI mode</div>
            <div className="mt-2 text-2xl font-semibold text-[#111]">
              {snapshot?.ai ?? 'Checking'}
            </div>
          </div>
          <div className="pk-frame bg-white px-5 py-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">
              Last checked
            </div>
            <div className="mt-2 text-lg font-semibold text-[#111]">{checkedAt}</div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="pk-frame bg-white px-6 py-6">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
              Current guarantees
            </div>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[#57544d]">
              {liveNotes.map((note) => (
                <div key={note} className="border border-[#ece8df] bg-[#faf8f4] px-4 py-4">
                  {note}
                </div>
              ))}
            </div>
          </div>

          <div className="pk-dark-grid border border-[#27303a] bg-[#111318] px-6 py-6 text-white [clip-path:polygon(0_0,calc(100%-16px)_0,100%_16px,100%_100%,16px_100%,0_calc(100%-16px))]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#95a0af]">
              Health response
            </div>
            <pre className="mt-4 overflow-x-auto text-sm leading-7 text-[#d6dde6]">
              {JSON.stringify(
                snapshot ?? {
                  ok: false,
                  version: 'loading',
                  database: 'error',
                  ai: 'fallback',
                  checkedAt: new Date().toISOString(),
                },
                null,
                2,
              )}
            </pre>
          </div>
        </section>
      </div>
    </div>
  )
}
