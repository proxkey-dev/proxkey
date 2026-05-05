const KEY = 'proxkey_active_org_id'

export function getActiveOrgId(): string | null {
  if (typeof localStorage === 'undefined') {
    return null
  }
  return localStorage.getItem(KEY)
}

export function setActiveOrgId(id: string): void {
  localStorage.setItem(KEY, id)
}

export function clearActiveOrgId(): void {
  localStorage.removeItem(KEY)
}
