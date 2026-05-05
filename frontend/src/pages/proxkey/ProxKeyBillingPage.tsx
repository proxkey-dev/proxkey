import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { proxkeyApi, type PlanTier } from '../../lib/proxkey-api'
import { useAuth } from '../../contexts/AuthContext'

const upgradePlans: Array<{
  plan: Exclude<PlanTier, 'FREE' | 'ENTERPRISE'>
  price: string
  packets: string
  seats: string
}> = [
  { plan: 'FOUNDER', price: '$29 / month', packets: '500 packets', seats: '3 seats' },
  { plan: 'TEAM', price: '$99 / month', packets: '3,000 packets', seats: '10 seats' },
  { plan: 'GROWTH', price: '$299 / month', packets: '15,000 packets', seats: '25 seats' },
]

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#ece8df] bg-[#faf8f4] px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[#111]">{value}</div>
    </div>
  )
}

export default function ProxKeyBillingPage() {
  const { organization } = useAuth()
  const [billing, setBilling] = useState<{
    organization: {
      id: string
      name: string
      plan: PlanTier
      subscriptionStatus: string
      currentPeriodStart: string | null
      currentPeriodEnd: string | null
    }
    limits: {
      packets: number | null
      seats: number | null
      repos: number | null
    }
  } | null>(null)
  const [usage, setUsage] = useState<{
    plan: PlanTier
    completedPackets: number
    packetLimit: number | null
    remainingPackets: number | null
    seatsUsed: number
  } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([proxkeyApi.billingPlan(), proxkeyApi.billingUsage()])
      .then(([plan, nextUsage]) => {
        setBilling(plan)
        setUsage(nextUsage)
        setError(null)
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load billing.')
      })
  }, [])

  async function handleCheckout(plan: Exclude<PlanTier, 'FREE' | 'ENTERPRISE'>): Promise<void> {
    try {
      const result = await proxkeyApi.startCheckout(plan)
      if (!result.ok && result.code === 'billing_not_configured') {
        setMessage(
          'Billing is not configured yet. Your organization remains on its current plan until Stripe is connected.',
        )
      }
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Failed to start checkout.')
    }
  }

  async function openPortal(): Promise<void> {
    try {
      const result = await proxkeyApi.requestPortal()
      if (!result.ok && result.code === 'billing_not_configured') {
        setMessage(
          'Customer billing portal is not configured yet. Upgrade requests still flow through the checkout action above.',
        )
      }
    } catch (portalError) {
      setError(
        portalError instanceof Error ? portalError.message : 'Failed to open billing portal.',
      )
    }
  }

  return (
    <div className="bg-[#f6f4ef] px-4 py-10 text-[#111] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="pk-frame pk-grid-surface bg-white px-6 py-8 shadow-[0_20px_54px_rgba(33,28,19,0.06)] sm:px-8">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">Billing</div>
          <h1 className="mt-4 font-['Georgia'] text-4xl tracking-tight text-[#111] sm:text-5xl">
            Pricing that scales with engineering noise.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[#57544d]">
            Monitor packet usage, upgrade the workspace, and keep limits visible before the queue
            becomes a blocker.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/dashboard"
              className="border border-[#d6d2c8] bg-white px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-[#111]"
            >
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={() => void openPortal()}
              className="border border-[#111] bg-[#111] px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white"
            >
              Manage billing
            </button>
          </div>
        </section>

        {error ? (
          <div className="border border-[#f1cac6] bg-[#fff4f4] px-4 py-3 text-sm text-[#e5484d]">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="border border-[#e7e2d8] bg-[#faf8f4] px-4 py-3 text-sm text-[#57544d]">
            {message}
          </div>
        ) : null}

        {billing && usage ? (
          <section className="grid gap-4 md:grid-cols-5">
            <Tile label="Workspace" value={organization?.name ?? billing.organization.name} />
            <Tile label="Current plan" value={billing.organization.plan} />
            <Tile label="Packets used" value={usage.completedPackets} />
            <Tile label="Packets remaining" value={usage.remainingPackets ?? 'Unlimited'} />
            <Tile
              label="Seats used"
              value={`${usage.seatsUsed} / ${billing.limits.seats ?? 'Unlimited'}`}
            />
          </section>
        ) : null}

        {billing ? (
          <section className="grid gap-4 xl:grid-cols-3">
            {upgradePlans.map((plan) => {
              const active = billing.organization.plan === plan.plan
              return (
                <div
                  key={plan.plan}
                  className={`pk-frame px-5 py-5 ${active ? 'bg-[#111318] text-white' : 'bg-white'}`}
                >
                  <div
                    className={`text-[11px] uppercase tracking-[0.2em] ${active ? 'text-[#95a0af]' : 'text-[#7e7569]'}`}
                  >
                    {plan.plan}
                  </div>
                  <div
                    className={`mt-3 font-['Georgia'] text-4xl tracking-tight ${active ? 'text-white' : 'text-[#111]'}`}
                  >
                    {plan.price}
                  </div>
                  <div
                    className={`mt-3 text-sm leading-7 ${active ? 'text-[#d6dde6]' : 'text-[#57544d]'}`}
                  >
                    <div>{plan.packets}</div>
                    <div>{plan.seats}</div>
                  </div>
                  <button
                    type="button"
                    disabled={active}
                    onClick={() => void handleCheckout(plan.plan)}
                    className={`mt-6 border px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] ${
                      active
                        ? 'border-white/12 bg-white/8 text-white/70'
                        : 'border-[#111] bg-[#111] text-white'
                    }`}
                  >
                    {active ? 'Current plan' : `Choose ${plan.plan.toLowerCase()}`}
                  </button>
                </div>
              )
            })}
          </section>
        ) : null}

        <section className="pk-frame bg-white px-6 py-6">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">Plan policy</div>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-[#57544d]">
            <div className="border border-[#ece8df] bg-[#faf8f4] px-4 py-4">
              Free and Founder workspaces stop at the monthly packet limit.
            </div>
            <div className="border border-[#ece8df] bg-[#faf8f4] px-4 py-4">
              Team and Growth can allow overages only when the backend is configured with
              `ENABLE_OVERAGES=true`.
            </div>
            <div className="border border-[#ece8df] bg-[#faf8f4] px-4 py-4">
              Enterprise onboarding runs through the founder contact flow instead of self-serve
              checkout.
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
