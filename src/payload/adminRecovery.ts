import crypto from 'node:crypto'

import {
  SUPER_ADMIN_ANIMAL_QUESTION,
  SUPER_ADMIN_FOOD_QUESTION,
} from './adminSecurityQuestions'

export const SUPER_ADMIN_RESET_TOKEN_TTL_MS = 15 * 60 * 1000

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizeSecurityAnswer(answer: string): string {
  return answer.trim().toLowerCase()
}

export function hashSecurityAnswer(answer: string): string {
  return crypto
    .createHash('sha256')
    .update(normalizeSecurityAnswer(answer))
    .digest('hex')
}

export function compareSecurityAnswer(answer: string, expectedHash: string | null | undefined): boolean {
  if (!expectedHash) return false

  return hashSecurityAnswer(answer) === expectedHash
}

export function createRecoveryToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export {
  SUPER_ADMIN_ANIMAL_QUESTION,
  SUPER_ADMIN_FOOD_QUESTION,
}
