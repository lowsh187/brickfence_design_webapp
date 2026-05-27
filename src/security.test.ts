import { describe, expect, it } from 'vitest'

import {
  assertSafeSupplierUrl,
  createFixedWindowRateLimiter,
  isAllowedSameOriginRequest,
  isPrivateHostname,
} from './security'

describe('supplier security helpers', () => {
  it('detects localhost and private network hosts', () => {
    expect(isPrivateHostname('localhost')).toBe(true)
    expect(isPrivateHostname('127.0.0.1')).toBe(true)
    expect(isPrivateHostname('10.0.0.5')).toBe(true)
    expect(isPrivateHostname('172.16.0.5')).toBe(true)
    expect(isPrivateHostname('192.168.1.20')).toBe(true)
    expect(isPrivateHostname('169.254.169.254')).toBe(true)
    expect(isPrivateHostname('example.com')).toBe(false)
  })

  it('rejects unsafe supplier URL schemes and private hosts', async () => {
    await expect(assertSafeSupplierUrl('file:///etc/passwd')).rejects.toThrow(
      'http or https',
    )
    await expect(assertSafeSupplierUrl('http://127.0.0.1:3000')).rejects.toThrow(
      'localhost or private network',
    )
    await expect(assertSafeSupplierUrl('https://user:pass@example.com')).rejects.toThrow(
      'embedded credentials',
    )
  })

  it('allows same-origin requests and rejects cross-origin requests', () => {
    expect(
      isAllowedSameOriginRequest(
        new Request('https://example.com/admin/fetch-supplier-prices', {
          headers: { origin: 'https://example.com' },
        }),
      ),
    ).toBe(true)

    expect(
      isAllowedSameOriginRequest(
        new Request('https://example.com/admin/fetch-supplier-prices', {
          headers: { origin: 'https://attacker.example' },
        }),
      ),
    ).toBe(false)
  })

  it('limits requests in a fixed window', () => {
    const limiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 1000 })

    expect(limiter('admin:local', 1000).allowed).toBe(true)
    expect(limiter('admin:local', 1100).allowed).toBe(true)
    expect(limiter('admin:local', 1200).allowed).toBe(false)
    expect(limiter('admin:local', 2101).allowed).toBe(true)
  })
})
