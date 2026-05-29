import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'

import {
  type PricingItem,
  defaultPricingMap,
  isPricingKey,
  normalizePvcPanelPrices,
} from '../../pricing'
import {
  getRelationshipID,
  normalizeSupplierUnitPrice,
} from '../../supplierPricing'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

type PricingItemDoc = {
  key?: string | null
  name?: string | null
  unit?: string | null
  pvcPricingMode?: 'panel' | 'per_m' | null
  unitConversionFactor?: number | null
  unitConversionNote?: string | null
  unitQuantity?: number | null
  customUnit?: string | null
  bagWeightKg?: number | null
  unitPrice?: number | null
  priceSource?: 'manual' | 'average' | 'supplier' | null
  selectedSupplierPriceSource?:
    | number
    | string
    | { id?: number | string }
    | null
  manualUnitPrice?: number | null
  pvcPanelPrices?: {
    fourFt?: number | null
    fiveFt?: number | null
    sixFt?: number | null
    eightFt?: number | null
    tenFt?: number | null
  } | null
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
      const pricingKey = doc.key === 'timber_fence' ? 'timber_screening_slat' : doc.key

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
              pricingKey,
              unit: supplierSource.unit,
              unitConversionFactor: supplierSource.unitConversionFactor,
              unitQuantity: supplierSource.unitQuantity,
              unitPrice: supplierSource.lastPrice,
            })
            if (pricingKey === 'pvc_fence') {
              doc.pvcPricingMode = supplierSource.pvcPricingMode ?? doc.pvcPricingMode
              doc.unit = supplierSource.unit ?? doc.unit
              if (supplierSource.pvcPanelPrices) {
                doc.pvcPanelPrices = supplierSource.pvcPanelPrices
              }
            }
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
      const shouldExposeUnitConversion =
        doc.priceSource !== 'supplier' &&
        doc.priceSource !== 'average' &&
        typeof manualPrice === 'number'

      prices[pricingKey] = {
        key: pricingKey,
        name: doc.name || prices[pricingKey].name,
        unit:
          doc.unit === 'custom'
            ? doc.customUnit || doc.unit
            : doc.unit || prices[pricingKey].unit,
        unitQuantity:
          typeof doc.unitQuantity === 'number'
            ? doc.unitQuantity
            : prices[pricingKey].unitQuantity,
        unitConversionFactor:
          shouldExposeUnitConversion && typeof doc.unitConversionFactor === 'number'
            ? doc.unitConversionFactor
            : prices[pricingKey].unitConversionFactor,
        unitConversionNote:
          shouldExposeUnitConversion
            ? doc.unitConversionNote || prices[pricingKey].unitConversionNote
            : prices[pricingKey].unitConversionNote,
        unitPrice,
        pvcPricingMode:
          pricingKey === 'pvc_fence'
            ? doc.pvcPricingMode ?? (doc.unit === 'm' ? 'per_m' : 'panel')
            : prices[pricingKey].pvcPricingMode,
        bagWeightKg:
          typeof doc.bagWeightKg === 'number'
            ? doc.bagWeightKg
            : prices[pricingKey].bagWeightKg,
        pvcPanelPrices:
          pricingKey === 'pvc_fence'
            ? normalizePvcPanelPrices(
              {
                '4ft': doc.pvcPanelPrices?.fourFt ?? undefined,
                '5ft': doc.pvcPanelPrices?.fiveFt ?? undefined,
                '6ft': doc.pvcPanelPrices?.sixFt ?? undefined,
                '8ft': doc.pvcPanelPrices?.eightFt ?? undefined,
                '10ft': doc.pvcPanelPrices?.tenFt ?? undefined,
              },
              unitPrice,
            ).prices
            : prices[pricingKey].pvcPanelPrices,
        currency: doc.currency || prices[pricingKey].currency,
      } satisfies PricingItem
    }

    source = 'cms'
  } catch {
    source = 'default'
  }

  return NextResponse.json({
    prices,
    source,
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Expires: '0',
      Pragma: 'no-cache',
    },
  })
}
