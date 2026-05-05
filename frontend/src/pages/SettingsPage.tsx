import * as Select from '@radix-ui/react-select'
import * as Switch from '@radix-ui/react-switch'
import * as Tabs from '@radix-ui/react-tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getSettings, patchSettings, postSlackTest } from '../lib/api'
import { formatCost } from '../lib/format'
import { EmptyState } from '../components/EmptyState'
import { SkeletonBlock } from '../components/SkeletonRow'

function BudgetField({
  cents,
  disabled,
  onSave,
}: {
  cents: number
  disabled: boolean
  onSave: (cents: number) => void
}) {
  const [val, setVal] = useState(() => (cents > 0 ? (cents / 100).toFixed(2) : ''))
  return (
    <>
      <input
        id="budget"
        type="number"
        min={0}
        step="0.01"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="mt-2 w-full max-w-xs rounded border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-[#e8e8e8] outline-none focus-visible:ring-2 focus-visible:ring-[#4ade80]"
      />
      <button
        type="button"
        className="mt-4 rounded bg-[#e8e8e8] px-4 py-2 text-sm font-medium text-[#0a0a0a] hover:opacity-90 disabled:opacity-50"
        disabled={disabled}
        onClick={() => {
          const dollars = Number(val)
          if (!Number.isFinite(dollars) || dollars < 0) {
            return
          }
          onSave(Math.round(dollars * 100))
        }}
      >
        Save
      </button>
    </>
  )
}

const ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
]

