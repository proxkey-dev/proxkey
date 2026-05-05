import { Navigate } from 'react-router-dom'
import { useAuth as useClerkAuth } from '@clerk/react'
import { useAuth } from '../contexts/AuthContext'
import ProxKeyMarketingLandingPage from './proxkey/ProxKeyMarketingLandingPage'

const clerkPublishableConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim()

export default function RootRedirectPage() {
  const { user, loading } = useAuth()

  if (!clerkPublishableConfigured) {
    if (loading) {
      return <div className="min-h-screen bg-[#0a0a0a]" />
    }
    if (user) {
      return <Navigate to="/dashboard" replace />
    }
    return <ProxKeyMarketingLandingPage />
  }

  return <RootRedirectPageWithClerk user={user} loading={loading} />
}

function RootRedirectPageWithClerk({
  user,
  loading,
}: {
  user: ReturnType<typeof useAuth>['user']
  loading: boolean
}) {
  const { isLoaded: clerkLoaded, isSignedIn } = useClerkAuth()

  if (!clerkLoaded || loading || (isSignedIn && !user)) {
    return <div className="min-h-screen bg-[#0a0a0a]" />
  }

  if (user || isSignedIn) {
    return <Navigate to="/dashboard" replace />
  }

  return <ProxKeyMarketingLandingPage />
}
