#!/usr/bin/env node
/**
 * Mirror monorepo subtrees into sibling repos (see scripts/repos-sync.config.json).
 *
 * Usage:
 *   node scripts/sync-repos.mjs
 *   node scripts/sync-repos.mjs --dry-run
 *   node scripts/sync-repos.mjs --only proxkey-website
 *   node scripts/sync-repos.mjs --push
 *
 * Commit message override:
 *   SYNC_COMMIT_MESSAGE="sync: foo" node scripts/sync-repos.mjs --push
 */

import { readFileSync, existsSync, mkdirSync, realpathSync } from 'fs'
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CONFIG_PATH = path.join(__dirname, 'repos-sync.config.json')

const PRESETS = {
  website: [
    '.git/',
    'node_modules/',
    'server/node_modules/',
    'dist/',
    'server/dist/',
    '.venv/',
    'supabase/.temp/',
    '.turbo/',
    '.env',
    '.env.local',
    '.env.*.local',
    'server/.env',
    'server/.env.*',
  ],
  nodePackage: [
    '.git/',
    'node_modules/',
    'dist/',
    '.turbo/',
    '.env',
    '.env.local',
    '.env.*.local',
    '*.tgz',
  ],
}

function parseArgs(argv) {
  const out = { dryRun: false, push: false, only: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--dry-run') out.dryRun = true
    else if (a === '--push') out.push = true
    else if (a === '--only') {
      out.only = argv[i + 1] ?? null
      i += 1
    } else if (a === '--help' || a === '-h') {
      console.log(`sync-repos.mjs [--dry-run] [--push] [--only <id>]`)
      process.exit(0)
    }
  }
  return out
}

function loadConfig() {
  const raw = readFileSync(CONFIG_PATH, 'utf8')
  return JSON.parse(raw)
}

function resolveDestination(entry) {
  const envKey = entry.destinationEnv
  const fromEnv = envKey && process.env[envKey] ? process.env[envKey].trim() : ''
  const rel = fromEnv || entry.destinationDefault || ''
  if (!rel) return null
  return path.isAbsolute(rel) ? path.normalize(rel) : path.resolve(ROOT, rel)
}

function rsyncMirror(srcAbs, dstAbs, excludes, dryRun) {
  const args = ['-a', '--delete']
  if (dryRun) args.push('-n', '--itemize-changes')
  for (const ex of excludes) {
    args.push('--exclude', ex)
  }
  const srcSlash = srcAbs.endsWith(path.sep) ? srcAbs : `${srcAbs}${path.sep}`
  const dstSlash = dstAbs.endsWith(path.sep) ? dstAbs : `${dstAbs}${path.sep}`
  args.push(srcSlash, dstSlash)
  const r = spawnSync('rsync', args, { stdio: 'inherit' })
  return r.status === 0
}

function gitCommitPush(dstAbs, id, dryRun) {
  if (dryRun) {
    console.log(`sync-repos: ${id}: skip git (--dry-run)`)
    return true
  }
  if (!existsSync(path.join(dstAbs, '.git'))) {
    console.log(`sync-repos: ${id}: no .git in destination; skip --push`)
    return true
  }
  spawnSync('git', ['-C', dstAbs, 'add', '-A'], { stdio: 'inherit' })
  const diff = spawnSync('git', ['-C', dstAbs, 'diff', '--cached', '--quiet'], { stdio: 'ignore' })
  if (diff.status === 0) {
    console.log(`sync-repos: ${id}: nothing to commit`)
    const push = spawnSync('git', ['-C', dstAbs, 'push'], { stdio: 'inherit' })
    return push.status === 0
  }
  const msg = process.env.SYNC_COMMIT_MESSAGE ?? `sync: mirror from proxkey monorepo (${id})`
  const commit = spawnSync('git', ['-C', dstAbs, 'commit', '-m', msg], { stdio: 'inherit' })
  if (commit.status !== 0) return false
  const push = spawnSync('git', ['-C', dstAbs, 'push'], { stdio: 'inherit' })
  return push.status === 0
}

function main() {
  const { dryRun, push, only } = parseArgs(process.argv.slice(2))
  let config
  try {
    config = loadConfig()
  } catch (e) {
    console.error(`sync-repos: failed to read ${CONFIG_PATH}:`, e.message)
    process.exit(1)
  }

  const mirrors = config.mirrors ?? []
  let failed = false

  for (const entry of mirrors) {
    if (only && entry.id !== only) continue

    const preset = PRESETS[entry.preset]
    if (!preset) {
      console.error(`sync-repos: unknown preset "${entry.preset}" for ${entry.id}`)
      failed = true
      continue
    }

    const srcRel = entry.source
    const srcAbs = path.resolve(ROOT, srcRel)
    if (!existsSync(srcAbs)) {
      console.error(`sync-repos: ${entry.id}: missing source ${srcAbs}`)
      failed = true
      continue
    }

    const dstAbs = resolveDestination(entry)
    if (!dstAbs) {
      console.error(`sync-repos: ${entry.id}: could not resolve destination`)
      failed = true
      continue
    }

    if (!existsSync(dstAbs)) {
      if (entry.skipIfDestinationMissing) {
        console.log(`sync-repos: ${entry.id}: skip (destination missing: ${dstAbs})`)
        continue
      }
      if (entry.createDestination) {
        mkdirSync(dstAbs, { recursive: true })
      } else {
        console.error(`sync-repos: ${entry.id}: destination missing: ${dstAbs}`)
        failed = true
        continue
      }
    }

    const dstReal = realpathSync(dstAbs)

    console.log(`sync-repos: ${entry.id} (${entry.label})`)
    console.log(`         ${srcAbs}/ -> ${dstReal}/`)

    if (!rsyncMirror(srcAbs, dstReal, preset, dryRun)) {
      console.error(`sync-repos: ${entry.id}: rsync failed`)
      failed = true
      continue
    }

    if (push && !gitCommitPush(dstReal, entry.id, dryRun)) {
      console.error(`sync-repos: ${entry.id}: git commit/push failed`)
      failed = true
    }
  }

  if (only && !mirrors.some((m) => m.id === only)) {
    console.error(`sync-repos: no mirror with id "${only}"`)
    process.exit(1)
  }

  process.exit(failed ? 1 : 0)
}

main()
