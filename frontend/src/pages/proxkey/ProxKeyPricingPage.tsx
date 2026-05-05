import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { proxkeyApi, type PlanTier } from '../../lib/proxkey-api'
import { useAuth } from '../../contexts/AuthContext'

const plans: Array<{
  name: string
  plan: PlanTier
  price: string
  bestFor: string
  packets: string
  keyValue: string
  cta: string
  highlight?: boolean
  features: string[]
  overage?: string
}> = [
  {
    name: 'Free',
    plan: 'FREE',
    price: '$0 / month',
    bestFor: 'Trying ProxKey',
    packets: '25 / month',
    keyValue: 'Manual triage + exports',
    cta: 'Start Free',
    features: [
      'Single workspace',
      'Manual issue intake',
      'Markdown export',
      'Live demo workflow',
      'Basic dashboard',
      '7-day history',
    ],
  },
  {
    name: 'Founder',
    plan: 'FOUNDER',
    price: '$29 / month',
    bestFor: 'Solo builders',
    packets: '500 / month',
    keyValue: 'CLI, API keys, 1 repo',
    cta: 'Choose Founder',
    features: [
      '3 seats included',
      '1 connected GitHub repo',
      'API key access',
      'CLI access',
      'GitHub Actions log upload',
      'Markdown / JSON export',
      'Basic owner suggestions',
      '30-day history',
      'Email support',
    ],
  },
  {
    name: 'Team',
    plan: 'TEAM',
    price: '$99 / month',
    bestFor: 'Small teams',
    packets: '3,000 / month',
    keyValue: 'GitHub, Slack, Jira/Linear, RBAC',
    cta: 'Choose Team',
    highlight: true,
    overage: '$10 per additional 1,000 packets',
    features: [
      '10 seats included',
      '5 connected repos',
      'GitHub integration',
      'Jira / Linear export',
      'Slack notifications',
      'CI failure analysis',
      'Test flake detection',
      'Team dashboard',
      'RBAC',
      'Audit log',
      '90-day history',
      'Priority support',
    ],
  },
  {
    name: 'Growth',
    plan: 'GROWTH',
    price: '$299 / month',
    bestFor: 'Scaling teams',
    packets: '15,000 / month',
    keyValue: 'Routing, rules, history, release risk',
    cta: 'Scale Triage',
    overage: '$10 per additional 1,000 packets',
    features: [
      '25 seats included',
      '25 connected repos',
      'Advanced ownership routing',
      'Service / team mapping',
      'Historical failure clustering',
      'Release risk scoring',
      'Custom triage rules',
      'Webhooks',
      'API ingestion',
      'Slack / Jira / Linear / GitHub workflows',
      '1-year history',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    plan: 'ENTERPRISE',
    price: 'Custom',
    bestFor: 'Larger orgs',
    packets: 'Custom volume',
    keyValue: 'SSO, VPC/on-prem, SLA',
    cta: 'Talk to Founder',
    features: [
      'Unlimited or negotiated repos',
      'SSO / SAML',
      'SCIM',
      'Custom retention',
      'Dedicated support',
      'Private deployment / VPC',
      'On-prem deployment path',
      'Security review',
      'SLA-backed support',
      'Custom integrations',
      'Dedicated onboarding',
    ],
  },
]

const faqs = [
  [
    'What counts as a packet?',
    'A packet is one normalized engineering intake record created from a CI failure, support escalation, QA finding, incident note, log bundle, ticket, Slack thread, API event, or CLI submission.',
  ],
  [
    'Can I try ProxKey before paying?',
    'Yes. The Free plan includes a workspace, manual intake, sample workflows, basic dashboard access, Markdown export, and limited packet history.',
  ],
  [
    'How is ProxKey different from an AI summarizer?',
    'ProxKey produces structured triage packets with severity, ownership, evidence, duplicate clustering, provenance, recommended next steps, exports, and audit history.',
  ],
  [
    'Which tools can ProxKey connect to?',
    'The platform is built around GitHub, Linear, Jira, Slack, email, CI systems, Sentry, Datadog, PagerDuty, REST API, webhooks, and CLI ingestion.',
  ],
  [
    'What happens if we exceed our packet limit?',
    'Team and Growth plans can continue processing with usage based overages. Enterprise plans can negotiate custom volume, retention, and support terms.',
  ],
  [
    'Is raw evidence stored securely?',
    'Raw evidence is workspace scoped, secrets can be redacted before model analysis, and Business or Enterprise workflows can use retention controls and audit logs.',
  ],
] as const

export default function ProxKeyPricingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [leadForm, setLeadForm] = useState({
    email: '',
    role: '',
    company: '',
    painPoint: '',
    teamSize: '',
    currentTools: '',
    estimatedMonthlyVolume: '',
  })
  const [leadState, setLeadState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [leadError, setLeadError] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  async function submitLead(): Promise<void> {
    setLeadState('submitting')
    setLeadError(null)
    try {
      await proxkeyApi.createLead({
        email: leadForm.email,
        role: leadForm.role,
        company: leadForm.company,
        painPoint: leadForm.painPoint,
        teamSize: leadForm.teamSize || undefined,
        currentTools: leadForm.currentTools
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        estimatedMonthlyVolume: leadForm.estimatedMonthlyVolume || undefined,
      })
      setLeadState('done')
    } catch (error) {
      setLeadState('error')
      setLeadError(error instanceof Error ? error.message : 'Failed to submit lead.')
    }
  }

  async function handlePlanClick(plan: PlanTier): Promise<void> {
    if (!user) {
      navigate('/signup')
      return
    }

    if (plan === 'FREE') {
      navigate('/dashboard')
      return
    }

    if (plan === 'ENTERPRISE') {
      window.location.hash = 'enterprise-lead'
      return
    }

    try {
      const result = await proxkeyApi.startCheckout(plan)
      if (!result.ok && result.code === 'billing_not_configured') {
        navigate('/dashboard')
        return
      }
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Failed to start checkout.')
    }
  }

  return (
    <div className="bg-[#f6f4ef] px-4 py-8 text-[#111] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="border border-[#e4dbc9] bg-[#fffdfa] px-5 py-8 shadow-[0_20px_54px_rgba(33,28,19,0.06)] sm:px-8 lg:py-10">
          <div className="mx-auto max-w-4xl text-center">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">Pricing</div>
            <h1 className="mt-4 font-['Georgia'] text-[clamp(46px,8vw,86px)] font-normal leading-[0.96] tracking-[-0.055em] text-[#111]">
              Plans for every triage load.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[#57544d]">
              Start with manual packets, then scale into routing, clustering, integrations, audit
              history, and enterprise controls.
            </p>
          </div>

          <div className="mt-8 grid gap-3 lg:grid-cols-5">
            {plans.map((plan) => (
              <div
                key={plan.plan}
                className={`border px-5 py-5 ${
                  plan.highlight
                    ? 'border-[#202a35] bg-[#111318] text-white shadow-[0_20px_54px_rgba(10,10,10,0.18)]'
                    : 'border-[#e4dbc9] bg-[#faf8f4]'
                }`}
              >
                <div
                  className={`text-[11px] uppercase tracking-[0.2em] ${plan.highlight ? 'text-[#9ba6b5]' : 'text-[#7e7569]'}`}
                >
                  {plan.name}
                </div>
                <div
                  className={`mt-3 font-['Georgia'] text-4xl font-normal tracking-tight ${plan.highlight ? 'text-white' : 'text-[#111]'}`}
                >
                  {plan.price}
                </div>
                <div
                  className={`mt-2 text-sm ${plan.highlight ? 'text-[#9ba6b5]' : 'text-[#7e7569]'}`}
                >
                  {plan.packets}
                </div>
                <div
                  className={`mt-3 min-h-10 text-sm font-medium leading-5 ${plan.highlight ? 'text-white' : 'text-[#111]'}`}
                >
                  {plan.keyValue}
                </div>
                <div
                  className={`mt-5 space-y-2 text-sm leading-6 ${plan.highlight ? 'text-[#d6dde6]' : 'text-[#57544d]'}`}
                >
                  {plan.features.slice(0, 6).map((feature) => (
                    <div key={feature}>• {feature}</div>
                  ))}
                  {plan.overage ? <div>• Overage: {plan.overage}</div> : null}
                </div>
                {plan.plan === 'ENTERPRISE' ? (
                  <a
                    href="#enterprise-lead"
                    className={`mt-6 inline-flex w-full justify-center border px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] ${
                      plan.highlight
                        ? 'border-white/18 bg-[#ff5a1f] text-white'
                        : 'border-[#d6d2c8] bg-white text-[#111]'
                    }`}
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handlePlanClick(plan.plan)}
                    className={`mt-6 inline-flex w-full justify-center border px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] ${
                      plan.highlight
                        ? 'border-white/18 bg-[#ff5a1f] text-white'
                        : 'border-[#d6d2c8] bg-white text-[#111]'
                    }`}
                  >
                    {plan.cta}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {checkoutError ? (
          <div className="border border-[#f1cac6] bg-[#fff4f4] px-4 py-3 text-sm text-[#e5484d]">
            {checkoutError}
          </div>
        ) : null}

        <section className="border border-[#e4dbc9] bg-[#fffdfa] px-5 py-7 shadow-[0_16px_36px_rgba(25,20,15,0.04)] sm:px-8">
          <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
                Questions & Answers
              </div>
              <h2 className="mt-4 font-['Georgia'] text-4xl font-normal tracking-[-0.04em] text-[#111] sm:text-5xl">
                Buying ProxKey without guesswork.
              </h2>
            </div>
            <div className="divide-y divide-[#e4dbc9] border-y border-[#e4dbc9]">
              {faqs.map(([question, answer]) => (
                <details key={question} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-[#111]">
                    {question}
                    <span className="text-[#ff5a1f] group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-[#57544d]">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section
          id="enterprise-lead"
          className="border border-[#202a35] bg-[#111318] px-5 py-7 text-white shadow-[0_18px_44px_rgba(0,0,0,0.22)] sm:px-8"
        >
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#9ba6b5]">
                Enterprise contact
              </div>
              <h2 className="mt-4 font-['Georgia'] text-4xl font-normal tracking-[-0.04em] text-white sm:text-5xl">
                Spread clean triage across every intake source.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#c7d0da]">
                For larger teams, custom retention, SSO, source connectors, security review, and
                dedicated onboarding.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={leadForm.email}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="Work email"
                className="border border-[#26313d] bg-[#151a20] px-4 py-3 text-sm text-white outline-none placeholder:text-[#7f8c99]"
              />
              <input
                value={leadForm.company}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, company: event.target.value }))
                }
                placeholder="Company"
                className="border border-[#26313d] bg-[#151a20] px-4 py-3 text-sm text-white outline-none placeholder:text-[#7f8c99]"
              />
              <input
                value={leadForm.role}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, role: event.target.value }))
                }
                placeholder="Role"
                className="border border-[#26313d] bg-[#151a20] px-4 py-3 text-sm text-white outline-none placeholder:text-[#7f8c99]"
              />
              <input
                value={leadForm.teamSize}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, teamSize: event.target.value }))
                }
                placeholder="Team size"
                className="border border-[#26313d] bg-[#151a20] px-4 py-3 text-sm text-white outline-none placeholder:text-[#7f8c99]"
              />
              <input
                value={leadForm.currentTools}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, currentTools: event.target.value }))
                }
                placeholder="Current tools (GitHub, Jira, Slack)"
                className="border border-[#26313d] bg-[#151a20] px-4 py-3 text-sm text-white outline-none placeholder:text-[#7f8c99] md:col-span-2"
              />
              <input
                value={leadForm.estimatedMonthlyVolume}
                onChange={(event) =>
                  setLeadForm((current) => ({
                    ...current,
                    estimatedMonthlyVolume: event.target.value,
                  }))
                }
                placeholder="Estimated monthly CI / log / ticket volume"
                className="border border-[#26313d] bg-[#151a20] px-4 py-3 text-sm text-white outline-none placeholder:text-[#7f8c99] md:col-span-2"
              />
              <textarea
                value={leadForm.painPoint}
                onChange={(event) =>
                  setLeadForm((current) => ({ ...current, painPoint: event.target.value }))
                }
                placeholder="Main triage pain"
                className="min-h-[120px] border border-[#26313d] bg-[#151a20] px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-[#7f8c99] md:col-span-2"
              />
              {leadError ? (
                <div className="border border-[#f1cac6] bg-[#fff4f4] px-4 py-3 text-sm text-[#e5484d] md:col-span-2">
                  {leadError}
                </div>
              ) : null}
              {leadState === 'done' ? (
                <div className="border border-[#294b3a] bg-[#102018] px-4 py-3 text-sm text-[#b9f0d0] md:col-span-2">
                  Lead captured. We will follow up at hello@proxkey.dev.
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => void submitLead()}
                disabled={leadState === 'submitting'}
                className="border border-[#ff5a1f] bg-[#ff5a1f] px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white disabled:opacity-70 md:col-span-2"
              >
                {leadState === 'submitting' ? 'Submitting…' : 'Talk to Founder'}
              </button>
            </div>
          </div>
        </section>

        <section className="border border-[#e4dbc9] bg-[#fffdfa] px-5 py-8 text-center shadow-[0_16px_36px_rgba(25,20,15,0.04)] sm:px-8">
          <h2 className="font-['Georgia'] text-4xl font-normal tracking-[-0.04em] text-[#111] sm:text-5xl">
            Route like ProxKey.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#57544d]">
            Turn your first messy engineering signal into a structured packet before the next queue
            review.
          </p>
          <button
            type="button"
            onClick={() => void handlePlanClick('FREE')}
            className="mt-5 border border-[#ff5a1f] bg-[#ff5a1f] px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white"
          >
            Start now
          </button>
        </section>
      </div>
    </div>
  )
}
