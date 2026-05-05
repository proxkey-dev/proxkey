import { describe, expect, it } from 'vitest'
import { RedactionService } from '../services/redaction.service'

describe('redaction', () => {
  it('removes secrets from text before LLM calls or logging', () => {
    const service = new RedactionService({
      redactEmails: true,
      redactPhones: true,
    })

    const redacted = service.redactText(`
      Authorization: Bearer sk_live_1234567890abcdef
      token=eyJhbGciOiJIUzI1NiJ9.payload.signature
      password=supersecret
      postgres://user:pass@localhost:5432/app
      AKIAIOSFODNN7EXAMPLE
      user@example.com
      +1 (555) 555-1212
    `)

    expect(redacted).toContain('[REDACTED_AUTH_HEADER]')
    expect(redacted).toContain('[REDACTED_PASSWORD]')
    expect(redacted).toContain('[REDACTED_DATABASE_URL]')
    expect(redacted).toContain('[REDACTED_AWS_KEY]')
    expect(redacted).toContain('[REDACTED_EMAIL]')
    expect(redacted).toContain('[REDACTED_PHONE]')
  })
})
