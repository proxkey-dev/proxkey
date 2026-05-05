import fs from 'node:fs'

const envFiles = [
  {
    path: '.env.example',
    required: ['VITE_API_BASE_URL'],
  },
  {
    path: 'server/.env.example',
    required: [
      'NODE_ENV',
      'HOST',
      'PORT',
      'DATABASE_URL',
      'REDIS_URL',
      'REDIS_ENABLED',
      'USE_INLINE_QUEUE',
      'CORS_ALLOWED_ORIGINS',
      'APP_BASE_URL',
      'API_BASE_URL',
      'DASHBOARD_SESSION_SECRET',
      'JWT_SECRET',
      'GITHUB_APP_ID',
      'GITHUB_APP_PRIVATE_KEY',
      'GITHUB_WEBHOOK_SECRET',
      'GITHUB_CLIENT_ID',
      'GITHUB_CLIENT_SECRET',
      'RESEND_API_KEY',
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

  for (const key of missingKeys) {
    errors.push(`${envFile.path} is missing ${key}`)
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
