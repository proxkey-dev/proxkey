import { Link } from 'react-router-dom'
import { apiUrl } from '../../lib/api'

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  )
}

export function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] font-['IBM_Plex_Sans',system-ui,sans-serif] text-[#e8e8e8] antialiased">
      <header className="sticky top-0 z-40 border-b border-[#1e1e1e] bg-[#0a0a0a]">
        <nav
          className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 md:px-6"
          aria-label="Primary"
        >
          <Link to="/" className="font-mono text-lg font-semibold tracking-tight text-[#e8e8e8] hover:text-[#4ade80]">
            ProxKey
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm text-[#6b6b6b]">
            <Link to="/about" className="text-[#e8e8e8] transition-colors">
              About
            </Link>
            <span aria-hidden="true">|</span>
            <Link to="/status" className="transition-colors hover:text-[#e8e8e8]">
              Status
            </Link>
            <span aria-hidden="true">|</span>
            <Link to="/docs" className="transition-colors hover:text-[#e8e8e8]">
              Docs
            </Link>
            <span aria-hidden="true">|</span>
            <Link to="/login" reloadDocument className="transition-colors hover:text-[#e8e8e8]">
              Sign in →
            </Link>
            <span aria-hidden="true">|</span>
            <a
              href={apiUrl('/api/auth/github')}
              className="rounded border border-[#4ade80] bg-[#4ade80] px-3 py-2 font-mono text-xs font-semibold text-black transition-opacity hover:opacity-90 md:text-sm"
            >
              Get started
            </a>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-4 pb-14 pt-14 md:px-6 md:pt-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#4ade80]">
            About
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-[#e8e8e8] md:text-5xl md:leading-[1.1]">
            About ProxKey
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#b8b8b8] md:text-xl">
            CI spend attribution for engineering organizations — mapped to repos, PRs, and the work
            that drove it.
          </p>
        </section>

        {/* Product */}
        <section className="border-t border-[#1e1e1e] px-4 py-14 md:px-6 md:py-20" aria-labelledby="product-heading">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-12 md:grid-cols-[2fr_1fr] md:gap-16">
              <div>
                <h2
                  id="product-heading"
                  className="font-mono text-sm font-semibold uppercase tracking-widest text-[#4ade80]"
                >
                  What we build
                </h2>
                <p className="mt-6 text-base leading-relaxed text-[#e8e8e8] md:text-lg">
                  ProxKey connects to GitHub Actions today — with CircleCI and Buildkite on the roadmap
                  — and attributes CI spend to the exact repo, team, PR, and test suite that caused it.
                </p>
                <p className="mt-4 text-base leading-relaxed text-[#6b6b6b] md:text-lg">
                  It helps engineering organizations see where CI money is going, identify waste,
                  and make faster decisions about flaky tests, redundant runs, and inefficient
                  pipelines.
                </p>
              </div>

              <div className="space-y-6">
                {[
                  { label: 'Launch', value: '2026' },
                  { label: 'Integrations', value: 'GitHub Actions · CircleCI & Buildkite (soon)' },
                  { label: 'Pricing', value: 'Free · 3 repos' },
                ].map((item) => (
                  <div key={item.label} className="border-t border-[#1e1e1e] pt-6">
                    <p className="font-mono text-xs uppercase tracking-widest text-[#4b4b4b]">{item.label}</p>
                    <p className="mt-1 font-mono text-sm text-[#e8e8e8]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Founder */}
        <section className="border-t border-[#1e1e1e] px-4 py-14 md:px-6 md:py-20" aria-labelledby="founder-heading">
          <div className="mx-auto max-w-5xl">
            <h2
              id="founder-heading"
              className="font-mono text-sm font-semibold uppercase tracking-widest text-[#4ade80]"
            >
              Founder
            </h2>

            <div className="mt-10 grid gap-10 md:grid-cols-[auto_1fr] md:gap-16">
              <div className="shrink-0">
                <div
                  className="flex h-24 w-24 select-none items-center justify-center rounded border border-[#1e1e1e] bg-[#111111] font-mono text-2xl font-semibold tracking-tight text-[#4ade80] md:h-28 md:w-28 md:text-[1.85rem]"
                  aria-hidden="true"
                >
                  OK
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold tracking-tight text-[#e8e8e8]">Omer Khan</h3>
                <p className="mt-1 font-mono text-xs uppercase tracking-widest text-[#4b4b4b]">
                  Founder
                </p>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-[#b8b8b8] md:text-lg">
                  Omer Khan is a software and systems engineer focused on developer infrastructure,
                  CI systems, and intelligent tooling for engineering teams.
                </p>

                <h4
                  id="links-heading"
                  className="mt-10 font-mono text-xs font-semibold uppercase tracking-widest text-[#4ade80]"
                >
                  Links
                </h4>
                <ul
                  className="mt-4 flex flex-col gap-4 font-mono text-sm text-[#e8e8e8]"
                  aria-labelledby="links-heading"
                >
                  <li>
                    <a
                      href="https://x.com/notomerkhan"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 underline-offset-4 transition-colors hover:text-[#4ade80] hover:underline"
                    >
                      <XIcon />
                      <span className="text-[#5c5c5c]" aria-hidden>
                        ·
                      </span>
                      <span>x.com/notomerkhan</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://linkedin.com/in/notomer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 underline-offset-4 transition-colors hover:text-[#4ade80] hover:underline"
                    >
                      <LinkedInIcon />
                      <span className="text-[#5c5c5c]" aria-hidden>
                        ·
                      </span>
                      <span>linkedin.com/in/notomer</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://notomer.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 underline-offset-4 transition-colors hover:text-[#4ade80] hover:underline"
                    >
                      <GlobeIcon />
                      <span className="text-[#5c5c5c]" aria-hidden>
                        ·
                      </span>
                      <span>notomer.com</span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section
          className="border-t border-[#1e1e1e] px-4 py-16 text-center md:px-6 md:py-20"
          aria-labelledby="cta-heading"
        >
          <div className="mx-auto max-w-xl">
            <h2 id="cta-heading" className="text-2xl font-bold text-[#e8e8e8] md:text-3xl">
              Start in 2 minutes.
            </h2>
            <p className="mt-3 text-[#6b6b6b]">Free for up to 3 repos. No credit card required.</p>
            <a
              href={apiUrl('/api/auth/github')}
              className="mt-8 inline-flex justify-center rounded bg-[#4ade80] px-6 py-3 font-mono text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Connect GitHub Actions
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1e1e1e] bg-[#0a0a0a] px-4 py-8 md:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 text-sm text-[#6b6b6b] md:flex-row md:items-center md:justify-between">
          <p className="font-mono text-[#e8e8e8]">ProxKey © 2026</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href="mailto:hello@proxkey.dev" className="hover:text-[#e8e8e8]">
              hello@proxkey.dev
            </a>
            <span aria-hidden="true">|</span>
            <Link to="/status" className="hover:text-[#e8e8e8]">
              Status
            </Link>
            <span aria-hidden="true">|</span>
            <Link to="/about" className="hover:text-[#e8e8e8]">
              About
            </Link>
            <span aria-hidden="true">|</span>
            <Link to="/docs" className="hover:text-[#e8e8e8]">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AboutPage
