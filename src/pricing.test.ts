import { describe, expect, it } from 'vitest'

import {
  calculateCostPricing,
  calculateMortarMixEstimate,
  defaultPricingMap,
  labourPricingKeyForBondPattern,
} from './pricing'

describe('labour pricing', () => {
  it('maps bond patterns to their labour pricing keys', () => {
    expect(labourPricingKeyForBondPattern('english')).toBe('english_bond_labour_cost')
    expect(labourPricingKeyForBondPattern('flemishGarden')).toBe(
      'flemish_garden_bond_labour_cost',
    )
  })

  it('uses the selected bond pattern labour price for labour cost', () => {
    const prices = defaultPricingMap()
    prices.english_bond_labour_cost = {
      ...prices.english_bond_labour_cost,
      unitPrice: 120,
    }

    const pricing = calculateCostPricing({
      brickCount: 10,
      mortarVolumeM3: 0,
      renderedLengthM: 5,
      renderedHeightM: 2,
      bondPattern: 'english',
      timberFence: 'none',
      prices,
    })

    expect(pricing.labourCost).toBe(1200)
  })
})

describe('mortar pricing', () => {
  it('uses the configured bag weight when estimating mortar bags', () => {
    const estimate = calculateMortarMixEstimate(1, 25)

    expect(estimate.dryMixKg).toBe(2200)
    expect(estimate.bagCount).toBe(88)
  })

  it('uses per-bag mortar pricing with the configured bag weight', () => {
    const prices = defaultPricingMap()
    prices.mortar = {
      ...prices.mortar,
      unit: 'per_bag',
      unitPrice: 10,
      bagWeightKg: 25,
    }

    const pricing = calculateCostPricing({
      brickCount: 0,
      mortarVolumeM3: 1,
      renderedLengthM: 0,
      renderedHeightM: 0,
      bondPattern: 'english',
      timberFence: 'none',
      prices,
    })

    expect(pricing.mortarBagCount).toBe(88)
    expect(pricing.mortarCost).toBe(880)
  })
})

describe('quantity-based brick pricing', () => {
  it('normalizes standard brick prices by the configured quantity', () => {
    const prices = defaultPricingMap()
    prices.standard_brick = {
      ...prices.standard_brick,
      unit: 'per_quantity',
      unitPrice: 960,
      unitQuantity: 500,
    }

    const pricing = calculateCostPricing({
      brickCount: 10,
      mortarVolumeM3: 0,
      renderedLengthM: 0,
      renderedHeightM: 0,
      bondPattern: 'english',
      timberFence: 'none',
      prices,
    })

    expect(pricing.brickCost).toBe(19.2)
  })
})
