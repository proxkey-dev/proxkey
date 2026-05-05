import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AuthMethodButtons } from '../components/auth/AuthMethodButtons'

export default function LoginPage() {
  const { user, loading, authError, clearAuthError, signIn } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [oauthNotice, setOauthNotice] = useState<string | null>(null)

  const [emailOpen, setEmailOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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

  async function submitEmail(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOauthNotice(null)
    if (!email.trim()) {
      setError('Enter your email.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }
    setBusy(true)
    const result = await signIn(email.trim().toLowerCase(), password)
    setBusy(false)
    if (result.error) {
      setError(result.error.message)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a]" />
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0a0a] px-4 py-12 text-[#e8e8e8]">
      <main className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-mono text-2xl font-semibold tracking-tight">ProxKey</p>
          <p className="mt-1 text-sm text-[#6b6b6b]">Every CI dollar, explained.</p>
        </div>

        <div className="rounded-xl border border-[#1e1e1e] bg-[#111111] p-6 sm:p-8">
          <h1 className="text-base font-semibold">Sign in</h1>
          <p className="mt-2 text-xs text-[#6b6b6b]">
            Use GitHub (session via the ProxKey API), or email and password. Google and Apple need
            OAuth on the API first.
          </p>

          {oauthNotice ? (
            <div className="mt-4 rounded border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
              {oauthNotice}
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          ) : null}

          <div className="mt-6">
            <AuthMethodButtons
              onGitHubClick={() => {
                clearAuthError()
                setError(null)
              }}
              onGoogleClick={() =>
                setOauthNotice(
                  'Google sign-in requires OAuth credentials on the API. Use GitHub or email for now.',
                )
              }
              onAppleClick={() =>
                setOauthNotice(
                  'Sign in with Apple requires OAuth credentials on the API. Use GitHub or email for now.',
                )
              }
              onEmailClick={() => {
                setOauthNotice(null)
                setEmailOpen(true)
              }}
              googleDisabled={false}
              appleDisabled={false}
            />
          </div>

          {emailOpen ? (
            <form className="mt-8 space-y-4 border-t border-[#1e1e1e] pt-8" onSubmit={submitEmail}>
              <p className="text-xs font-medium uppercase tracking-wider text-[#6b6b6b]">
                Email & password
              </p>
              <div>
                <label htmlFor="li-email" className="mb-1.5 block text-xs text-[#a8a8a8]">
                  Email
                </label>
                <input
                  id="li-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2.5 text-sm outline-none focus:border-[#4ade80]"
                  required
                />
              </div>
              <div>
                <label htmlFor="li-pass" className="mb-1.5 block text-xs text-[#a8a8a8]">
                  Password
                </label>
                <input
                  id="li-pass"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2.5 text-sm outline-none focus:border-[#4ade80]"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-[#e8e8e8] py-3 text-sm font-semibold text-[#0a0a0a] disabled:opacity-50"
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-[#3a3a3a]">
          New to ProxKey?{' '}
          <Link to="/signup" className="font-medium text-[#e8e8e8] hover:text-[#4ade80]">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-[#3a3a3a]">
          Free for up to 3 repos. No credit card required.
        </p>
        <p className="mt-4 text-center text-[11px] text-[#3a3a3a]">
          <Link to="/" className="hover:text-[#6b6b6b]">
            Home
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
