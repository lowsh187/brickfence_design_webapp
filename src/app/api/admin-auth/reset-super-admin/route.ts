import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '../../../../../payload.config'
import { SUPER_ADMIN_ROLE } from '../../../../payload/access'
import { isNonEmptyString } from '../../../../payload/adminRecovery'

type AdminDoc = {
  id: number | string
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ message }, { status })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const confirmPassword =
    typeof body?.confirmPassword === 'string' ? body.confirmPassword : ''

  if (!isNonEmptyString(token) || !isNonEmptyString(password) || !isNonEmptyString(confirmPassword)) {
    return badRequest('Token, password, and confirm password are required.')
  }
  if (password !== confirmPassword) {
    return badRequest('Passwords do not match.')
  }

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'admins',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: {
      and: [
        {
          role: {
            equals: SUPER_ADMIN_ROLE,
          },
        },
        {
          resetPasswordToken: {
            equals: token,
          },
        },
        {
          resetPasswordExpiration: {
            greater_than: new Date().toISOString(),
          },
        },
      ],
    },
  })
  const admin = result.docs[0] as AdminDoc | undefined

  if (!admin) {
    return badRequest('Reset token is invalid or has expired.', 403)
  }

  await payload.update({
    collection: 'admins',
    id: admin.id,
    data: {
      password,
      resetPasswordExpiration: new Date().toISOString(),
      resetPasswordToken: null,
    },
    overrideAccess: true,
  })

  return NextResponse.json({
    message: 'Password reset successfully.',
  })
}
