import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl } from '../lib/api'

export default function SignupPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, user, navigate])

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a]" />
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0a0a] px-4 py-12 text-[#e8e8e8]">
      <main className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-2xl font-semibold tracking-tight">ProxKey</p>
          <p className="mt-1 text-sm text-[#6b6b6b]">Every CI dollar, explained.</p>
        </div>

        <div className="rounded-xl border border-[#1e1e1e] bg-[#111111] p-8">
          <h1 className="mb-1 text-base font-semibold">Create your workspace</h1>
          <p className="mb-6 text-xs text-[#6b6b6b]">
            First sign-in with GitHub creates your workspace automatically.
          </p>

          <a
            href={apiUrl('/api/auth/github')}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4ade80] px-4 py-3 text-sm font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
          >
            Continue with GitHub
          </a>
          <p className="mt-5 text-center text-xs text-[#6b6b6b]">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-[#e8e8e8] hover:text-[#4ade80]">
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-[#3a3a3a]">
          Free tier includes up to 3 repos. No credit card required.
        </p>
        <p className="mt-3 text-center text-xs text-[#3a3a3a]">
          <Link to="/" className="hover:text-[#6b6b6b]">
            Back to home
          </Link>
          <span className="mx-2 text-[#2a2a2a]">·</span>
          <Link to="/about" className="hover:text-[#6b6b6b]">
            About
          </Link>
          <span className="mx-2 text-[#2a2a2a]">·</span>
          <Link to="/docs" className="hover:text-[#6b6b6b]">
            Docs
          </Link>
        </p>
      </main>
    </div>
  )
}
