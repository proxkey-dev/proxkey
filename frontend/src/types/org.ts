export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'BILLING' | 'VIEWER'

export type OrgMembership = {
  organization_id: string
  member_role: MemberRole
  is_default: boolean
  name: string
  slug: string
  logo_url?: string
  brand_color?: string
}
