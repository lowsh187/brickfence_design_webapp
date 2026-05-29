import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '../../../../../payload.config'
import { countAdmins } from '../../../../payload/adminSecurity'
import {
  SUPER_ADMIN_ROLE,
} from '../../../../payload/access'
import {
  isNonEmptyString,
  normalizeEmail,
} from '../../../../payload/adminRecovery'

function badRequest(message: string, status = 400) {
  return NextResponse.json({ message }, { status })
}

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const existingAdminCount = await countAdmins(payload)

  if (existingAdminCount > 0) {
    return badRequest('First user registration is no longer available.', 403)
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const confirmPassword =
    typeof body?.confirmPassword === 'string' ? body.confirmPassword : ''
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const securityQuestionAnimalAnswer =
    typeof body?.securityQuestionAnimalAnswer === 'string'
      ? body.securityQuestionAnimalAnswer
      : ''
  const securityQuestionFoodAnswer =
    typeof body?.securityQuestionFoodAnswer === 'string'
      ? body.securityQuestionFoodAnswer
      : ''

  if (!isNonEmptyString(email) || !isNonEmptyString(password) || !isNonEmptyString(confirmPassword)) {
    return badRequest('Email, password, and confirm password are required.')
  }
  if (password !== confirmPassword) {
    return badRequest('Passwords do not match.')
  }
  if (
    !isNonEmptyString(securityQuestionAnimalAnswer) ||
    !isNonEmptyString(securityQuestionFoodAnswer)
  ) {
    return badRequest('Both security question answers are required.')
  }

  await payload.create({
    collection: 'admins',
    data: {
      email,
      name,
      password,
      role: SUPER_ADMIN_ROLE,
      securityQuestionAnimalAnswer,
      securityQuestionFoodAnswer,
    },
    overrideAccess: true,
  })

  return NextResponse.json({
    message: 'Super admin account created successfully.',
  }, { status: 201 })
}
