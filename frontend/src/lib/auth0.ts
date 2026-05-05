import type { PlanTier } from './proxkey-api'

export type PendingAuth0Signup = {
  name: string
  organizationName: string
  plan: PlanTier
}

const PENDING_SIGNUP_KEY = 'proxkey.auth0.pending-signup'

export function getAuth0ClientConfig() {
  const domain = (import.meta.env.VITE_AUTH0_DOMAIN as string | undefined)?.trim()
  const clientId = (import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined)?.trim()
  const audience = (import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined)?.trim()
  const callbackUrl = (import.meta.env.VITE_AUTH0_CALLBACK_URL as string | undefined)?.trim()

  if (!domain || !clientId || !audience) {
    return null
  }

  return {
    domain,
    clientId,
    audience,
    redirectUri: callbackUrl || `${window.location.origin}/callback`,
  }
}

export function savePendingAuth0Signup(value: PendingAuth0Signup): void {
  window.sessionStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(value))
}

export function loadPendingAuth0Signup(): PendingAuth0Signup | null {
  const raw = window.sessionStorage.getItem(PENDING_SIGNUP_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as PendingAuth0Signup
  } catch {
    return null
  }
}

export function clearPendingAuth0Signup(): void {
  window.sessionStorage.removeItem(PENDING_SIGNUP_KEY)
}
