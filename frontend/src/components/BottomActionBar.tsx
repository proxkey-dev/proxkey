import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

function ActionButton({
  label,
  onClick,
  primary = false,
}: {
  label: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 flex-1 items-center justify-center px-3 text-[12px] font-medium uppercase tracking-[0.14em] ${
        primary ? 'bg-[#ff5a1f] text-white' : 'border border-[#ddd4c5] bg-white text-[#111]'
      }`}
    >
      {label}
    </button>
  )
}

export function BottomActionBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    setIsDismissed(false)
  }, [location.pathname])

  useEffect(() => {
    if (
      location.pathname !== '/' &&
      location.pathname !== '/signup' &&
      location.pathname !== '/signin'
    ) {
      setIsVisible(false)
      return
    }

    function handleScroll(): void {
      setIsVisible(window.scrollY > 420)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [location.pathname])

  if (!isVisible || isDismissed) {
    return null
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] md:hidden">
      <div className="mx-auto max-w-[430px] border border-[#ddd4c5] bg-[rgba(246,244,239,0.97)] p-2 shadow-[0_16px_32px_rgba(25,20,15,0.14)] backdrop-blur">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            aria-label="Close sticky call to action"
            onClick={() => setIsDismissed(true)}
            className="flex h-8 w-8 items-center justify-center text-[#6f6559]"
          >
            ×
          </button>
        </div>
        <div className="flex gap-2">
          <ActionButton label="Generate sample packet" onClick={() => navigate('/demo')} />
          <ActionButton label="Start free" primary onClick={() => navigate('/signup?plan=free')} />
        </div>
      </div>
    </div>
  )
}
