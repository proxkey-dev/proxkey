type Conclusion = 'success' | 'failure' | 'flaky' | 'cancelled'

const map: Record<Conclusion, string> = {
  success: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
  failure: 'border-red-500/50 bg-red-500/10 text-red-300',
  flaky: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
  cancelled: 'border-[#1e1e1e] bg-[#161616] text-[#6b6b6b]',
}

export function ConclusionBadge({ conclusion }: { conclusion: string }) {
  const c = (conclusion in map ? conclusion : 'cancelled') as Conclusion
  return (
    <span className={`inline-flex rounded px-2 py-0.5 font-mono text-xs capitalize ${map[c]} border`}>
      {c}
    </span>
  )
}
