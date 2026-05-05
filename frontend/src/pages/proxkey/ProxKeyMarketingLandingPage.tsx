import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { apiUrl } from '../../lib/api'

const BODY_SANS =
  '"IBM Plex Sans", system-ui, ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif'

const MONO = '"JetBrains Mono", ui-monospace, "Fira Code", Menlo, Monaco, monospace'

const landingCss = `
@keyframes pk-landing-terminal-reveal {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.pk-landing-terminal-line {
  opacity: 0;
  animation: pk-landing-terminal-reveal 0.45s ease forwards;
}
@media (prefers-reduced-motion: reduce) {
  .pk-landing-terminal-line {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
`

type TerminalRow = {
  key: string
  line: string
}

const terminalRows: TerminalRow[] = [
  { key: 'cmd', line: '$ proxkey analyze --org acme --period 30d' },
  { key: 'b0', line: '' },
  { key: 'b1', line: '✓ 847 builds analyzed across 12 repos' },
  { key: 'b2', line: '✓ $12,340 in CI spend attributed' },
  { key: 'b3', line: '' },
  { key: 'h1', line: 'Ownership breakdown:' },
  {
    key: 'r1',
    line: '  api-service      $4,210  team:backend     34%',
  },
  {
    key: 'r2',
    line: '  mobile-app       $3,890  team:mobile      32%',
  },
  {
    key: 'r3',
    line: '  data-pipeline    $2,100  team:data        17%',
  },
  {
    key: 'r4',
    line: '  (8 more repos)          $2,140            17%',
  },
  { key: 'w0', line: '' },
  { key: 'w-head', line: 'Waste detected:' },
  {
    key: 'w1',
    line: '⚠  14 docs-only builds ran full CI      → $840 wasted',
  },
  {
    key: 'w2',
    line: '⚠  3 always-flaky tests still running   → $290 wasted',
  },
  {
    key: 'w3',
    line: '⚠  8 oversized runners on short jobs    → $180 wasted',
  },
  { key: 'f0', line: '' },
  { key: 'f1', line: 'Highest-impact fix:' },
  {
    key: 'f2',
    line: '  Skip CI on docs/* and *.md changes in api-service',
  },
  {
    key: 'f3',
    line: '  Estimated monthly savings: $840',
  },
]

function TerminalLineVisual({ content, idx }: { content: string; idx: number }) {
  const isEmpty = content === ''
  if (isEmpty) {
    return <div className="h-[0.65em]" aria-hidden />
  }

  let body: ReactNode = <span className="text-[#e8e8e8]">{content}</span>

  if (content.startsWith('✓')) {
    const rest = content.slice(1).trimStart()
    const dollarMatch = rest.match(/\$\d[\d,]*/)
    body = (
      <>
        <span className="text-[#4ade80]">✓</span> {highlightDollars(rest, dollarMatch)}
      </>
    )
  } else if (content.startsWith('⚠')) {
    body = warningLine(content)
  } else if (/\$\d[\d,]/.test(content)) {
    body = highlightDollars(content, content.match(/\$\d[\d,]*/))
  }

  return (
    <div
      className="pk-landing-terminal-line text-[13px] leading-relaxed md:text-sm"
      style={{ animationDelay: `${idx * 0.068}s` }}
    >
      {body}
    </div>
  )
}

function warningLine(full: string): ReactNode {
  const body = full.replace(/^⚠\s*/, '')
  const sep = '→'
  const i = body.indexOf(sep)
  if (i === -1) {
    return (
      <>
        <span className="text-[#f59e0b]">⚠</span>
        <span className="text-[#e8e8e8]"> {body}</span>
      </>
    )
  }

  const left = body.slice(0, i).trimEnd()
  const rightRaw = body.slice(i + sep.length).trimStart()
  const bucks = rightRaw.match(/^\$\d[\d,]+/)
  const restAfterMoney = bucks ? rightRaw.slice(bucks[0].length) : ''

  return (
    <>
      <span className="text-[#f59e0b]">⚠</span>
      <span className="text-[#e8e8e8]"> {left} </span>
      <span className="text-[#e8e8e8]">{sep}</span>
      <span className="text-[#e8e8e8]"> </span>
      {bucks ? <span className="text-[#4ade80]">{bucks[0]}</span> : null}
      <span className="text-[#e8e8e8]">{bucks ? `${restAfterMoney}` : rightRaw}</span>
    </>
  )
}

