import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AuthMethodButtons } from '../components/auth/AuthMethodButtons'
import { clearOnboardingDraft, saveOnboardingDraft } from '../lib/onboardingDraft'
import type { PlanTier } from '../lib/proxkey-api'

const PLAN: PlanTier = 'FREE'

export default function SignupPage() {
  const { signUp, user, loading } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [accountType, setAccountType] = useState<'individual' | 'company' | null>(null)
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [oauthNotice, setOauthNotice] = useState<string | null>(null)

  const [emailOpen, setEmailOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) {
      clearOnboardingDraft()
      navigate('/dashboard', { replace: true })
    }
  }, [loading, user, navigate])

  function defaultWorkspaceName(): string {
    const t = fullName.trim()
    if (accountType === 'individual') {
      return companyName.trim() || (t ? `${t.split(/\s+/)[0] ?? t}'s workspace` : 'My workspace')
    }
    return companyName.trim()
  }

  function goToProviders() {
    setOauthNotice(null)
    if (!fullName.trim()) {
      setError('Enter your name.')
      return
    }
    if (accountType === 'company' && !companyName.trim()) {
      setError('Enter your company or team name.')
      return
    }
    setError(null)
    setStep(3)
  }

  function persistDraftForOAuth() {
    if (!accountType) return
    saveOnboardingDraft({
      accountType,
      fullName: fullName.trim(),
      companyName: companyName.trim() || defaultWorkspaceName(),
    })
  }

  async function submitEmail(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setOauthNotice(null)
    if (!email.trim()) {
      setError('Enter your work email.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    const org = defaultWorkspaceName()
    if (accountType === 'company' && !companyName.trim()) {
      setError('Enter your company or team name.')
      return
    }

    setBusy(true)
    const result = await signUp(
      email.trim().toLowerCase(),
      password,
      fullName.trim() || email.split('@')[0] || 'ProxKey User',
      org,
      PLAN,
    )
    setBusy(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    clearOnboardingDraft()
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
          <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-[#4a4a4a]">
            New account · step {step} of 3
          </p>
        </div>

        <div className="rounded-xl border border-[#1e1e1e] bg-[#111111] p-6 sm:p-8">
          {step === 1 ? (
            <>
              <h1 className="text-base font-semibold">How will you use ProxKey?</h1>
              <p className="mt-2 text-xs text-[#6b6b6b]">You can change this later in settings.</p>
              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAccountType('individual')
                    setStep(2)
                  }}
                  className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-4 text-left transition-colors hover:border-[#4ade80]/50 hover:bg-[#121212]"
                >
                  <span className="block text-sm font-semibold text-[#e8e8e8]">Just me</span>
                  <span className="mt-1 block text-xs text-[#6b6b6b]">Individual — personal workspace and repos.</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAccountType('company')
                    setStep(2)
                  }}
                  className="rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-4 text-left transition-colors hover:border-[#4ade80]/50 hover:bg-[#121212]"
                >
                  <span className="block text-sm font-semibold text-[#e8e8e8]">My company or team</span>
                  <span className="mt-1 block text-xs text-[#6b6b6b]">
                    Shared workspace, seats, and attribution for your org.
                  </span>
                </button>
              </div>
            </>
          ) : null}

          {step === 2 && accountType ? (
            <>
              <h1 className="text-base font-semibold">Tell us about you</h1>
              <p className="mt-2 text-xs text-[#6b6b6b]">
                {accountType === 'company'
                  ? 'We use this to label your workspace and invites.'
                  : 'Your name appears on reports and activity.'}
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <label htmlFor="su-name" className="mb-1.5 block text-xs font-medium text-[#a8a8a8]">
                    Full name
                  </label>
                  <input
                    id="su-name"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ada Lovelace"
                    className="w-full rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2.5 text-sm text-[#e8e8e8] outline-none focus:border-[#4ade80]"
                  />
                </div>
                <div>
                  <label htmlFor="su-org" className="mb-1.5 block text-xs font-medium text-[#a8a8a8]">
                    {accountType === 'company' ? 'Company or team name' : 'Workspace name (optional)'}
                  </label>
                  <input
                    id="su-org"
                    type="text"
                    autoComplete="organization"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={accountType === 'company' ? 'Acme Engineering' : 'My workspace'}
                    className="w-full rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2.5 text-sm text-[#e8e8e8] outline-none focus:border-[#4ade80]"
                  />
                  {accountType === 'individual' ? (
                    <p className="mt-1 text-[11px] text-[#4a4a4a]">
                      Leave blank to use a default based on your name.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1)
                    setError(null)
                  }}
                  className="rounded-lg border border-[#2e2e2e] px-4 py-2 text-xs font-medium text-[#9a9a9a] hover:bg-[#161616]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={goToProviders}
                  className="rounded-lg bg-[#4ade80] px-4 py-2 text-xs font-semibold text-[#0a0a0a] hover:opacity-90"
                >
                  Continue
                </button>
              </div>
            </>
          ) : null}

          {step === 3 && accountType ? (
            <>
              <h1 className="text-base font-semibold">Create your account</h1>
              <p className="mt-2 text-xs text-[#6b6b6b]">
                Choose a sign-in method. For new workspaces, email creates your ProxKey user and organization in one step.
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
                  onGitHubClick={persistDraftForOAuth}
                  onGoogleClick={() =>
                    setOauthNotice(
                      'Google sign-in requires OAuth credentials on the API. For now, use GitHub or email.',
                    )
                  }
                  onAppleClick={() =>
                    setOauthNotice(
                      'Sign in with Apple requires OAuth credentials on the API. For now, use GitHub or email.',
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
                  <p className="text-xs font-medium uppercase tracking-wider text-[#6b6b6b]">Work email & password</p>
                  <div>
                    <label htmlFor="su-email" className="mb-1.5 block text-xs text-[#a8a8a8]">
                      Email
                    </label>
                    <input
                      id="su-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2.5 text-sm outline-none focus:border-[#4ade80]"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="su-pass" className="mb-1.5 block text-xs text-[#a8a8a8]">
                      Password
                    </label>
                    <input
                      id="su-pass"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2.5 text-sm outline-none focus:border-[#4ade80]"
                      minLength={8}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="su-pass2" className="mb-1.5 block text-xs text-[#a8a8a8]">
                      Confirm password
                    </label>
                    <input
                      id="su-pass2"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="w-full rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2.5 text-sm outline-none focus:border-[#4ade80]"
                      minLength={8}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-lg bg-[#e8e8e8] py-3 text-sm font-semibold text-[#0a0a0a] disabled:opacity-50"
                  >
                    {busy ? 'Creating workspace…' : 'Create account'}
                  </button>
                </form>
              ) : null}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(2)
                    setEmailOpen(false)
                    setError(null)
                    setOauthNotice(null)
                  }}
                  className="text-xs text-[#6b6b6b] hover:text-[#e8e8e8]"
                >
                  ← Back
                </button>
              </div>
            </>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-[#3a3a3a]">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-[#e8e8e8] hover:text-[#4ade80]">
            Sign in
          </Link>
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