export default function SettingsPage() {
  const qc = useQueryClient()
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 300_000,
  })

  const [slackUrl, setSlackUrl] = useState('')

  const patch = useMutation({
    mutationFn: patchSettings,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  const slackTest = useMutation({
    mutationFn: postSlackTest,
  })

  if (settings.isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="font-mono text-xl text-[#e8e8e8]">Settings</h1>
        <SkeletonBlock className="h-64" />
      </div>
    )
  }

  if (settings.error || !settings.data) {
    return (
      <div className="space-y-4">
        <h1 className="font-mono text-xl text-[#e8e8e8]">Settings</h1>
        <div className="rounded border border-red-500/40 p-4 text-sm text-red-300">
          {settings.error instanceof Error ? settings.error.message : 'Failed to load settings'}
          <button type="button" className="ml-3 underline" onClick={() => void settings.refetch()}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  const s = settings.data

  return (
    <div className="space-y-6">
      <h1 className="font-mono text-xl text-[#e8e8e8]">Settings</h1>

      <Tabs.Root defaultValue="general" className="space-y-4">
        <Tabs.List className="flex flex-wrap gap-1 rounded border border-[#1e1e1e] bg-[#111111] p-1" aria-label="Settings sections">
          {(['general', 'notifications', 'github', 'plan'] as const).map((id) => (
            <Tabs.Trigger
              key={id}
              value={id}
              className="rounded px-4 py-2 text-sm text-[#6b6b6b] outline-none ring-offset-2 ring-offset-[#0a0a0a] hover:text-[#e8e8e8] focus-visible:ring-2 focus-visible:ring-[#4ade80] data-[state=active]:bg-[#161616] data-[state=active]:text-[#e8e8e8]"
            >
              {id[0]!.toUpperCase() + id.slice(1)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="general" className="rounded border border-[#1e1e1e] bg-[#111111] p-6">
          <label className="text-sm text-[#6b6b6b]">Organization</label>
          <p className="mt-1 text-[#e8e8e8]">{s.orgName}</p>
          <label className="mt-6 block text-sm text-[#6b6b6b]" htmlFor="budget">
            Monthly budget (USD)
          </label>
          <BudgetField
            key={s.monthlyBudgetCents}
            cents={s.monthlyBudgetCents}
            disabled={patch.isPending}
            onSave={(cents) => patch.mutate({ monthlyBudgetCents: cents })}
          />
        </Tabs.Content>

        <Tabs.Content value="notifications" className="space-y-6 rounded border border-[#1e1e1e] bg-[#111111] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#e8e8e8]">Weekly digest</p>
              <p className="text-xs text-[#6b6b6b]">Email summary of CI spend.</p>
            </div>
            <Switch.Root
              checked={s.digestEnabled}
              onCheckedChange={(checked) => patch.mutate({ digestEnabled: checked })}
              className="h-6 w-11 shrink-0 rounded-full border border-[#1e1e1e] bg-[#0a0a0a] data-[state=checked]:bg-[#4ade80]"
            >
              <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-[#e8e8e8] transition-transform will-change-transform data-[state=checked]:translate-x-[22px]" />
            </Switch.Root>
          </div>

          <div>
            <label className="text-sm text-[#6b6b6b]">Timezone</label>
            <Select.Root value={s.timezone} onValueChange={(tz) => patch.mutate({ timezone: tz })}>
              <Select.Trigger className="mt-2 flex w-full max-w-xs items-center justify-between rounded border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2 text-left text-sm text-[#e8e8e8] outline-none focus-visible:ring-2 focus-visible:ring-[#4ade80]">
                <Select.Value />
                <span className="text-[#6b6b6b]">▾</span>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="z-50 overflow-hidden rounded border border-[#1e1e1e] bg-[#111111] shadow-lg">
                  <Select.Viewport className="p-1">
                    {ZONES.map((z) => (
                      <Select.Item
                        key={z}
                        value={z}
                        className="cursor-default rounded px-3 py-2 text-sm text-[#e8e8e8] outline-none data-[highlighted]:bg-[#161616]"
                      >
                        <Select.ItemText>{z}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>

          <div>
            <label className="text-sm text-[#6b6b6b]" htmlFor="slack">
              Slack webhook URL
            </label>
            <input
              id="slack"
              defaultValue={s.slackWebhookUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              className="mt-2 w-full max-w-xl rounded border border-[#1e1e1e] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-[#e8e8e8] outline-none focus-visible:ring-2 focus-visible:ring-[#4ade80]"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-[#e8e8e8] px-4 py-2 text-sm text-[#e8e8e8] hover:bg-[#161616]"
                onClick={() => patch.mutate({ slackWebhookUrl: slackUrl || s.slackWebhookUrl })}
                disabled={patch.isPending}
              >
                Save webhook
              </button>
              <button
                type="button"
                className="rounded bg-[#e8e8e8] px-4 py-2 text-sm font-medium text-[#0a0a0a] hover:opacity-90 disabled:opacity-50"
                disabled={slackTest.isPending}
                onClick={() => {
                  const url = slackUrl || s.slackWebhookUrl
                  if (!url) {
                    return
                  }
                  slackTest.mutate(url)
                }}
              >
                Test
              </button>
            </div>
            {slackTest.isError ? (
              <p className="mt-2 text-xs text-red-400">Slack test failed. Check the URL and try again.</p>
            ) : null}
            {slackTest.isSuccess ? <p className="mt-2 text-xs text-[#4ade80]">Test message sent.</p> : null}
          </div>
        </Tabs.Content>

        <Tabs.Content value="github" className="rounded border border-[#1e1e1e] bg-[#111111] p-6">
          <p className="text-sm text-[#6b6b6b]">Installation</p>
          <p className="mt-1 font-mono text-[#e8e8e8]">{s.githubInstallationStatus}</p>
          {s.githubInstallationId ? (
            <p className="mt-2 font-mono text-xs text-[#6b6b6b]">ID {s.githubInstallationId}</p>
          ) : null}
          <a
            href="https://github.com/apps"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex rounded bg-[#e8e8e8] px-4 py-2 text-sm font-medium text-[#0a0a0a] no-underline hover:opacity-90"
          >
            Configure GitHub App
          </a>
          <h3 className="mt-8 text-sm font-medium text-[#e8e8e8]">Connected repositories</h3>
          {s.connectedRepos.length === 0 ? (
            <div className="mt-4">
              <EmptyState heading="No repos connected" body="Install the app on repositories to start ingesting builds." />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-[#1e1e1e] rounded border border-[#1e1e1e]">
              {s.connectedRepos.map((r) => (
                <li key={r.id} className="px-4 py-2 font-mono text-sm text-[#e8e8e8]">
                  {r.name}
                </li>
              ))}
            </ul>
          )}
        </Tabs.Content>

        <Tabs.Content value="plan" className="rounded border border-[#1e1e1e] bg-[#111111] p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-[#6b6b6b]">Current plan</p>
              <p className="mt-1 inline-block rounded border border-[#4ade80]/40 bg-[#4ade80]/10 px-3 py-1 font-mono text-sm uppercase text-[#4ade80]">
                {s.plan}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-[#6b6b6b]">Usage this month</p>
              <p className="mt-1 font-mono text-lg text-[#e8e8e8]">{formatCost(s.monthlyUsageCents, true)}</p>
              <p className="mt-2 text-xs text-[#6b6b6b]">
                Included <span className="font-mono text-[#e8e8e8]">{formatCost(s.monthlyIncludedCents, true)}</span>
              </p>
            </div>
          </div>
          <a
            href="mailto:hello@proxkey.dev?subject=ProxKey%20plan%20upgrade"
            className="mt-8 inline-flex rounded border border-[#e8e8e8] px-4 py-2 text-sm text-[#e8e8e8] no-underline hover:bg-[#161616]"
          >
            Upgrade
          </a>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
