import type { Access } from 'payload'

export const SUPER_ADMIN_ROLE = 'super-admin'
export const ADMIN_ROLE = 'admin'

export type AdminRole = typeof SUPER_ADMIN_ROLE | typeof ADMIN_ROLE

type AuthenticatedAdminUser = {
  collection?: string
  id?: number | string
  role?: string | null
} | null | undefined

export const anyone: Access = () => true

export function isAdminUser(user: AuthenticatedAdminUser): boolean {
  return Boolean(user && user.collection === 'admins')
}

export function isSuperAdmin(user: AuthenticatedAdminUser): boolean {
  return isAdminUser(user) && user?.role === SUPER_ADMIN_ROLE
}

export const adminsOnly: Access = ({ req: { user } }) => isAdminUser(user)

export const superAdminsOnly: Access = ({ req: { user } }) => isSuperAdmin(user)

export const superAdminsOrSelf: Access = ({ req: { user } }) => {
  if (!isAdminUser(user)) return false
  if (isSuperAdmin(user)) return true

  return {
    id: {
      equals: user.id,
    },
  }
}
