import type { Payload } from 'payload'

import {
  DEFAULT_PRICING_ITEMS,
  LABOUR_PRICING_KEYS,
  type PricingKey,
  type LabourPricingKey,
} from '../pricing'

const DEFAULT_LABOUR_PRICING_KEYS = LABOUR_PRICING_KEYS.filter(
  (key): key is Exclude<LabourPricingKey, 'labour'> => key !== 'labour',
)

const DEFAULT_MATERIAL_PRICING_KEYS = [
  'mortar',
  'standard_brick',
  'custom_brick',
  'timber_picket',
  'timber_screening_slat',
  'pvc_fence',
] as const satisfies readonly PricingKey[]

const CATEGORY_BY_PRICING_KEY: Record<(typeof DEFAULT_MATERIAL_PRICING_KEYS)[number], string> = {
  mortar: 'mortar',
  standard_brick: 'brick',
  custom_brick: 'brick',
  timber_picket: 'infill',
  timber_screening_slat: 'infill',
  pvc_fence: 'infill',
}

const DEFAULT_PRICING_KEYS_TO_SEED = [
  ...DEFAULT_LABOUR_PRICING_KEYS,
  ...DEFAULT_MATERIAL_PRICING_KEYS,
] as const

export async function seedDefaultPricingItems(payload: Payload): Promise<void> {
  for (const key of DEFAULT_PRICING_KEYS_TO_SEED) {
    const existing = await payload.find({
      collection: 'pricing-items',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        key: {
          equals: key,
        },
      },
    })

    if (existing.docs.length > 0) continue

    const defaultItem = DEFAULT_PRICING_ITEMS[key]
    const isLabour = DEFAULT_LABOUR_PRICING_KEYS.includes(key as Exclude<LabourPricingKey, 'labour'>)

    await payload.create({
      collection: 'pricing-items',
      overrideAccess: true,
      data: {
        category: isLabour
          ? 'labour'
          : CATEGORY_BY_PRICING_KEY[key as (typeof DEFAULT_MATERIAL_PRICING_KEYS)[number]],
        key,
        priceSource: 'manual',
        unit: defaultItem.unit,
        manualUnitPrice: defaultItem.unitPrice,
        bagWeightKg: key === 'mortar' ? defaultItem.bagWeightKg : undefined,
        pvcPricingMode: key === 'pvc_fence' ? defaultItem.pvcPricingMode : undefined,
        currency: defaultItem.currency,
        isActive: true,
        notes:
          isLabour
            ? 'Seeded default labour cost. Update this price to match company rates.'
            : 'Seeded default material price. Update this price to match company rates.',
      },
    })
  }
}
