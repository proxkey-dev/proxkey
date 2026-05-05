import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Profile as ProfileType } from '../lib/rbac'
import type { OrgMembership } from '../types/org'
import {
  proxkeyApi,
  setAccessTokenProvider,
  setToken,
  type AuthUser,
  type PlanTier,
} from '../lib/proxkey-api'
import { apiUrl, postLogout } from '../lib/api'
import { clearActiveOrgId, getActiveOrgId, setActiveOrgId } from '../lib/activeOrg'
import {
  clearPendingAuth0Signup,
  loadPendingAuth0Signup,
  savePendingAuth0Signup,
} from '../lib/auth0'
import { useAuth0Runtime } from './Auth0RuntimeContext'

type AuthError = {
  message: string
}

type AuthSession = {
  organizationId: string
  role: 'OWNER' | 'ADMIN' | 'TRIAGE_LEAD' | 'EMPLOYEE'
}

interface AuthContextType {
  user: AuthUser | null
  session: AuthSession | null
  loading: boolean
  authStrategy: 'local' | 'auth0'
  authError: string | null
  profile: ProfileType | null
  membership: OrgMembership | null
  organization: { id: string; name: string } | null
  role: 'OWNER' | 'ADMIN' | 'TRIAGE_LEAD' | 'EMPLOYEE' | null
  clearAuthError: () => void
  signUp: (
    email: string,
    password: string,
    fullName?: string,
    organizationName?: string,
    plan?: PlanTier,
  ) => Promise<{ error: AuthError | null; redirecting?: boolean }>
  signIn: (
    email: string,
    password: string,
    organizationId?: string,
  ) => Promise<{ error: AuthError | null; redirecting?: boolean }>
  signOut: () => Promise<{ error: AuthError | null; redirecting?: boolean }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildAuthError(error: unknown): AuthError {
  if (error instanceof Error) {
    return { message: error.message }
  }

  return { message: 'An unexpected error occurred' }
}

/** Right after OAuth redirect getAccessTokenSilently can flake once; bootstrap requires a Bearer immediately. */
async function resolveAuth0AccessToken(getter: () => Promise<string | null>): Promise<string | null> {
  const delaysMs = [0, 75, 200, 450, 750]
  for (const ms of delaysMs) {
    if (ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, ms))
    }
    const token = await getter().catch(() => null)
    if (token) return token
  }
  return null
}

function buildUser(payload: AuthUser): AuthUser & { user_metadata: { full_name?: string | null } } {
  return {
    id: payload.id,
    email: payload.email,
    name: payload.name,
    orgId: payload.orgId,
    role: payload.role,
    status: payload.status,
    user_metadata: {
      full_name: payload.name,
    },
  }
}

function buildProfile(payload: AuthUser): ProfileType {
  const now = new Date().toISOString()

  return {
    id: payload.id,
    email: payload.email,
    display_name: payload.name ?? payload.email.split('@')[0],
    avatar_path: undefined,
    prefs: {},
    created_at: now,
    updated_at: now,
  }
}

function buildMembership(
  payload: AuthUser,
  organization: { id: string; name: string },
): OrgMembership {
  return {
    organization_id: organization.id,
    member_role: (payload.role === 'TRIAGE_LEAD'
      ? 'ADMIN'
      : payload.role) as OrgMembership['member_role'],
    is_default: true,
    name: organization.name,
    slug: toSlug(organization.name) || organization.id,
  }
}

