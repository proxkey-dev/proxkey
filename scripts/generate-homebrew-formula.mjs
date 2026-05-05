#!/usr/bin/env node

import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const packageDir = path.join(repoRoot, 'cli')
const outputPath = path.join(repoRoot, 'packaging', 'homebrew', 'proxkey.rb')
const localOutputPath = path.join(repoRoot, 'packaging', 'homebrew', 'proxkey-local.rb')
const formulaName = 'proxkey'
const formulaClassName = 'Proxkey'
const localFormulaClassName = 'ProxkeyLocal'
const isLocalFormula = process.argv.includes('--local')

function fail(message) {
  console.error(message)
  process.exit(1)
}

async function loadPublishedTarballSha256(tarballUrl) {
  const response = await fetch(tarballUrl)
  if (!response.ok) {
    throw new Error(`Unable to download published tarball: ${response.status} ${response.statusText}`)
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function packTarball({ keep }) {
  const packDestination = keep ? packageDir : fs.mkdtempSync(path.join(os.tmpdir(), 'proxkey-pack-'))
  const packResult = spawnSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', packDestination], {
    cwd: packageDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_cache: path.join(os.tmpdir(), 'proxkey-npm-cache'),
    },
  })

  if (packResult.status !== 0) {
    fail(packResult.stderr || packResult.stdout || 'npm pack failed')
  }

  const packedArtifacts = JSON.parse(packResult.stdout.trim())
  const tarballFilename = packedArtifacts[0]?.filename
  if (!tarballFilename) {
    fail(`Unable to read npm pack output: ${packResult.stdout}`)
  }

  const tarballPath = path.join(packDestination, tarballFilename)
  if (!fs.existsSync(tarballPath)) {
    fail(`Packed tarball not found at ${tarballPath}`)
  }

  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(tarballPath)).digest('hex')

  if (!keep) {
    fs.rmSync(packDestination, { recursive: true, force: true })
  }

  return { tarballPath, sha256 }
}

const packageJsonPath = path.join(packageDir, 'package.json')
if (!fs.existsSync(packageJsonPath)) {
  fail(`Missing package.json at ${packageJsonPath}`)
}

if (!fs.existsSync(path.join(packageDir, 'dist', 'index.js'))) {
  fail(`Build output missing at ${path.join(packageDir, 'dist', 'index.js')}. Run the CLI build first.`)
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
if (packageJson.name !== 'proxkey-cli') {
  fail(`Expected the CLI package name to be "proxkey-cli", received "${packageJson.name}"`)
}

const version = packageJson.version
const packagePath = packageJson.name
const tarballBaseName = packageJson.name.split('/').at(-1)
if (!tarballBaseName) {
  fail(`Unable to derive tarball base name from ${packageJson.name}`)
}
const tarballUrl = `https://registry.npmjs.org/${packagePath}/-/${tarballBaseName}-${version}.tgz`

let formulaUrl = tarballUrl
let formulaOutputPath = outputPath
let formulaClass = formulaClassName
let sha256

if (isLocalFormula) {
  const packed = packTarball({ keep: true })
  formulaUrl = `file://${packed.tarballPath}`
  formulaOutputPath = localOutputPath
  formulaClass = localFormulaClassName
  sha256 = packed.sha256
} else {
  try {
    sha256 = await loadPublishedTarballSha256(tarballUrl)
  } catch {
    sha256 = packTarball({ keep: false }).sha256
  }
}

const formula = `class ${formulaClass} < Formula
  desc "CLI for ProxKey AI triage workflows"
  homepage "https://proxkey.dev"
  url "${formulaUrl}"
  sha256 "${sha256}"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/proxkey version")
    assert_match "Usage:", shell_output("#{bin}/proxkey help")
  end
end
`

fs.mkdirSync(path.dirname(formulaOutputPath), { recursive: true })
fs.writeFileSync(formulaOutputPath, formula, 'utf8')

console.log(`Wrote ${formulaOutputPath}`)
if (isLocalFormula) {
  console.log('Homebrew requires local formulae to be installed from a tap.')
  console.log('Example local tap flow:')
  console.log('  brew tap-new yourname/proxkey-local --no-git')
  console.log(`  cp ${path.relative(repoRoot, formulaOutputPath)} "$(brew --repository yourname/proxkey-local)/Formula/proxkey-local.rb"`)
  console.log('  brew install yourname/proxkey-local/proxkey-local')
} else {
  console.log(`Publish ${packageJson.name}@${version} to npm before using the ${formulaName} formula in a tap.`)
}
