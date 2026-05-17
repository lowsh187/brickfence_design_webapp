import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'

import {
  type PricingItem,
  defaultPricingMap,
  isPricingKey,
} from '../../pricing'
import {
  getRelationshipID,
  normalizeSupplierUnitPrice,
} from '../../supplierPricing'

type PricingItemDoc = {
  key?: string | null
  name?: string | null
  unit?: string | null
  unitPrice?: number | null
  priceSource?: 'manual' | 'average' | 'supplier' | null
  selectedSupplierPriceSource?:
    | number
    | string
    | { id?: number | string }
    | null
  manualUnitPrice?: number | null
  autoAverageUnitPrice?: number | null
  selectedSupplierUnitPrice?: number | null
  effectiveUnitPrice?: number | null
  currency?: string | null
}

export async function GET() {
  const prices = defaultPricingMap()
  let source: 'cms' | 'default' = 'default'

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured')
    }

    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'pricing-items',
      depth: 0,
      limit: 100,
      pagination: false,
      where: {
        isActive: {
          equals: true,
        },
      },
    })

    for (const doc of result.docs as PricingItemDoc[]) {
      if (!isPricingKey(doc.key)) continue

      const manualPrice =
        typeof doc.manualUnitPrice === 'number'
          ? doc.manualUnitPrice
          : typeof doc.unitPrice === 'number'
            ? doc.unitPrice
            : undefined
      const averagePrice =
        typeof doc.autoAverageUnitPrice === 'number'
          ? doc.autoAverageUnitPrice
          : undefined
      const cachedSupplierPrice =
        typeof doc.selectedSupplierUnitPrice === 'number'
          ? doc.selectedSupplierUnitPrice
          : undefined
      const effectivePrice =
        typeof doc.effectiveUnitPrice === 'number'
          ? doc.effectiveUnitPrice
          : undefined
      let supplierPrice: number | undefined
      const selectedSupplierID = getRelationshipID(doc.selectedSupplierPriceSource)

      if (doc.priceSource === 'supplier' && selectedSupplierID) {
        try {
          const supplierSource = await payload.findByID({
            collection: 'supplier-price-sources',
            id: selectedSupplierID,
            depth: 0,
            overrideAccess: true,
          })

          if (
            supplierSource.pricingKey === doc.key &&
            supplierSource.lastStatus === 'success' &&
            typeof supplierSource.lastPrice === 'number'
          ) {
            supplierPrice = normalizeSupplierUnitPrice({
              pricingKey: doc.key,
              unit: supplierSource.unit,
              unitPrice: supplierSource.lastPrice,
            })
          }
        } catch {
          supplierPrice = undefined
        }
      }

      const unitPrice =
        doc.priceSource === 'supplier'
          ? supplierPrice ??
            cachedSupplierPrice ??
            averagePrice ??
            manualPrice ??
            effectivePrice
          : doc.priceSource === 'average'
          ? averagePrice ?? manualPrice ?? effectivePrice
          : manualPrice ?? averagePrice ?? effectivePrice

      if (typeof unitPrice !== 'number') continue

      prices[doc.key] = {
        key: doc.key,
        name: doc.name || prices[doc.key].name,
        unit: doc.unit || prices[doc.key].unit,
        unitPrice,
        currency: doc.currency || prices[doc.key].currency,
      } satisfies PricingItem
    }

    source = 'cms'
  } catch {
    source = 'default'
  }

  return NextResponse.json({
    prices,
    source,
  })
}
