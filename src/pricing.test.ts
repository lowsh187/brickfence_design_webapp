import { describe, expect, it } from 'vitest'

import {
  calculateCostPricing,
  calculateMortarMixEstimate,
  calculatePvcFencePanelCounts,
  defaultPricingMap,
  inferPvcFencePanelSize,
  labourPricingKeyForBondPattern,
  selectPvcFencePanel,
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

  it('normalizes custom units with a conversion factor', () => {
    const prices = defaultPricingMap()
    prices.standard_brick = {
      ...prices.standard_brick,
      unit: 'custom',
      unitPrice: 50,
      unitConversionFactor: 10,
      unitConversionNote: 'One box contains 10 bricks.',
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

    expect(pricing.brickCost).toBe(50)
  })
})

describe('PVC fence panel pricing', () => {
  it('selects the shortest panel that covers each bay width', () => {
    expect(selectPvcFencePanel(1.2)?.label).toBe('4ft')
    expect(selectPvcFencePanel(1.5)?.label).toBe('5ft')
    expect(selectPvcFencePanel(1.8)?.label).toBe('6ft')
    expect(selectPvcFencePanel(2.4)?.label).toBe('8ft')
    expect(selectPvcFencePanel(3)?.label).toBe('10ft')
  })

  it('infers PVC panel size from supplier URLs and titles', () => {
    expect(
      inferPvcFencePanelSize(
        'https://example.com/products/detail/36-high-x-6-long-white-t-top-railing',
      ),
    ).toBe('6ft')
    expect(inferPvcFencePanelSize('36" H x 10\' L White T-Top Railing')).toBe('10ft')
  })

  it('counts PVC panels by bay width and prices them per item', () => {
    const prices = defaultPricingMap()
    prices.pvc_fence = {
      ...prices.pvc_fence,
      pvcPanelPrices: {
        ...prices.pvc_fence.pvcPanelPrices,
        '4ft': 100,
        '6ft': 150,
        '8ft': 220,
      },
    }

    expect(calculatePvcFencePanelCounts([1.2, 1.8, 2.4])).toEqual({
      '4ft': 1,
      '6ft': 1,
      '8ft': 1,
    })

    const pricing = calculateCostPricing({
      brickCount: 0,
      mortarVolumeM3: 0,
      renderedLengthM: 5.4,
      renderedHeightM: 0,
      bondPattern: 'english',
      timberFence: 'pvc',
      infillBayWidthsM: [1.2, 1.8, 2.4],
      prices,
    })

    expect(pricing.infillCost).toBe(470)
  })

  it('prices PVC fence per metre when configured for metre pricing', () => {
    const prices = defaultPricingMap()
    prices.pvc_fence = {
      ...prices.pvc_fence,
      unit: 'm',
      unitPrice: 80,
      pvcPricingMode: 'per_m',
    }

    const pricing = calculateCostPricing({
      brickCount: 0,
      mortarVolumeM3: 0,
      renderedLengthM: 10,
      renderedHeightM: 0,
      bondPattern: 'english',
      timberFence: 'pvc',
      infillBayWidthsM: [1.2, 1.8, 2.4],
      prices,
    })

    expect(pricing.infillCost).toBe(432)
  })
})
