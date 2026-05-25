import { describe, expect, it } from 'vitest'

import { isSafeAIPriceParse } from './supplierPriceAI'

describe('isSafeAIPriceParse', () => {
  it('rejects high standard brick prices marked as each', () => {
    expect(
      isSafeAIPriceParse(
        {
          bagWeightKg: null,
          confidence: 0.95,
          evidence: '$1,929',
          price: 1929,
          reason: 'Price found without a quantity unit.',
          unit: 'each',
          unitQuantity: null,
        },
        'standard_brick',
      ),
    ).toBe(false)
  })

  it('accepts high standard brick prices with a valid quantity unit', () => {
    expect(
      isSafeAIPriceParse(
        {
          bagWeightKg: null,
          confidence: 0.95,
          evidence: '$1,929 per 1000',
          price: 1929,
          reason: 'Price block states per 1000.',
          unit: 'per_quantity',
          unitQuantity: 1000,
        },
        'standard_brick',
      ),
    ).toBe(true)
  })
})
