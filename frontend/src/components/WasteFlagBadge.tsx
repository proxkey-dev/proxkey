export type WasteFlagType =
  | 'DOCS_ONLY_TRIGGER'
  | 'ALWAYS_FLAKY_TEST'
  | 'OVERSIZED_RUNNER'
  | 'REDUNDANT_MATRIX'
  | 'CACHE_MISS_CHURN'

const styles: Record<WasteFlagType, string> = {
  DOCS_ONLY_TRIGGER: 'border-amber-500/60 bg-amber-500/10 text-amber-200',
  ALWAYS_FLAKY_TEST: 'border-red-500/60 bg-red-500/10 text-red-200',
  OVERSIZED_RUNNER: 'border-orange-500/60 bg-orange-500/10 text-orange-200',
  REDUNDANT_MATRIX: 'border-yellow-500/60 bg-yellow-500/10 text-yellow-200',
  CACHE_MISS_CHURN: 'border-amber-500/60 bg-amber-500/10 text-amber-100',
}

function normalize(type: string): WasteFlagType | null {
  if (type in styles) {
    return type as WasteFlagType
  }
  return null
}

export function WasteFlagBadge({ type }: { type: string }) {
  const key = normalize(type)
  const className = key ? styles[key] : 'border-[#1e1e1e] bg-[#161616] text-[#e8e8e8]'
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs font-medium ${className} border`}
    >
      {type}
    </span>
  )
}
