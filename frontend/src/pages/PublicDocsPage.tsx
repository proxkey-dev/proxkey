import { Link } from 'react-router-dom'
import { apiUrl } from '../lib/api'

export default function PublicDocsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-[#e8e8e8]">
      <main className="flex-1 px-4 py-12 md:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-[#6b6b6b]">
            <Link to="/" className="hover:text-[#4ade80]">
              ← Home
            </Link>
            <span aria-hidden="true" className="text-[#2a2a2a]">
              |
            </span>
            <Link to="/about" className="hover:text-[#e8e8e8]">
              About
            </Link>
          </div>
          <h1 className="mt-8 font-mono text-2xl font-semibold tracking-tight">Documentation</h1>
          <p className="mt-4 text-sm leading-relaxed text-[#6b6b6b]">
            Product docs are still being published here. Connect GitHub Actions from the home page to open the dashboard,
            or email{' '}
            <a href="mailto:hello@proxkey.dev" className="text-[#4ade80] hover:underline">
              hello@proxkey.dev
            </a>{' '}
            for integration help.
          </p>
        </div>
      </main>

      <footer className="border-t border-[#1e1e1e] bg-[#0a0a0a] px-4 py-8 md:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 text-sm text-[#6b6b6b] md:flex-row md:items-center md:justify-between">
          <p className="font-mono text-[#e8e8e8]">ProxKey © 2026</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href="mailto:hello@proxkey.dev" className="transition-colors hover:text-[#e8e8e8]">
              hello@proxkey.dev
            </a>
            <span aria-hidden="true" className="hidden text-[#2a2a2a] sm:inline">
              |
            </span>
            <a
              href={apiUrl('/health')}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[#e8e8e8]"
            >
              Status
            </a>
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
