import type { ReactNode } from 'react'
import { useClerk } from '@clerk/react'

type Props = {
  proxkeySignOut: () => Promise<unknown>
  className?: string
  disabled?: boolean
  children?: ReactNode
  /** Runs after ProxKey sign-out and optional Clerk session end (navigation, menus, etc.). */
  afterSignOut?: () => void | Promise<void>
}

export function ProxkeySignOutButtonPlain({
  proxkeySignOut,
  className,
  disabled,
  children = 'Sign out',
  afterSignOut,
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      onClick={() => {
        void (async () => {
          await proxkeySignOut().catch(() => {})
          await afterSignOut?.()
        })()
      }}
    >
      {children}
    </button>
  )
}

/** Use only beneath `ClerkProvider` when `VITE_CLERK_PUBLISHABLE_KEY` is set. */
export function ProxkeySignOutButtonWithClerk({
  proxkeySignOut,
  className,
  disabled,
  children = 'Sign out',
  afterSignOut,
}: Props) {
  const { signOut: clerkSignOut } = useClerk()

  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      onClick={() => {
        void (async () => {
          await proxkeySignOut().catch(() => {})
          await clerkSignOut().catch(() => {})
          await afterSignOut?.()
        })()
      }}
    >
      {children}
    </button>
  )
}
