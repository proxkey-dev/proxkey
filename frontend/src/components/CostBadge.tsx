import { formatCost } from '../lib/format'

type Props = {
  cents: number
  compact?: boolean
  className?: string
}

export function CostBadge({ cents, compact = false, className = '' }: Props) {
  return (
    <span className={`font-mono tabular-nums text-right ${className}`} translate="no">
      {formatCost(cents, compact)}
    </span>
  )
}
