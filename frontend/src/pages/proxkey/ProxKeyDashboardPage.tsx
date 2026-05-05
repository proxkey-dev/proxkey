import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  proxkeyApi,
  type AuthUser,
  type DashboardStats,
  type InboxItem,
} from '../../lib/proxkey-api'
import { useAuth } from '../../contexts/AuthContext'
import { demoExamples, onboardingTools, onboardingTypes } from '../../lib/proxkey-samples'

type AuthMode = 'login' | 'signup'

type ProxKeyDashboardPageProps = {
  onOpenAuth: (mode?: AuthMode) => void
}

type EmployeeForm = {
  name: string
  email: string
  role: 'ADMIN' | 'TRIAGE_LEAD' | 'EMPLOYEE'
}

type TriageForm = {
  title: string
  rawText: string
  logs: string
}

function formatStatus(status: InboxItem['status']): string {
  return status.replace(/_/g, ' ')
}

function formatSeverity(severity: InboxItem['severity']): string {
  if (!severity) {
    return '-'
  }

  return severity === 'CRITICAL'
    ? 'SEV-1'
    : severity === 'HIGH'
      ? 'SEV-2'
      : severity === 'MEDIUM'
        ? 'SEV-3'
        : 'SEV-4'
}

function Panel({
  className = '',
  children,
  id,
}: {
  className?: string
  children: React.ReactNode
  id?: string
}) {
  return (
    <section
      id={id}
      className={`pk-frame bg-white shadow-[0_16px_36px_rgba(25,20,15,0.04)] ${className}`}
    >
      {children}
    </section>
  )
}

function DarkPanel({
  className = '',
  children,
  id,
}: {
  className?: string
  children: React.ReactNode
  id?: string
}) {
  return (
    <section
      id={id}
      className={`relative border border-[#1f2933] bg-[#11161d] shadow-[0_18px_44px_rgba(0,0,0,0.22)] [clip-path:polygon(0_0,calc(100%-14px)_0,100%_14px,100%_100%,14px_100%,0_calc(100%-14px))] ${className}`}
    >
      {children}
    </section>
  )
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#ece8df] bg-[#faf8f4] px-4 py-4 [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,10px_100%,0_calc(100%-10px))]">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[#111]">{value}</div>
    </div>
  )
}

