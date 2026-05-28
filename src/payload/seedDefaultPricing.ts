import type { Payload } from 'payload'

import {
  DEFAULT_PRICING_ITEMS,
  LABOUR_PRICING_KEYS,
  type LabourPricingKey,
} from '../pricing'

const DEFAULT_LABOUR_PRICING_KEYS = LABOUR_PRICING_KEYS.filter(
  (key): key is Exclude<LabourPricingKey, 'labour'> => key !== 'labour',
)

export async function seedDefaultPricingItems(payload: Payload): Promise<void> {
  for (const key of DEFAULT_LABOUR_PRICING_KEYS) {
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

    await payload.create({
      collection: 'pricing-items',
      overrideAccess: true,
      data: {
        category: 'labour',
        key,
        priceSource: 'manual',
        unit: 'per_brick',
        manualUnitPrice: defaultItem.unitPrice,
        currency: defaultItem.currency,
        isActive: true,
        notes:
          'Seeded default labour cost. Update this price to match company rates.',
      },
    })
  }
}
