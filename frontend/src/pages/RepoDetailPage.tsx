import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getRepoBuilds, getRepoDetail } from '../lib/api'
import { formatCost, formatDuration } from '../lib/format'
import { ConclusionBadge } from '../components/ConclusionBadge'
import { CostBadge } from '../components/CostBadge'
import { EmptyState } from '../components/EmptyState'
import { Pagination } from '../components/Pagination'
import { SkeletonRow } from '../components/SkeletonRow'
import { WasteFlagBadge } from '../components/WasteFlagBadge'

const PAGE_SIZE = 50

export default function RepoDetailPage() {
  const { id: repoId } = useParams<{ id: string }>()
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [repoId])

  const detail = useQuery({
    queryKey: ['repo', repoId],
    queryFn: () => getRepoDetail(repoId!),
    enabled: Boolean(repoId),
    staleTime: 60_000,
  })

  const builds = useQuery({
    queryKey: ['repo', repoId, 'builds', page, PAGE_SIZE],
    queryFn: () => getRepoBuilds(repoId!, page, PAGE_SIZE),
    enabled: Boolean(repoId),
    staleTime: 30_000,
  })

  if (!repoId) {
    return null
  }

  if (detail.error) {
    return (
      <div className="rounded border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
        {detail.error instanceof Error ? detail.error.message : 'Repository not found.'}
        <button type="button" className="ml-4 rounded border border-[#e8e8e8] px-3 py-1" onClick={() => void detail.refetch()}>
          Retry
        </button>
      </div>
    )
  }

  const d = detail.data

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center gap-3">
        {detail.isLoading ? (
          <div className="h-8 w-64 animate-pulse rounded bg-[#1e1e1e]" />
        ) : (
          <>
            <h1 className="font-mono text-xl text-[#e8e8e8]">{d?.name}</h1>
            <span className="rounded border border-[#1e1e1e] bg-[#111111] px-2 py-0.5 font-mono text-xs text-[#6b6b6b]">
              GitHub Actions
            </span>
          </>
        )}
      </header>

      <section>
        {detail.isLoading ? (
          <div className="h-64 animate-pulse rounded border border-[#1e1e1e] bg-[#111111]" />
        ) : (
          <div className="h-64 rounded border border-[#1e1e1e] bg-[#111111] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d?.spend30d ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="#1e1e1e" vertical={false} />
                <XAxis dataKey="day" stroke="#6b6b6b" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <YAxis
                  stroke="#6b6b6b"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCost(Number(v), true)}
                  width={52}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#111111',
                    border: '1px solid #1e1e1e',
                    borderRadius: 4,
                    color: '#e8e8e8',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  formatter={(v) => [formatCost(Number(v ?? 0)), 'Spend']}
                />
                <Line type="monotone" dataKey="spendCents" stroke="#4ade80" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-[#6b6b6b]">Build history</h2>
        <div className="mt-3 overflow-x-auto rounded border border-[#1e1e1e] bg-[#111111]">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e] text-left text-[#6b6b6b]">
                <th className="px-4 py-3">PR</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3 text-right font-mono">Cost</th>
                <th className="px-4 py-3 text-right font-mono">Duration</th>
                <th className="px-4 py-3 text-right font-mono">Jobs</th>
                <th className="px-4 py-3">Conclusion</th>
                <th className="px-4 py-3 text-right font-mono">Flags</th>
              </tr>
            </thead>
            <tbody>
              {builds.isLoading ? (
                <>
                  <SkeletonRow columns={8} />
                  <SkeletonRow columns={8} />
                </>
              ) : (builds.data?.items.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8">
                    <EmptyState heading="No builds for this repo" body="Runs will appear after webhook ingestion." />
                  </td>
                </tr>
              ) : (
                builds.data?.items.map((b) => (
                  <tr key={b.id} className="border-b border-[#1e1e1e] last:border-0 hover:bg-[#161616]">
                    <td className="px-4 py-3 text-[#e8e8e8]">{b.prTitle}</td>
                    <td className="px-4 py-3 text-[#6b6b6b]">{b.author}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#6b6b6b]">{b.branch}</td>
                    <td className="px-4 py-3 text-right">
                      <CostBadge cents={b.costCents} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[#6b6b6b]">{formatDuration(b.durationSeconds)}</td>
                    <td className="px-4 py-3 text-right font-mono text-[#6b6b6b]">{b.jobCount}</td>
                    <td className="px-4 py-3">
                      <ConclusionBadge conclusion={b.conclusion} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[#e8e8e8]">{b.wasteFlagCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {builds.data ? (
            <Pagination
              page={builds.data.page}
              pageSize={builds.data.pageSize}
              total={builds.data.total}
              onPageChange={setPage}
              disabled={builds.isFetching}
            />
          ) : null}
        </div>
        {builds.error ? (
          <p className="mt-2 text-sm text-red-400">
            Failed to load builds.{' '}
            <button type="button" className="underline" onClick={() => void builds.refetch()}>
              Retry
            </button>
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="text-sm font-medium text-[#6b6b6b]">Waste flags (this repo)</h2>
        <div className="mt-3 space-y-2">
          {detail.isLoading ? (
            <div className="h-20 animate-pulse rounded border border-[#1e1e1e] bg-[#111111]" />
          ) : (d?.wasteFlags.length ?? 0) === 0 ? (
            <EmptyState heading="No waste flags" body="This repository has no active waste detections." />
          ) : (
            d?.wasteFlags.map((f) => (
              <div key={f.id} className="rounded border border-[#1e1e1e] bg-[#111111] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <WasteFlagBadge type={f.type} />
                  <CostBadge cents={f.savingsCents} compact className="text-[#4ade80]" />
                </div>
                <p className="mt-2 text-sm text-[#6b6b6b]">{f.recommendation}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
