import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getRepos } from '../lib/api'
import { EmptyState } from '../components/EmptyState'
import { SkeletonRow } from '../components/SkeletonRow'

export default function ReposIndexPage() {
  const q = useQuery({ queryKey: ['repos'], queryFn: getRepos, staleTime: 60_000 })

  if (q.isLoading) {
    return (
      <div>
        <h1 className="font-mono text-xl text-[#e8e8e8]">Repositories</h1>
        <div className="mt-6 overflow-x-auto rounded border border-[#1e1e1e] bg-[#111111]">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e] text-left text-[#6b6b6b]">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Default branch</th>
              </tr>
            </thead>
            <tbody>
              <SkeletonRow columns={2} />
              <SkeletonRow columns={2} />
              <SkeletonRow columns={2} />
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (q.error) {
    return (
      <div className="rounded border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
        {q.error instanceof Error ? q.error.message : 'Failed to load repos.'}
        <button
          type="button"
          className="ml-4 rounded border border-[#e8e8e8] px-3 py-1 text-[#e8e8e8]"
          onClick={() => void q.refetch()}
        >
          Retry
        </button>
      </div>
    )
  }

  const items = q.data?.items ?? []
  if (items.length === 0) {
    return (
      <div>
        <h1 className="font-mono text-xl text-[#e8e8e8]">Repositories</h1>
        <div className="mt-6">
          <EmptyState
            heading="No repositories yet"
            body="Connect the GitHub App and run a workflow. Repositories appear here once ProxKey receives webhook data."
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-mono text-xl text-[#e8e8e8]">Repositories</h1>
      <div className="mt-6 overflow-x-auto rounded border border-[#1e1e1e] bg-[#111111]">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#1e1e1e] text-left text-[#6b6b6b]">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Default branch</th>
              <th className="px-4 py-3">Provider</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-[#1e1e1e] last:border-0 hover:bg-[#161616]">
                <td className="px-4 py-3">
                  <Link className="text-[#e8e8e8] hover:text-[#4ade80]" to={`/dashboard/repos/${r.id}`}>
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-[#6b6b6b]">{r.defaultBranch}</td>
                <td className="px-4 py-3 text-[#6b6b6b]">GitHub Actions</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
