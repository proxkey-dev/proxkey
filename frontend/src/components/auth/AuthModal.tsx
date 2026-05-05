import { type FormEvent, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import type { PlanTier } from '../../lib/proxkey-api'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'signup'
  initialPlan?: PlanTier
  externalError?: string | null
}

type AuthMode = 'login' | 'signup'

const inputClassName =
  'w-full border border-[#d6d2c8] bg-[#fbfaf7] px-4 py-3 text-sm text-[#111] outline-none transition focus:border-[#ff5a1f] focus:ring-2 focus:ring-[#ff5a1f]/15'

const tabClassName =
  'flex-1 border px-3 py-2 text-sm font-medium uppercase tracking-[0.16em] transition'

export function AuthModal({
  isOpen,
  onClose,
  initialMode = 'login',
  initialPlan = 'FREE',
  externalError = null,
}: AuthModalProps) {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [plan, setPlan] = useState<PlanTier>(initialPlan === 'ENTERPRISE' ? 'TEAM' : initialPlan)
  const [name, setName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
      setPlan(initialPlan === 'ENTERPRISE' ? 'TEAM' : initialPlan)
      setError(externalError)
      return
    }

    setMode(initialMode)
    setPlan(initialPlan === 'ENTERPRISE' ? 'TEAM' : initialPlan)
    setName('')
    setOrganizationName('')
    setEmail('')
    setPassword('')
    setSubmitting(false)
    setError(null)
  }, [externalError, initialMode, initialPlan, isOpen])

  if (!isOpen) {
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const result =
      mode === 'login'
        ? await signIn(email.trim().toLowerCase(), password)
        : await signUp(
            email.trim().toLowerCase(),
            password,
            name.trim(),
            organizationName.trim(),
            plan,
          )

    if (result.error) {
      setError(result.error.message)
      setSubmitting(false)
      return
    }

    if (result.redirecting) {
      return
    }

    setSubmitting(false)
    onClose()
    navigate('/dashboard')
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0 bg-[rgba(17,17,17,0.58)] backdrop-blur-md"
          onClick={onClose}
        />

        <div className="fixed inset-0 flex items-center justify-center p-0 md:p-6">
          <motion.div
            initial={{ y: 18, opacity: 0.92, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0.92, scale: 0.985 }}
            transition={{ duration: 0.18 }}
            className="pk-grid-surface relative flex min-h-screen w-full flex-col border-x border-[#d6d2c8] bg-[#f6f4ef] md:min-h-0 md:max-w-[560px] md:border md:shadow-[0_32px_100px_rgba(10,10,10,0.32)]"
          >
            <div className="pointer-events-none absolute inset-0 border border-white/45 [clip-path:polygon(0_0,calc(100%-18px)_0,100%_18px,100%_100%,18px_100%,0_calc(100%-18px))]" />

            <div className="relative mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pb-6 pt-5 md:px-7 md:pb-7 md:pt-6">
              <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-[#d8d1c5] md:hidden" />

              <div className="flex items-start justify-between gap-4">
                <div className="max-w-[360px]">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
                    {mode === 'login' ? 'Sign in' : 'Create workspace'}
                  </div>
                  <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#111]">
                    {mode === 'login'
                      ? 'Access the triage control center'
                      : 'Launch a real ProxKey workspace'}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[#57544d]">
                    {mode === 'login'
                      ? 'Sign in with your work email.'
                      : 'Create an organization, provision the owner account, and land directly in the production dashboard.'}
                  </p>
                  {mode === 'signup' ? (
                    <div className="mt-4 inline-flex border border-[#eadfce] bg-[#faf8f4] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[#57544d]">
                      Selected plan: {plan.toLowerCase()}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center border border-[#d6d2c8] bg-white text-[#111]"
                  aria-label="Close authentication modal"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-0 border border-[#d6d2c8] bg-[#efebe2] p-1">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`${tabClassName} ${mode === 'login' ? 'border-[#111] bg-[#111] text-white' : 'border-transparent bg-transparent text-[#57544d]'}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`${tabClassName} ${mode === 'signup' ? 'border-[#111] bg-[#111] text-white' : 'border-transparent bg-transparent text-[#57544d]'}`}
                >
                  Sign Up
                </button>
              </div>

              {error ? (
                <div className="mt-5 border border-[#f1cac6] bg-[#fff4f4] px-4 py-3 text-sm text-[#e5484d]">
                  {error}
                </div>
              ) : null}

              <form className="mt-6 flex flex-1 flex-col gap-4" onSubmit={handleSubmit}>
                {mode === 'signup' ? (
                  <>
                    <div>
                      <label
                        htmlFor="auth-name"
                        className="mb-2 block text-sm font-medium text-[#111]"
                      >
                        Full name
                      </label>
                      <input
                        id="auth-name"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className={inputClassName}
                        placeholder="Aisha Carter"
                        autoComplete="name"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="auth-organization"
                        className="mb-2 block text-sm font-medium text-[#111]"
                      >
                        Organization
                      </label>
                      <input
                        id="auth-organization"
                        type="text"
                        value={organizationName}
                        onChange={(event) => setOrganizationName(event.target.value)}
                        className={inputClassName}
                        placeholder="Northwind Systems"
                        autoComplete="organization"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="auth-plan"
                        className="mb-2 block text-sm font-medium text-[#111]"
                      >
                        Plan
                      </label>
                      <select
                        id="auth-plan"
                        value={plan}
                        onChange={(event) => setPlan(event.target.value as PlanTier)}
                        className={inputClassName}
                      >
                        <option value="FREE">Free</option>
                        <option value="FOUNDER">Founder</option>
                        <option value="TEAM">Team</option>
                        <option value="GROWTH">Growth</option>
                      </select>
                    </div>
                  </>
                ) : null}

                <div>
                  <label htmlFor="auth-email" className="mb-2 block text-sm font-medium text-[#111]">
                    Work email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClassName}
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="auth-password" className="mb-2 block text-sm font-medium text-[#111]">
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={inputClassName}
                    placeholder={
                      mode === 'login' ? 'Enter your password' : 'Minimum 8 characters'
                    }
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                  />
                </div>

                <div className="mt-auto grid gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="border border-[#111] bg-[#111] px-5 py-3 text-sm font-medium text-white disabled:opacity-70"
                  >
                    {submitting
                      ? mode === 'login'
                        ? 'Signing in…'
                        : 'Creating workspace…'
                      : mode === 'login'
                        ? 'Continue'
                        : 'Create workspace'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      navigate('/#demo-inbox')
                    }}
                    className="border border-[#d6d2c8] bg-white px-5 py-3 text-sm font-medium text-[#111]"
                  >
                    Continue with demo
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
