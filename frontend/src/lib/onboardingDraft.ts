/**
 * Optional draft answers before OAuth redirect (e.g. GitHub). Survives one session only.
 */
export type OnboardingDraftV1 = {
  version: 1
  accountType: 'individual' | 'company'
  fullName: string
  companyName: string
  updatedAt: string
}

const KEY = 'proxkey.onboarding.v1'

export function saveOnboardingDraft(draft: Omit<OnboardingDraftV1, 'version' | 'updatedAt'>): void {
  try {
    const payload: OnboardingDraftV1 = {
      version: 1,
      ...draft,
      updatedAt: new Date().toISOString(),
    }
    sessionStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadOnboardingDraft(): OnboardingDraftV1 | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OnboardingDraftV1
    if (parsed?.version !== 1 || !parsed.accountType) return null
    return parsed
  } catch {
    return null
  }
}

export function clearOnboardingDraft(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
