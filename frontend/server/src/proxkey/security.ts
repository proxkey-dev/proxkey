export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function redactSensitiveText(input: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]'],
    [/\b(?:\+?\d{1,3}[-. ]?)?(?:\(?\d{2,4}\)?[-. ]?)?\d{3}[-. ]?\d{4}\b/g, '[REDACTED_PHONE]'],
    [/\b(?:sk|pk|rk)_[a-zA-Z0-9]{12,}\b/g, '[REDACTED_API_KEY]'],
    [/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[REDACTED_JWT]'],
    [/(authorization\s*:\s*)bearer\s+[^\s]+/gi, '$1[REDACTED_TOKEN]'],
    [
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s'"]+/gi,
      '[REDACTED_CONNECTION_STRING]',
    ],
    [
      /-----BEGIN(?:[ A-Z]+)?PRIVATE KEY-----[\s\S]+?-----END(?:[ A-Z]+)?PRIVATE KEY-----/g,
      '[REDACTED_PRIVATE_KEY]',
    ],
  ]

  return replacements.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    input,
  )
}
