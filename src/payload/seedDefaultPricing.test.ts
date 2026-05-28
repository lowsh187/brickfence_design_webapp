import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { seedDefaultPricingItems } from './seedDefaultPricing'

function createPayloadStub(existingKeys: string[] = []) {
  const existing = new Set(existingKeys)
  const create = vi.fn(async ({ data }) => ({ id: data.key, ...data }))
  const find = vi.fn(async ({ where }) => {
    const key = where?.key?.equals

    return {
      docs: typeof key === 'string' && existing.has(key) ? [{ id: key }] : [],
    }
  })

  return {
    create,
    find,
  } as unknown as Payload & {
    create: typeof create
    find: typeof find
  }
}

describe('seedDefaultPricingItems', () => {
  it('creates the seven bond-specific labour defaults', async () => {
    const payload = createPayloadStub()

    await seedDefaultPricingItems(payload)

    const createdData = payload.create.mock.calls.map(([call]) => call.data)

    expect(payload.create).toHaveBeenCalledTimes(7)
    expect(createdData.map((data) => data.key)).toEqual([
      'stretcher_bond_labour_cost',
      'stack_bond_labour_cost',
      'header_bond_labour_cost',
      'english_bond_labour_cost',
      'english_garden_bond_labour_cost',
      'flemish_bond_labour_cost',
      'flemish_garden_bond_labour_cost',
    ])
    expect(createdData.every((data) => data.category === 'labour')).toBe(true)
    expect(createdData.every((data) => data.priceSource === 'manual')).toBe(true)
    expect(createdData.every((data) => data.unit === 'per_brick')).toBe(true)
    expect(
      createdData.map((data) => [data.key, data.manualUnitPrice]),
    ).toEqual([
      ['stretcher_bond_labour_cost', 2],
      ['stack_bond_labour_cost', 2],
      ['header_bond_labour_cost', 2],
      ['english_bond_labour_cost', 3],
      ['english_garden_bond_labour_cost', 3],
      ['flemish_bond_labour_cost', 3],
      ['flemish_garden_bond_labour_cost', 3],
    ])
  })

  it('does not overwrite existing labour rows', async () => {
    const payload = createPayloadStub(['english_bond_labour_cost'])

    await seedDefaultPricingItems(payload)

    const createdKeys = payload.create.mock.calls.map(([call]) => call.data.key)

    expect(payload.create).toHaveBeenCalledTimes(6)
    expect(createdKeys).not.toContain('english_bond_labour_cost')
    expect(createdKeys).not.toContain('labour')
  })
})
