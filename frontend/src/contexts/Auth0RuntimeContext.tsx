import { createContext, useCallback, useContext, useMemo } from 'react'
import { Auth0Provider, useAuth0, type AppState, type User as Auth0User } from '@auth0/auth0-react'
import { useNavigate } from 'react-router-dom'
import { getAuth0ClientConfig } from '../lib/auth0'

type Auth0Intent = 'login' | 'signup'

type Auth0RuntimeValue = {
  configured: boolean
  isAuthenticated: boolean
  isLoading: boolean
  user: Auth0User | undefined
  error: string | null
  startAuthFlow: (intent: Auth0Intent) => Promise<void>
  getAccessToken: () => Promise<string | null>
  logout: () => void
}

const fallbackValue: Auth0RuntimeValue = {
  configured: false,
  isAuthenticated: false,
  isLoading: false,
  user: undefined,
  error: null,
  startAuthFlow: async () => undefined,
  getAccessToken: async () => null,
  logout: () => undefined,
}

const Auth0RuntimeContext = createContext<Auth0RuntimeValue>(fallbackValue)

function Auth0RuntimeBridge({ children }: { children: React.ReactNode }) {
  const {
    error,
    getAccessTokenSilently,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    user,
  } = useAuth0()
  const config = getAuth0ClientConfig()

  const value = useMemo<Auth0RuntimeValue>(
    () => ({
      configured: true,
      isAuthenticated,
      isLoading,
      user,
      error: error?.message ?? null,
      startAuthFlow: async (intent) => {
        if (!config) {
          return
        }
        await loginWithRedirect({
          authorizationParams: {
            redirect_uri: config.redirectUri,
            audience: config.audience,
            scope: 'openid profile email offline_access',
            screen_hint: intent === 'signup' ? 'signup' : undefined,
          },
        })
      },
      getAccessToken: async () => {
        if (!config) {
          return null
        }

        return getAccessTokenSilently({
          authorizationParams: {
            audience: config.audience,
            redirect_uri: config.redirectUri,
            scope: 'openid profile email offline_access',
          },
        }).catch(() => null)
      },
      logout: () => {
        logout({
          logoutParams: {
            returnTo: window.location.origin,
          },
        })
      },
    }),
    [
      config,
      error?.message,
      getAccessTokenSilently,
      isAuthenticated,
      isLoading,
      loginWithRedirect,
      logout,
      user,
    ],
  )

  return <Auth0RuntimeContext.Provider value={value}>{children}</Auth0RuntimeContext.Provider>
}

/** Must render under BrowserRouter so post-Auth0 redirect uses React Router (not bare history.replaceState). */
function Auth0ProviderWithNavigate({
  children,
  config,
}: {
  children: React.ReactNode
  config: NonNullable<ReturnType<typeof getAuth0ClientConfig>>
}) {
  const navigate = useNavigate()

  const onRedirectCallback = useCallback((_appState?: AppState) => {
    // Never send Auth0 completes straight to `/dashboard`: RequireAuth would bounce to `/login`
    // until ProxKey bootstrap finishes. CallbackPage waits on AuthContext hydration then routes.
    navigate('/callback', { replace: true })
  }, [navigate])

  return (
    <Auth0Provider
      domain={config.domain}
      clientId={config.clientId}
      onRedirectCallback={onRedirectCallback}
      authorizationParams={{
        redirect_uri: config.redirectUri,
        audience: config.audience,
        scope: 'openid profile email offline_access',
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
      useRefreshTokensFallback={true}
    >
      <Auth0RuntimeBridge>{children}</Auth0RuntimeBridge>
    </Auth0Provider>
  )
}

export function Auth0RuntimeProvider({ children }: { children: React.ReactNode }) {
  const config = getAuth0ClientConfig()

  if (!config) {
    return (
      <Auth0RuntimeContext.Provider value={fallbackValue}>{children}</Auth0RuntimeContext.Provider>
    )
  }

  return (
    <Auth0ProviderWithNavigate config={config}>{children}</Auth0ProviderWithNavigate>
  )
}

export function useAuth0Runtime() {
  return useContext(Auth0RuntimeContext)
}
