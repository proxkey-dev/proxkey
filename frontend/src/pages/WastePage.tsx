import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useMemo, useState } from 'react'
import { getRepos, getWasteFlags, resolveWasteFlag } from '../lib/api'
import { formatCost } from '../lib/format'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRow } from '../components/SkeletonRow'
import { WasteFlagBadge } from '../components/WasteFlagBadge'

const FLAG_TYPES = [
  'DOCS_ONLY_TRIGGER',
  'ALWAYS_FLAKY_TEST',
  'OVERSIZED_RUNNER',
  'REDUNDANT_MATRIX',
  'CACHE_MISS_CHURN',
] as const

export default function WastePage() {
  const qc = useQueryClient()
  const [flagType, setFlagType] = useState<string>('')
  const [repoId, setRepoId] = useState<string>('')
  const [status, setStatus] = useState<'active' | 'resolved' | 'all'>('active')
  const [expanded, setExpanded] = useState<string | null>(null)

  const repos = useQuery({ queryKey: ['repos'], queryFn: getRepos, staleTime: 60_000 })

  const wasteQuery = useMemo(
    () => ({
      flagType: flagType || undefined,
      repoId: repoId || undefined,
      status,
    }),
    [flagType, repoId, status],
  )

  const listKey = ['waste', 'list', wasteQuery] as const

  const waste = useQuery({
    queryKey: listKey,
    queryFn: () => getWasteFlags(wasteQuery),
    staleTime: 60_000,
  })

  const resolve = useMutation({
    mutationFn: (flagId: string) => resolveWasteFlag(flagId),
    onMutate: async (flagId) => {
      await qc.cancelQueries({ queryKey: listKey })
      const previous = qc.getQueryData<Awaited<ReturnType<typeof getWasteFlags>>>(listKey)
      if (previous) {
        qc.setQueryData(listKey, {
          ...previous,
          items: previous.items.map((f) => (f.id === flagId ? { ...f, status: 'resolved' as const } : f)),
        })
      }
      return { previous }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(listKey, ctx.previous)
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['waste'] })
    },
  })

  const totalSavings = (waste.data?.items ?? []).reduce((s, f) => s + (f.status === 'active' ? f.savingsCents : 0), 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-xl text-[#e8e8e8]">Waste Flags</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            Est. savings opportunity:{' '}
            <span className="font-mono text-[#4ade80]">{formatCost(totalSavings, true)}</span>/mo (active flags)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={flagType}
            onChange={(e) => setFlagType(e.target.value)}
            className="rounded border border-[#1e1e1e] bg-[#111111] px-3 py-2 text-sm text-[#e8e8e8] outline-none focus-visible:ring-2 focus-visible:ring-[#4ade80]"
            aria-label="Flag type"
          >
            <option value="">All types</option>
            {FLAG_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={repoId}
            onChange={(e) => setRepoId(e.target.value)}
            className="rounded border border-[#1e1e1e] bg-[#111111] px-3 py-2 text-sm text-[#e8e8e8] outline-none focus-visible:ring-2 focus-visible:ring-[#4ade80]"
            aria-label="Repository"
            disabled={repos.isLoading}
          >
            <option value="">All repos</option>
            {(repos.data?.items ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded border border-[#1e1e1e] bg-[#111111] px-3 py-2 text-sm text-[#e8e8e8] outline-none focus-visible:ring-2 focus-visible:ring-[#4ade80]"
            aria-label="Status"
          >
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
        </div>
      </header>

      <div className="overflow-x-auto rounded border border-[#1e1e1e] bg-[#111111]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#1e1e1e] text-left text-[#6b6b6b]">
              <th className="px-4 py-3">Flag</th>
              <th className="px-4 py-3">Repo</th>
              <th className="px-4 py-3 text-right font-mono">Est. savings/mo</th>
              <th className="px-4 py-3 font-mono">First seen</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {waste.isLoading ? (
              <>
                <SkeletonRow columns={6} />
                <SkeletonRow columns={6} />
              </>
            ) : waste.error ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-red-300">
                  {waste.error instanceof Error ? waste.error.message : 'Failed to load'}
                  <button type="button" className="ml-3 underline" onClick={() => void waste.refetch()}>
                    Retry
                  </button>
                </td>
              </tr>
            ) : (waste.data?.items.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8">
                  <EmptyState
                    heading="No flags match filters"
                    body="Try widening filters or check back after more builds are analyzed."
                  />
                </td>
              </tr>
            ) : (
              waste.data?.items.map((f) => (
                <Fragment key={f.id}>
                  <tr className="border-b border-[#1e1e1e] align-top hover:bg-[#161616]">
                    <td className="px-4 py-3">
                      <WasteFlagBadge type={f.type} />
                      <button
                        type="button"
                        className="ml-2 text-xs text-[#4ade80] hover:underline"
                        onClick={() => setExpanded((x) => (x === f.id ? null : f.id))}
                      >
                        {expanded === f.id ? 'Hide' : 'Details'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[#e8e8e8]">{f.repoName}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#4ade80]">{formatCost(f.savingsCents)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#6b6b6b]">
                      {new Date(f.firstSeen).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-[#6b6b6b]">{f.status}</td>
                    <td className="px-4 py-3 text-right">
                      {f.status === 'active' ? (
                        <button
                          type="button"
                          disabled={resolve.isPending}
                          onClick={() => resolve.mutate(f.id)}
                          className="rounded bg-[#e8e8e8] px-3 py-1.5 text-xs font-medium text-[#0a0a0a] hover:opacity-90 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="text-xs text-[#6b6b6b]">—</span>
                      )}
                    </td>
                  </tr>
                  {expanded === f.id ? (
                    <tr className="border-b border-[#1e1e1e] bg-[#0a0a0a]">
                      <td colSpan={6} className="px-4 py-4 text-sm text-[#6b6b6b]">
                        <p className="font-medium text-[#e8e8e8]">Affected builds</p>
                        <p className="mt-1 font-mono text-xs">{f.affectedBuilds.join(', ') || '—'}</p>
                        <p className="mt-4 font-medium text-[#e8e8e8]">Fix recommendation</p>
                        <p className="mt-1 text-[#e8e8e8]">{f.recommendation}</p>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
