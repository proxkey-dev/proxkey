import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const nav = [
  { to: '/dashboard', end: true, label: 'Overview' },
  { to: '/dashboard/repos', end: false, label: 'Repos' },
  { to: '/dashboard/waste', end: false, label: 'Waste Flags' },
  { to: '/dashboard/flaky', end: false, label: 'Flaky Tests' },
  { to: '/dashboard/settings', end: false, label: 'Settings' },
]

function linkClass({ isActive }: { isActive: boolean }): string {
  return `block rounded px-3 py-2 text-sm outline-none ring-offset-2 ring-offset-[#0a0a0a] focus-visible:ring-2 focus-visible:ring-[#4ade80] ${
    isActive ? 'bg-[#161616] text-[#e8e8e8]' : 'text-[#6b6b6b] hover:bg-[#161616] hover:text-[#e8e8e8]'
  }`
}

function UserAvatar({ name, email }: { name?: string | null; email?: string }) {
  const initials = (name ?? email ?? '?')
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#1e1e1e] bg-[#1e1e1e] text-xs font-semibold text-[#e8e8e8]">
      {initials}
    </span>
  )
}

export default function DashboardLayout() {
  const auth = useAuth()

  async function signOut(): Promise<void> {
    await auth.signOut()
  }

  const orgName = auth.organization?.name ?? 'Organization'
  const displayName = auth.user?.name ?? auth.user?.email ?? ''

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8e8e8]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[#1e1e1e] bg-[#0a0a0a] p-4 md:flex md:w-[240px]">
        <div className="border-b border-[#1e1e1e] pb-4">
          <span className="font-mono text-lg font-semibold">ProxKey</span>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="mt-3 flex w-full items-center justify-between rounded border border-[#1e1e1e] bg-[#111111] px-3 py-2 text-left text-sm text-[#e8e8e8] outline-none hover:bg-[#161616] focus-visible:ring-2 focus-visible:ring-[#4ade80]">
              <span className="truncate">{orgName}</span>
              <span className="text-[#6b6b6b]" aria-hidden>
                ▾
              </span>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[200px] rounded border border-[#1e1e1e] bg-[#111111] p-1 shadow-lg"
                sideOffset={4}
              >
                <DropdownMenu.Item
                  className="cursor-default rounded px-3 py-2 text-sm text-[#e8e8e8] outline-none data-[highlighted]:bg-[#161616]"
                  disabled
                >
                  {orgName}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label="Primary">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-[#1e1e1e] pt-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={auth.user?.name} email={auth.user?.email} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[#e8e8e8]">{displayName}</p>
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-xs text-[#6b6b6b] underline-offset-2 hover:text-[#e8e8e8] hover:underline"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-[#1e1e1e] bg-[#0a0a0a] px-4 py-3 md:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold">ProxKey</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-xs text-[#6b6b6b] hover:text-[#e8e8e8]"
          >
            Sign out
          </button>
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto pb-1" aria-label="Primary mobile">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded px-2 py-1.5 text-xs ${isActive ? 'bg-[#161616] text-[#e8e8e8]' : 'text-[#6b6b6b]'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="min-h-screen md:ml-[240px]">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
