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

  it('accepts PVC prices when they are per item or per metre', () => {
    expect(
      isSafeAIPriceParse(
        {
          bagWeightKg: null,
          confidence: 0.95,
          evidence: '36" H x 6\' L $148.15 Measurement Unit: Ea',
          price: 148.15,
          reason: 'Main 6ft PVC panel sale price.',
          unit: 'each',
          unitQuantity: null,
        },
        'pvc_fence',
      ),
    ).toBe(true)

    expect(
      isSafeAIPriceParse(
        {
          bagWeightKg: null,
          confidence: 0.95,
          evidence: '$148.15 per metre',
          price: 148.15,
          reason: 'Per metre PVC price.',
          unit: 'm',
          unitQuantity: null,
        },
        'pvc_fence',
      ),
    ).toBe(true)
  })

  it('requires a conversion factor for custom units', () => {
    expect(
      isSafeAIPriceParse(
        {
          bagWeightKg: null,
          confidence: 0.95,
          evidence: '$50 per box of 10',
          price: 50,
          reason: 'Custom box unit detected.',
          unit: 'custom',
          unitConversionFactor: null,
          unitConversionNote: null,
          unitQuantity: null,
        },
        'standard_brick',
      ),
    ).toBe(false)

    expect(
      isSafeAIPriceParse(
        {
          bagWeightKg: null,
          confidence: 0.95,
          evidence: '$50 per box of 10',
          price: 50,
          reason: 'Custom box unit detected.',
          unit: 'custom',
          unitConversionFactor: 10,
          unitConversionNote: 'One box contains 10 bricks.',
          unitQuantity: null,
        },
        'standard_brick',
      ),
    ).toBe(true)
  })
})
