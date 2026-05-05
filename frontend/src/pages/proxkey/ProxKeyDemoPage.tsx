import { useMemo, useState } from 'react'
import { proxkeyApi } from '../../lib/proxkey-api'
import { demoExamples } from '../../lib/proxkey-samples'

type DemoState =
  | { status: 'idle' }
  | { status: 'running' }
  | {
      status: 'done'
      result: Awaited<ReturnType<typeof proxkeyApi.runDemo>>
    }
  | {
      status: 'error'
      message: string
    }

export default function ProxKeyDemoPage() {
  const [selectedId, setSelectedId] = useState(demoExamples[0].id)
  const [title, setTitle] = useState(demoExamples[0].title)
  const [rawText, setRawText] = useState(demoExamples[0].rawText)
  const [logs, setLogs] = useState(demoExamples[0].logs ?? '')
  const [state, setState] = useState<DemoState>({ status: 'idle' })

  const selectedExample = useMemo(
    () => demoExamples.find((example) => example.id === selectedId) ?? demoExamples[0],
    [selectedId],
  )

  const pipeline = useMemo(
    () => [
      'Extracting evidence',
      'Classifying severity',
      'Searching duplicates',
      'Routing owner',
      'Building handoff',
    ],
    [],
  )

  function applySample(id: string): void {
    const next = demoExamples.find((example) => example.id === id)
    if (!next) {
      return
    }

    setSelectedId(next.id)
    setTitle(next.title)
    setRawText(next.rawText)
    setLogs(next.logs ?? '')
    setState({ status: 'idle' })
  }

  async function runDemo(): Promise<void> {
    if (!title.trim() || !rawText.trim()) {
      setState({
        status: 'error',
        message: 'Enter a title and report text first.',
      })
      return
    }

    setState({ status: 'running' })
    try {
      const result = await proxkeyApi.runDemo({
        title: title.trim(),
        rawText: rawText.trim(),
        logs: logs.trim() || undefined,
        metadataJson: {
          source: selectedExample.source,
        },
      })
      setState({ status: 'done', result })
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Demo failed.',
      })
    }
  }

  return (
    <div className="bg-[#f6f4ef] px-4 py-6 text-[#111] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="pk-frame pk-grid-surface bg-white px-6 py-8 shadow-[0_20px_54px_rgba(33,28,19,0.06)] sm:px-8">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">Live demo</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#111] sm:text-6xl">
            Paste messy issue text and inspect the packet before you sign up.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[#57544d]">
            This surface stays clearly separate from persistent workspace records. It uses the live
            backend endpoint when available and the deterministic fallback when an AI provider is
            not configured.
          </p>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_0.65fr_0.9fr]">
          <div className="pk-frame bg-white px-5 py-5 shadow-[0_16px_36px_rgba(25,20,15,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-[#7e7569]">Input</div>
                <div className="mt-2 text-xl font-semibold">Choose a sample or paste your own</div>
              </div>
              <select
                value={selectedId}
                onChange={(event) => applySample(event.target.value)}
                className="border border-[#d6d2c8] bg-white px-3 py-2 text-sm outline-none"
              >
                {demoExamples.map((example) => (
                  <option key={example.id} value={example.id}>
                    {example.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 grid gap-3">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full border border-[#d6d2c8] bg-[#faf8f4] px-4 py-3 text-sm outline-none"
                placeholder="Issue title"
              />
              <textarea
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                className="min-h-[220px] w-full border border-[#d6d2c8] bg-[#faf8f4] px-4 py-4 text-sm leading-7 outline-none"
                placeholder="Paste report text, QA notes, or a customer escalation"
              />
              <textarea
                value={logs}
                onChange={(event) => setLogs(event.target.value)}
                className="min-h-[150px] w-full border border-[#d6d2c8] bg-[#faf8f4] px-4 py-4 text-sm leading-7 outline-none"
                placeholder="Optional logs or stack trace"
              />
            </div>

            <button
              type="button"
              onClick={() => void runDemo()}
              className="mt-5 border border-[#ff5a1f] bg-[#ff5a1f] px-5 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white"
            >
              Run triage
            </button>
          </div>

          <div className="pk-dark-grid border border-[#27303a] bg-[#111318] px-5 py-5 text-white [clip-path:polygon(0_0,calc(100%-16px)_0,100%_16px,100%_100%,16px_100%,0_calc(100%-16px))]">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#95a0af]">Pipeline</div>
            <div className="mt-5 space-y-3">
              {pipeline.map((step, index) => (
                <div
                  key={step}
                  className="border border-[#27303a] bg-[#161b22] px-4 py-4 text-sm text-[#d6dde6]"
                >
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#95a0af]">
                    Step {index + 1}
                  </div>
                  <div className="mt-2">{step}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="pk-frame bg-white px-5 py-5 shadow-[0_16px_36px_rgba(25,20,15,0.04)]">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#7e7569]">Output</div>
            {state.status === 'idle' ? (
              <div className="mt-4 text-sm leading-7 text-[#57544d]">
                Run the pipeline to render the triage packet.
              </div>
            ) : null}
            {state.status === 'running' ? (
              <div className="mt-4 text-sm leading-7 text-[#57544d]">Processing signal…</div>
            ) : null}
            {state.status === 'error' ? (
              <div className="mt-4 text-sm leading-7 text-[#e5484d]">{state.message}</div>
            ) : null}
            {state.status === 'done' ? (
              <div className="mt-4 space-y-4 text-sm leading-7">
                <div>
                  <div className="font-semibold text-[#111]">Summary</div>
                  <div>{state.result.summary}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="font-semibold text-[#111]">Severity</div>
                    <div>{state.result.severity}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-[#111]">Component</div>
                    <div>{state.result.component}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-[#111]">Confidence</div>
                    <div>{Math.round(state.result.confidence * 100)}%</div>
                  </div>
                  <div>
                    <div className="font-semibold text-[#111]">Missing info</div>
                    <div>{state.result.missingInfo[0] ?? 'None'}</div>
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-[#111]">Reproduction steps</div>
                  <ul className="mt-2 space-y-1">
                    {state.result.reproSteps.map((step) => (
                      <li key={step}>• {step}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-[#111]">Next action</div>
                  <div>{state.result.nextAction}</div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
