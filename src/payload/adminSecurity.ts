import type { Payload } from 'payload'

import {
  ADMIN_ROLE,
  SUPER_ADMIN_ROLE,
  type AdminRole,
  isAdminUser,
  isSuperAdmin,
} from './access'

type AdminDocumentLike = {
  createdAt?: string | null
  email?: string | null
  id: number | string
  role?: string | null
}

type ActingUserLike = {
  id?: number | string
  collection?: string
  role?: string | null
} | null | undefined

export const ADMIN_ROLE_OPTIONS = [
  {
    label: 'Super Admin',
    value: SUPER_ADMIN_ROLE,
  },
  {
    label: 'Admin',
    value: ADMIN_ROLE,
  },
] as const

export function normalizeAdminRole(role: unknown): AdminRole {
  return role === SUPER_ADMIN_ROLE ? SUPER_ADMIN_ROLE : ADMIN_ROLE
}

export function resolveAdminRole(params: {
  existingAdminCount: number
  incomingRole?: unknown
  originalRole?: unknown
}): AdminRole {
  if (params.incomingRole != null) return normalizeAdminRole(params.incomingRole)
  if (params.originalRole != null) return normalizeAdminRole(params.originalRole)
  return params.existingAdminCount === 0 ? SUPER_ADMIN_ROLE : ADMIN_ROLE
}

export function assertCanChangeAdminRole(params: {
  actingUser: ActingUserLike
  nextRole: AdminRole
  originalRole?: unknown
  superAdminCount: number
  targetAdminId?: number | string
}) {
  const currentRole = normalizeAdminRole(params.originalRole)
  const actorIsSuperAdmin = isSuperAdmin(params.actingUser)
  const actorIsTarget =
    params.actingUser?.id != null &&
    params.targetAdminId != null &&
    String(params.actingUser.id) === String(params.targetAdminId)

  if (!actorIsSuperAdmin && currentRole !== params.nextRole) {
    throw new Error('Only a super admin can change another admin role.')
  }

  if (
    currentRole === SUPER_ADMIN_ROLE &&
    params.nextRole !== SUPER_ADMIN_ROLE &&
    params.superAdminCount <= 1
  ) {
    throw new Error('At least one super admin must remain in the system.')
  }

  if (
    actorIsTarget &&
    actorIsSuperAdmin &&
    currentRole === SUPER_ADMIN_ROLE &&
    params.nextRole !== SUPER_ADMIN_ROLE
  ) {
    throw new Error('Super admins cannot remove their own super admin role.')
  }
}

export function assertCanDeleteAdmin(params: {
  actingUser: ActingUserLike
  superAdminCount: number
  targetAdmin: AdminDocumentLike
}) {
  if (!isAdminUser(params.actingUser)) {
    throw new Error('You must be logged in as an admin to delete admin accounts.')
  }

  const actorIsTarget =
    params.actingUser?.id != null &&
    String(params.actingUser.id) === String(params.targetAdmin.id)

  if (actorIsTarget) {
    throw new Error('Admins cannot delete their own account.')
  }

  if (
    normalizeAdminRole(params.targetAdmin.role) === SUPER_ADMIN_ROLE &&
    params.superAdminCount <= 1
  ) {
    throw new Error('The last super admin account cannot be deleted.')
  }
}

export async function countAdmins(payload: Payload): Promise<number> {
  const result = await payload.find({
    collection: 'admins',
    depth: 0,
    limit: 1,
    pagination: false,
  })

  return result.totalDocs
}

export async function countSuperAdmins(payload: Payload): Promise<number> {
  const result = await payload.find({
    collection: 'admins',
    depth: 0,
    limit: 1,
    pagination: false,
    where: {
      role: {
        equals: SUPER_ADMIN_ROLE,
      },
    },
  })

  return result.totalDocs
}

export async function ensureAdminRoles(payload: Payload): Promise<void> {
  const result = await payload.find({
    collection: 'admins',
    depth: 0,
    limit: 1000,
    pagination: false,
    sort: 'createdAt',
  })
  const admins = [...result.docs] as AdminDocumentLike[]

  if (admins.length === 0) return

  const existingSuperAdmin = admins.find(
    (admin) => normalizeAdminRole(admin.role) === SUPER_ADMIN_ROLE && admin.role != null,
  )
  const bootstrapSuperAdmin = existingSuperAdmin ?? admins[0]

  for (const admin of admins) {
    const desiredRole: AdminRole =
      String(admin.id) === String(bootstrapSuperAdmin.id) ? SUPER_ADMIN_ROLE : ADMIN_ROLE

    if (admin.role === desiredRole) continue

    await payload.update({
      collection: 'admins',
      context: {
        skipAdminRoleGuards: true,
      },
      id: admin.id,
      data: {
        role: desiredRole,
      },
      depth: 0,
      overrideAccess: true,
    })
  }
}
