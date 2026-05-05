import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/** Legacy route; OAuth flows use dedicated GitHub paths. */
export default function CallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/login', { replace: true })
  }, [navigate])

  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0a0a] text-[#e8e8e8]">
      <div className="text-center">
        <p className="font-mono text-2xl font-semibold">ProxKey</p>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[#6b6b6b]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2e2e2e] border-t-[#4ade80]" />
          Redirecting…
        </div>
      </div>
    </div>
  )
}
