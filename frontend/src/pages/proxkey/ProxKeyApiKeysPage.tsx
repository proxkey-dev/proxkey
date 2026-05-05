import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { proxkeyApi } from '../../lib/proxkey-api'
import { useAuth } from '../../contexts/AuthContext'

const availableScopes: Array<'packets:write' | 'packets:read' | 'usage:read'> = [
  'packets:write',
  'packets:read',
  'usage:read',
]

export default function ProxKeyApiKeysPage() {
  const { role } = useAuth()
  const [apiKeys, setApiKeys] = useState<
    Array<{
      id: string
      name: string
      keyPrefix: string
      scopesJson: string[]
      lastUsedAt: string | null
      revokedAt: string | null
      createdAt: string
    }>
  >([])
  const [name, setName] = useState('CI ingestion')
  const [scopes, setScopes] = useState<Array<'packets:write' | 'packets:read' | 'usage:read'>>([
    'packets:write',
    'packets:read',
  ])
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canManageKeys = role === 'OWNER' || role === 'ADMIN'

  async function loadKeys(): Promise<void> {
    try {
      const response = await proxkeyApi.apiKeys()
      setApiKeys(response.items)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load API keys.')
    }
  }

  useEffect(() => {
    if (canManageKeys) {
      void loadKeys()
    }
  }, [canManageKeys])

  const installCommand = useMemo(() => {
    return revealedKey ?? 'pk_live_your_key_here'
  }, [revealedKey])

  async function createKey(): Promise<void> {
    try {
      const created = await proxkeyApi.createApiKey({
        name: name.trim() || 'CLI key',
        scopes,
      })
      setRevealedKey(created.key)
      setName('CI ingestion')
      await loadKeys()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create API key.')
    }
  }

  async function revokeKey(id: string): Promise<void> {
    try {
      await proxkeyApi.revokeApiKey(id)
      await loadKeys()
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Failed to revoke API key.')
    }
  }

  function toggleScope(scope: 'packets:write' | 'packets:read' | 'usage:read'): void {
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    )
  }

  if (!canManageKeys) {
    return (
      <div className="bg-[#f6f4ef] px-4 py-10 text-[#111] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="pk-frame bg-white px-6 py-8">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">API keys</div>
            <h1 className="mt-4 font-['Georgia'] text-4xl tracking-tight text-[#111] sm:text-5xl">
              Owner or admin access required.
            </h1>
            <p className="mt-4 text-base leading-8 text-[#57544d]">
              Workspace members can generate and export packets, but only owners and admins can mint
              or revoke API keys.
            </p>
            <Link
              to="/dashboard"
              className="mt-6 inline-flex border border-[#111] bg-[#111] px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#f6f4ef] px-4 py-10 text-[#111] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="pk-frame pk-grid-surface bg-white px-6 py-8 shadow-[0_20px_54px_rgba(33,28,19,0.06)] sm:px-8">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">API keys</div>
          <h1 className="mt-4 font-['Georgia'] text-4xl tracking-tight text-[#111] sm:text-5xl">
            Issue a key once, then move triage into CI and local repos.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[#57544d]">
            Keys are hashed at rest, shown only once, and scoped to the current workspace for CLI
            and API ingestion.
          </p>
        </section>

        {error ? (
          <div className="border border-[#f1cac6] bg-[#fff4f4] px-4 py-3 text-sm text-[#e5484d]">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="pk-frame bg-white px-6 py-6">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">Create key</div>
            <div className="mt-4 grid gap-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="border border-[#d6d2c8] bg-[#faf8f4] px-4 py-3 text-sm outline-none"
                placeholder="CI ingestion"
              />
              <div className="grid gap-2">
                {availableScopes.map((scope) => (
                  <label
                    key={scope}
                    className="flex items-center gap-3 border border-[#ece8df] bg-[#faf8f4] px-4 py-3 text-sm text-[#57544d]"
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                    />
                    <span>{scope}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void createKey()}
                className="border border-[#111] bg-[#111] px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white"
              >
                Create API key
              </button>
              {revealedKey ? (
                <div className="border border-[#d7ebdf] bg-[#effaf3] px-4 py-3 text-sm text-[#256042]">
                  Full key shown once: <code>{revealedKey}</code>
                </div>
              ) : null}
            </div>
          </div>

          <div className="pk-dark-grid border border-[#27303a] bg-[#111318] px-6 py-6 text-white [clip-path:polygon(0_0,calc(100%-16px)_0,100%_16px,100%_100%,16px_100%,0_calc(100%-16px))]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#95a0af]">
              CLI install
            </div>
            <pre className="mt-4 overflow-x-auto text-sm leading-7 text-[#d6dde6]">
              {`npm install -g @notomer/proxkey-cli
proxkey auth set-key ${installCommand}
proxkey triage --file ./logs/build.log
proxkey ci analyze --logs ./logs/test-output.txt`}
            </pre>
          </div>
        </section>

        <section className="pk-frame bg-white px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
              Issued keys
            </div>
            <Link
              to="/dashboard"
              className="border border-[#d6d2c8] bg-white px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-[#111]"
            >
              Back to dashboard
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col gap-3 border border-[#ece8df] bg-[#faf8f4] px-4 py-4 text-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-semibold text-[#111]">{key.name}</div>
                  <div className="mt-1 text-[#6e675d]">{key.keyPrefix}</div>
                  <div className="mt-1 text-[#6e675d]">{key.scopesJson.join(', ')}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[#6e675d]">
                    {key.revokedAt
                      ? 'Revoked'
                      : key.lastUsedAt
                        ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                        : 'Never used'}
                  </div>
                  {!key.revokedAt ? (
                    <button
                      type="button"
                      onClick={() => void revokeKey(key.id)}
                      className="border border-[#d6d2c8] bg-white px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#111]"
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {apiKeys.length === 0 ? (
              <div className="border border-[#ece8df] bg-[#faf8f4] px-4 py-4 text-sm text-[#57544d]">
                No API keys issued yet. Create one above to power the CLI, CI ingestion, or
                server-to-server packet creation.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
