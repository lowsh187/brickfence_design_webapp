export const DEFAULT_PRICING_ITEMS = {
  standard_brick: {
    name: 'Standard brick',
    unit: 'each',
    unitPrice: 1.35,
    currency: 'AUD',
  },
  mortar: {
    name: 'Mortar',
    unit: '20kg_bag',
    unitPrice: 12,
    currency: 'AUD',
  },
  labour: {
    name: 'Bricklaying labour',
    unit: 'm2',
    unitPrice: 95,
    currency: 'AUD',
  },
  timber_fence: {
    name: 'Timber fence infill',
    unit: 'm',
    unitPrice: 55,
    currency: 'AUD',
  },
  pvc_fence: {
    name: 'PVC fence infill',
    unit: 'm',
    unitPrice: 70,
    currency: 'AUD',
  },
} as const

export type PricingKey = keyof typeof DEFAULT_PRICING_ITEMS

export const PRICING_KEYS = Object.keys(DEFAULT_PRICING_ITEMS) as PricingKey[]

export function isPricingKey(value: string | null | undefined): value is PricingKey {
  return PRICING_KEYS.includes(value as PricingKey)
}

export type PricingItem = {
  key: PricingKey
  name: string
  unit: string
  unitPrice: number
  currency: string
}

export type PricingMap = Record<PricingKey, PricingItem>

export type CostPricing = {
  brickCost: number
  mortarCost: number
  mortarDryMixKg: number
  mortarBagCount: number
  labourCost: number
  infillCost: number
  totalCost: number
  currency: string
}

export const MORTAR_DRY_MIX_KG_PER_M3 = 2000
export const MORTAR_BAG_WEIGHT_KG = 20
export const MORTAR_WASTAGE_FACTOR = 1.1

export function normalizeUnitPrice(item: PricingItem): number {
  if (item.key === 'standard_brick' && item.unit === 'per_1000') {
    return item.unitPrice / 1000
  }

  return item.unitPrice
}

export function defaultUnitForPricingKey(
  pricingKey: string | null | undefined,
): string {
  switch (pricingKey) {
    case 'mortar':
      return '20kg_bag'
    case 'labour':
      return 'm2'
    case 'timber_fence':
    case 'pvc_fence':
      return 'm'
    case 'standard_brick':
    default:
      return 'each'
  }
}

export function defaultPricingMap(): PricingMap {
  return Object.fromEntries(
    Object.entries(DEFAULT_PRICING_ITEMS).map(([key, item]) => [
      key,
      { key, ...item },
    ]),
  ) as PricingMap
}

export function calculateMortarMixEstimate(mortarVolumeM3: number): {
  dryMixKg: number
  bagCount: number
} {
  if (!Number.isFinite(mortarVolumeM3) || mortarVolumeM3 <= 0) {
    return { dryMixKg: 0, bagCount: 0 }
  }

  const dryMixKg = mortarVolumeM3 * MORTAR_DRY_MIX_KG_PER_M3 * MORTAR_WASTAGE_FACTOR
  const bagCount = Math.ceil(dryMixKg / MORTAR_BAG_WEIGHT_KG)

  return {
    dryMixKg,
    bagCount,
  }
}

function calculateMortarCost(mortarVolumeM3: number, mortarPrice: PricingItem): {
  cost: number
  dryMixKg: number
  bagCount: number
} {
  const estimate = calculateMortarMixEstimate(mortarVolumeM3)
  const unitPrice = normalizeUnitPrice(mortarPrice)

  if (mortarPrice.unit === '20kg_bag') {
    return {
      cost: estimate.bagCount * unitPrice,
      dryMixKg: estimate.dryMixKg,
      bagCount: estimate.bagCount,
    }
  }

  return {
    cost: mortarVolumeM3 * unitPrice,
    dryMixKg: estimate.dryMixKg,
    bagCount: estimate.bagCount,
  }
}

export function calculateCostPricing(params: {
  brickCount: number
  mortarVolumeM3: number
  renderedLengthM: number
  renderedHeightM: number
  timberFence: string
  prices: PricingMap
}): CostPricing {
  const brickCost = params.brickCount * normalizeUnitPrice(params.prices.standard_brick)
  const mortar = calculateMortarCost(params.mortarVolumeM3, params.prices.mortar)
  const labourCost = 0
  const infillCost =
    params.timberFence === 'timber'
      ? params.renderedLengthM * normalizeUnitPrice(params.prices.timber_fence)
      : params.timberFence === 'pvc'
      ? params.renderedLengthM * normalizeUnitPrice(params.prices.pvc_fence)
      : 0

  return {
    brickCost,
    mortarCost: mortar.cost,
    mortarDryMixKg: mortar.dryMixKg,
    mortarBagCount: mortar.bagCount,
    labourCost,
    infillCost,
    totalCost: brickCost + mortar.cost + labourCost + infillCost,
    currency: params.prices.standard_brick.currency,
  }
}

export function formatCurrency(value: number, currency = 'AUD'): string {
  if (!Number.isFinite(value)) return '$0.00'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
  }).format(value)
}

export function formatPricingUnit(unit: string | null | undefined): string {
  switch (unit) {
    case 'each':
      return 'each'
    case 'per_1000':
      return 'per 1000'
    case 'm3':
      return 'per cubic metre'
    case 'm2':
      return 'per square metre'
    case 'm':
      return 'per metre'
    case '20kg_bag':
      return 'per 20kg bag'
    default:
      return unit || ''
  }
}

export function formatPriceWithUnit(
  price: number | null | undefined,
  unit: string | null | undefined,
): string {
  if (typeof price !== 'number' || !Number.isFinite(price)) return ''
  return `${price} ${formatPricingUnit(unit)}`.trim()
}
