export const DEFAULT_PRICING_ITEMS = {
  standard_brick: {
    name: 'Standard brick',
    unit: 'each',
    unitPrice: 1.35,
    currency: 'AUD',
  },
  mortar: {
    name: 'Mortar',
    unit: 'per_bag',
    unitPrice: 12,
    bagWeightKg: 20,
    currency: 'AUD',
  },
  labour: {
    name: 'Bricklaying labour fallback',
    unit: 'per_brick',
    unitPrice: 95,
    currency: 'AUD',
  },
  stretcher_bond_labour_cost: {
    name: 'Stretcher bond labour cost',
    unit: 'per_brick',
    unitPrice: 95,
    currency: 'AUD',
  },
  stack_bond_labour_cost: {
    name: 'Stack bond labour cost',
    unit: 'per_brick',
    unitPrice: 95,
    currency: 'AUD',
  },
  header_bond_labour_cost: {
    name: 'Header bond labour cost',
    unit: 'per_brick',
    unitPrice: 95,
    currency: 'AUD',
  },
  english_bond_labour_cost: {
    name: 'English bond labour cost',
    unit: 'per_brick',
    unitPrice: 95,
    currency: 'AUD',
  },
  english_garden_bond_labour_cost: {
    name: 'English garden bond labour cost',
    unit: 'per_brick',
    unitPrice: 95,
    currency: 'AUD',
  },
  flemish_bond_labour_cost: {
    name: 'Flemish bond labour cost',
    unit: 'per_brick',
    unitPrice: 95,
    currency: 'AUD',
  },
  flemish_garden_bond_labour_cost: {
    name: 'Flemish garden bond labour cost',
    unit: 'per_brick',
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

export const LABOUR_PRICING_KEYS = [
  'labour',
  'stretcher_bond_labour_cost',
  'stack_bond_labour_cost',
  'header_bond_labour_cost',
  'english_bond_labour_cost',
  'english_garden_bond_labour_cost',
  'flemish_bond_labour_cost',
  'flemish_garden_bond_labour_cost',
] as const satisfies readonly PricingKey[]

export type LabourPricingKey = (typeof LABOUR_PRICING_KEYS)[number]

export const LABOUR_PRICING_KEY_BY_BOND_PATTERN: Record<string, LabourPricingKey> = {
  stretcher: 'stretcher_bond_labour_cost',
  stack: 'stack_bond_labour_cost',
  header: 'header_bond_labour_cost',
  english: 'english_bond_labour_cost',
  englishGarden: 'english_garden_bond_labour_cost',
  flemish: 'flemish_bond_labour_cost',
  flemishGarden: 'flemish_garden_bond_labour_cost',
}

export function isPricingKey(value: string | null | undefined): value is PricingKey {
  return PRICING_KEYS.includes(value as PricingKey)
}

export function isLabourPricingKey(
  value: string | null | undefined,
): value is LabourPricingKey {
  return LABOUR_PRICING_KEYS.includes(value as LabourPricingKey)
}

export type PricingItem = {
  key: PricingKey
  name: string
  unit: string
  unitPrice: number
  unitQuantity?: number
  bagWeightKg?: number
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
export const DEFAULT_MORTAR_BAG_WEIGHT_KG = 20
export const MORTAR_WASTAGE_FACTOR = 1.1

export function normalizeUnitPrice(item: PricingItem): number {
  if (item.key === 'standard_brick' && item.unit === 'per_1000') {
    return item.unitPrice / 1000
  }

  if (item.key === 'standard_brick' && item.unit === 'per_quantity') {
    const quantity =
      typeof item.unitQuantity === 'number' &&
      Number.isFinite(item.unitQuantity) &&
      item.unitQuantity > 0
        ? item.unitQuantity
        : 1

    return item.unitPrice / quantity
  }

  return item.unitPrice
}

export function defaultUnitForPricingKey(
  pricingKey: string | null | undefined,
): string {
  switch (pricingKey) {
    case 'mortar':
      return 'per_bag'
    case 'timber_fence':
    case 'pvc_fence':
      return 'm'
    case 'standard_brick':
    default:
      if (isLabourPricingKey(pricingKey)) return 'per_brick'
      return 'each'
  }
}

export function labourPricingKeyForBondPattern(
  bondPattern: string | null | undefined,
): LabourPricingKey {
  return bondPattern
    ? LABOUR_PRICING_KEY_BY_BOND_PATTERN[bondPattern] ?? 'labour'
    : 'labour'
}

export function defaultPricingMap(): PricingMap {
  return Object.fromEntries(
    Object.entries(DEFAULT_PRICING_ITEMS).map(([key, item]) => [
      key,
      { key, ...item },
    ]),
  ) as PricingMap
}

export function calculateMortarMixEstimate(
  mortarVolumeM3: number,
  bagWeightKg = DEFAULT_MORTAR_BAG_WEIGHT_KG,
): {
  dryMixKg: number
  bagCount: number
} {
  if (!Number.isFinite(mortarVolumeM3) || mortarVolumeM3 <= 0) {
    return { dryMixKg: 0, bagCount: 0 }
  }

  const dryMixKg = mortarVolumeM3 * MORTAR_DRY_MIX_KG_PER_M3 * MORTAR_WASTAGE_FACTOR
  const validBagWeight =
    Number.isFinite(bagWeightKg) && bagWeightKg > 0
      ? bagWeightKg
      : DEFAULT_MORTAR_BAG_WEIGHT_KG
  const bagCount = Math.ceil(dryMixKg / validBagWeight)

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
  const estimate = calculateMortarMixEstimate(
    mortarVolumeM3,
    mortarPrice.bagWeightKg,
  )
  const unitPrice = normalizeUnitPrice(mortarPrice)

  if (mortarPrice.unit === 'per_bag' || mortarPrice.unit === '20kg_bag') {
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
  bondPattern: string
  timberFence: string
  prices: PricingMap
}): CostPricing {
  const labourKey = labourPricingKeyForBondPattern(params.bondPattern)
  const labourPrice = params.prices[labourKey] ?? params.prices.labour
  const brickCost = params.brickCount * normalizeUnitPrice(params.prices.standard_brick)
  const mortar = calculateMortarCost(params.mortarVolumeM3, params.prices.mortar)
  const labourCost = params.brickCount * normalizeUnitPrice(labourPrice)
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
    case 'per_quantity':
      return 'per quantity'
    case 'per_brick':
      return 'per brick'
    case 'm3':
      return 'per cubic metre'
    case 'm2':
      return 'per square metre'
    case 'm':
      return 'per metre'
    case '20kg_bag':
      return 'per 20kg bag'
    case 'per_bag':
      return 'per bag'
    case 'custom':
      return 'custom unit'
    default:
      return unit || ''
  }
}

export function formatPriceUnitLabel(item: {
  unit?: string | null
  unitQuantity?: number | null
}): string {
  if (item.unit === 'per_quantity') {
    const quantity = item.unitQuantity
    return typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0
      ? `per ${quantity}`
      : 'per quantity'
  }

  return formatPricingUnit(item.unit)
}

export function formatPriceWithUnit(
  price: number | null | undefined,
  unit: string | null | undefined,
  unitQuantity?: number | null,
): string {
  if (typeof price !== 'number' || !Number.isFinite(price)) return ''
  return `${price} ${formatPriceUnitLabel({ unit, unitQuantity })}`.trim()
}
