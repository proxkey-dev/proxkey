import { Link } from 'react-router-dom'

export default function PublicDocsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-12 text-[#e8e8e8] md:px-8">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="font-mono text-sm text-[#6b6b6b] hover:text-[#4ade80]">
          ← Home
        </Link>
        <h1 className="mt-8 font-mono text-2xl font-semibold tracking-tight">Documentation</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#6b6b6b]">
          Product docs are still being published here. Connect GitHub Actions from the home page to open the dashboard, or
          email{' '}
          <a href="mailto:hello@proxkey.dev" className="text-[#4ade80] hover:underline">
            hello@proxkey.dev
          </a>{' '}
          for integration help.
        </p>
      </div>
    </div>
  )
}
