import { RateLimitError } from '../errors/app-error'

type RateLimitBucket = {
  count: number
  resetAt: number
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>()

  consume(key: string, limit: number, windowMs: number): void {
    const now = Date.now()
    const existing = this.buckets.get(key)

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      })
      return
    }

    if (existing.count >= limit) {
      throw new RateLimitError('Rate limit exceeded', {
        retryAfterMs: existing.resetAt - now,
      })
    }

    existing.count += 1
    this.buckets.set(key, existing)
  }
}
