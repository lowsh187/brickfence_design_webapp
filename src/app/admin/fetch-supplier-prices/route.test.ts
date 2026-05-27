import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.fn()

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('../../../../payload.config', () => ({
  default: {},
}))

vi.mock('payload', () => ({
  buildConfig: vi.fn((config) => config),
  getPayload: vi.fn(async () => ({
    auth: authMock,
  })),
}))

describe('fetch supplier prices route security', () => {
  beforeEach(() => {
    authMock.mockReset()
  })

  it('rejects unauthenticated requests', async () => {
    authMock.mockResolvedValue({ user: null })
    const { POST } = await import('./route')

    const response = await POST(
      new Request('https://example.com/admin/fetch-supplier-prices', {
        method: 'POST',
      }),
    )

    expect(response.status).toBe(401)
  })

  it('rejects cross-origin authenticated requests', async () => {
    authMock.mockResolvedValue({
      user: {
        collection: 'admins',
        id: 'admin-1',
      },
    })
    const { POST } = await import('./route')

    const response = await POST(
      new Request('https://example.com/admin/fetch-supplier-prices', {
        headers: {
          origin: 'https://attacker.example',
        },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(403)
  })
})
