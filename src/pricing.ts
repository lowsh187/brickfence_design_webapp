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
    unitPrice: 2,
    currency: 'AUD',
  },
  stack_bond_labour_cost: {
    name: 'Stack bond labour cost',
    unit: 'per_brick',
    unitPrice: 2,
    currency: 'AUD',
  },
  header_bond_labour_cost: {
    name: 'Header bond labour cost',
    unit: 'per_brick',
    unitPrice: 2,
    currency: 'AUD',
  },
  english_bond_labour_cost: {
    name: 'English bond labour cost',
    unit: 'per_brick',
    unitPrice: 3,
    currency: 'AUD',
  },
  english_garden_bond_labour_cost: {
    name: 'English garden bond labour cost',
    unit: 'per_brick',
    unitPrice: 3,
    currency: 'AUD',
  },
  flemish_bond_labour_cost: {
    name: 'Flemish bond labour cost',
    unit: 'per_brick',
    unitPrice: 3,
    currency: 'AUD',
  },
  flemish_garden_bond_labour_cost: {
    name: 'Flemish garden bond labour cost',
    unit: 'per_brick',
    unitPrice: 3,
    currency: 'AUD',
  },
  timber_fence: {
    name: 'Timber fence infill',
    unit: 'm',
    unitPrice: 55,
    currency: 'AUD',
  },
  pvc_fence: {
    name: 'PVC fence',
    unit: 'each',
    unitPrice: 148.15,
    pvcPricingMode: 'panel',
    pvcPanelPrices: {
      '4ft': 110,
      '5ft': 130,
      '6ft': 148.15,
      '8ft': 227.81,
      '10ft': 309.39,
    },
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

export const PVC_FENCE_PANEL_SPECS = [
  { label: '4ft', maxWidthM: 1.219 },
  { label: '5ft', maxWidthM: 1.524 },
  { label: '6ft', maxWidthM: 1.829 },
  { label: '8ft', maxWidthM: 2.438 },
  { label: '10ft', maxWidthM: 3.048 },
] as const satisfies ReadonlyArray<{
  label: string
  maxWidthM: number
}>

export type PvcFencePanelSize = (typeof PVC_FENCE_PANEL_SPECS)[number]['label']

export type PvcPanelPriceMap = Partial<Record<PvcFencePanelSize, number>>

export type PvcPricingMode = 'panel' | 'per_m'

export function isPvcFencePricingKey(value: string | null | undefined): value is 'pvc_fence' {
  return value === 'pvc_fence'
}

export function inferPvcFencePanelSize(
  value: string | null | undefined,
): PvcFencePanelSize | undefined {
  if (!value) return undefined
  const normalized = value.toLowerCase()
  const match =
    normalized.match(/\b(4|5|6|8|10)\s*(?:ft|'|’)\s*(?:l|long)?\b/) ??
    normalized.match(/\b(?:x|-)(4|5|6|8|10)(?:-|_)?long\b/) ??
    normalized.match(/\b(4|5|6|8|10)-long\b/)
  const size = match?.[1] ? `${match[1]}ft` : undefined

  return PVC_FENCE_PANEL_SPECS.some((spec) => spec.label === size)
    ? (size as PvcFencePanelSize)
    : undefined
}

export function normalizePvcPanelPrices(
  input: PvcPanelPriceMap | null | undefined,
  fallbackPrice?: number,
): {
  explicitCount: number
  missingSizes: PvcFencePanelSize[]
  prices: Record<PvcFencePanelSize, number>
  warning: string
} {
  const sizes = PVC_FENCE_PANEL_SPECS.map((spec) => spec.label)
  const explicitPrices = sizes
    .map((size) => ({
      price: input?.[size],
      size,
    }))
    .filter((item): item is { price: number; size: PvcFencePanelSize } =>
      typeof item.price === 'number' && Number.isFinite(item.price) && item.price > 0,
    )
  const explicitCount = explicitPrices.length
  const firstKnownPrice =
    explicitPrices[0]?.price ??
    (typeof fallbackPrice === 'number' && Number.isFinite(fallbackPrice) && fallbackPrice > 0
      ? fallbackPrice
      : 0)
  const prices = {} as Record<PvcFencePanelSize, number>
  const missingSizes: PvcFencePanelSize[] = []

  for (let index = 0; index < sizes.length; index++) {
    const size = sizes[index]
    const explicitPrice = input?.[size]
    if (typeof explicitPrice === 'number' && Number.isFinite(explicitPrice) && explicitPrice > 0) {
      prices[size] = explicitPrice
      continue
    }

    missingSizes.push(size)
    const nextLarger = sizes
      .slice(index + 1)
      .map((largerSize) => input?.[largerSize])
      .find((price) => typeof price === 'number' && Number.isFinite(price) && price > 0)
    const previousSmaller = sizes
      .slice(0, index)
      .reverse()
      .map((smallerSize) => input?.[smallerSize])
      .find((price) => typeof price === 'number' && Number.isFinite(price) && price > 0)

    prices[size] =
      typeof nextLarger === 'number'
        ? nextLarger
        : typeof previousSmaller === 'number'
          ? previousSmaller
          : firstKnownPrice
  }

  let warning = ''
  if (explicitCount === 1) {
    warning =
      'Only one PVC panel size price was entered. All PVC panel sizes will use that price by default.'
  } else if (missingSizes.length > 0 && explicitCount > 1) {
    warning = `Missing PVC panel prices: ${missingSizes.join(', ')}. Missing sizes use the next larger size price where available.`
  } else if (explicitCount === 0) {
    warning =
      'No PVC panel size prices were entered. PVC panel sizes will use the default unit price until prices are entered.'
  }

  return {
    explicitCount,
    missingSizes,
    prices,
    warning,
  }
}

export function formatPvcPanelPriceSummary(
  prices: Record<PvcFencePanelSize, number> | PvcPanelPriceMap,
): string {
  return PVC_FENCE_PANEL_SPECS
    .map((spec) => {
      const price = prices[spec.label]
      return typeof price === 'number' && Number.isFinite(price)
        ? `${spec.label}: ${price} each`
        : `${spec.label}: No data`
    })
    .join(', ')
}

export function formatPvcPriceDisplay(params: {
  mode?: string | null
  panelPrices?: Record<PvcFencePanelSize, number> | PvcPanelPriceMap | null
  unitPrice?: number | null
}): string {
  if (params.mode === 'per_m') {
    return typeof params.unitPrice === 'number' && Number.isFinite(params.unitPrice)
      ? `${params.unitPrice} per m`
      : 'No data'
  }

  return params.panelPrices
    ? formatPvcPanelPriceSummary(params.panelPrices)
    : 'No data'
}

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
  pvcPricingMode?: PvcPricingMode
  unitConversionFactor?: number
  unitConversionNote?: string
  unitQuantity?: number
  bagWeightKg?: number
  pvcPanelPrices?: Partial<Record<PvcFencePanelSize, number>>
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

  if (
    typeof item.unitConversionFactor === 'number' &&
    Number.isFinite(item.unitConversionFactor) &&
    item.unitConversionFactor > 0
  ) {
    return item.unitPrice / item.unitConversionFactor
  }

  return item.unitPrice
}

export function baseCalculationUnitForPricingKey(
  pricingKey: string | null | undefined,
): string {
  if (isLabourPricingKey(pricingKey)) return 'one brick'

  switch (pricingKey) {
    case 'standard_brick':
      return 'one brick'
    case 'mortar':
      return 'one mortar pricing unit used by the calculator'
    case 'timber_fence':
      return 'one metre'
    case 'pvc_fence':
      return 'one panel'
    default:
      return 'one calculator unit'
  }
}

export function defaultUnitForPricingKey(
  pricingKey: string | null | undefined,
): string {
  switch (pricingKey) {
    case 'mortar':
      return 'per_bag'
    case 'timber_fence':
      return 'm'
    case 'pvc_fence':
      return 'each'
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

export function selectPvcFencePanel(widthM: number):
  | (typeof PVC_FENCE_PANEL_SPECS)[number]
  | undefined {
  if (!Number.isFinite(widthM) || widthM <= 0) return undefined

  return PVC_FENCE_PANEL_SPECS.find((spec) => widthM <= spec.maxWidthM + 0.001)
}

export function calculatePvcFencePanelCounts(
  bayWidthsM: number[],
): Partial<Record<PvcFencePanelSize, number>> {
  const counts: Partial<Record<PvcFencePanelSize, number>> = {}

  for (const widthM of bayWidthsM) {
    const panel = selectPvcFencePanel(widthM)
    if (!panel) continue
    counts[panel.label] = (counts[panel.label] ?? 0) + 1
  }

  return counts
}

export function calculatePvcFenceCost(params: {
  bayWidthsM: number[]
  fallbackLengthM: number
  prices: PricingMap
}): number {
  const pvcPrice = params.prices.pvc_fence
  if (pvcPrice.pvcPricingMode === 'per_m' || pvcPrice.unit === 'm') {
    const pricedLength =
      params.bayWidthsM.length > 0
        ? params.bayWidthsM.reduce((sum, width) => sum + width, 0)
        : params.fallbackLengthM

    return pricedLength * normalizeUnitPrice(pvcPrice)
  }

  const panelCounts = calculatePvcFencePanelCounts(params.bayWidthsM)
  const normalizedPanelPrices = normalizePvcPanelPrices(
    pvcPrice.pvcPanelPrices,
    pvcPrice.unitPrice,
  ).prices
  const panelCost = Object.entries(panelCounts).reduce((sum, [size, count]) => {
    const unitPrice = normalizedPanelPrices[size as PvcFencePanelSize]

    return sum + (count ?? 0) * unitPrice
  }, 0)

  if (panelCost > 0) return panelCost

  return params.fallbackLengthM * normalizeUnitPrice(params.prices.pvc_fence)
}

export function calculateCostPricing(params: {
  brickCount: number
  mortarVolumeM3: number
  renderedLengthM: number
  renderedHeightM: number
  bondPattern: string
  timberFence: string
  infillBayWidthsM?: number[]
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
      ? calculatePvcFenceCost({
        bayWidthsM: params.infillBayWidthsM ?? [],
        fallbackLengthM: params.renderedLengthM,
        prices: params.prices,
      })
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
