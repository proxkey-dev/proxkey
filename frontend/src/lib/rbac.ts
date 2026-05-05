import type { MemberRole as Role, OrgMembership } from '@/types/org'

export const isOwner = (role?: Role) => role === 'OWNER'
export const canManageMembers = (role?: Role) => role === 'OWNER' || role === 'ADMIN'
export const canEditOrgSettings = (role?: Role) => role === 'OWNER' || role === 'ADMIN'
export const canSeeBilling = (role?: Role) =>
  role === 'OWNER' || role === 'ADMIN' || role === 'BILLING'
export const canUseOwnerPanel = (role?: Role) => role === 'OWNER'

export type Profile = {
  id: string
  email?: string
  display_name?: string
  avatar_path?: string
  prefs?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type { OrgMembership }

export const getRoleFromMembership = (membership?: OrgMembership | null): Role | undefined =>
  membership?.member_role
