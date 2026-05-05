import { useState } from 'react'
import { Link } from 'react-router-dom'

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Get Started', href: '/dashboard' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Docs', href: '/docs' },
      { label: 'Status', href: '/status' },
    ],
  },
  {
    title: 'Contact',
    links: [
      { label: 'hello@proxkey.dev', href: 'mailto:hello@proxkey.dev' },
      { label: 'Setup help', href: 'mailto:hello@proxkey.dev?subject=ProxKey%20setup%20help' },
    ],
  },
] as const

function FooterLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith('/')) {
    return (
      <Link to={href} className="text-[15px] leading-[1.5] text-[#d6dee8]">
        {label}
      </Link>
    )
  }

  return (
    <a href={href} className="text-[15px] leading-[1.5] text-[#d6dee8]">
      {label}
    </a>
  )
}

export function Footer() {
  const [openGroup, setOpenGroup] = useState<string>('Product')

  return (
    <footer className="border-t border-[#27303a] bg-[#111318] text-white">
      <div className="mx-auto hidden max-w-7xl px-4 py-14 md:block lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="max-w-xl">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#9ca8b5]">
              A new layer in the stack: incident attribution
            </div>
            <h2 className="mt-4 font-['Georgia'] text-4xl tracking-tight text-white sm:text-5xl">
              Know what change broke production.
            </h2>
            <p className="mt-4 text-base leading-8 text-[#cfd7e0]">
              ProxKey ranks the most likely root-cause commits across deploy history, service
              dependencies, and incident signals.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/signup?plan=free"
                className="border border-[#ff5a1f] bg-[#ff5a1f] px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white"
              >
                Start triaging incidents
              </Link>
              <Link
                to="/demo"
                className="border border-[#39424c] bg-transparent px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white"
              >
                Explore signed-out preview
              </Link>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#8290a0]">
                  {column.title}
                </div>
                <div className="mt-4 grid gap-3">
                  {column.links.map((link) => (
                    <FooterLink key={link.label} href={link.href} label={link.label} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[#27303a] pt-6 text-sm text-[#9ca8b5] sm:flex-row sm:items-center sm:justify-between">
          <div>© 2026 ProxKey, Inc.</div>
          <div className="flex flex-wrap gap-3">
            <span>Ranked commits with evidence.</span>
            <span>Evidence output by default.</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[430px] px-4 py-8 md:hidden">
        <div className="space-y-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#92a0b0]">
            Incident attribution
          </div>
          <p className="text-[15px] leading-[1.65] text-[#d6dee8]">
            ProxKey ranks the most likely root-cause commits across deploy history, service
            dependencies, and incident signals.
          </p>
          <Link
            to="/signup?plan=free"
            className="flex min-h-11 w-full items-center justify-center border border-[#ff5a1f] bg-[#ff5a1f] px-4 text-sm font-medium uppercase tracking-[0.14em] text-white"
          >
            Start triaging incidents
          </Link>
        </div>

        <div className="mt-6 space-y-2">
          {columns.map((column) => {
            const expanded = openGroup === column.title

            return (
              <div key={column.title} className="border border-[#27303a] bg-[#171c22]">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroup((current) => (current === column.title ? '' : column.title))
                  }
                  className="flex min-h-12 w-full items-center justify-between px-4 text-left"
                >
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#92a0b0]">
                    {column.title}
                  </span>
                  <span className="text-[#ff8a5c]">{expanded ? '−' : '+'}</span>
                </button>
                {expanded ? (
                  <div className="space-y-3 border-t border-[#27303a] px-4 py-4">
                    {column.links.map((link) => (
                      <FooterLink key={link.label} href={link.href} label={link.label} />
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="mt-6 border-t border-[#27303a] pt-4 text-[13px] leading-[1.6] text-[#92a0b0]">
          © 2026 ProxKey, Inc.
        </div>
      </div>
    </footer>
  )
}
