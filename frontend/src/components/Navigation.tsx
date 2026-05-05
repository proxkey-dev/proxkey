import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ProxKeyLogo } from './ProxKeyLogo'
import { useAuth } from '../contexts/AuthContext'

type AuthMode = 'login' | 'signup'

type NavigationProps = {
  onOpenAuth: (mode?: AuthMode) => void
}

const publicNavLinks = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Docs', href: '/docs' },
  { label: 'Get Started', href: '/dashboard' },
  { label: 'Status', href: '/status' },
] as const

const appNavLinks = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Workspaces', href: '/dashboard' },
  { label: 'Packets', href: '/dashboard#inbox' },
  { label: 'Integrations', href: '/settings/api-keys' },
  { label: 'Settings', href: '/settings/billing' },
] as const

function isLinkActive(pathname: string, hash: string, href: string): boolean {
  const [cleanHref, cleanHash] = href.split('#')

  if (cleanHref === '/') {
    return pathname === '/'
  }

  if (cleanHash) {
    return pathname === cleanHref && hash === `#${cleanHash}`
  }

  if (hash && pathname === cleanHref) {
    return false
  }

  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`)
}

export function Navigation({ onOpenAuth }: NavigationProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const displayName =
    user?.name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    user?.email.split('@')[0] ||
    'Workspace'
  const navLinks = user ? appNavLinks : publicNavLinks

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileMenuOpen) {
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [mobileMenuOpen])

  async function handleSignOut(): Promise<void> {
    setIsSigningOut(true)
    await signOut()
    setIsSigningOut(false)
    setMobileMenuOpen(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#ddd4c5] bg-[rgba(246,244,239,0.96)] backdrop-blur-xl">
      <div className="mx-auto hidden max-w-7xl items-center justify-between gap-6 px-4 py-4 md:flex lg:px-8">
        <Link to="/" className="inline-flex items-center gap-3 text-[#111]">
          <span className="inline-flex h-11 w-11 items-center justify-center border border-[#d9cfbf] bg-white [clip-path:polygon(0_0,calc(100%-12px)_0,100%_12px,100%_100%,12px_100%,0_calc(100%-12px))]">
            <ProxKeyLogo size={22} animated={false} />
          </span>
          <span>
            <span className="block text-[11px] uppercase tracking-[0.22em] text-[#7e7569]">
              ProxKey
            </span>
            <span className="block text-base font-semibold tracking-tight">
              Incident attribution
            </span>
          </span>
        </Link>

        <nav className="pk-grid-surface flex items-center gap-1 border border-[#d6d2c8] bg-[#f3eee4] px-2 py-2 [clip-path:polygon(0_0,calc(100%-12px)_0,100%_12px,100%_100%,12px_100%,0_calc(100%-12px))]">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className={`border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition ${
                isLinkActive(location.pathname, location.hash, link.href)
                  ? 'border-[#111] bg-white text-[#111]'
                  : 'border-transparent text-[#5f584f] hover:border-[#d6d2c8] hover:bg-white hover:text-[#111]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {!user ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="border border-[#d6d2c8] bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#111]"
            >
              Sign in
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="border border-[#d6d2c8] bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#111]"
            >
              {displayName}
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSignOut()
              }}
              disabled={isSigningOut}
              className="border border-[#111] bg-[#111] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white disabled:opacity-70"
            >
              {isSigningOut ? 'Signing out' : 'Sign out'}
            </button>
          </div>
        )}
      </div>

      <div className="mx-auto flex h-16 max-w-[430px] items-center justify-between px-4 md:hidden">
        <Link to="/" className="flex min-w-0 items-center gap-3 text-[#111]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#d9cfbf] bg-white">
            <ProxKeyLogo size={20} animated={false} />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold tracking-[0.04em] text-[#111]">
              ProxKey
            </span>
            <span className="block truncate text-[11px] uppercase tracking-[0.18em] text-[#73695d]">
              Incident attribution
            </span>
          </span>
        </Link>

        <button
          type="button"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((current) => !current)}
          className="flex h-11 w-11 items-center justify-center border border-[#d9cfbf] bg-white text-[#111]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-x-0 bottom-0 top-16 z-50 bg-[#f6f4ef] md:hidden">
          <div className="mx-auto flex h-full max-w-[430px] flex-col px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4">
            <nav className="flex-1 space-y-2 overflow-y-auto">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  className="flex min-h-11 items-center border border-[#ddd4c5] bg-white px-4 text-[15px] font-medium text-[#111]"
                >
                  {link.label}
                </Link>
              ))}

              {!user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    onOpenAuth('login')
                  }}
                  className="flex min-h-11 w-full items-center justify-center border border-[#111] bg-[#111] px-4 text-[15px] font-medium uppercase tracking-[0.14em] text-white"
                >
                  Sign in
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void handleSignOut()
                  }}
                  disabled={isSigningOut}
                  className="flex min-h-11 w-full items-center border border-[#ddd4c5] bg-white px-4 text-left text-[15px] font-medium text-[#111] disabled:opacity-70"
                >
                  {isSigningOut ? 'Signing out' : 'Sign out'}
                </button>
              )}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  )
}
