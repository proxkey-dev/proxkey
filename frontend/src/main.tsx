import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/react'
import { dark } from '@clerk/themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ClerkProxKeyBridge } from './auth/ClerkProxKeyBridge'
import { AuthProvider } from './contexts/AuthContext'
import { setUnauthorizedHandler } from './lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

setUnauthorizedHandler(() => {
  queryClient.clear()
  window.location.assign('/login')
})

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim()

const routerTree = (
  <BrowserRouter>
    <AuthProvider>
      {clerkPublishableKey ? <ClerkProxKeyBridge /> : null}
      <App />
    </AuthProvider>
  </BrowserRouter>
)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {clerkPublishableKey ? (
        <ClerkProvider
          publishableKey={clerkPublishableKey}
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: '#4ade80',
              colorTextOnPrimaryBackground: '#0a0a0a',
            },
          }}
        >
          {routerTree}
        </ClerkProvider>
      ) : (
        routerTree
      )}
    </QueryClientProvider>
  </React.StrictMode>,
)
