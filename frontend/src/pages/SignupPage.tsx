import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl } from '../lib/api'
import type { PlanTier } from '../lib/proxkey-api'

const plans: { value: PlanTier; label: string; desc: string }[] = [
  { value: 'FREE', label: 'Free', desc: 'Up to 3 repos' },
  { value: 'TEAM', label: 'Team', desc: 'Unlimited repos + seats' },
  { value: 'FOUNDER', label: 'Founder', desc: 'Early-access pricing' },
]

const PLAN_ORDER: PlanTier[] = ['FREE', 'FOUNDER', 'TEAM', 'GROWTH', 'ENTERPRISE']

function normalizePlan(raw: string | null): PlanTier | null {
  if (!raw) {
    return null
  }
  const upper = raw.trim().toUpperCase() as PlanTier
  return PLAN_ORDER.includes(upper) ? upper : null
}

export default function SignupPage() {
  const { signUp, user, loading, clearAuthError, authStrategy } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [fullName, setFullName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [plan, setPlan] = useState<PlanTier>('FREE')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const fromQuery = normalizePlan(searchParams.get('plan'))
    if (fromQuery) {
      setPlan(fromQuery)
    }
  }, [searchParams])

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, user, navigate])

  async function runSignup() {
    if (authStrategy === 'local') {
      return
    }
    if (!fullName.trim()) {
      setError('Enter your full name.')
      return
    }
    if (!workspaceName.trim()) {
      setError('Enter your workspace name.')
      return
    }

    setBusy(true)
    setError(null)
    clearAuthError()

    try {
      const result = await signUp('', '', fullName.trim(), workspaceName.trim(), plan)
      if (result.error) {
        setError(result.error.message)
        setBusy(false)
        return
      }
      // If redirecting: Auth0 takes over – browser navigates away
    } catch (unexpected) {
      setError(unexpected instanceof Error ? unexpected.message : 'Sign-up failed. Try again.')
      setBusy(false)
    }
  }

  function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void runSignup()
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a]" />
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0a0a] px-4 py-12 text-[#e8e8e8]">
      <main className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="mb-8 text-center">
          <p className="font-mono text-2xl font-semibold tracking-tight">ProxKey</p>
          <p className="mt-1 text-sm text-[#6b6b6b]">Every CI dollar, explained.</p>
        </div>

        <div className="rounded-xl border border-[#1e1e1e] bg-[#111111] p-8">
          <h1 className="mb-1 text-base font-semibold">Create your workspace</h1>
          <p className="mb-6 text-xs text-[#6b6b6b]">
            {authStrategy === 'auth0'
              ? 'Tell us about yourself, then complete sign-up via Auth0.'
              : 'First sign-in with GitHub creates your workspace automatically.'}
          </p>

          {error && (
            <div className="mb-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {authStrategy === 'local' ? (
            <>
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
            </>
          ) : (
            <>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Full name */}
                <div>
                  <label htmlFor="fullName" className="mb-1.5 block text-xs font-medium text-[#a8a8a8]">
                    Full name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value) }}
                    disabled={busy}
                    className="w-full rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2.5 text-sm text-[#e8e8e8] placeholder-[#3a3a3a] outline-none transition-colors focus:border-[#4ade80] disabled:opacity-50"
                  />
                </div>

                {/* Workspace name */}
                <div>
                  <label htmlFor="workspaceName" className="mb-1.5 block text-xs font-medium text-[#a8a8a8]">
                    Workspace name
                  </label>
                  <input
                    id="workspaceName"
                    type="text"
                    autoComplete="organization"
                    placeholder="Acme Corp"
                    value={workspaceName}
                    onChange={(e) => { setWorkspaceName(e.target.value) }}
                    disabled={busy}
                    className="w-full rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2.5 text-sm text-[#e8e8e8] placeholder-[#3a3a3a] outline-none transition-colors focus:border-[#4ade80] disabled:opacity-50"
                  />
                  <p className="mt-1 text-xs text-[#3a3a3a]">Your company or team name.</p>
                </div>

                {/* Plan selection */}
                <div>
                  <p className="mb-2 text-xs font-medium text-[#a8a8a8]">Plan</p>
                  <div className="grid grid-cols-3 gap-2">
                    {plans.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => { setPlan(p.value) }}
                        disabled={busy}
                        className={`rounded-lg border px-3 py-2.5 text-left text-xs transition-colors disabled:opacity-50 ${
                          plan === p.value
                            ? 'border-[#4ade80] bg-[#4ade80]/10 text-[#4ade80]'
                            : 'border-[#1e1e1e] text-[#6b6b6b] hover:border-[#2e2e2e] hover:text-[#e8e8e8]'
                        }`}
                      >
                        <span className="block font-semibold">{p.label}</span>
                        <span className="block text-[10px] opacity-70">{p.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#4ade80] px-4 py-3 text-sm font-semibold text-[#0a0a0a] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
                >
                  {busy ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a]" />
                  ) : null}
                  {busy ? 'Redirecting…' : 'Continue with Auth0 →'}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-[#6b6b6b]">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-[#e8e8e8] hover:text-[#4ade80]">
                  Sign in
                </Link>
              </p>
            </>
          )}
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
