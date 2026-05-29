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
  it('creates the bond-specific labour and material defaults', async () => {
    const payload = createPayloadStub()

    await seedDefaultPricingItems(payload)

    const createdData = payload.create.mock.calls.map(([call]) => call.data)

    expect(payload.create).toHaveBeenCalledTimes(13)
    expect(createdData.map((data) => data.key)).toEqual([
      'stretcher_bond_labour_cost',
      'stack_bond_labour_cost',
      'header_bond_labour_cost',
      'english_bond_labour_cost',
      'english_garden_bond_labour_cost',
      'flemish_bond_labour_cost',
      'flemish_garden_bond_labour_cost',
      'mortar',
      'standard_brick',
      'custom_brick',
      'timber_picket',
      'timber_screening_slat',
      'pvc_fence',
    ])
    expect(createdData.every((data) => data.priceSource === 'manual')).toBe(true)
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
      ['mortar', 10],
      ['standard_brick', 1],
      ['custom_brick', 1],
      ['timber_picket', 4],
      ['timber_screening_slat', 4],
      ['pvc_fence', 50],
    ])
    expect(createdData.find((data) => data.key === 'mortar')).toMatchObject({
      category: 'mortar',
      unit: 'per_bag',
      bagWeightKg: 20,
    })
    expect(createdData.find((data) => data.key === 'standard_brick')).toMatchObject({
      category: 'brick',
      unit: 'each',
    })
    expect(createdData.find((data) => data.key === 'custom_brick')).toMatchObject({
      category: 'brick',
      unit: 'each',
    })
    expect(createdData.find((data) => data.key === 'timber_picket')).toMatchObject({
      category: 'infill',
      unit: 'each',
    })
    expect(createdData.find((data) => data.key === 'timber_screening_slat')).toMatchObject({
      category: 'infill',
      unit: 'm',
    })
    expect(createdData.find((data) => data.key === 'pvc_fence')).toMatchObject({
      category: 'infill',
      unit: 'm',
      pvcPricingMode: 'per_m',
    })
  })

  it('does not overwrite existing seeded rows', async () => {
    const payload = createPayloadStub(['english_bond_labour_cost', 'mortar'])

    await seedDefaultPricingItems(payload)

    const createdKeys = payload.create.mock.calls.map(([call]) => call.data.key)

    expect(payload.create).toHaveBeenCalledTimes(11)
    expect(createdKeys).not.toContain('english_bond_labour_cost')
    expect(createdKeys).not.toContain('mortar')
    expect(createdKeys).not.toContain('labour')
  })
})
