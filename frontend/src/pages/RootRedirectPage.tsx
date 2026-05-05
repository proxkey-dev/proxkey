import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ProxKeyMarketingLandingPage from './proxkey/ProxKeyMarketingLandingPage'

export default function RootRedirectPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a]" />
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <ProxKeyMarketingLandingPage />
}
