import { useAuth } from '@clerk/react'
import { useEffect } from 'react'
import { apiUrl } from '../lib/api'
import { setToken } from '../lib/proxkey-api'

const publishable =
  typeof import.meta.env.VITE_CLERK_PUBLISHABLE_KEY === 'string'
    ? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY.trim()
    : ''

/**
 * After Clerk creates a browser session, exchange it for a ProxKey API Bearer session.
 */
export function ClerkProxKeyBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth()

  useEffect(() => {
    if (!publishable) {
      return
    }
    if (!isLoaded || !isSignedIn) {
      return
    }

    let cancelled = false

    async function sync() {
      try {
        const clerkJwt = await getToken()
        if (!clerkJwt || cancelled) {
          return
        }
        const res = await fetch(apiUrl('/api/auth/clerk'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${clerkJwt}` },
          credentials: 'include',
        })
        const data = (await res.json().catch(() => null)) as { accessToken?: string } | null
        if (!res.ok || !data?.accessToken) {
          return
        }
        if (cancelled) {
          return
        }
        setToken(data.accessToken)
        window.dispatchEvent(new Event('proxkey-auth-refresh'))
      } catch {
        /* ignore transient network failures */
      }
    }

    void sync()

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded, isSignedIn])

  return null
}
