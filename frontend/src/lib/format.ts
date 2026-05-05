export function formatCost(cents: number, compact = false): string {
  const dollars = cents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: compact || dollars >= 1000 ? 0 : 2,
    minimumFractionDigits: compact || dollars >= 1000 ? 0 : 2,
  }).format(dollars)
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) {
    return s
  }
  return `${s.slice(0, max - 1)}…`
}
