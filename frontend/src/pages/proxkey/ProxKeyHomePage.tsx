import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const signalStrip = [
  'deploy history loaded',
  'service graph matched',
  'checkout error spike detected',
  'payments dependency implicated',
  'gateway symptom downranked',
  'ranked commits ready',
] as const

const incidentTimeline = [
  ['02:14', 'API errors cross the alert threshold.'],
  ['02:17', 'Gateway, checkout, and payments are all noisy.'],
  ['02:19', 'Thirty-seven recent changes are plausible.'],
  ['02:21', 'ProxKey ranks the most likely commits.'],
] as const

const modelInputs = [
  ['Deploy history', 'commit, PR, service, timestamp'],
  ['Service graph', 'caller, dependency, blast radius'],
  ['Temporal evidence', 'immediate and delayed failure windows'],
  ['Failure signals', 'errors, latency, alerts, saturation'],
] as const

const positioning = [
  ['Datadog', 'shows symptoms'],
  ['PagerDuty', 'coordinates response'],
  ['GitHub', 'stores changes'],
  ['ProxKey', 'attributes incidents to changes'],
] as const

function SectionLabel({ children, light = false }: { children: string; light?: boolean }) {
  return (
    <div
      className={`text-[10px] uppercase tracking-[0.22em] ${light ? 'text-[#97a4b2]' : 'text-[#756e64]'}`}
    >
      {children}
    </div>
  )
}

