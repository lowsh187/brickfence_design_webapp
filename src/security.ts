import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const PRIVATE_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
])

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }

  const [a, b] = parts
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isPrivateIPv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('ff')
  )
}

export function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!normalized) return true
  if (PRIVATE_HOSTS.has(normalized)) return true

  const ipVersion = isIP(normalized)
  if (ipVersion === 4) return isPrivateIPv4(normalized)
  if (ipVersion === 6) return isPrivateIPv6(normalized)

  return false
}

export async function assertSafeSupplierUrl(url: string): Promise<URL> {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Supplier URL is invalid.')
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Supplier URL must use http or https.')
  }

  if (parsed.username || parsed.password) {
    throw new Error('Supplier URL must not include embedded credentials.')
  }

  if (isPrivateHostname(parsed.hostname)) {
    throw new Error('Supplier URL cannot point to localhost or private network addresses.')
  }

  try {
    const addresses = await lookup(parsed.hostname, { all: true, verbatim: false })
    if (addresses.some((address) => isPrivateHostname(address.address))) {
      throw new Error('Supplier URL resolves to a private network address.')
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('private network')) {
      throw error
    }
    throw new Error('Supplier URL hostname could not be verified.')
  }

  return parsed
}

export function isAllowedSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

export function getClientRateLimitKey(request: Request, userID?: string | number | null): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIP = request.headers.get('x-real-ip')?.trim()
  return `${userID ?? 'anonymous'}:${forwardedFor || realIP || 'local'}`
}

export function createFixedWindowRateLimiter(options: {
  limit: number
  windowMs: number
}) {
  const attempts = new Map<string, { count: number; resetAt: number }>()

  return (key: string, now = Date.now()) => {
    const current = attempts.get(key)
    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + options.windowMs })
      return { allowed: true, remaining: options.limit - 1, resetAt: now + options.windowMs }
    }

    if (current.count >= options.limit) {
      return { allowed: false, remaining: 0, resetAt: current.resetAt }
    }

    current.count += 1
    return {
      allowed: true,
      remaining: Math.max(0, options.limit - current.count),
      resetAt: current.resetAt,
    }
  }
}
