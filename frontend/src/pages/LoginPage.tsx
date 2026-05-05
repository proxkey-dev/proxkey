import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl } from '../lib/api'

export default function LoginPage() {
  const { signIn, user, loading, authStrategy, authError, clearAuthError } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, user, navigate])

  useEffect(() => {
    if (authError && authError !== 'NO_WORKSPACE') {
      setError(authError)
    }
  }, [authError])

  async function handleSignIn() {
    if (authStrategy === 'local') {
      return
    }
    setBusy(true)
    setError(null)
    clearAuthError()
    const result = await signIn('', '')
    if (result.error) {
      setError(result.error.message)
      setBusy(false)
      return
    }
    // Auth0 SPA redirect normally returns before unload; leaving busy avoids a clickable double-submit blink.
    if (!result.redirecting) {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a]" />
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0a0a] px-4 text-[#e8e8e8]">
      <main className="w-full max-w-sm">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <p className="font-mono text-2xl font-semibold tracking-tight">ProxKey</p>
          <p className="mt-1 text-sm text-[#6b6b6b]">Every CI dollar, explained.</p>
        </div>

        <div className="rounded-xl border border-[#1e1e1e] bg-[#111111] p-8">
          <h1 className="mb-1 text-base font-semibold">Sign in to your workspace</h1>
          <p className="mb-6 text-xs text-[#6b6b6b]">
            {authStrategy === 'auth0'
              ? 'Securely authenticated via Auth0.'
              : 'Sign in with GitHub (redirects to the ProxKey API to set your session).'}
          </p>

          {error && (
            <div className="mb-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {authStrategy === 'local' ? (
            <a
              href={apiUrl('/api/auth/github')}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#e8e8e8] px-4 py-3 text-sm font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
                />
              </svg>
              Continue with GitHub
            </a>
          ) : (
            <button
              type="button"
              onClick={() => void handleSignIn()}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#e8e8e8] px-4 py-3 text-sm font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
            >
              {busy ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a]" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden>
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2a8 8 0 0 1 5.29 13.887l-1.063-1.063A6.001 6.001 0 0 0 12 6a6 6 0 0 0-6 6 6.001 6.001 0 0 0 4.773 5.887L9.71 18.94A8 8 0 0 1 12 4z" />
                </svg>
              )}
              Continue with Auth0
            </button>
          )}

        </div>

        <p className="mt-6 text-center text-xs text-[#3a3a3a]">
          Free for up to 3 repos. No credit card required.
        </p>
        <p className="mt-2 text-center text-xs text-[#3a3a3a]">
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
