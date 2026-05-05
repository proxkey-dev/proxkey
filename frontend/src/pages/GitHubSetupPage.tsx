import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { postGitHubInstallation } from '../lib/api'

const messages = ['Setting up workspace…', 'Syncing repositories…', 'Almost ready…'] as const

export default function GitHubSetupPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [msgIndex, setMsgIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length)
    }, 2000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const installationId = params.get('installation_id')
    if (!installationId) {
      setError('Missing installation_id.')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await postGitHubInstallation({ installation_id: installationId })
        if (!cancelled) {
          navigate(res.next ?? '/dashboard', { replace: true })
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Installation failed.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [navigate, params])

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0a0a0a] px-4 text-[#e8e8e8]">
        <div className="max-w-md rounded border border-[#1e1e1e] bg-[#111111] p-8 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            className="mt-6 rounded border border-[#e8e8e8] px-4 py-2 text-sm text-[#e8e8e8] hover:bg-[#161616]"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0a0a] px-4 text-[#e8e8e8]">
      <p className="text-sm text-[#6b6b6b]">{messages[msgIndex]}</p>
    </div>
  )
}
