import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiUrl } from '../lib/api'

/**
 * GitHub should redirect to the API (`/api/auth/github/callback`) in production.
 * If the OAuth app is misconfigured to hit the SPA, forward the query to the API.
 */
export default function GitHubCallbackPage() {
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const err = params.get('error')
    const errDesc = params.get('error_description')
    if (err) {
      setError(errDesc || err)
      return
    }

    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) {
      setError('Missing OAuth parameters (code/state). Check GitHub OAuth redirect URI points to the API callback.')
      return
    }

    const qs = new URLSearchParams({ code, state })
    window.location.replace(apiUrl(`/api/auth/github/callback?${qs.toString()}`))
  }, [params])

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0a0a] px-4 text-[#e8e8e8]">
        <div className="max-w-md rounded border border-[#1e1e1e] bg-[#111111] p-8 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <Link to="/login" className="mt-6 inline-block text-sm text-[#4ade80] underline-offset-2 hover:underline">
            Try again
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0a0a] px-4 text-[#e8e8e8]">
      <p className="text-sm text-[#6b6b6b]">Redirecting to complete sign-in…</p>
    </div>
  )
}
