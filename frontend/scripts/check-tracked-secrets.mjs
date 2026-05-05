import { execFileSync } from 'node:child_process'

const allowedEnvFiles = new Set(['.env.example', 'server/.env.example'])
const trackedFiles = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

const trackedSecretFiles = trackedFiles.filter((filePath) => {
  const fileName = filePath.split('/').at(-1)
  return fileName?.startsWith('.env') && !allowedEnvFiles.has(filePath)
})

if (trackedSecretFiles.length > 0) {
  console.error(
    [
      'Sensitive env files must not be tracked. Keep only .env.example files in git.',
      ...trackedSecretFiles.map((filePath) => `- ${filePath}`),
    ].join('\n'),
  )
  process.exit(1)
}

console.log('No tracked non-example env files found.')