/** Split string and emphasize dollar amounts in green where matched. */
function highlightDollars(text: string, firstDollarMatch: RegExpMatchArray | null): ReactNode {
  if (!firstDollarMatch || firstDollarMatch.index === undefined) {
    return <span className="text-[#e8e8e8]">{text}</span>
  }
  const i = firstDollarMatch.index
  const amt = firstDollarMatch[0]
  return (
    <>
      <span className="text-[#e8e8e8]">{text.slice(0, i)}</span>
      <span className="text-[#4ade80]">{amt}</span>
      <span className="text-[#e8e8e8]">{text.slice(i + amt.length)}</span>
    </>
  )
}

function NavGitHubHref() {
  return apiUrl('/api/auth/github')
}

export function ProxKeyMarketingLandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const mobileNavId = useId()

  useEffect(() => {
    const prevTitle = document.title
    const title = 'ProxKey — CI Intelligence for Engineering Teams'
    document.title = title

    const description =
      'ProxKey shows where CI time, spend, and waste come from — across repos, PRs, workflows, and teams. Connect GitHub Actions in 2 minutes.'
    const meta = document.querySelector('meta[name="description"]')
    const prevDesc = meta?.getAttribute('content')

    meta?.setAttribute('content', description)

    const ogDesc = document.querySelector('meta[property="og:description"]')
    const prevOgDesc = ogDesc?.getAttribute('content')
    ogDesc?.setAttribute('content', description)

    const twDesc = document.querySelector('meta[name="twitter:description"]')
    const prevTwDesc = twDesc?.getAttribute('content')
    twDesc?.setAttribute('content', description)

    const ogTitle = document.querySelector('meta[property="og:title"]')
    const prevOgTitle = ogTitle?.getAttribute('content')
    ogTitle?.setAttribute('content', title)

    const twTitle = document.querySelector('meta[name="twitter:title"]')
    const prevTwTitle = twTitle?.getAttribute('content')
    twTitle?.setAttribute('content', title)

    return () => {
      document.title = prevTitle
      if (prevDesc != null && meta) {
        meta.setAttribute('content', prevDesc)
      }
      if (prevOgDesc != null && ogDesc) {
        ogDesc.setAttribute('content', prevOgDesc)
      }
      if (prevTwDesc != null && twDesc) {
        twDesc.setAttribute('content', prevTwDesc)
      }
      if (prevOgTitle != null && ogTitle) {
        ogTitle.setAttribute('content', prevOgTitle)
      }
      if (prevTwTitle != null && twTitle) {
        twTitle.setAttribute('content', prevTwTitle)
      }
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileNavOpen])

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-[#e8e8e8] antialiased"
      style={{ fontFamily: BODY_SANS }}
    >
      <style>{landingCss}</style>

      <header className="sticky top-0 z-40 border-b border-[#1e1e1e] bg-[#0a0a0a]">
        <nav
          className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 md:px-6"
          aria-label="Primary"
        >
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-[#e8e8e8] hover:text-[#4ade80] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
            style={{ fontFamily: MONO }}
          >
            ProxKey
          </Link>

          <button
            type="button"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md border border-[#1e1e1e] md:hidden"
            aria-expanded={mobileNavOpen}
            aria-controls={mobileNavId}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <span className="sr-only">{mobileNavOpen ? 'Close menu' : 'Open menu'}</span>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              {mobileNavOpen ? (
                <path strokeWidth={2} d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
              ) : (
                <path strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>

          <div className="hidden items-center gap-5 text-sm text-[#6b6b6b] md:flex">
            <Link
              to="/about"
              className="transition-colors hover:text-[#e8e8e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
            >
              About
            </Link>
            <span aria-hidden="true" className="text-[#2a2a2a]">
              |
            </span>
            <Link
              to="/docs"
              className="transition-colors hover:text-[#e8e8e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
            >
              Docs
            </Link>
            <span aria-hidden="true" className="text-[#2a2a2a]">
              |
            </span>
            <Link
              to="/login"
              reloadDocument
              className="transition-colors hover:text-[#e8e8e8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
            >
              Sign in
            </Link>
            <span aria-hidden="true" className="text-[#2a2a2a]">
              |
            </span>
            <Link
              to="/signup"
              className="rounded-lg border border-[#4ade80] bg-[#4ade80] px-3.5 py-2 text-[13px] font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
              style={{ fontFamily: MONO }}
            >
              Get started
            </Link>
          </div>
        </nav>

        <div
          id={mobileNavId}
          className={`border-t border-[#1e1e1e] bg-[#0a0a0a] md:hidden ${mobileNavOpen ? 'block' : 'hidden'}`}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-4 text-sm text-[#6b6b6b]">
            <Link to="/about" className="py-2 hover:text-[#e8e8e8]" onClick={() => setMobileNavOpen(false)}>
              About
            </Link>
            <Link to="/docs" className="py-2 hover:text-[#e8e8e8]" onClick={() => setMobileNavOpen(false)}>
              Docs
            </Link>
            <Link
              to="/login"
              reloadDocument
              className="py-2 hover:text-[#e8e8e8]"
              onClick={() => setMobileNavOpen(false)}
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="mt-2 inline-flex w-full justify-center rounded-lg border border-[#4ade80] bg-[#4ade80] px-3.5 py-2.5 text-center font-semibold text-[#0a0a0a]"
              style={{ fontFamily: MONO }}
              onClick={() => setMobileNavOpen(false)}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-4 pb-16 pt-12 md:px-6 md:pb-20 md:pt-16" aria-labelledby="hero-heading">
          <h1
            id="hero-heading"
            className="max-w-4xl text-4xl font-bold leading-tight tracking-tight text-[#e8e8e8] md:text-5xl md:leading-[1.12]"
          >
            Make CI visible,
            <br />
            attributable, and controllable.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#6b6b6b] md:text-xl">
            ProxKey connects to GitHub Actions to show where CI time, spend, and waste actually come from — by repo,
            team, PR, workflow, and test suite.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href={NavGitHubHref()}
              className="inline-flex justify-center rounded-lg bg-[#4ade80] px-5 py-3 text-center font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
              style={{ fontFamily: MONO }}
            >
              Connect GitHub Actions
            </a>
            <a
              href="#how-it-works"
              className="inline-flex justify-center rounded-lg border border-[#1e1e1e] bg-transparent px-5 py-3 text-center font-medium text-[#e8e8e8] transition-colors hover:border-[#2e2e2e] hover:bg-[#111111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
              style={{ fontFamily: MONO }}
            >
              See how it works
            </a>
          </div>
          <p className="mt-4 text-xs text-[#6b6b6b] md:text-sm" style={{ fontFamily: MONO }}>
            Free for up to 3 repos. No credit card required.
          </p>

          <div
            className="mx-auto mt-12 max-w-2xl rounded border border-[#1e1e1e] bg-[#0d0d0d] p-4 md:p-6"
            role="img"
            aria-label="Illustrative CLI output showing sample attribution. Not connected to live data."
          >
            <pre className="m-0 overflow-x-auto font-normal tabular-nums text-[#e8e8e8]">
              <code className="block whitespace-pre font-[inherit]" style={{ fontFamily: MONO }}>
                {terminalRows.map((row, idx) => (
                  <TerminalLineVisual key={row.key} content={row.line} idx={idx} />
                ))}
              </code>
            </pre>
          </div>
        </section>

        {/* The problem */}
        <section
          id="the-problem"
          className="scroll-mt-24 border-t border-[#1e1e1e] bg-[#0a0a0a] px-4 py-16 md:px-6 md:py-20"
          aria-labelledby="problem-heading"
        >
          <div className="mx-auto max-w-5xl">
            <h2 id="problem-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
              CI used to be background noise. Now it&apos;s operational overhead.
            </h2>
            <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
              <div>
                <h3 className="text-base font-semibold text-[#e8e8e8]">Code volume is exploding.</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#6b6b6b] md:text-base">
                  AI-assisted coding means more commits, more PRs, and more CI runs. Your compute bill grew. Nobody can
                  explain which team or workflow caused it.
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#e8e8e8]">Your CI vendor shows activity, not ownership.</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#6b6b6b] md:text-base">
                  GitHub Actions gives you total minutes and an invoice. It does not tell you which engineer&apos;s
                  experiment ran macOS runners 40 times last Tuesday.
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#e8e8e8]">Waste hides inside normal workflows.</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#6b6b6b] md:text-base">
                  Docs-only PRs triggering full test suites. Flaky tests that always fail, still burning compute. Oversized
                  runners sitting idle for 90 seconds. It compounds invisibly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="scroll-mt-24 border-t border-[#1e1e1e] px-4 py-16 md:px-6 md:py-20"
          aria-labelledby="how-heading"
        >
          <div className="mx-auto max-w-5xl">
            <h2 id="how-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
              Connect once. Full visibility starts immediately.
            </h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-4 md:gap-6">
              {[
                'Install the GitHub App — 2 minutes, no code changes required',
                'ProxKey ingests workflow runs, job-level events, and billing data',
                'Every build attributed to repo, branch, PR, author, workflow, and team',
                'Waste surfaces automatically with dollar estimates and fix recommendations',
              ].map((body, index) => {
                const n = String(index + 1).padStart(2, '0')
                return (
                  <li key={n} className="flex gap-4 md:flex-col md:gap-3">
                    <span className="shrink-0 font-mono text-3xl font-semibold tracking-tight text-[#3a3a3a] md:text-4xl">
                      {n}
                    </span>
                    <p className="text-sm leading-relaxed text-[#6b6b6b] md:text-base">{body}</p>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* What you get */}
        <section className="border-t border-[#1e1e1e] px-4 py-16 md:px-6 md:py-20" aria-labelledby="what-heading">
          <div className="mx-auto max-w-5xl">
            <h2 id="what-heading" className="text-2xl font-bold tracking-tight md:text-3xl">
              What you get
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-6">
              <article className="rounded-[4px] border border-[#1e1e1e] bg-[#111111] p-6 md:p-7">
                <h3 className="text-base font-semibold text-[#e8e8e8]" style={{ fontFamily: MONO }}>
                  Ownership
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#6b6b6b] md:text-[15px]">
                  Every build tied to the repo, PR, author, team, workflow, and test suite behind it. Know exactly who is
                  driving CI activity.
                </p>
              </article>
              <article className="rounded-[4px] border border-[#1e1e1e] bg-[#111111] p-6 md:p-7">
                <h3 className="text-base font-semibold text-[#e8e8e8]" style={{ fontFamily: MONO }}>
                  Waste detection
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#6b6b6b] md:text-[15px]">
                  Automatic detection of docs-only triggers, flaky tests, oversized runners, and redundant matrix jobs —
                  with a dollar estimate per flag.
                </p>
              </article>
              <article className="rounded-[4px] border border-[#1e1e1e] bg-[#111111] p-6 md:p-7">
                <h3 className="text-base font-semibold text-[#e8e8e8]" style={{ fontFamily: MONO }}>
                  Optimization insights
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#6b6b6b] md:text-[15px]">
                  See where to reduce cost, improve signal, and clean up noisy pipelines first. Ranked by impact so you
                  know what to fix this week.
                </p>
              </article>
              <article className="rounded-[4px] border border-[#1e1e1e] bg-[#111111] p-6 md:p-7">
                <h3 className="text-base font-semibold text-[#e8e8e8]" style={{ fontFamily: MONO }}>
                  Cross-repo visibility
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#6b6b6b] md:text-[15px]">
                  One view across all repos and teams. Trends, hot spots, and team accountability in a single dashboard
                  your whole org can use.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Why now */}
        <section className="border-t border-[#1e1e1e] px-4 py-16 md:px-6 md:py-20" aria-labelledby="why-heading">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="why-heading" className="text-lg font-semibold text-[#e8e8e8] md:text-xl">
              Why now
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-[#6b6b6b] md:text-base">
              AI is increasing software output faster than most teams can manage their delivery systems. CI activity is
              growing, costs are compounding, and ownership is invisible. ProxKey is the missing layer between CI usage and
              CI control.
            </p>
          </div>
        </section>

        {/* Get started */}
        <section className="border-t border-[#1e1e1e] px-4 py-20 md:px-6 md:py-28" aria-labelledby="cta-heading">
          <div className="mx-auto max-w-xl text-center">
            <h2 id="cta-heading" className="text-2xl font-bold md:text-3xl">
              Start in 2 minutes.
            </h2>
            <p className="mt-3 text-[#6b6b6b] md:text-[17px]">Free for up to 3 repos. No credit card required.</p>
            <a
              href={NavGitHubHref()}
              className="mt-10 inline-flex justify-center rounded-lg bg-[#4ade80] px-6 py-3 font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
              style={{ fontFamily: MONO }}
            >
              Connect GitHub Actions
            </a>
            <p className="mt-6 text-xs text-[#6b6b6b] md:text-sm" style={{ fontFamily: MONO }}>
              Works with GitHub Actions today. CircleCI and Buildkite coming soon.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1e1e1e] bg-[#0a0a0a] px-4 py-8 md:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 text-sm text-[#6b6b6b] md:flex-row md:items-center md:justify-between">
          <p style={{ fontFamily: MONO }} className="text-[#e8e8e8]">
            ProxKey © 2026
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href="mailto:hello@proxkey.dev" className="transition-colors hover:text-[#e8e8e8]">
              hello@proxkey.dev
            </a>
            <span aria-hidden="true" className="hidden text-[#2a2a2a] sm:inline">
              |
            </span>
            <Link to="/status" className="transition-colors hover:text-[#e8e8e8]">
              Status
            </Link>
            <span aria-hidden="true" className="hidden text-[#2a2a2a] sm:inline">
              |
            </span>
            <Link to="/about" className="transition-colors hover:text-[#e8e8e8]">
              About
            </Link>
            <span aria-hidden="true" className="hidden text-[#2a2a2a] sm:inline">
              |
            </span>
            <Link to="/docs" className="transition-colors hover:text-[#e8e8e8]">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default ProxKeyMarketingLandingPage