function mapGithubOrgRole(apiRole: string): AuthUser['role'] {
  const r = apiRole.toLowerCase()
  if (r === 'owner') return 'OWNER'
  if (r === 'admin') return 'ADMIN'
  if (r === 'triage_lead' || r === 'triage') return 'TRIAGE_LEAD'
  return 'EMPLOYEE'
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const auth0 = useAuth0Runtime()
  const { configured, getAccessToken, isAuthenticated, isLoading, logout, startAuthFlow } = auth0
  const [user, setUser] = useState<
    (AuthUser & { user_metadata: { full_name?: string | null } }) | null
  >(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileType | null>(null)
  const [membership, setMembership] = useState<OrgMembership | null>(null)
  const [organization, setOrganization] = useState<{ id: string; name: string } | null>(null)
  const [role, setRole] = useState<'OWNER' | 'ADMIN' | 'TRIAGE_LEAD' | 'EMPLOYEE' | null>(null)

  const clearState = () => {
    setAccessTokenProvider(null)
    setToken(null)
    clearActiveOrgId()
    setUser(null)
    setSession(null)
    setProfile(null)
    setMembership(null)
    setOrganization(null)
    setRole(null)
  }

  const applyPayload = (payload: {
    user: AuthUser
    organization: { id: string; name: string }
    accessToken?: string
  }) => {
    setAuthError(null)

    if (payload.accessToken) {
      setToken(payload.accessToken)
    }

    setUser(buildUser(payload.user))
    setSession({
      organizationId: payload.organization.id,
      role: payload.user.role,
    })
    setProfile(buildProfile(payload.user))
    setMembership(buildMembership(payload.user, payload.organization))
    setOrganization(payload.organization)
    setRole(payload.user.role)
  }

  useEffect(() => {
    if (!configured) {
      setAccessTokenProvider(null)
      return
    }

    if (isAuthenticated) {
      setAccessTokenProvider(getAccessToken)
      return
    }

    setAccessTokenProvider(null)
  }, [configured, getAccessToken, isAuthenticated])

  useEffect(() => {
    let isMounted = true

    const hydrate = async () => {
      if (configured && isLoading) {
        return
      }

      try {
        if (!configured) {
          try {
            const ghRes = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
            if (ghRes.ok) {
              const data = (await ghRes.json()) as {
                githubLogin: string
                email: string
                orgs: Array<{ id: string; name: string; plan?: string; role: string }>
              }
              if (data.orgs?.length) {
                const stored = getActiveOrgId()
                const fromStored = stored ? data.orgs.find((o) => o.id === stored) : undefined
                const org = fromStored ?? data.orgs[0]!
                setActiveOrgId(org.id)
                const role = mapGithubOrgRole(org.role)
                if (isMounted) {
                  setToken(null)
                  applyPayload({
                    user: {
                      id: data.githubLogin,
                      email: data.email,
                      orgId: org.id,
                      name: data.githubLogin,
                      role,
                      status: 'ACTIVE',
                    },
                    organization: { id: org.id, name: org.name },
                  })
                  setLoading(false)
                }
                return
              }
            }
          } catch {
            /* fall through to legacy /api/me */
          }
        }

        if (configured) {
          if (!isAuthenticated) {
            if (isMounted) {
              clearState()
            }
            return
          }

          const bearer = await resolveAuth0AccessToken(getAccessToken)
          if (!bearer) {
            if (isMounted) {
              clearState()
              setAuthError('AUTH0_ACCESS_TOKEN_UNAVAILABLE')
            }
            return
          }
          setToken(bearer)

          const pendingSignup = loadPendingAuth0Signup()

          try {
            await proxkeyApi.bootstrap({
              name: pendingSignup?.name,
              organizationName: pendingSignup?.organizationName,
              plan: pendingSignup?.plan,
            })
            clearPendingAuth0Signup()
          } catch (bootstrapError) {
            const msg = bootstrapError instanceof Error ? bootstrapError.message : ''
            // New Auth0 user with no workspace – send them to sign up
            if (
              msg.includes('BOOTSTRAP_FAILED') ||
              msg.toLowerCase().includes('no proxkey workspace') ||
              msg.toLowerCase().includes('start with sign up')
            ) {
              clearPendingAuth0Signup()
              if (isMounted) {
                clearState()
                setAuthError('NO_WORKSPACE')
              }
              return
            }
            throw bootstrapError
          }

          const refreshed = await proxkeyApi.me()
          if (!refreshed.authenticated || !refreshed.user || !refreshed.organization) {
            throw new Error('Failed to load authenticated user.')
          }

          if (isMounted) {
            applyPayload({
              user: refreshed.user,
              organization: refreshed.organization,
              accessToken: refreshed.accessToken,
            })
          }

          return
        }

        const me = await proxkeyApi.me().catch(() => ({ authenticated: false }) as const)
        if (isMounted && me.authenticated && me.user && me.organization) {
          applyPayload({
            user: me.user,
            organization: me.organization,
            accessToken: me.accessToken,
          })
          setLoading(false)
          return
        }

        if (isMounted) {
          clearState()
        }
      } catch (error) {
        if (isMounted) {
          if (configured) {
            setAuthError(error instanceof Error ? error.message : 'Authentication failed.')
          }
          clearState()
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void hydrate()

    return () => {
      isMounted = false
    }
  }, [configured, isAuthenticated, isLoading, getAccessToken])

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      loading,
      authStrategy: configured ? 'auth0' : 'local',
      authError,
      profile,
      membership,
      organization,
      role,
      clearAuthError: () => {
        setAuthError(null)
      },
      signUp: async (email, password, fullName, organizationName, plan) => {
        setAuthError(null)

        if (configured) {
          try {
            if (!fullName?.trim() || !organizationName?.trim()) {
              throw new Error('Enter your full name and workspace name before continuing.')
            }

            savePendingAuth0Signup({
              name: fullName.trim(),
              organizationName: organizationName.trim(),
              plan: plan ?? 'FREE',
            })
            await startAuthFlow('signup')
            return { error: null, redirecting: true }
          } catch (error) {
            clearPendingAuth0Signup()
            return { error: buildAuthError(error) }
          }
        }

        try {
          const payload = await proxkeyApi.register(
            fullName?.trim() || email.split('@')[0] || 'ProxKey User',
            organizationName?.trim() || 'ProxKey Workspace',
            email.trim().toLowerCase(),
            password,
            plan ?? 'FREE',
          )
          const me = await proxkeyApi.me()
          if (!me.authenticated || !me.user || !me.organization) {
            throw new Error('Failed to load authenticated user.')
          }
          applyPayload({
            user: me.user,
            organization: me.organization,
            accessToken: payload.accessToken,
          })
          return { error: null }
        } catch (error) {
          return { error: buildAuthError(error) }
        }
      },
      signIn: async (email, password, organizationId) => {
        setAuthError(null)

        if (configured) {
          try {
            void email
            void password
            void organizationId
            clearPendingAuth0Signup()
            await startAuthFlow('login')
            return { error: null, redirecting: true }
          } catch (error) {
            return { error: buildAuthError(error) }
          }
        }

        try {
          void organizationId
          const payload = await proxkeyApi.login(email.trim().toLowerCase(), password)
          const me = await proxkeyApi.me()
          if (!me.authenticated || !me.user || !me.organization) {
            throw new Error('Failed to load authenticated user.')
          }
          applyPayload({
            user: me.user,
            organization: me.organization,
            accessToken: payload.accessToken,
          })
          return { error: null }
        } catch (error) {
          return { error: buildAuthError(error) }
        }
      },
      signOut: async () => {
        try {
          setAuthError(null)
          if (configured) {
            clearState()
            clearPendingAuth0Signup()
            logout()
            return { error: null, redirecting: true }
          }
          await postLogout().catch(() => {})
          await proxkeyApi.logout().catch(() => {})
          clearState()
          return { error: null }
        } catch (error) {
          return { error: buildAuthError(error) }
        }
      },
      resetPassword: async (_email) => {
        setAuthError(null)

        if (configured) {
          return {
            error: {
              message: 'Password resets are managed by Auth0 for this workspace.',
            },
          }
        }

        return {
          error: {
            message: 'Password reset is not implemented in this MVP yet.',
          },
        }
      },
    }),
    [
      authError,
      configured,
      loading,
      logout,
      membership,
      organization,
      profile,
      role,
      session,
      startAuthFlow,
      user,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
