import { SignUp } from '@clerk/react'
import { dark } from '@clerk/themes'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function SignupPage() {
  const { user, loading } = useAuth()
  const clerkPk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim()

  if (!clerkPk) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0a0a0a] px-6 py-14 text-[#e8e8e8]">
        <main className="mx-auto max-w-lg">
          <h1 className="text-xl font-semibold">Clerk publishable key missing</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#b8b8b8]">
            Add{' '}
            <code className="rounded bg-[#161616] px-2 py-0.5 text-[13px] text-[#4ade80]">
              VITE_CLERK_PUBLISHABLE_KEY
            </code>{' '}
            to <code className="text-[13px]">frontend/.env.local</code>.
          </p>
          <Link to="/login" className="mt-6 mr-6 inline-block text-sm text-[#4ade80] hover:underline">
            Sign in
          </Link>
          <Link to="/" className="mt-6 inline-block text-sm text-[#6b6b6b] hover:text-[#e8e8e8]">
            Home
          </Link>
        </main>
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a]" />
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] px-4 py-8 text-[#e8e8e8]">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center">
        <div className="mb-6 w-full text-center">
          <Link to="/" className="font-mono text-2xl font-semibold tracking-tight hover:text-[#4ade80]">
            ProxKey
          </Link>
          <p className="mt-1 text-sm text-[#6b6b6b]">Create an account.</p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-[#4a4a4a]">
            Every CI dollar, explained.
          </p>
        </div>
        <SignUp
          routing="path"
          path="/signup"
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: '#4ade80',
              colorTextOnPrimaryBackground: '#0a0a0a',
            },
          }}
          signInUrl="/login"
          forceRedirectUrl="/dashboard"
          fallbackRedirectUrl="/dashboard"
        />
        <p className="mt-8 text-center text-xs text-[#3a3a3a]">
          Already have an account?{' '}
          <Link className="text-[#e8e8e8] underline-offset-2 hover:text-[#4ade80] hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      </main>
      <footer className="mx-auto mb-6 flex w-full max-w-md justify-center gap-3 text-[11px] text-[#3a3a3a]">
        <Link to="/" className="hover:text-[#6b6b6b]">
          Home
        </Link>
        <span aria-hidden className="text-[#2a2a2a]">
          ·
        </span>
        <Link to="/about" className="hover:text-[#6b6b6b]">
          About
        </Link>
        <span aria-hidden className="text-[#2a2a2a]">
          ·
        </span>
        <Link to="/docs" className="hover:text-[#6b6b6b]">
          Docs
        </Link>
      </footer>
    </div>
  )
}
