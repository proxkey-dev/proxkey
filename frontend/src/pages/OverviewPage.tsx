import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  getBuildFeed,
  getSpendBreakdownRepos,
  getSpendSummary,
  getWeeklySpend,
  getWasteFlags,
} from '../lib/api'
import { formatCost, formatDuration, truncate } from '../lib/format'
import { ConclusionBadge } from '../components/ConclusionBadge'
import { CostBadge } from '../components/CostBadge'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRow } from '../components/SkeletonRow'
import { SpendChart } from '../components/SpendChart'
import { WasteFlagBadge } from '../components/WasteFlagBadge'

function DeltaBadge({ value }: { value: number }) {
  const up = value > 0
  const down = value < 0
  return (
    <span
      className={`inline-flex rounded border px-2 py-1 font-mono text-xs ${
        up ? 'border-red-500/50 text-red-300' : down ? 'border-emerald-500/50 text-emerald-300' : 'border-[#1e1e1e] text-[#6b6b6b]'
      }`}
    >
      {value > 0 ? '+' : ''}
      {value.toFixed(1)}% WoW
    </span>
  )
}

export default function OverviewPage() {
  const summary = useQuery({
    queryKey: ['spend', 'summary'],
    queryFn: getSpendSummary,
    refetchInterval: 60_000,
    staleTime: 60_000,
  })
  const weekly = useQuery({
    queryKey: ['spend', 'weekly'],
    queryFn: getWeeklySpend,
    refetchInterval: 60_000,
    staleTime: 60_000,
  })
  const repos = useQuery({
    queryKey: ['spend', 'breakdown', 'repo'],
    queryFn: getSpendBreakdownRepos,
    staleTime: 60_000,
  })
  const waste = useQuery({
    queryKey: ['waste', 'active'],
    queryFn: () => getWasteFlags({ status: 'active' }),
    staleTime: 60_000,
  })
  const builds = useQuery({
    queryKey: ['builds', 'feed', 20],
    queryFn: () => getBuildFeed(20),
    refetchInterval: 30_000,
    staleTime: 30_000,
  })

  const topFlags = (waste.data?.items ?? []).slice(0, 5)
  const activeCount = waste.data?.items.length ?? 0
  const savingsTotal = (waste.data?.items ?? []).reduce((s, f) => s + f.savingsCents, 0)

  const headerError = summary.error ?? weekly.error ?? repos.error
  if (headerError && !summary.data) {
    return (
      <div className="rounded border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
        Could not load overview.
        <button
          type="button"
          className="ml-4 rounded border border-[#e8e8e8] px-3 py-1 text-[#e8e8e8]"
          onClick={() => {
            void summary.refetch()
            void weekly.refetch()
            void repos.refetch()
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#6b6b6b]">This month</p>
          {summary.isLoading ? (
            <div className="mt-2 h-10 w-56 animate-pulse rounded bg-[#1e1e1e]" />
          ) : (
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <span className="font-mono text-3xl tabular-nums tracking-tight text-[#e8e8e8] md:text-[32px]">
                {formatCost(summary.data?.monthlySpendCents ?? 0)}
              </span>
              <DeltaBadge value={summary.data?.wowDeltaPercent ?? 0} />
            </div>
          )}
        </div>
      </header>

      <section>
        <SpendChart data={weekly.data?.weeks ?? []} loading={weekly.isLoading} />
        {weekly.error ? (
          <p className="mt-2 text-sm text-red-400">
            Chart failed to load.{' '}
            <button type="button" className="underline" onClick={() => void weekly.refetch()}>
              Retry
            </button>
          </p>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium text-[#6b6b6b]">Top repos</h2>
          <div className="mt-3 overflow-x-auto rounded border border-[#1e1e1e] bg-[#111111]">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1e1e1e] text-left text-[#6b6b6b]">
                  <th className="px-4 py-3">Repo</th>
                  <th className="px-4 py-3 text-right font-mono">Spend</th>
                  <th className="px-4 py-3 text-right font-mono">Builds</th>
                  <th className="px-4 py-3 text-right font-mono">Avg/build</th>
                  <th className="px-4 py-3 text-right font-mono">WoW</th>
                </tr>
              </thead>
              <tbody>
                {repos.isLoading ? (
                  <>
                    <SkeletonRow columns={5} />
                    <SkeletonRow columns={5} />
                    <SkeletonRow columns={5} />
                  </>
                ) : (repos.data?.rows.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8">
                      <EmptyState
                        heading="No spend this month"
                        body="Once GitHub Actions builds are ingested, repository rollups appear here."
                      />
                    </td>
                  </tr>
                ) : (
                  repos.data?.rows.map((r) => (
                    <tr key={r.repoId} className="border-b border-[#1e1e1e] last:border-0 hover:bg-[#161616]">
                      <td className="px-4 py-3">
                        <Link to={`/dashboard/repos/${r.repoId}`} className="text-[#e8e8e8] hover:text-[#4ade80]">
                          {r.repoName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <CostBadge cents={r.spendCents} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#e8e8e8]">{r.buildCount}</td>
                      <td className="px-4 py-3 text-right">
                        <CostBadge cents={r.avgCostCents} />
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono text-sm ${
                          r.wowDeltaPercent > 0 ? 'text-red-300' : r.wowDeltaPercent < 0 ? 'text-emerald-300' : 'text-[#6b6b6b]'
                        }`}
                      >
                        {r.wowDeltaPercent > 0 ? '+' : ''}
                        {r.wowDeltaPercent.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#6b6b6b]">Waste flags</h2>
          <div className="mt-3 rounded border border-[#1e1e1e] bg-[#111111]">
            {waste.isLoading ? (
              <div className="space-y-3 p-4">
                <div className="h-4 w-48 animate-pulse rounded bg-[#1e1e1e]" />
                <div className="h-12 animate-pulse rounded bg-[#161616]" />
                <div className="h-12 animate-pulse rounded bg-[#161616]" />
              </div>
            ) : activeCount === 0 ? (
              <div className="p-4">
                <EmptyState
                  heading="No active waste flags"
                  body="ProxKey will flag oversized runners, docs-only triggers, cache churn, and more when patterns show up in your builds."
                />
              </div>
            ) : (
              <>
                <div className="border-b border-[#1e1e1e] px-4 py-3 text-sm text-[#e8e8e8]">
                  <span className="font-mono text-[#4ade80]">{activeCount}</span> active flags · save up to{' '}
                  <span className="font-mono text-[#4ade80]">{formatCost(savingsTotal, true)}</span>
                  /mo
                </div>
                <ul className="divide-y divide-[#1e1e1e]">
                  {topFlags.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <WasteFlagBadge type={f.type} />
                        <p className="mt-1 truncate text-xs text-[#6b6b6b]">{f.repoName}</p>
                      </div>
                      <span className="font-mono text-sm text-[#e8e8e8]">{formatCost(f.savingsCents, true)}/mo</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[#1e1e1e] px-4 py-3">
                  <Link to="/dashboard/waste" className="text-sm text-[#4ade80] hover:underline">
                    View all
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-[#6b6b6b]">Recent builds</h2>
        <div className="mt-3 overflow-x-auto rounded border border-[#1e1e1e] bg-[#111111]">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e] text-left text-[#6b6b6b]">
                <th className="px-4 py-3">Repo</th>
                <th className="px-4 py-3">PR</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3 text-right font-mono">Cost</th>
                <th className="px-4 py-3 text-right font-mono">Duration</th>
                <th className="px-4 py-3">Conclusion</th>
              </tr>
            </thead>
            <tbody>
              {builds.isLoading ? (
                <>
                  <SkeletonRow columns={6} />
                  <SkeletonRow columns={6} />
                </>
              ) : (builds.data?.items.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <EmptyState heading="No builds yet" body="Complete a GitHub Actions run to see the live feed." />
                  </td>
                </tr>
              ) : (
                builds.data?.items.map((b) => (
                  <tr key={b.id} className="border-b border-[#1e1e1e] last:border-0 hover:bg-[#161616]">
                    <td className="px-4 py-3">
                      <Link to={`/dashboard/repos/${b.repoId}`} className="text-[#e8e8e8] hover:text-[#4ade80]">
                        {b.repoName}
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[#6b6b6b]" title={b.prTitle}>
                      {truncate(b.prTitle, 40)}
                    </td>
                    <td className="px-4 py-3 text-[#6b6b6b]">{b.author}</td>
                    <td className="px-4 py-3 text-right">
                      <CostBadge cents={b.costCents} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[#6b6b6b]">{formatDuration(b.durationSeconds)}</td>
                    <td className="px-4 py-3">
                      <ConclusionBadge conclusion={b.conclusion} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {builds.error ? (
          <p className="mt-2 text-sm text-red-400">
            Builds feed failed.{' '}
            <button type="button" className="underline" onClick={() => void builds.refetch()}>
              Retry
            </button>
          </p>
        ) : null}
      </section>
    </div>
  )
}
