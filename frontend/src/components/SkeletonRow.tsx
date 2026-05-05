export function SkeletonRow({ columns = 6 }: { columns?: number }) {
  return (
    <tr className="border-b border-[#1e1e1e]" aria-hidden>
      {Array.from({ length: columns }, (_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 animate-pulse rounded bg-[#1e1e1e]" style={{ width: `${60 + (i % 3) * 12}%` }} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded border border-[#1e1e1e] bg-[#111111] ${className}`} aria-label="Loading">
      <div className="h-40 bg-[#161616]" />
    </div>
  )
}