function TogglePill({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-2 text-sm font-medium transition ${
        active ? 'border-[#111] bg-[#111] text-white' : 'border-[#d6d2c8] bg-white text-[#111]'
      }`}
    >
      {label}
    </button>
  )
}

const installCommands = {
  npm: 'npm install -g @notomer/proxkey-cli',
  homebrew: 'brew tap proxkey/tap\nbrew install proxkey',
  npx: 'npx @notomer/proxkey-cli@latest init',
} as const

type InstallTab = keyof typeof installCommands

const tocLinks = [
  ['Install', 'install'],
  ['Authenticate', 'authenticate'],
  ['Initialize', 'initialize'],
  ['Integrations', 'integrations'],
  ['Quickstart', 'quickstart'],
  ['Commands', 'commands'],
  ['CI', 'ci'],
  ['Output', 'output'],
  ['Doctor', 'doctor'],
] as const

const integrations = [
  ['GitHub', 'Open issues and attach packet evidence to repos.', 'Engineering systems'],
  ['Jira', 'Export triage packets into project workflows.', 'Engineering systems'],
  ['Linear', 'Create focused issues with owner and severity.', 'Engineering systems'],
  ['Slack', 'Ingest escalation threads and notify owners.', 'Communication'],
  ['Sentry', 'Attach errors, traces, and release context.', 'Signals'],
  ['Datadog', 'Pull logs and monitor evidence into packets.', 'Signals'],
  ['PagerDuty', 'Connect incidents to follow-up engineering work.', 'Signals'],
  ['Splunk', 'Convert log searches into packet evidence.', 'Signals'],
] as const

const quickstartSteps = [
  ['Add source material', 'proxkey triage ./incident.md'],
  ['Add more evidence', 'proxkey triage ./logs/error.log --attach ./screenshots/failure.png'],
  ['Review packet', 'proxkey inspect pk_1842'],
  [
    'Export',
    'proxkey export pk_1842 --to github\nproxkey export pk_1842 --to linear\nproxkey export pk_1842 --to markdown',
  ],
] as const

function copyText(value: string): Promise<void> {
  if (!navigator.clipboard) {
    return Promise.resolve()
  }

  return navigator.clipboard.writeText(value)
}

function CodeBlock({
  label,
  code,
  compact = false,
}: {
  label?: string
  code: string
  compact?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(): Promise<void> {
    await copyText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="overflow-hidden border border-[#202a35] bg-[#0d1117] text-white shadow-[0_16px_36px_rgba(0,0,0,0.2)]">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[#202a35] bg-[#151a20] px-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#9eaaba]">
          {label ?? 'Command'}
        </div>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="border border-[#26313d] bg-[#111318] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[#dbe2ea] transition hover:border-[#9a5137] hover:text-white"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className={`overflow-x-auto whitespace-pre-wrap px-4 font-mono text-sm leading-7 text-[#f3e9dc] ${compact ? 'py-3' : 'py-4'}`}
      >
        {code}
      </pre>
    </div>
  )
}

function Pill({
  children,
  tone = 'dark',
}: {
  children: React.ReactNode
  tone?: 'dark' | 'light' | 'orange' | 'success'
}) {
  const classes =
    tone === 'light'
      ? 'border-[#e2d8c9] bg-[#faf6ee] text-[#5c554c]'
      : tone === 'orange'
        ? 'border-[#6a3525] bg-[#251714] text-[#ffb49b]'
        : tone === 'success'
          ? 'border-[#294b3a] bg-[#102018] text-[#b9f0d0]'
          : 'border-[#384350] bg-[#181d24] text-[#dbe2ea]'

  return (
    <span
      className={`inline-flex border px-3 py-2 text-[11px] uppercase tracking-[0.16em] ${classes}`}
    >
      {children}
    </span>
  )
}

function SectionIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[#9eaaba]">{eyebrow}</div>
      <h2 className="mt-3 font-['Georgia'] text-3xl tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {copy ? <p className="mt-3 text-sm leading-7 text-[#c7d0da]">{copy}</p> : null}
    </div>
  )
}

function PublicDashboardPreview({ onOpenAuth }: { onOpenAuth: (mode?: AuthMode) => void }) {
  const [activeInstallTab, setActiveInstallTab] = useState<InstallTab>('npm')

  return (
    <div className="bg-[linear-gradient(180deg,#080a0d_0%,#0d1117_44%,#111318_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="hidden self-start lg:sticky lg:top-28 lg:block">
          <div className="border border-[#202a35] bg-[#11161d] p-3">
            <div className="px-2 py-2 text-[10px] uppercase tracking-[0.2em] text-[#8491a1]">
              Setup path
            </div>
            <div className="grid gap-1">
              {tocLinks.map(([label, id]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="border border-transparent px-2 py-2 text-[11px] uppercase tracking-[0.14em] text-[#c7d0da] transition hover:border-[#26313d] hover:bg-[#171c22] hover:text-white"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <DarkPanel className="pk-grid-surface bg-[linear-gradient(145deg,#10141a_0%,#181f28_100%)] px-6 py-8 text-white md:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#ffb49b]">
                  Get started with ProxKey
                </div>
                <h1 className="mt-4 font-['Georgia'] text-[clamp(38px,7vw,68px)] leading-[0.98] tracking-tight text-white">
                  Install the CLI. Connect your stack. Triage faster.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-[#c3ccd6]">
                  ProxKey ingests noisy logs, support escalations, failing tests, screenshots, and
                  incident notes, then turns them into structured engineering packets with severity,
                  ownership, evidence, and export-ready handoffs.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void copyText(installCommands.npm)}
                    className="border border-[#ff5a1f] bg-[#ff5a1f] px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white transition hover:bg-[#ff6c35]"
                  >
                    Install with npm
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyText(installCommands.homebrew)}
                    className="border border-[#5b3328] bg-[#251714] px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-[#ffcfbd] transition hover:border-[#9a5137]"
                  >
                    Install with Homebrew
                  </button>
                  <a
                    href="#quickstart"
                    className="border border-[#26313d] bg-[#171c22] px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white transition hover:border-[#9a5137]"
                  >
                    View quickstart
                  </a>
                  <Link
                    to="/docs"
                    className="border border-[#26313d] bg-transparent px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white transition hover:border-[#52606d]"
                  >
                    Open docs
                  </Link>
                </div>
              </div>

              <div className="grid gap-4">
                <CodeBlock
                  label="Terminal"
                  code={`$ npm install -g @notomer/proxkey-cli
$ proxkey login
$ proxkey init
$ proxkey connect github
$ proxkey triage ./reports/incident.txt`}
                />
                <div className="border border-[#202a35] bg-[#111318] p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#9eaaba]">
                    Structured output
                  </div>
                  <div className="mt-3 grid gap-2 font-mono text-sm leading-7 text-[#f4ede4]">
                    <div>Packet created: pk_1842</div>
                    <div>Severity: SEV-2</div>
                    <div>Likely owner: Platform</div>
                    <div>Missing context: Request timeline</div>
                    <div>Export targets: GitHub, Jira, Linear, Markdown</div>
                  </div>
                </div>
              </div>
            </div>
          </DarkPanel>

          <DarkPanel id="install" className="px-6 py-7 text-white">
            <SectionIntro
              eyebrow="Install"
              title="Install ProxKey CLI"
              copy="Use the ProxKey CLI locally or in CI to ingest noisy engineering inputs and turn them into structured triage packets."
            />
            <div className="mt-6 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {(Object.keys(installCommands) as InstallTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveInstallTab(tab)}
                    className={`border px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.14em] transition ${
                      activeInstallTab === tab
                        ? 'border-[#9a5137] bg-[#251714] text-[#ffcfbd]'
                        : 'border-[#26313d] bg-[#151a20] text-[#dbe2ea] hover:border-[#52606d]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
                <div className="border border-[#26313d] bg-[#151a20] px-4 py-4 text-sm leading-7 text-[#c7d0da]">
                  <div>Supports macOS and Linux first.</div>
                  <div>Node 18+ recommended.</div>
                </div>
              </div>
              <CodeBlock label={activeInstallTab} code={installCommands[activeInstallTab]} />
            </div>
          </DarkPanel>

          <DarkPanel id="authenticate" className="px-6 py-7 text-white">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <SectionIntro
                eyebrow="Authenticate"
                title="Authenticate your workspace"
                copy="Sign in once to connect the CLI to your ProxKey workspace and API."
              />
              <div className="grid gap-4">
                <CodeBlock label="Browser sign-in" code="proxkey login" compact />
                <CodeBlock
                  label="Token auth"
                  code={`export PROXKEY_API_KEY=pk_live_xxxxx
proxkey auth verify`}
                  compact
                />
                <div className="grid gap-2 sm:grid-cols-3">
                  {['Workspace connected', 'CLI verified', 'Ready to ingest signals'].map(
                    (item) => (
                      <div
                        key={item}
                        className="border border-[#294b3a] bg-[#102018] px-4 py-4 text-sm font-medium text-[#b9f0d0]"
                      >
                        {item}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </DarkPanel>

          <DarkPanel id="initialize" className="px-6 py-7 text-white">
            <SectionIntro eyebrow="Initialize" title="Initialize ProxKey in your repo" />
            <div className="mt-6 grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
              <div className="grid gap-4">
                <CodeBlock label="Repo setup" code="proxkey init" compact />
                <div className="border border-[#26313d] bg-[#151a20] p-4 font-mono text-sm leading-7 text-[#f4ede4]">
                  <div>.proxkey/</div>
                  <div>proxkey.config.yaml</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {[
                    'Repo-aware configuration',
                    'Local + CI compatible',
                    'Export-ready packets',
                  ].map((item) => (
                    <div
                      key={item}
                      className="border border-[#26313d] bg-[#151a20] px-4 py-4 text-sm text-[#dbe2ea]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <CodeBlock
                label="proxkey.config.yaml"
                code={`workspace: acme-platform
project: checkout-service
sources:
  logs:
    enabled: true
    path: ./logs
  incidents:
    enabled: true
    path: ./incidents
  screenshots:
    enabled: true
    path: ./evidence/screenshots
integrations:
  github: true
  jira: false
  linear: true`}
              />
            </div>
          </DarkPanel>

          <DarkPanel id="integrations" className="px-6 py-7 text-white">
            <SectionIntro
              eyebrow="Integrations"
              title="Connect the tools your team already uses"
              copy="Wire ProxKey into the systems that hold code, alerts, incidents, and handoffs."
            />
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {integrations.map(([name, description, bucket]) => (
                <div
                  key={name}
                  className="group border border-[#26313d] bg-[#151a20] p-4 transition hover:border-[#52606d] hover:bg-[#171c22]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white">{name}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#8491a1]">
                        {bucket}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="border border-[#26313d] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#dbe2ea] group-hover:border-[#52606d]"
                    >
                      Connect
                    </button>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#c7d0da]">{description}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <CodeBlock
                label="Connect commands"
                code={`proxkey connect github
proxkey connect jira
proxkey connect linear
proxkey connect slack`}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                {['Engineering systems', 'Signals', 'Communication'].map((bucket) => (
                  <div key={bucket} className="border border-[#26313d] bg-[#151a20] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#9eaaba]">
                      {bucket}
                    </div>
                    <div className="mt-3 text-sm leading-7 text-[#dbe2ea]">
                      {integrations
                        .filter((item) => item[2] === bucket)
                        .map((item) => item[0])
                        .join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DarkPanel>

          <DarkPanel id="quickstart" className="px-6 py-7 text-white">
            <SectionIntro eyebrow="Quickstart" title="From raw input to triage packet in minutes" />
            <div className="mt-6 grid gap-3 xl:grid-cols-4">
              {quickstartSteps.map(([title, command], index) => (
                <div key={title} className="border border-[#26313d] bg-[#151a20] p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[#ffb49b]">
                    Step {index + 1}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">{title}</div>
                  <div className="mt-4">
                    <CodeBlock label="Run" code={command} compact />
                  </div>
                </div>
              ))}
            </div>
          </DarkPanel>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <DarkPanel id="commands" className="px-6 py-7 text-white">
              <SectionIntro eyebrow="Commands" title="Common CLI commands" />
              <div className="mt-6">
                <CodeBlock
                  label="Reference"
                  code={`proxkey login                    # authenticate CLI
proxkey init                     # initialize config in repo
proxkey connect github           # connect integration
proxkey triage ./report.txt      # generate a packet from a raw report
proxkey inspect pk_1842          # inspect generated packet
proxkey export pk_1842 --to jira # export to external system
proxkey doctor                   # validate CLI setup
proxkey version                  # check installed version`}
                />
              </div>
            </DarkPanel>

            <DarkPanel id="ci" className="px-6 py-7 text-white">
              <SectionIntro
                eyebrow="CI setup"
                title="Run ProxKey in CI"
                copy="Use ProxKey in GitHub Actions or other CI pipelines to convert failing job outputs into structured triage artifacts."
              />
              <div className="mt-6">
                <CodeBlock
                  label="GitHub Actions"
                  code={`- name: Install ProxKey
  run: npm install -g @notomer/proxkey-cli
- name: Authenticate
  run: proxkey auth verify
  env:
    PROXKEY_API_KEY: \${{ secrets.PROXKEY_API_KEY }}
- name: Triage failing artifacts
  run: proxkey triage ./artifacts/test-failures.log --to markdown`}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  'Packet generated',
                  'Owner suggested',
                  'Severity ranked',
                  'Missing context flagged',
                ].map((item) => (
                  <Pill key={item} tone="success">
                    {item}
                  </Pill>
                ))}
              </div>
            </DarkPanel>
          </div>

          <DarkPanel id="output" className="px-6 py-7 text-white">
            <SectionIntro
              eyebrow="Output"
              title="What ProxKey produces"
              copy="Setup ends with a structured packet that is ready to inspect, route, and export."
            />
            <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Title', 'Checkout 500s after deploy'],
                  ['Severity', 'SEV-2'],
                  ['Likely owner', 'Platform'],
                  ['Confidence', '82%'],
                  ['Evidence', 'incident.md, error.log, failure.png'],
                  ['Export targets', 'GitHub, Jira, Linear, Markdown'],
                ].map(([label, value]) => (
                  <div key={label} className="border border-[#26313d] bg-[#151a20] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#9eaaba]">
                      {label}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[#f4ede4]">{value}</div>
                  </div>
                ))}
              </div>
              <div className="border border-[#26313d] bg-[#151a20] p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[#9eaaba]">
                  Packet preview
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  Checkout requests fail after auth deploy
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#dbe2ea]">
                  Checkout POST requests started returning 500s after the auth callback release.
                  Logs point to a missing session token in the payment handoff path.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#9eaaba]">
                      Repro steps
                    </div>
                    <ol className="mt-2 space-y-2 text-sm leading-7 text-[#dbe2ea]">
                      <li>1. Log in as a test customer</li>
                      <li>2. Add item to cart</li>
                      <li>3. Submit checkout after callback redirect</li>
                    </ol>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#9eaaba]">
                      Missing context
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pill tone="orange">Request timeline</Pill>
                      <Pill tone="orange">Deploy SHA</Pill>
                      <Pill tone="orange">Affected account IDs</Pill>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DarkPanel>

          <DarkPanel id="doctor" className="px-6 py-7 text-white">
            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <SectionIntro
                eyebrow="Troubleshooting"
                title="Validate your setup"
                copy="Run the doctor command before first export or inside CI to catch missing auth, config, and integrations."
              />
              <div className="grid gap-4">
                <CodeBlock label="Doctor" code="proxkey doctor" compact />
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    'CLI installed',
                    'Auth valid',
                    'Config found',
                    'Integrations reachable',
                    'Export targets available',
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between border border-[#26313d] bg-[#151a20] px-4 py-3 text-sm text-[#dbe2ea]"
                    >
                      <span>{item}</span>
                      <span className="text-[#b9f0d0]">pass</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DarkPanel>

          <DarkPanel className="border-[#322822] bg-[linear-gradient(145deg,#251714_0%,#14171d_100%)] px-6 py-8 text-white">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#ffb49b]">
                  Ready to triage your first issue?
                </div>
                <h2 className="mt-3 font-['Georgia'] text-3xl tracking-tight text-white sm:text-4xl">
                  Install ProxKey and create your first packet.
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void copyText(installCommands.npm)}
                  className="border border-[#ff5a1f] bg-[#ff5a1f] px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white"
                >
                  Install ProxKey CLI
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="border border-[#ffad8b] bg-transparent px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-[#ffcfbd]"
                >
                  Create workspace
                </button>
                <Link
                  to="/docs"
                  className="border border-[#26313d] bg-[#111318] px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white"
                >
                  Read docs
                </Link>
              </div>
            </div>
          </DarkPanel>
        </div>
      </div>
    </div>
  )
}

export default function ProxKeyDashboardPage({ onOpenAuth }: ProxKeyDashboardPageProps) {
  const navigate = useNavigate()
  const { user, organization, role } = useAuth()
  const [inbox, setInbox] = useState<{
    items: InboxItem[]
    highSeverity: number
    needsReview: number
    missingInfo: number
    duplicateClusters: number
  } | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [billing, setBilling] = useState<{
    organization: {
      id: string
      name: string
      plan: string
      subscriptionStatus: string
    }
    limits: {
      packets: number | null
      seats: number | null
      repos: number | null
    }
  } | null>(null)
  const [usage, setUsage] = useState<{
    plan: string
    completedPackets: number
    packetLimit: number | null
    remainingPackets: number | null
    seatsUsed: number
  } | null>(null)
  const [apiKeys, setApiKeys] = useState<
    Array<{
      id: string
      name: string
      keyPrefix: string
      lastUsedAt: string | null
      revokedAt: string | null
      createdAt: string
    }>
  >([])
  const [employees, setEmployees] = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>({
    name: '',
    email: '',
    role: 'EMPLOYEE',
  })
  const [triageForm, setTriageForm] = useState<TriageForm>({
    title: '',
    rawText: '',
    logs: '',
  })
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['Bugs'])
  const [selectedTools, setSelectedTools] = useState<string[]>(['GitHub'])
  const [onboardingTitle, setOnboardingTitle] = useState(demoExamples[1].title)
  const [onboardingText, setOnboardingText] = useState(demoExamples[1].rawText)
  const [onboardingLogs, setOnboardingLogs] = useState(demoExamples[1].logs ?? '')
  const [submittingReport, setSubmittingReport] = useState(false)
  const [submittingOnboarding, setSubmittingOnboarding] = useState(false)
  const [newApiKeyName, setNewApiKeyName] = useState('CI ingestion')
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null)
  const [pendingPacketTitle, setPendingPacketTitle] = useState<string | null>(null)

  const isOwner = role === 'OWNER'
  const canManageEmployees = role === 'OWNER' || role === 'ADMIN' || role === 'TRIAGE_LEAD'
  const canManageKeys = role === 'OWNER' || role === 'ADMIN'

  const loadDashboard = useCallback(async (): Promise<void> => {
    if (!user) {
      return
    }

    try {
      const [nextInbox, nextStats, nextEmployees] = await Promise.all([
        proxkeyApi.inbox(),
        isOwner ? proxkeyApi.stats() : Promise.resolve(null),
        canManageEmployees ? proxkeyApi.employees() : Promise.resolve({ items: [] as AuthUser[] }),
      ])
      const [nextBilling, nextUsage, nextApiKeys] = await Promise.all([
        proxkeyApi.billingPlan().catch(() => null),
        proxkeyApi.billingUsage().catch(() => null),
        canManageKeys
          ? proxkeyApi.apiKeys().catch(() => ({ items: [] }))
          : Promise.resolve({ items: [] }),
      ])

      setInbox(nextInbox)
      setStats(nextStats)
      setEmployees(nextEmployees.items)
      setBilling(nextBilling)
      setUsage(nextUsage)
      setApiKeys(nextApiKeys.items)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard.')
    } finally {
      setLoading(false)
    }
  }, [canManageEmployees, canManageKeys, isOwner, user])

  useEffect(() => {
    void loadDashboard()
    const interval = window.setInterval(() => {
      void loadDashboard()
    }, 5000)

    return () => {
      window.clearInterval(interval)
    }
  }, [loadDashboard])

  const personalMetrics = useMemo(() => {
    if (!inbox || !user) {
      return null
    }

    const assigned = inbox.items.filter((item) => item.owner === user.name)
    return {
      assigned: assigned.length,
      highPriority: assigned.filter(
        (item) => item.severity === 'HIGH' || item.severity === 'CRITICAL',
      ).length,
      reviewQueue: assigned.filter((item) => item.status === 'NEEDS_REVIEW').length,
      ready: assigned.filter((item) => item.status === 'ASSIGNED' || item.status === 'TRIAGED')
        .length,
    }
  }, [inbox, user])

  const ownerSummary = useMemo(() => {
    if (!inbox || !stats) {
      return null
    }

    return {
      packets: stats.companyHealth.totalReports,
      highSeverity: inbox.highSeverity,
      missingInfo: inbox.missingInfo,
      avgConfidence: `${Math.round(stats.companyHealth.avgConfidence * 100)}%`,
      readyForExport: inbox.items.filter(
        (item) => item.status === 'ASSIGNED' || item.status === 'TRIAGED',
      ).length,
    }
  }, [inbox, stats])

  const alerts = useMemo(() => {
    if (!inbox) {
      return []
    }

    return [
      inbox.items.filter(
        (item) => (item.severity === 'HIGH' || item.severity === 'CRITICAL') && !item.owner,
      ).length > 0
        ? `${inbox.items.filter((item) => (item.severity === 'HIGH' || item.severity === 'CRITICAL') && !item.owner).length} high-severity packets are still unassigned.`
        : null,
      inbox.missingInfo > 0 ? `${inbox.missingInfo} packets still need more context.` : null,
      inbox.needsReview > 0 ? `${inbox.needsReview} packets are waiting for human review.` : null,
    ].filter(Boolean) as string[]
  }, [inbox])

  function toggleSelection(
    list: string[],
    value: string,
    setValue: (next: string[]) => void,
  ): void {
    if (list.includes(value)) {
      setValue(list.filter((item) => item !== value))
      return
    }

    setValue([...list, value])
  }

  function loadSampleBug(): void {
    const example = demoExamples[1]
    setOnboardingTitle(example.title)
    setOnboardingText(example.rawText)
    setOnboardingLogs(example.logs ?? '')
  }

  async function waitForPacketCompletion(reportId: string): Promise<boolean> {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const report = await proxkeyApi.report(reportId)
      if (report.report.status !== 'PROCESSING') {
        return true
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 1200)
      })
    }

    return false
  }

  async function inviteEmployee(): Promise<void> {
    try {
      await proxkeyApi.createEmployee(employeeForm)
      setEmployeeForm({ name: '', email: '', role: 'EMPLOYEE' })
      await loadDashboard()
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Failed to invite employee.')
    }
  }

  async function submitReport(
    input: TriageForm,
    metadataJson?: Record<string, unknown>,
  ): Promise<string> {
    if (!input.title.trim() || !input.rawText.trim()) {
      setError('Enter a title and report text to create a triage packet.')
      throw new Error('Enter a title and report text to create a triage packet.')
    }

    const created = await proxkeyApi.createReport({
      title: input.title.trim(),
      rawText: input.rawText.trim(),
      logs: input.logs.trim() || undefined,
      source: 'MANUAL',
      metadataJson,
    })

    return created.reportId
  }

  async function createManualReport(): Promise<void> {
    setSubmittingReport(true)
    setPendingPacketTitle(triageForm.title.trim() || 'New triage packet')
    try {
      const reportId = await submitReport(triageForm)
      const completed = await waitForPacketCompletion(reportId)
      await loadDashboard()
      setTriageForm({ title: '', rawText: '', logs: '' })
      if (completed) {
        navigate(`/reports/${reportId}`)
      } else {
        setError('Packet is still processing. It will appear in the queue shortly.')
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit report.')
    } finally {
      setPendingPacketTitle(null)
      setSubmittingReport(false)
    }
  }

  async function completeOnboarding(): Promise<void> {
    setSubmittingOnboarding(true)
    setPendingPacketTitle(onboardingTitle.trim() || 'First triage packet')
    try {
      const reportId = await submitReport(
        {
          title: onboardingTitle,
          rawText: onboardingText,
          logs: onboardingLogs,
        },
        {
          onboarding: {
            triageTypes: selectedTypes,
            tools: selectedTools,
            completedAt: new Date().toISOString(),
          },
        },
      )
      const completed = await waitForPacketCompletion(reportId)
      await loadDashboard()
      if (completed) {
        navigate(`/reports/${reportId}`)
      } else {
        setError('Packet is still processing. It will appear in the queue shortly.')
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to generate the first triage packet.',
      )
    } finally {
      setPendingPacketTitle(null)
      setSubmittingOnboarding(false)
    }
  }

  async function createApiKey(): Promise<void> {
    try {
      const created = await proxkeyApi.createApiKey({
        name: newApiKeyName.trim() || 'CLI key',
      })
      setRevealedApiKey(created.key)
      setNewApiKeyName('CI ingestion')
      await loadDashboard()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create API key.')
    }
  }

  async function revokeApiKey(id: string): Promise<void> {
    try {
      await proxkeyApi.revokeApiKey(id)
      await loadDashboard()
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Failed to revoke API key.')
    }
  }

  if (!user) {
    return <PublicDashboardPreview onOpenAuth={onOpenAuth} />
  }

  const showOnboarding = !loading && inbox !== null && inbox.items.length === 0

  return (
    <div className="bg-[#f6f4ef] px-4 py-6 text-[#111] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <Panel className="pk-grid-surface bg-[linear-gradient(145deg,#fffdfa_0%,#efeae0_100%)] px-6 py-6 shadow-[0_18px_42px_rgba(25,20,15,0.05)]">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
            {isOwner ? 'Company overview' : 'Your queue'}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {organization?.name ?? 'ProxKey'}
          </h1>
          <div className="mt-3 text-sm leading-7 text-[#57544d]">
            {isOwner && ownerSummary
              ? `${ownerSummary.packets} packets this month • ${ownerSummary.highSeverity} high severity • ${ownerSummary.missingInfo} need more info`
              : personalMetrics
                ? `${personalMetrics.assigned} assigned • ${personalMetrics.highPriority} high priority • ${personalMetrics.reviewQueue} need review`
                : 'Loading workspace health…'}
          </div>
        </Panel>

        {isOwner && ownerSummary ? (
          <div className="grid gap-3 md:grid-cols-5">
            <SummaryTile label="Packets this month" value={ownerSummary.packets} />
            <SummaryTile label="Open high severity" value={ownerSummary.highSeverity} />
            <SummaryTile label="Needs more info" value={ownerSummary.missingInfo} />
            <SummaryTile label="Average confidence" value={ownerSummary.avgConfidence} />
            <SummaryTile label="Ready for export" value={ownerSummary.readyForExport} />
          </div>
        ) : personalMetrics ? (
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryTile label="Assigned" value={personalMetrics.assigned} />
            <SummaryTile label="High priority" value={personalMetrics.highPriority} />
            <SummaryTile label="Needs review" value={personalMetrics.reviewQueue} />
            <SummaryTile label="Ready now" value={personalMetrics.ready} />
          </div>
        ) : null}

        {billing && usage ? (
          <Panel className="px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
                Plan and usage
              </div>
              <Link
                to="/settings/billing"
                className="border border-[#d6d2c8] bg-white px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#111]"
              >
                Open billing
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <SummaryTile label="Current plan" value={billing.organization.plan} />
              <SummaryTile label="Completed packets" value={usage.completedPackets} />
              <SummaryTile
                label="Remaining packets"
                value={usage.remainingPackets ?? 'Unlimited'}
              />
              <SummaryTile label="Seats used" value={usage.seatsUsed} />
              <SummaryTile label="Seat limit" value={billing.limits.seats ?? 'Unlimited'} />
            </div>
          </Panel>
        ) : null}

        {showOnboarding ? (
          <Panel className="px-6 py-6">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
              First-run onboarding
            </div>
            <h2 className="mt-3 font-['Georgia'] text-4xl tracking-tight text-[#111] sm:text-5xl">
              Create the first real triage packet now.
            </h2>
            <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
              <div className="space-y-5">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#111]">
                    Step 1: What are you triaging?
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {onboardingTypes.map((item) => (
                      <TogglePill
                        key={item}
                        active={selectedTypes.includes(item)}
                        label={item}
                        onClick={() => toggleSelection(selectedTypes, item, setSelectedTypes)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#111]">
                    Step 2: What tools do you use?
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {onboardingTools.map((item) => (
                      <TogglePill
                        key={item}
                        active={selectedTools.includes(item)}
                        label={item}
                        onClick={() => toggleSelection(selectedTools, item, setSelectedTools)}
                      />
                    ))}
                  </div>
                </div>

                <div className="border border-[#ece8df] bg-[#faf8f4] px-4 py-4 text-sm leading-7 text-[#57544d]">
                  Step 4 creates a real packet in your workspace and routes it through the live
                  triage pipeline.
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold uppercase tracking-[0.14em] text-[#111]">
                    Step 3: Paste your first messy issue
                  </div>
                  <button
                    type="button"
                    onClick={loadSampleBug}
                    className="border border-[#d6d2c8] bg-white px-3 py-2 text-sm font-medium uppercase tracking-[0.14em] text-[#111]"
                  >
                    Use sample bug report
                  </button>
                </div>
                <input
                  value={onboardingTitle}
                  onChange={(event) => setOnboardingTitle(event.target.value)}
                  placeholder="Issue title"
                  className="w-full border border-[#d6d2c8] bg-[#faf8f4] px-4 py-3 text-sm outline-none"
                />
                <textarea
                  value={onboardingText}
                  onChange={(event) => setOnboardingText(event.target.value)}
                  placeholder="Paste your first messy issue"
                  className="min-h-[180px] w-full border border-[#d6d2c8] bg-[#faf8f4] px-4 py-4 text-sm leading-7 outline-none"
                />
                <textarea
                  value={onboardingLogs}
                  onChange={(event) => setOnboardingLogs(event.target.value)}
                  placeholder="Optional logs or stack trace"
                  className="min-h-[120px] w-full border border-[#d6d2c8] bg-[#faf8f4] px-4 py-4 text-sm leading-7 outline-none"
                />
                <button
                  type="button"
                  onClick={() => void completeOnboarding()}
                  disabled={submittingOnboarding}
                  className="border border-[#ff5a1f] bg-[#ff5a1f] px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white disabled:opacity-70"
                >
                  {submittingOnboarding
                    ? 'Generating first packet…'
                    : 'Step 4: Generate first triage packet'}
                </button>
              </div>
            </div>
          </Panel>
        ) : null}

        <Panel id="triage" className="px-6 py-6">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
            New triage packet
          </div>
          <div className="mt-4 grid gap-3">
            <input
              value={triageForm.title}
              onChange={(event) =>
                setTriageForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Issue title"
              className="w-full border border-[#d6d2c8] bg-[#faf8f4] px-4 py-3 text-sm outline-none"
            />
            <textarea
              value={triageForm.rawText}
              onChange={(event) =>
                setTriageForm((current) => ({ ...current, rawText: event.target.value }))
              }
              placeholder="Paste the bug report, support escalation, or incident summary"
              className="min-h-[140px] w-full border border-[#d6d2c8] bg-[#faf8f4] px-4 py-4 text-sm leading-7 outline-none"
            />
            <textarea
              id="upload"
              value={triageForm.logs}
              onChange={(event) =>
                setTriageForm((current) => ({ ...current, logs: event.target.value }))
              }
              placeholder="Optional logs or stack trace"
              className="min-h-[100px] w-full border border-[#d6d2c8] bg-[#faf8f4] px-4 py-4 text-sm leading-7 outline-none"
            />
            <button
              type="button"
              onClick={() => void createManualReport()}
              disabled={submittingReport}
              className="w-full border border-[#ff5a1f] bg-[#ff5a1f] px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white disabled:opacity-70"
            >
              {submittingReport ? 'Submitting…' : 'Generate triage packet'}
            </button>
          </div>
        </Panel>

        {pendingPacketTitle ? (
          <Panel className="pk-dark-grid border border-[#27303a] bg-[#111318] px-6 py-6 text-white">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#95a0af]">
              Processing packet
            </div>
            <h2 className="mt-3 font-['Georgia'] text-4xl tracking-tight text-white sm:text-5xl">
              {pendingPacketTitle}
            </h2>
            <div className="mt-4 text-sm leading-7 text-[#d6dde6]">
              ProxKey is redacting sensitive context, classifying severity, checking duplicates, and
              preparing the engineering handoff.
            </div>
          </Panel>
        ) : null}

        {error ? (
          <div className="border border-[#f1cac6] bg-[#fff4f4] px-4 py-3 text-sm text-[#e5484d]">
            {error}
          </div>
        ) : null}
        {loading ? <div className="text-sm text-[#57544d]">Loading dashboard…</div> : null}

        {!loading && inbox && inbox.items.length === 0 ? (
          <Panel className="px-6 py-6">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
              Empty state
            </div>
            <h2 className="mt-3 font-['Georgia'] text-4xl tracking-tight text-[#111] sm:text-5xl">
              No packets yet. Here is what a good triage packet looks like.
            </h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border border-[#ece8df] bg-[#faf8f4] px-4 py-4 text-sm leading-7 text-[#57544d]">
                <div className="font-semibold text-[#111]">Sample packet</div>
                <div className="mt-2">Title: Users bounce back to login after password reset</div>
                <div>Severity: SEV-2</div>
                <div>Component: Auth</div>
                <div>
                  Next action: Compare Safari cookie behavior against the last auth callback change.
                </div>
              </div>
              <div className="border border-[#ece8df] bg-[#faf8f4] px-4 py-4 text-sm leading-7 text-[#57544d]">
                ProxKey cleans up the intake before it hits engineering. Paste the raw issue once,
                generate the packet, then review and export the result instead of rewriting the bug
                by hand.
              </div>
            </div>
          </Panel>
        ) : null}

        {inbox && inbox.items.length > 0 ? (
          <Panel id="inbox" className="overflow-hidden">
            <div className="border-b border-[#ece8df] px-6 py-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
                Recent triage packets
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[860px] text-left text-sm">
                <thead className="bg-[#faf8f4] text-[11px] uppercase tracking-[0.18em] text-[#81796d]">
                  <tr>
                    <th className="px-6 py-3">Title</th>
                    <th className="px-6 py-3">Severity</th>
                    <th className="px-6 py-3">Owner</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Confidence</th>
                    <th className="px-6 py-3">Source</th>
                    <th className="px-6 py-3">Updated</th>
                    <th className="px-6 py-3">Export</th>
                  </tr>
                </thead>
                <tbody>
                  {inbox.items.map((item) => (
                    <tr key={item.id} className="border-t border-[#f1ede5]">
                      <td className="px-6 py-4 font-medium">
                        <Link to={`/reports/${item.id}`} className="hover:text-[#ff5a1f]">
                          {item.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4">{formatSeverity(item.severity)}</td>
                      <td className="px-6 py-4">{item.owner ?? 'Pending'}</td>
                      <td className="px-6 py-4">{formatStatus(item.status)}</td>
                      <td className="px-6 py-4">
                        {item.confidence === null
                          ? 'Pending'
                          : `${Math.round(item.confidence * 100)}%`}
                      </td>
                      <td className="px-6 py-4">{item.source}</td>
                      <td className="px-6 py-4">{new Date(item.updatedAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/reports/${item.id}`}
                          className="border border-[#d6d2c8] bg-white px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#111]"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}

        {inbox ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['High severity', inbox.highSeverity],
              ['Needs review', inbox.needsReview],
              ['Missing info', inbox.missingInfo],
              ['Duplicate clusters', inbox.duplicateClusters],
            ].map(([label, value]) => (
              <Panel key={label} className="px-5 py-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">
                  {label}
                </div>
                <div className="mt-2 text-3xl font-semibold text-[#111]">{value}</div>
              </Panel>
            ))}
          </div>
        ) : null}

        {isOwner && stats ? (
          <>
            <Panel className="px-6 py-6">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
                Team performance
              </div>
              <div className="mt-4 space-y-3">
                {stats.teamPerformance.reportsPerEmployee.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between border border-[#ece8df] bg-[#faf8f4] px-4 py-4 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-[#111]">{entry.name}</div>
                      <div className="text-[#6e675d]">{entry.role}</div>
                    </div>
                    <div className="text-right">
                      <div>{entry.reports} packets</div>
                      <div className={entry.reports >= 3 ? 'text-[#e5484d]' : 'text-[#1f8f5f]'}>
                        {entry.reports >= 3 ? 'Overloaded' : 'Active'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="px-6 py-6">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
                Queue intelligence
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <SummaryTile
                  label="Duplicate clusters"
                  value={stats.queueIntelligence.duplicateClusters}
                />
                <SummaryTile
                  label="Missing info rate"
                  value={`${Math.round(stats.queueIntelligence.missingInfoRate * 100)}%`}
                />
                <SummaryTile label="Audit log entries" value={stats.security.auditLogs} />
              </div>
            </Panel>
          </>
        ) : null}

        {canManageEmployees ? (
          <Panel className="px-6 py-6">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">Employees</div>
            <div className="mt-4 space-y-3">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center justify-between border border-[#ece8df] bg-[#faf8f4] px-4 py-4 text-sm"
                >
                  <div>
                    <div className="font-semibold text-[#111]">{employee.email}</div>
                    <div className="text-[#6e675d]">{employee.name}</div>
                  </div>
                  <div className="text-right">
                    <div>{employee.role}</div>
                    <div className="text-[#6e675d]">{employee.status}</div>
                  </div>
                </div>
              ))}
            </div>

            {role === 'OWNER' || role === 'ADMIN' ? (
              <div className="mt-5 border border-[#ece8df] bg-[#faf8f4] px-4 py-4">
                <div className="text-sm font-semibold">Invite employee</div>
                <div className="mt-3 grid gap-3">
                  <input
                    value={employeeForm.name}
                    onChange={(event) =>
                      setEmployeeForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Employee name"
                    className="border border-[#d6d2c8] bg-white px-4 py-3 text-sm outline-none"
                  />
                  <input
                    value={employeeForm.email}
                    onChange={(event) =>
                      setEmployeeForm((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="teammate@company.com"
                    className="border border-[#d6d2c8] bg-white px-4 py-3 text-sm outline-none"
                  />
                  <select
                    value={employeeForm.role}
                    onChange={(event) =>
                      setEmployeeForm((current) => ({
                        ...current,
                        role: event.target.value as EmployeeForm['role'],
                      }))
                    }
                    className="border border-[#d6d2c8] bg-white px-4 py-3 text-sm outline-none"
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="TRIAGE_LEAD">TRIAGE_LEAD</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void inviteEmployee()}
                    className="border border-[#111] bg-[#111] px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white"
                  >
                    Invite employee
                  </button>
                </div>
              </div>
            ) : null}
          </Panel>
        ) : null}

        {canManageKeys ? (
          <Panel className="px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">API keys</div>
              <Link
                to="/settings/api-keys"
                className="border border-[#d6d2c8] bg-white px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#111]"
              >
                Open key settings
              </Link>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  value={newApiKeyName}
                  onChange={(event) => setNewApiKeyName(event.target.value)}
                  placeholder="Key name"
                  className="flex-1 border border-[#d6d2c8] bg-[#faf8f4] px-4 py-3 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => void createApiKey()}
                  className="border border-[#111] bg-[#111] px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white"
                >
                  Create API key
                </button>
              </div>
              {revealedApiKey ? (
                <div className="border border-[#d7ebdf] bg-[#effaf3] px-4 py-3 text-sm text-[#256042]">
                  Full key shown once: <code>{revealedApiKey}</code>
                </div>
              ) : null}
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-col gap-3 border border-[#ece8df] bg-[#faf8f4] px-4 py-4 text-sm md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-semibold text-[#111]">{key.name}</div>
                    <div className="text-[#6e675d]">{key.keyPrefix}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[#6e675d]">
                      {key.revokedAt
                        ? 'Revoked'
                        : key.lastUsedAt
                          ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                          : 'Never used'}
                    </div>
                    {!key.revokedAt ? (
                      <button
                        type="button"
                        onClick={() => void revokeApiKey(key.id)}
                        className="border border-[#d6d2c8] bg-white px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#111]"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {alerts.length > 0 ? (
          <Panel className="px-6 py-6">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">Alerts</div>
            <div className="mt-4 space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert}
                  className="border border-[#f0ddd7] bg-[#fff7f4] px-4 py-4 text-sm text-[#b9473b]"
                >
                  {alert}
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  )
}
