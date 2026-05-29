import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '../../../../../payload.config'
import { ADMIN_ROLE } from '../../../../payload/access'
import { countAdmins } from '../../../../payload/adminSecurity'
import { isNonEmptyString, normalizeEmail } from '../../../../payload/adminRecovery'

function badRequest(message: string, status = 400) {
  return NextResponse.json({ message }, { status })
}

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const existingAdminCount = await countAdmins(payload)

  if (existingAdminCount === 0) {
    return badRequest('The first account must be created as a super admin.', 403)
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const confirmPassword =
    typeof body?.confirmPassword === 'string' ? body.confirmPassword : ''
  const name = typeof body?.name === 'string' ? body.name.trim() : ''

  if (!isNonEmptyString(email) || !isNonEmptyString(password) || !isNonEmptyString(confirmPassword)) {
    return badRequest('Email, password, and confirm password are required.')
  }
  if (password !== confirmPassword) {
    return badRequest('Passwords do not match.')
  }

  await payload.create({
    collection: 'admins',
    context: {
      forcePublicAdminRole: true,
    },
    data: {
      email,
      name,
      password,
      role: ADMIN_ROLE,
    },
    overrideAccess: true,
  })

  return NextResponse.json({
    message: 'Admin account created successfully.',
  }, { status: 201 })
}
