import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '../../../../../payload.config'
import { SUPER_ADMIN_ROLE } from '../../../../payload/access'
import {
  SUPER_ADMIN_RESET_TOKEN_TTL_MS,
  compareSecurityAnswer,
  createRecoveryToken,
  isNonEmptyString,
  normalizeEmail,
} from '../../../../payload/adminRecovery'

type AdminDoc = {
  email?: string | null
  id: number | string
  role?: string | null
  securityQuestionAnimalHash?: string | null
  securityQuestionFoodHash?: string | null
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ message }, { status })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : ''
  const securityQuestionAnimalAnswer =
    typeof body?.securityQuestionAnimalAnswer === 'string'
      ? body.securityQuestionAnimalAnswer
      : ''
  const securityQuestionFoodAnswer =
    typeof body?.securityQuestionFoodAnswer === 'string'
      ? body.securityQuestionFoodAnswer
      : ''

  if (
    !isNonEmptyString(email) ||
    !isNonEmptyString(securityQuestionAnimalAnswer) ||
    !isNonEmptyString(securityQuestionFoodAnswer)
  ) {
    return badRequest('Email and both security answers are required.')
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
          email: {
            equals: email,
          },
        },
        {
          role: {
            equals: SUPER_ADMIN_ROLE,
          },
        },
      ],
    },
  })
  const admin = result.docs[0] as AdminDoc | undefined

  if (!admin) {
    return badRequest('Super admin verification failed.', 403)
  }

  const answersMatch =
    compareSecurityAnswer(securityQuestionAnimalAnswer, admin.securityQuestionAnimalHash) &&
    compareSecurityAnswer(securityQuestionFoodAnswer, admin.securityQuestionFoodHash)

  if (!answersMatch) {
    return badRequest('Super admin verification failed.', 403)
  }

  const token = createRecoveryToken()
  await payload.update({
    collection: 'admins',
    id: admin.id,
    data: {
      resetPasswordExpiration: new Date(Date.now() + SUPER_ADMIN_RESET_TOKEN_TTL_MS).toISOString(),
      resetPasswordToken: token,
    },
    overrideAccess: true,
  })

  return NextResponse.json({
    token,
  })
}
