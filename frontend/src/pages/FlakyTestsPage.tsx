import { useQuery } from '@tanstack/react-query'
import { getFlakyTests } from '../lib/api'
import { formatCost } from '../lib/format'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRow } from '../components/SkeletonRow'

export default function FlakyTestsPage() {
  const q = useQuery({
    queryKey: ['flaky-tests'],
    queryFn: getFlakyTests,
    staleTime: 60_000,
  })

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-mono text-xl text-[#e8e8e8]">Flaky tests</h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">Sorted by estimated wasted compute (30 days).</p>
      </header>

      <div className="overflow-x-auto rounded border border-[#1e1e1e] bg-[#111111]">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#1e1e1e] text-left text-[#6b6b6b]">
              <th className="px-4 py-3">Test name</th>
              <th className="px-4 py-3">Suite</th>
              <th className="px-4 py-3">Repo</th>
              <th className="px-4 py-3">Flaky rate 30d</th>
              <th className="px-4 py-3 text-right font-mono">Est. waste</th>
              <th className="px-4 py-3 font-mono">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading ? (
              <>
                <SkeletonRow columns={6} />
                <SkeletonRow columns={6} />
              </>
            ) : q.error ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-red-300">
                  {q.error instanceof Error ? q.error.message : 'Failed to load'}
                  <button type="button" className="ml-3 underline" onClick={() => void q.refetch()}>
                    Retry
                  </button>
                </td>
              </tr>
            ) : (q.data?.items.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8">
                  <EmptyState
                    heading="No flaky signals"
                    body="Test results linked to builds will populate flaky rate and waste estimates."
                  />
                </td>
              </tr>
            ) : (
              q.data?.items.map((t) => {
                const pct = Math.min(100, Number((t.flakyRate * 100).toFixed(1)))
                return (
                  <tr key={t.id} className="border-b border-[#1e1e1e] last:border-0 hover:bg-[#161616]">
                    <td className="max-w-xs truncate px-4 py-3 text-[#e8e8e8]" title={t.testName}>
                      {t.testName}
                    </td>
                    <td className="px-4 py-3 text-[#6b6b6b]">{t.suite}</td>
                    <td className="px-4 py-3 text-[#6b6b6b]">{t.repoName}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-[#e8e8e8]">{pct}%</span>
                        <div className="h-2 w-24 overflow-hidden rounded bg-[#1e1e1e]" role="presentation">
                          <div className="h-full bg-[#f59e0b]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[#4ade80]">{formatCost(t.wastedComputeCents)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#6b6b6b]">
                      {new Date(t.lastSeen).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
