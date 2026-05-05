import { Navigate, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { RequireAuth } from './auth/RequireAuth'
import DashboardLayout from './layouts/DashboardLayout'
import FlakyTestsPage from './pages/FlakyTestsPage'
import GitHubCallbackPage from './pages/GitHubCallbackPage'
import GitHubSetupPage from './pages/GitHubSetupPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import CallbackPage from './pages/CallbackPage'
import OverviewPage from './pages/OverviewPage'
import RepoDetailPage from './pages/RepoDetailPage'
import ReposIndexPage from './pages/ReposIndexPage'
import AboutPage from './pages/proxkey/AboutPage'
import PublicDocsPage from './pages/PublicDocsPage'
import RootRedirectPage from './pages/RootRedirectPage'
import SettingsPage from './pages/SettingsPage'
import StatusPage from './pages/StatusPage'
import WastePage from './pages/WastePage'
import './index.css'

export default function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <Routes>
        <Route path="/" element={<RootRedirectPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/callback" element={<CallbackPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/docs" element={<PublicDocsPage />} />
        <Route path="/github/callback" element={<GitHubCallbackPage />} />
        <Route path="/github/setup" element={<GitHubSetupPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="repos" element={<ReposIndexPage />} />
            <Route path="repos/:id" element={<RepoDetailPage />} />
            <Route path="waste" element={<WastePage />} />
            <Route path="flaky" element={<FlakyTestsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </TooltipProvider>
  )
}
