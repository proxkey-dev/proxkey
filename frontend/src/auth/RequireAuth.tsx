import { Navigate, Outlet } from 'react-router-dom'
import { useAuth as useClerkAuth } from '@clerk/react'
import { useAuth } from '../contexts/AuthContext'

const clerkPublishableConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim()

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-sm text-[#6b6b6b]">
      Loading…
    </div>
  )
}

function RequireProxkeyOutlet() {
  const { user, loading } = useAuth()

  if (loading) {
    return <Spinner />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function RequireClerkAndProxkeyOutlet() {
  const { user, loading } = useAuth()
  const { isLoaded: clerkLoaded, isSignedIn } = useClerkAuth()

  if (!clerkLoaded || loading || (isSignedIn && !user)) {
    return <Spinner />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export function RequireAuth() {
  if (!clerkPublishableConfigured) {
    return <RequireProxkeyOutlet />
  }
  return <RequireClerkAndProxkeyOutlet />
}
