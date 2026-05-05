import fs from 'node:fs'

const envFiles = [
  {
    path: '.env.example',
    required: [
      'VITE_API_BASE_URL',
      'VITE_AUTH0_DOMAIN',
      'VITE_AUTH0_CLIENT_ID',
      'VITE_AUTH0_AUDIENCE',
      'VITE_AUTH0_CALLBACK_URL',
    ],
  },
  {
    path: 'server/.env.example',
    required: [
      'NODE_ENV',
      'HOST',
      'PORT',
      'DATABASE_URL',
      'CORS_ORIGINS',
      'BODY_LIMIT_BYTES',
      'SESSION_COOKIE_NAME',
      'SESSION_TTL_HOURS',
      'CONTENT_ENCRYPTION_KEY',
      'LLM_PROVIDER',
      'AUTH0_DOMAIN',
      'AUTH0_AUDIENCE',
      'AUTH0_CLIENT_ID',
      'AUTH0_CLI_CLIENT_ID',
      'AUTH0_ISSUER_BASE_URL',
      'FRONTEND_ORIGIN',
      'REDIS_ENABLED',
      'USE_INLINE_QUEUE',
      'ENABLE_OVERAGES',
      'LOG_LEVEL',
    ],
  },
]

function parseEnvExample(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const entries = new Map()
  const duplicates = new Set()

  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      throw new Error(`${filePath}:${index + 1} is not KEY=value format`)
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1)

    if (entries.has(key)) {
      duplicates.add(key)
    }

    entries.set(key, value)
  }

  return { entries, duplicates }
}

const errors = []

for (const envFile of envFiles) {
  if (!fs.existsSync(envFile.path)) {
    errors.push(`${envFile.path} is missing`)
    continue
  }

  const { entries, duplicates } = parseEnvExample(envFile.path)
  const missingKeys = envFile.required.filter((key) => !entries.has(key))
  const blankRequiredKeys = envFile.required.filter(
    (key) => entries.has(key) && entries.get(key)?.trim() === '',
  )

  for (const key of missingKeys) {
    errors.push(`${envFile.path} is missing ${key}`)
  }

  for (const key of blankRequiredKeys) {
    errors.push(`${envFile.path} has an invalid ${key} entry`)
  }

  for (const key of duplicates) {
    errors.push(`${envFile.path} defines ${key} more than once`)
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('Environment example files contain the required keys.')
