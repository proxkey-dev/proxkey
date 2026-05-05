type RedactionServiceOptions = {
  redactEmails: boolean
  redactPhones: boolean
}

export class RedactionService {
  constructor(private readonly options: RedactionServiceOptions) {}

  redactText(input: string): string {
    const replacements: Array<[RegExp, string]> = [
      [/(authorization\s*:\s*)bearer\s+[^\s]+/gi, '$1[REDACTED_AUTH_HEADER]'],
      [/\bbearer\s+[a-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED_BEARER_TOKEN]'],
      [/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[REDACTED_JWT]'],
      [/\b(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA)[A-Z0-9]{16}\b/g, '[REDACTED_AWS_KEY]'],
      [
        /-----BEGIN(?:[ A-Z]+)?PRIVATE KEY-----[\s\S]+?-----END(?:[ A-Z]+)?PRIVATE KEY-----/g,
        '[REDACTED_PRIVATE_KEY]',
      ],
      [
        /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s'"]+/gi,
        '[REDACTED_DATABASE_URL]',
      ],
      [/\b(?:sk|pk|rk)_[a-zA-Z0-9]{12,}\b/g, '[REDACTED_API_KEY]'],
      [/(api[_-]?key\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED_API_KEY]'],
      [/(password\s*[:=]\s*)([^\s,;]+)/gi, '$1[REDACTED_PASSWORD]'],
      [/(set-cookie\s*:\s*)([^\n]+)/gi, '$1[REDACTED_COOKIE]'],
      [/(cookie\s*:\s*)([^\n]+)/gi, '$1[REDACTED_COOKIE]'],
    ]

    if (this.options.redactEmails) {
      replacements.push([/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]'])
    }

    if (this.options.redactPhones) {
      replacements.push([
        /\b(?:\+?\d{1,3}[-. ]?)?(?:\(?\d{2,4}\)?[-. ]?)?\d{3}[-. ]?\d{4}\b/g,
        '[REDACTED_PHONE]',
      ])
    }

    return replacements.reduce(
      (value, [pattern, replacement]) => value.replace(pattern, replacement),
      input,
    )
  }

  redactUnknown<T>(value: T): T {
    if (typeof value === 'string') {
      return this.redactText(value) as T
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.redactUnknown(item)) as T
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        this.redactUnknown(item),
      ])

      return Object.fromEntries(entries) as T
    }

    return value
  }
}
