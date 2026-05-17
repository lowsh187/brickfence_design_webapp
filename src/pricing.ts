export const DEFAULT_PRICING_ITEMS = {
  standard_brick: {
    name: 'Standard brick',
    unit: 'each',
    unitPrice: 1.35,
    currency: 'AUD',
  },
  mortar: {
    name: 'Mortar',
    unit: 'm3',
    unitPrice: 220,
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
  labourCost: number
  infillCost: number
  totalCost: number
  currency: string
}

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
      return 'm3'
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

export function calculateCostPricing(params: {
  brickCount: number
  mortarVolumeM3: number
  renderedLengthM: number
  renderedHeightM: number
  timberFence: string
  prices: PricingMap
}): CostPricing {
  const wallAreaM2 = params.renderedLengthM * params.renderedHeightM
  const brickCost = params.brickCount * normalizeUnitPrice(params.prices.standard_brick)
  const mortarCost = params.mortarVolumeM3 * normalizeUnitPrice(params.prices.mortar)
  const labourCost = wallAreaM2 * normalizeUnitPrice(params.prices.labour)
  const infillCost =
    params.timberFence === 'timber'
      ? params.renderedLengthM * normalizeUnitPrice(params.prices.timber_fence)
      : params.timberFence === 'pvc'
      ? params.renderedLengthM * normalizeUnitPrice(params.prices.pvc_fence)
      : 0

  return {
    brickCost,
    mortarCost,
    labourCost,
    infillCost,
    totalCost: brickCost + mortarCost + labourCost + infillCost,
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
