const apiEndpoints = [
  'POST /api/triage/generate',
  'GET /api/triage/:id',
  'GET /api/reports',
  'PATCH /api/triage/:reportId',
  'POST /api/codebase/scan',
  'POST /api/cli/ingest',
]

const cliCommands = [
  'proxkey login',
  'proxkey auth set-key pk_live_xxx',
  'proxkey init',
  'proxkey triage "customer says checkout spins forever"',
  'proxkey triage --file ./bug-report.txt',
  'proxkey triage --logs ./logs.txt',
  'proxkey ci analyze --logs ./logs/test-output.txt',
  'proxkey triage --json',
  'proxkey export --format markdown <report-id>',
]

export default function ProxKeyDocsPage() {
  return (
    <div className="bg-[#f6f4ef] px-4 py-10 text-[#111] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="pk-frame pk-grid-surface bg-white px-6 py-8 shadow-[0_20px_54px_rgba(33,28,19,0.06)] sm:px-8">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">Docs</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#111] sm:text-6xl">
            Quickstart for the engineering triage layer.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[#57544d]">
            Sign up, paste a messy report, generate a packet, then export it into the workflow your
            team already uses.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="pk-frame bg-white px-6 py-6">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">Quickstart</div>
            <div className="mt-4 space-y-4 text-sm leading-7 text-[#57544d]">
              <div>1. Sign up and create a workspace.</div>
              <div>2. Paste a messy bug report, incident note, or support escalation.</div>
              <div>3. Generate the first triage packet.</div>
              <div>4. Review severity, repro steps, and next actions.</div>
              <div>5. Export as Markdown, GitHub issue text, Jira text, or Linear text.</div>
            </div>
          </div>

          <div className="pk-dark-grid border border-[#27303a] bg-[#111318] px-6 py-6 text-white [clip-path:polygon(0_0,calc(100%-16px)_0,100%_16px,100%_100%,16px_100%,0_calc(100%-16px))]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#9aa4b2]">SDK</div>
            <pre className="mt-4 overflow-x-auto text-sm leading-7 text-[#d6dde6]">
              {`import { createClient } from "@proxkey/proxkey-js"

const client = createClient({
  apiKey: process.env.PROXKEY_API_KEY,
  baseUrl: "https://api.proxkey.dev",
})

const packet = await client.triage.generate({
  rawInput: "Checkout hangs after Apple Pay confirmation...",
  source: "support",
})`}
            </pre>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="pk-frame bg-white px-6 py-6">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">REST API</div>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[#57544d]">
              {apiEndpoints.map((endpoint) => (
                <div key={endpoint} className="border border-[#ece8df] bg-[#faf8f4] px-4 py-3">
                  {endpoint}
                </div>
              ))}
            </div>
          </div>

          <div className="pk-frame bg-white px-6 py-6">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">CLI</div>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[#57544d]">
              {cliCommands.map((command) => (
                <div
                  key={command}
                  className="border border-[#ece8df] bg-[#faf8f4] px-4 py-3 font-mono text-[13px]"
                >
                  {command}
                </div>
              ))}
            </div>
            <div className="mt-4 border border-[#ece8df] bg-[#faf8f4] px-4 py-4 text-sm leading-7 text-[#57544d]">
              Local/dev install: <code>npm install</code>, <code>npm run build</code>, then run{' '}
              <code>node ./dist/index.js triage --file ./logs/build.log</code>.
            </div>
          </div>

          <div className="pk-frame bg-white px-6 py-6">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
              Security model
            </div>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[#57544d]">
              <div>• Secrets are redacted before AI analysis.</div>
              <div>• Sessions use HTTP-only cookies and hashed server-side tokens.</div>
              <div>• Workspace data is tenant-scoped.</div>
              <div>• Audit logs capture authentication and packet changes.</div>
              <div>• Exports stay operator-controlled.</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
