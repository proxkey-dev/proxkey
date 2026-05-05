import { useEffect, useState } from 'react'
import { apiUrl, getAuthCapabilities } from '../../lib/api'

type Style = 'dark' | 'light'

function googleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function appleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.42 2.27-.88 3.34-.65 1.44-2.08 2.96-3.51 2.97-1.05-.07-2.13-1.77-2.88-2.85-.77-1.1-1.66-2.45-1.66-3.77 0-.15 0-.3.02-.45.08-.01.15-.02.23-.02 1.12-.05 2.45.81 3.31 1.72.85-.94 2.07-1.67 3.14-1.67.07 0 .14.01.22.02-.02.11-.03.23-.03.34zm-4.38 6.13c1.35 0 2.5.6 3.41 1.45-.85.04-1.83.47-2.47 1.08-.66.62-1.11 1.47-1.11 2.48 0 1.06.5 1.88 1.11 2.47.67.65 1.6 1.05 2.54 1.18-1.24 1.58-2.94 2.83-4.84 2.83-2.1 0-3.85-1.21-4.92-2.95-.82-1.36-1.28-2.96-1.28-4.64 0-1.45.37-2.84 1.04-4.05.68-1.21 1.62-2.25 2.83-3.04.62-.43 1.31-.76 2.04-.96-.03.19-.05.39-.05.61 0 1.08.46 2.04 1.12 2.75-.61-.04-1.19.04-1.72.23-.5.18-.95.49-1.32.92-.82.92-1.09 2.17-1.09 3.35 0 1.42.54 2.78 1.64 3.75-.74-1.03-1.03-2.3-1.03-3.56 0-2.27 1.21-4.22 2.92-5.12z" />
    </svg>
  )
}

function githubIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
      />
    </svg>
  )
}

function mailIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

const baseBtn =
  'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80] disabled:cursor-not-allowed disabled:opacity-45'

export type AuthMethodButtonsProps = {
  style?: Style
  /** Called immediately before navigating to GitHub (after draft is saved by parent). */
  onGitHubClick?: () => void
  /** When API reports GitHub OAuth unavailable, user clicked the GitHub control (show inline help). */
  onGitHubUnavailable?: () => void
  onGoogleClick?: () => void
  onAppleClick?: () => void
  onEmailClick: () => void
  googleDisabled?: boolean
  appleDisabled?: boolean
}

export function AuthMethodButtons({
  style = 'dark',
  onGitHubClick,
  onGitHubUnavailable,
  onGoogleClick,
  onAppleClick,
  onEmailClick,
  googleDisabled = true,
  appleDisabled = true,
}: AuthMethodButtonsProps) {
  const gh = apiUrl('/api/auth/github')
  const [githubOAuth, setGithubOAuth] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    getAuthCapabilities().then((c) => {
      if (!cancelled) setGithubOAuth(c.githubOAuth)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const isLight = style === 'light'
  const primaryBorder = isLight ? 'border-[#1e1e1e] bg-[#0a0a0a] text-[#e8e8e8] hover:bg-[#141414]' : 'border-[#2e2e2e] bg-[#161616] text-[#e8e8e8] hover:bg-[#1c1c1c]'
  const ghostBorder = isLight ? 'border-[#2e2e2e] bg-transparent text-[#e8e8e8] hover:bg-[#141414]' : 'border-[#2e2e2e] bg-[#111111] text-[#e8e8e8] hover:bg-[#161616]'
  const moreLabel =
    googleDisabled && appleDisabled ? 'More options (soon)' : 'Or continue with'

  const githubWorks = githubOAuth === true
  /** Until we know GitHub OAuth works, avoid leading with a broken link — prefer email. */
  const emailFirst = githubOAuth !== true

  const githubControl =
    githubWorks ? (
      <a
        href={gh}
        className={`${baseBtn} border ${primaryBorder}`}
        onClick={() => onGitHubClick?.()}
      >
        {githubIcon()}
        Continue with GitHub
      </a>
    ) : (
      <button
        type="button"
        disabled={githubOAuth === null}
        className={`${baseBtn} border ${primaryBorder} disabled:cursor-wait`}
        onClick={() => onGitHubUnavailable?.()}
        title={githubOAuth === false ? 'GitHub sign-in is not configured on this server. Use email.' : undefined}
      >
        {githubIcon()}
        Continue with GitHub
      </button>
    )

  const emailControl = (
    <button
      type="button"
      className={`${baseBtn} border ${ghostBorder}`}
      onClick={onEmailClick}
    >
      {mailIcon()}
      Continue with email
    </button>
  )

  return (
    <div className="flex flex-col gap-2">
      {emailFirst ? (
        <>
          {emailControl}
          {githubControl}
        </>
      ) : (
        <>
          {githubControl}
          {emailControl}
        </>
      )}

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-[#2a2a2a]" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-[#5a5a5a]">
          {moreLabel}
        </div>
      </div>

      <button
        type="button"
        disabled={googleDisabled}
        className={`${baseBtn} border ${ghostBorder}`}
        onClick={() => onGoogleClick?.()}
        title={googleDisabled ? 'Google sign-in — configure OAuth on the API to enable' : undefined}
      >
        {googleIcon()}
        Google
      </button>

      <button
        type="button"
        disabled={appleDisabled}
        className={`${baseBtn} border ${ghostBorder}`}
        onClick={() => onAppleClick?.()}
        title={appleDisabled ? 'Sign in with Apple — configure OAuth on the API to enable' : undefined}
      >
        {appleIcon()}
        Apple
      </button>
    </div>
  )
}
