import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { proxkeyApi, type AuthUser } from '../../lib/proxkey-api'
import { useAuth } from '../../contexts/AuthContext'

function CutPanel({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`border border-[#ece8df] bg-[#faf8f4] ${className}`}>{children}</div>
}

function copyText(value: string): Promise<void> {
  return navigator.clipboard.writeText(value)
}

function downloadText(filename: string, value: string): void {
  const blob = new Blob([value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function ProxKeyReportPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const { role } = useAuth()
  const [data, setData] = useState<Awaited<ReturnType<typeof proxkeyApi.report>> | null>(null)
  const [employees, setEmployees] = useState<AuthUser[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    summary: '',
    severity: 'MEDIUM',
    component: '',
    nextAction: '',
    reproSteps: '',
    missingInfo: '',
    ownerId: '',
  })

  const canReview = role === 'OWNER' || role === 'ADMIN' || role === 'TRIAGE_LEAD'

  const loadReport = useCallback(async (): Promise<void> => {
    if (!reportId) {
      return
    }

    try {
      const [report, employeeList] = await Promise.all([
        proxkeyApi.report(reportId),
        canReview ? proxkeyApi.employees() : Promise.resolve({ items: [] as AuthUser[] }),
      ])

      setData(report)
      setEmployees(employeeList.items)
      const ownerMatch = employeeList.items.find(
        (employee) => employee.name === report.report.triageResult?.suggestedOwner,
      )
      setForm({
        summary: report.report.triageResult?.summary ?? '',
        severity: report.report.triageResult?.severity ?? 'MEDIUM',
        component: report.report.triageResult?.component ?? '',
        nextAction: report.report.triageResult?.nextAction ?? '',
        reproSteps: (report.report.triageResult?.reproSteps ?? []).join('\n'),
        missingInfo: (report.report.triageResult?.missingInfo ?? []).join('\n'),
        ownerId: ownerMatch?.id ?? '',
      })
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load report.')
    }
  }, [canReview, reportId])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  async function updateReport(body: Record<string, unknown>): Promise<void> {
    if (!reportId) {
      return
    }

    setSaving(true)
    try {
      await proxkeyApi.updateTriage(reportId, body)
      await loadReport()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update report.')
    } finally {
      setSaving(false)
    }
  }

  const exportText = useMemo(() => {
    if (!data?.report.triageResult) {
      return null
    }

    const triage = data.report.triageResult
    const repro = triage.reproSteps.map((step) => `- ${step}`).join('\n') || '- None'
    const missing = triage.missingInfo.map((item) => `- ${item}`).join('\n') || '- None'
    const summary = [
      `# ${data.report.title}`,
      '',
      `Severity: ${triage.severity}`,
      `Component: ${triage.component}`,
      `Confidence: ${Math.round(triage.confidence * 100)}%`,
      '',
      '## Summary',
      triage.summary,
      '',
      '## Reproduction steps',
      repro,
      '',
      '## Missing information',
      missing,
      '',
      '## Next action',
      triage.nextAction,
    ].join('\n')

    return {
      markdown: summary,
      github: [
        `Title: ${data.report.title}`,
        '',
        triage.summary,
        '',
        'Reproduction steps:',
        repro,
        '',
        'Next action:',
        triage.nextAction,
      ].join('\n'),
      jira: [
        `Summary: ${data.report.title}`,
        `Severity: ${triage.severity}`,
        `Component: ${triage.component}`,
        '',
        `Description:\n${triage.summary}`,
        '',
        `Missing info:\n${missing}`,
      ].join('\n'),
      linear: [
        `${data.report.title}`,
        '',
        `Severity ${triage.severity}`,
        triage.summary,
        '',
        `Next action: ${triage.nextAction}`,
      ].join('\n'),
      support: `Thanks for the report. We have translated this issue into an engineering packet and the next step is: ${triage.nextAction}`,
    }
  }, [data])

  if (!data) {
    return <div className="px-4 py-12 text-sm text-[#4f4f4b]">{error ?? 'Loading report…'}</div>
  }

  const triage = data.report.triageResult

  return (
    <div className="bg-[#f6f4ef] px-4 py-6 text-[#111] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl pb-28">
        <div className="pk-frame bg-white px-6 py-6 shadow-[0_16px_36px_rgba(25,20,15,0.04)]">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#7e7569]">
            Triage packet detail
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{data.report.title}</h1>
          <div className="mt-3 text-sm leading-7 text-[#57544d]">
            {data.report.source} • {data.report.status} • created{' '}
            {new Date(data.report.createdAt).toLocaleString()}
          </div>

          {triage ? (
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                <CutPanel className="px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">
                    Summary
                  </div>
                  {canReview ? (
                    <textarea
                      value={form.summary}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, summary: event.target.value }))
                      }
                      className="mt-3 min-h-[140px] w-full border border-[#d6d2c8] bg-white px-4 py-4 text-sm leading-7 outline-none"
                    />
                  ) : (
                    <div className="mt-2 text-sm leading-7">{triage.summary}</div>
                  )}
                </CutPanel>

                <div className="grid gap-3 sm:grid-cols-2">
                  <CutPanel className="px-4 py-4 text-sm">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">
                      Severity
                    </div>
                    {canReview ? (
                      <select
                        value={form.severity}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, severity: event.target.value }))
                        }
                        className="mt-3 w-full border border-[#d6d2c8] bg-white px-4 py-3 text-sm outline-none"
                      >
                        <option value="LOW">SEV-4</option>
                        <option value="MEDIUM">SEV-3</option>
                        <option value="HIGH">SEV-2</option>
                        <option value="CRITICAL">SEV-1</option>
                      </select>
                    ) : (
                      <div className="mt-2 font-semibold">{triage.severity}</div>
                    )}
                  </CutPanel>
                  <CutPanel className="px-4 py-4 text-sm">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">
                      Confidence
                    </div>
                    <div className="mt-2 font-semibold">{Math.round(triage.confidence * 100)}%</div>
                  </CutPanel>
                  <CutPanel className="px-4 py-4 text-sm">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">
                      Component
                    </div>
                    {canReview ? (
                      <input
                        value={form.component}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, component: event.target.value }))
                        }
                        className="mt-3 w-full border border-[#d6d2c8] bg-white px-4 py-3 text-sm outline-none"
                      />
                    ) : (
                      <div className="mt-2 font-semibold">{triage.component}</div>
                    )}
                  </CutPanel>
                  <CutPanel className="px-4 py-4 text-sm">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">
                      Suggested owner
                    </div>
                    {canReview ? (
                      <select
                        value={form.ownerId}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, ownerId: event.target.value }))
                        }
                        className="mt-3 w-full border border-[#d6d2c8] bg-white px-4 py-3 text-sm outline-none"
                      >
                        <option value="">Keep current owner</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name} · {employee.role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-2 font-semibold">{triage.suggestedOwner ?? 'Pending'}</div>
                    )}
                  </CutPanel>
                </div>

                <CutPanel className="px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">
                    Reproduction steps
                  </div>
                  {canReview ? (
                    <textarea
                      value={form.reproSteps}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, reproSteps: event.target.value }))
                      }
                      className="mt-3 min-h-[120px] w-full border border-[#d6d2c8] bg-white px-4 py-4 text-sm leading-7 outline-none"
                    />
                  ) : (
                    <ul className="mt-3 space-y-1 text-sm leading-7">
                      {triage.reproSteps.map((step) => (
                        <li key={step}>• {step}</li>
                      ))}
                    </ul>
                  )}
                </CutPanel>

                <CutPanel className="px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">
                    Missing information
                  </div>
                  {canReview ? (
                    <textarea
                      value={form.missingInfo}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, missingInfo: event.target.value }))
                      }
                      className="mt-3 min-h-[120px] w-full border border-[#d6d2c8] bg-white px-4 py-4 text-sm leading-7 outline-none"
                    />
                  ) : (
                    <ul className="mt-3 space-y-1 text-sm leading-7">
                      {triage.missingInfo.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  )}
                </CutPanel>

                <CutPanel className="px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">
                    Recommended next action
                  </div>
                  {canReview ? (
                    <textarea
                      value={form.nextAction}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, nextAction: event.target.value }))
                      }
                      className="mt-3 min-h-[100px] w-full border border-[#d6d2c8] bg-white px-4 py-4 text-sm leading-7 outline-none"
                    />
                  ) : (
                    <div className="mt-3 text-sm leading-7">{triage.nextAction}</div>
                  )}
                </CutPanel>
              </div>

              <div className="space-y-4">
                <CutPanel className="px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">
                    Exports
                  </div>
                  {exportText ? (
                    <div className="mt-4 grid gap-2">
                      <button
                        type="button"
                        onClick={() => void copyText(exportText.markdown)}
                        className="border border-[#d6d2c8] bg-white px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.14em] text-[#111]"
                      >
                        Copy Markdown
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadText(`${data.report.title}.md`, exportText.markdown)}
                        className="border border-[#d6d2c8] bg-white px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.14em] text-[#111]"
                      >
                        Download Markdown
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyText(exportText.github)}
                        className="border border-[#d6d2c8] bg-white px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.14em] text-[#111]"
                      >
                        Copy GitHub issue
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyText(exportText.jira)}
                        className="border border-[#d6d2c8] bg-white px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.14em] text-[#111]"
                      >
                        Copy Jira issue
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyText(exportText.linear)}
                        className="border border-[#d6d2c8] bg-white px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.14em] text-[#111]"
                      >
                        Copy Linear issue
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyText(exportText.support)}
                        className="border border-[#d6d2c8] bg-white px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.14em] text-[#111]"
                      >
                        Copy customer response
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm leading-7 text-[#57544d]">
                      Export options appear after triage completes.
                    </div>
                  )}
                </CutPanel>

                <CutPanel className="px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#81796d]">
                    Pipeline steps
                  </div>
                  <div className="mt-4 space-y-2">
                    {data.steps.map((step) => (
                      <div
                        key={step.id}
                        className="border border-[#d6d2c8] bg-white px-4 py-3 text-sm text-[#57544d]"
                      >
                        {step.stepName} · {step.durationMs} ms
                      </div>
                    ))}
                  </div>
                </CutPanel>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-sm leading-7 text-[#57544d]">
              New report processing… This view updates automatically when triage completes.
            </div>
          )}

          {error ? (
            <div className="mt-5 border border-[#f1cac6] bg-[#fff4f4] px-4 py-3 text-sm text-[#e5484d]">
              {error}
            </div>
          ) : null}
        </div>

        {canReview && triage ? (
          <div className="fixed bottom-[88px] left-0 right-0 z-30 px-4 md:bottom-4">
            <div className="mx-auto flex max-w-7xl flex-wrap gap-2 border border-[#e7e2d8] bg-[rgba(246,244,239,0.96)] p-3 backdrop-blur">
              <button
                type="button"
                onClick={() =>
                  void updateReport({
                    summary: form.summary,
                    severity: form.severity,
                    component: form.component,
                    nextAction: form.nextAction,
                    reproSteps: form.reproSteps
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean),
                    missingInfo: form.missingInfo
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean),
                    suggestedOwnerId: form.ownerId || null,
                  })
                }
                disabled={saving}
                className="border border-[#111] bg-[#111] px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white disabled:opacity-70"
              >
                Save changes
              </button>
              <button
                type="button"
                onClick={() =>
                  void updateReport({
                    status: 'ASSIGNED',
                    suggestedOwnerId: form.ownerId || undefined,
                  })
                }
                disabled={saving}
                className="border border-[#1f8f5f] bg-[#1f8f5f] px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white disabled:opacity-70"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => void updateReport({ status: 'NEEDS_REVIEW' })}
                disabled={saving}
                className="border border-[#ff5a1f] bg-[#ff5a1f] px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-white disabled:opacity-70"
              >
                Request info
              </button>
              <button
                type="button"
                onClick={() => void updateReport({ status: 'RESOLVED' })}
                disabled={saving}
                className="border border-[#d6d2c8] bg-white px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-[#111] disabled:opacity-70"
              >
                Mark resolved
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
