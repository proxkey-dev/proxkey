import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAuth0Runtime } from '../contexts/Auth0RuntimeContext'
import { loadPendingAuth0Signup } from '../lib/auth0'

/**
 * Auth0 redirects here first. Tokens are finalized by the SDK and we clear the URL via
 * `onRedirectCallback` (React Router navigate). While this mounts, bootstrap runs in AuthContext.
 * This effect is a fallback if we ever land here without Router sync (e.g. deep link).
 */
export default function CallbackPage() {
  const { user, loading, authError, clearAuthError } = useAuth()
  const { isLoading: auth0Loading } = useAuth0Runtime()
  const navigate = useNavigate()

  useEffect(() => {
    if (auth0Loading || loading) {
      return
    }

    if (user) {
      navigate('/dashboard', { replace: true })
      return
    }

    if (authError === 'NO_WORKSPACE') {
      clearAuthError()
      navigate('/signup', { replace: true })
      return
    }

    if (!authError) {
      const pendingSignup = loadPendingAuth0Signup()
      // User started ProxKey signup (Auth0) but returned without a session (cancel/error) — resume on /signup, not login.
      navigate(pendingSignup ? '/signup' : '/login', { replace: true })
    }
  }, [auth0Loading, loading, user, authError, navigate, clearAuthError])

  if (authError && authError !== 'NO_WORKSPACE') {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0a0a] px-4 text-[#e8e8e8]">
        <div className="max-w-sm text-center">
          <p className="mb-2 font-mono text-2xl font-semibold">ProxKey</p>
          <p className="mb-3 text-sm text-[#6b6b6b]">Something went wrong during sign-in.</p>
          <p className="mb-5 rounded border border-red-900/50 bg-red-950/40 px-4 py-2 text-xs text-red-400">
            {authError}
          </p>
          <div className="flex flex-col gap-2">
            <a
              href="/signup"
              className="rounded-lg bg-[#4ade80] px-4 py-2 text-xs font-semibold text-[#0a0a0a] hover:opacity-90"
            >
              Create a workspace
            </a>
            <a href="/login" className="text-xs text-[#6b6b6b] underline hover:text-[#e8e8e8]">
              Back to sign in
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Still waiting on Auth0 or our context
  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0a0a] text-[#e8e8e8]">
      <div className="text-center">
        <p className="font-mono text-2xl font-semibold">ProxKey</p>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#6b6b6b]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2e2e2e] border-t-[#4ade80]" />
          Completing sign-in…
        </div>
      </div>
    </div>
  )
}