function TerminalBlock({
  children,
  title = 'proxkey attribution',
  className = '',
}: {
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <div
      className={`overflow-hidden border border-[#252c35] bg-[#0f1217] text-white shadow-[0_22px_48px_rgba(15,18,23,0.18)] ${className}`}
    >
      <div className="flex min-h-10 items-center gap-2 border-b border-[#252c35] px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff6a3d]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e5c14a]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#35b86b]" />
        <span className="ml-2 text-[10px] uppercase tracking-[0.18em] text-[#a8b3c0]">{title}</span>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-4 font-mono text-[13px] leading-7 text-[#eef3f7] sm:text-[14px]">
        {children}
      </pre>
    </div>
  )
}

export default function ProxKeyHomePage() {
  const { user } = useAuth()

  return (
    <div className="overflow-x-clip bg-[#f4f5f2] text-[#111318]">
      <section className="min-h-[calc(100vh-4rem)] border-b border-[#d8ddd5] px-4 pb-12 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <div className="max-w-3xl">
            <SectionLabel>A new layer in the stack: incident attribution</SectionLabel>
            <h1 className="mt-5 font-['Georgia'] text-[clamp(46px,8vw,88px)] leading-[0.95] tracking-normal text-[#111318]">
              Know what change broke production.
            </h1>
            <p className="mt-6 max-w-2xl text-[18px] leading-8 text-[#3f464f]">
              ProxKey attributes incidents to the most likely code changes across your system in
              seconds.
            </p>
            <div className="mt-8">
              <Link
                to={user ? '/dashboard' : '/login'}
                className="inline-flex min-h-12 items-center justify-center border border-[#ff5a1f] bg-[#ff5a1f] px-5 text-sm font-semibold uppercase tracking-[0.14em] text-white"
              >
                Start triaging incidents
              </Link>
            </div>
          </div>

          <TerminalBlock className="lg:translate-y-4" title="incident inc-4721">
            {`Incident: API errors (02:14)

Top candidates:
1. auth-service@a91f2c  87%
   PR #482, deployed 1h 12m before incident
   changed token validation path

2. gateway@b77de1       9%
   connected caller, weaker temporal match

3. billing@c19aa3       4%
   adjacent service, low graph confidence`}
          </TerminalBlock>
        </div>
      </section>

      <section className="overflow-hidden border-b border-[#252c35] bg-[#111318] py-3 text-white">
        <div className="pk-mobile-ticker text-[11px] uppercase tracking-[0.18em]">
          <div className="pk-mobile-ticker-track">
            {[...signalStrip, ...signalStrip].map((item, index) => (
              <span key={`${item}-${index}`} className="inline-block pr-10">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#d8ddd5] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionLabel>Moment</SectionLabel>
            <h2 className="mt-4 font-['Georgia'] text-[clamp(34px,5vw,58px)] leading-[1.03] tracking-normal">
              The incident call starts with a question the system can already answer.
            </h2>
          </div>
          <div className="grid gap-0 border-y border-[#cfd6cd]">
            {incidentTimeline.map(([time, copy]) => (
              <div
                key={time}
                className="grid grid-cols-[5.5rem_1fr] border-b border-[#cfd6cd] last:border-b-0"
              >
                <div className="border-r border-[#cfd6cd] px-4 py-5 font-mono text-[14px] text-[#ff5a1f]">
                  {time}
                </div>
                <div className="px-4 py-5 text-[17px] leading-7 text-[#343b43]">{copy}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#252c35] bg-[#111318] px-4 py-14 text-white sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <div>
            <SectionLabel light>Reveal</SectionLabel>
            <h2 className="mt-4 font-['Georgia'] text-[clamp(34px,5vw,58px)] leading-[1.03] tracking-normal">
              Not another dashboard. Evidence output.
            </h2>
            <p className="mt-5 max-w-xl text-[17px] leading-8 text-[#cdd7e2]">
              During an incident, the useful artifact is not a chart. It is a ranked list of changes
              with the evidence behind each score.
            </p>
          </div>
          <TerminalBlock title="proxkey rank --incident inc-4721" className="border-[#39424d]">
            {`Input:
  alerts: checkout 5xx, gateway p95, payments auth errors
  graph: gateway -> checkout -> payments
  deploy window: 6h

Ranked root causes:
  payments@cafe777        49.05%
    same-service payments error spike
    checkout depends on payments
    deployed 2h 58m before first signal

  checkout@b00c042        32.34%
    same-service checkout errors
    weaker payments evidence

  search@deed404         10.46%
    gateway latency only, not checkout path dominant

  unknown                 0.82%`}
          </TerminalBlock>
        </div>
      </section>

      <section className="border-b border-[#d8ddd5] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <SectionLabel>Model</SectionLabel>
            <h2 className="mt-4 font-['Georgia'] text-[clamp(34px,5vw,58px)] leading-[1.03] tracking-normal">
              Incidents are evaluated against the system that produced them.
            </h2>
          </div>
          <div className="mt-10 grid border-y border-[#cfd6cd] md:grid-cols-2 xl:grid-cols-4">
            {modelInputs.map(([title, copy]) => (
              <div
                key={title}
                className="border-b border-[#cfd6cd] px-4 py-6 md:border-r xl:border-b-0 last:border-r-0"
              >
                <div className="font-mono text-[13px] uppercase tracking-[0.14em] text-[#ff5a1f]">
                  {title}
                </div>
                <div className="mt-4 text-[17px] leading-7 text-[#343b43]">{copy}</div>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-[18px] leading-8 text-[#343b43]">
            The system already has the clues: what deployed, where it sits in the graph, when
            symptoms appeared, and how failures propagate. ProxKey makes that latent truth visible.
          </p>
        </div>
      </section>

      <section className="border-b border-[#252c35] bg-[#111318] px-4 py-14 text-white sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <TerminalBlock title="multi-service attribution" className="border-[#39424d]">
            {`Incident: checkout latency and payment failures
Started: 2026-05-01 13:18 UTC

Candidates:
1. payments@cafe777          0.4905
   evidence:
   - payments error-rate signal on same service
   - checkout depends on payments
   - delayed failure window still active

2. checkout@b00c042          0.3234
   evidence:
   - checkout alert on same service
   - weaker downstream payments fit

3. identity@a11ce01          0.0729
   evidence:
   - shared dependency, weaker temporal match`}
          </TerminalBlock>
          <div>
            <SectionLabel light>Cross-service</SectionLabel>
            <h2 className="mt-4 font-['Georgia'] text-[clamp(34px,5vw,58px)] leading-[1.03] tracking-normal">
              The broken change is often not where the loudest alert fired.
            </h2>
            <p className="mt-5 text-[17px] leading-8 text-[#cdd7e2]">
              ProxKey scores callers, dependencies, adjacent services, and delayed symptoms
              together, so a dependency deploy can outrank a noisy edge-service alert when the
              evidence supports it.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-[#d8ddd5] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.88fr_1.12fr]">
          <div>
            <SectionLabel>Positioning</SectionLabel>
            <h2 className="mt-4 font-['Georgia'] text-[clamp(34px,5vw,58px)] leading-[1.03] tracking-normal">
              Observability tells you something broke. Attribution tells you what changed.
            </h2>
          </div>
          <div className="border-y border-[#cfd6cd]">
            {positioning.map(([tool, limit]) => (
              <div
                key={tool}
                className="grid grid-cols-[7.5rem_1fr] border-b border-[#cfd6cd] last:border-b-0 sm:grid-cols-[11rem_1fr]"
              >
                <div className="border-r border-[#cfd6cd] px-4 py-5 font-semibold text-[#111318]">
                  {tool}
                </div>
                <div className="px-4 py-5 text-[16px] leading-7 text-[#343b43]">{limit}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 border-y border-[#252c35] bg-[#111318] px-4 py-8 text-white sm:px-6 lg:grid-cols-[1fr_auto] lg:items-end lg:px-8">
          <div>
            <SectionLabel light>Get started</SectionLabel>
            <h2 className="mt-4 font-['Georgia'] text-[clamp(34px,5vw,58px)] leading-[1.03] tracking-normal">
              Start triaging incidents by change.
            </h2>
            <p className="mt-5 max-w-2xl text-[17px] leading-8 text-[#cdd7e2]">
              Connect deploy events, observability signals, and your service graph. Get ranked
              commits when production breaks.
            </p>
          </div>
          <Link
            to={user ? '/dashboard' : '/login'}
            className="inline-flex min-h-12 items-center justify-center border border-[#ff5a1f] bg-[#ff5a1f] px-5 text-sm font-semibold uppercase tracking-[0.14em] text-white"
          >
            Start triaging incidents
          </Link>
        </div>
      </section>
    </div>
  )
}
